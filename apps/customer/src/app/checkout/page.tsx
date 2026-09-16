"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@cho-online/firebase";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  updateDoc,
  increment,
  getDocs,
} from "firebase/firestore";
import { useCartStore } from "@/store/useCartStore";

const MAX_SHIPPING_FEE = 50000;
const MAX_COD_THRESHOLD = 300000;
const POINTS_EXPIRE_DAYS = 90;

interface ShippingOptions {
  distanceKm: number;
  isRaining?: boolean;
  orderTime?: Date;
}

interface Coordinates {
  lat: number;
  lng: number;
}

interface MerchantSnapshot {
  id: string;
  merchantCode?: string;
  shopName: string;
  address: string;
  phone: string;
  coordinates: Coordinates;
}

const isValidCoordinate = (value: unknown, min: number, max: number) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= min && numberValue <= max;
};

const normalizeCoordinates = (
  latValue: unknown,
  lngValue: unknown
): Coordinates | null => {
  const lat = Number(latValue);
  const lng = Number(lngValue);

  if (
    !isValidCoordinate(lat, -90, 90) ||
    !isValidCoordinate(lng, -180, 180)
  ) {
    return null;
  }

  return { lat, lng };
};

const calculateHaversineKm = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const R = 6371.0088;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const formatDistanceFromKm = (distanceKm: number): string => {
  if (!Number.isFinite(distanceKm)) return "Chưa xác định";

  if (distanceKm < 1) {
    return `${Math.max(100, Math.round(distanceKm * 1000))}m`;
  }

  return `${distanceKm.toFixed(2)} km`;
};

// 🚚 Tính phí ship cơ bản (1km đầu = 14.000đ, từ km thứ 2 trở đi mỗi km +4.000đ)
const calculateBaseShippingFee = ({ distanceKm }: ShippingOptions): number => {
  const safeDistanceKm = Math.max(0, Number(distanceKm) || 0);

  let baseFee = 14000;

  if (safeDistanceKm > 1) {
    const extraKm = Math.ceil(safeDistanceKm - 1);
    baseFee = 14000 + extraKm * 4000;
  }

  return Math.min(baseFee, MAX_SHIPPING_FEE);
};

// 🌧️ Tính riêng phụ phí thời tiết xấu (mưa)
const calculateRainFee = (isRaining = false): number => {
  return isRaining ? 3000 : 0;
};

// ⏰ Tính riêng phụ phí giờ cao điểm / giờ đêm
const calculatePeakHourFee = (orderTime = new Date()): number => {
  const hour = orderTime.getHours();
  if (hour >= 11 && hour < 13) {
    return 3000;
  } else if (hour >= 18 && hour < 22) {
    return 3000;
  } else if (hour >= 22 || hour < 5) {
    return 7000;
  }
  return 0;
};

const calculateEarnedPoints = (subTotal: number): number => {
  if (subTotal <= 0) return 0;
  return Math.floor(subTotal / 1000);
};

interface Voucher {
  id: string;
  code: string;
  title: string;
  description?: string;
  applyType: "ORDER" | "SHIPPING";
  discountType: "FIXED" | "PERCENTAGE";
  discountValue: number;
  maxDiscount?: number | null;
  minOrder?: number | null;
  usageLimit?: number | null;
  usedCount?: number;
  startDate?: string | null;
  endDate?: string | null;
  isActive?: boolean;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, selectedMerchantId, clearCart, clearMerchantItems } = useCartStore();

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const checkoutItems = useMemo(() => {
    if (!selectedMerchantId) return items;

    return items.filter((item: any) => {
      const prod = item.product || item;
      const itemMerchantId =
        prod.merchantId || prod.merchantCode || prod.shopId || "default_merchant";
      return itemMerchantId === selectedMerchantId;
    });
  }, [items, selectedMerchantId]);

  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [fullName, setFullName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "banking">("cod");
  const [loading, setLoading] = useState(false);

  // 📍 Tọa độ giao hàng thật của khách.
  // Ưu tiên users.location / users.lat-lng, sau đó localStorage user_shipping_info.
  const [customerCoordinates, setCustomerCoordinates] = useState<Coordinates | null>(null);

  // 🏪 Snapshot hiện tại của merchant.
  const [merchantSnapshot, setMerchantSnapshot] = useState<MerchantSnapshot | null>(null);
  const [merchantLoading, setMerchantLoading] = useState(true);

  const [isRaining, setIsRaining] = useState(false);
  const [weatherLoading, setWeatherLoading] = useState(true);

  const [userPoints, setUserPoints] = useState(0);
  const [usePoints, setUsePoints] = useState(false);
  const [showItemsList, setShowItemsList] = useState(false);
  const [showFeeModal, setShowFeeModal] = useState(false);

  const [availableVouchers, setAvailableVouchers] = useState<Voucher[]>([]);
  const [selectedShippingVoucher, setSelectedShippingVoucher] = useState<Voucher | null>(null);
  const [selectedShopVoucher, setSelectedShopVoucher] = useState<Voucher | null>(null);

  const [inputVoucherCode, setInputVoucherCode] = useState("");
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState<"ALL" | "SHIPPING" | "ORDER">("ALL");

  const firstProduct = (checkoutItems[0]?.product || checkoutItems[0] || {}) as any;

  const checkoutMerchantId =
    selectedMerchantId ||
    firstProduct?.merchantId ||
    firstProduct?.shopId ||
    "";

  // 🌤️ Tự động kiểm tra thời tiết tại chính vị trí của quán.
  // Không dùng tọa độ Hà Tĩnh cố định.
  useEffect(() => {
    const checkMerchantWeather = async () => {
      if (!merchantSnapshot?.coordinates) {
        setWeatherLoading(true);
        setIsRaining(false);
        return;
      }

      const { lat, lng } = merchantSnapshot.coordinates;

      try {
        setWeatherLoading(true);

        console.groupCollapsed("🌤️ [CHECKOUT] Weather source");
        console.log("Merchant:", {
          merchantId: merchantSnapshot.id,
          shopName: merchantSnapshot.shopName,
        });
        console.log("Weather coordinates:", { lat, lng });
        console.log("Weather source:", "merchant.coordinates");
        console.groupEnd();

        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=rain,weather_code`
        );

        if (!res.ok) {
          throw new Error(`Weather API HTTP ${res.status}`);
        }

        const data = await res.json();

        const rainAmount = Number(data?.current?.rain) || 0;
        const code = Number(data?.current?.weather_code) || 0;
        const isRainyCode =
          (code >= 51 && code <= 67) ||
          (code >= 80 && code <= 82) ||
          code >= 95;

        const raining = rainAmount > 0 || isRainyCode;
        setIsRaining(raining);

        console.groupCollapsed("🌧️ [CHECKOUT] Weather result");
        console.log("Merchant coordinates:", { lat, lng });
        console.log("rain amount:", rainAmount);
        console.log("weather code:", code);
        console.log("isRaining:", raining);
        console.groupEnd();
      } catch (err) {
        console.warn("⚠️ Không thể lấy thời tiết tại vị trí quán:", err);
        setIsRaining(false);
      } finally {
        setWeatherLoading(false);
      }
    };

    checkMerchantWeather();
  }, [merchantSnapshot]);

  // 🟢 Xác thực người dùng + lấy địa chỉ và tọa độ thật
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        useCartStore.getState().setUserId(null);
        router.replace("/login?redirectTo=/checkout");
        setAuthLoading(false);
        return;
      }

      setUser(currentUser);
      useCartStore.getState().setUserId(currentUser.uid);

      if (currentUser.displayName) setFullName(currentUser.displayName);

      try {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        const userData = userDoc.exists() ? userDoc.data() : null;

        let resolvedLocation: Coordinates | null = null;
        let customerLocationSource = "NONE";

        if (userDoc.exists()) {
          const data = userDoc.data();

          console.group("👤 [CHECKOUT] USER FIRESTORE");
          console.log("User UID:", currentUser.uid);
          console.log("Raw user data:", data);
          console.log("users.location:", data.location);
          console.log("users.lat:", data.lat);
          console.log("users.lng:", data.lng);
          console.log("users.latitude:", data.latitude);
          console.log("users.longitude:", data.longitude);
          console.groupEnd();

          if (data.name || data.fullName) {
            setFullName(data.name || data.fullName);
          }

          if (data.phone) {
            setPhone(data.phone);
          }

          if (data.address) {
            setAddress(data.address);
          }

          if (data.points !== undefined && data.points !== null) {
            setUserPoints(Number(data.points) || 0);
          }

          resolvedLocation = normalizeCoordinates(
            data.location?.latitude,
            data.location?.longitude
          );

          if (resolvedLocation) {
            customerLocationSource = "users.location";
          } else {
            resolvedLocation =
              normalizeCoordinates(data.lat, data.lng) ||
              normalizeCoordinates(data.latitude, data.longitude);

            if (resolvedLocation) {
              customerLocationSource = "users.lat/lng";
            }
          }

          console.log("📍 [CHECKOUT] Resolved customer location:", resolvedLocation);
          console.log("📍 [CHECKOUT] Customer location source:", customerLocationSource);
        }

        // Fallback sang localStorage vì profile flow của bạn cũng lưu user_shipping_info.
        if (!resolvedLocation && typeof window !== "undefined") {
          const localData = localStorage.getItem("user_shipping_info");

          if (localData) {
            try {
              const parsed = JSON.parse(localData);

              if (!address && parsed.address) setAddress(parsed.address);
              if (!fullName && (parsed.fullName || parsed.name)) {
                setFullName(parsed.fullName || parsed.name);
              }
              if (!phone && parsed.phone) setPhone(parsed.phone);

              resolvedLocation =
                normalizeCoordinates(
                  parsed.location?.latitude,
                  parsed.location?.longitude
                );

              if (resolvedLocation) {
                customerLocationSource = "localStorage.location";
              } else {
                resolvedLocation =
                  normalizeCoordinates(parsed.location?.lat, parsed.location?.lng) ||
                  normalizeCoordinates(parsed.lat, parsed.lng) ||
                  normalizeCoordinates(parsed.latitude, parsed.longitude);

                if (resolvedLocation) {
                  customerLocationSource = "localStorage.lat/lng";
                }
              }
            } catch (localError) {
              console.warn("⚠️ Không thể đọc user_shipping_info:", localError);
            }
          }
        }

        if (!resolvedLocation && currentUser.phoneNumber) {
          setPhone((prev) => prev || currentUser.phoneNumber || "");
        }

        setCustomerCoordinates(resolvedLocation);

        console.groupCollapsed("📍 [CHECKOUT] Customer location source");
        console.log("userId:", currentUser.uid);
        console.log("address:", userData?.address || "");
        console.log("Firebase user.location:", userData?.location || null);
        console.log("Firebase user.lat/lng:", userData ? {
          lat: userData.lat,
          lng: userData.lng,
        } : null);
        console.log("Resolved customer coordinates:", resolvedLocation);
        console.log("Coordinate source:", customerLocationSource);
        console.groupEnd();
      } catch (err) {
        console.error("Lỗi lấy thông tin giao hàng:", err);
      }

      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  // 🏪 Lấy merchant hiện tại làm SOURCE OF TRUTH.
  // Không còn dùng tọa độ cũ từ product snapshot để tạo order.
  useEffect(() => {
    let cancelled = false;

    const fetchMerchant = async () => {
      if (!checkoutMerchantId) {
        setMerchantSnapshot(null);
        setMerchantLoading(false);
        return;
      }

      setMerchantLoading(true);

      try {
        console.groupCollapsed("🛒 [CHECKOUT] Merchant ID source");
        console.log("selectedMerchantId:", selectedMerchantId);
        console.log("firstProduct.merchantId:", firstProduct?.merchantId);
        console.log("firstProduct.shopId:", firstProduct?.shopId);
        console.log("checkoutMerchantId:", checkoutMerchantId);
        console.groupEnd();

        const merchantSnap = await getDoc(doc(db, "merchants", checkoutMerchantId));

        if (!merchantSnap.exists()) {
          throw new Error(`Không tìm thấy cửa hàng với ID: ${checkoutMerchantId}`);
        }

        const data = merchantSnap.data();

        const coordinates =
          normalizeCoordinates(
            data.pickupLocation?.latitude,
            data.pickupLocation?.longitude
          ) ||
          normalizeCoordinates(data.lat, data.lng) ||
          normalizeCoordinates(data.latitude, data.longitude);

        if (!coordinates) {
          throw new Error("Cửa hàng chưa có tọa độ GPS hợp lệ.");
        }

        const snapshot: MerchantSnapshot = {
          id: merchantSnap.id,
          merchantCode: data.merchantCode || firstProduct?.merchantCode || "",
          shopName:
            data.shopName ||
            data.storeName ||
            data.name ||
            firstProduct?.merchantName ||
            firstProduct?.shopName ||
            "Cửa hàng",
          address:
            data.address ||
            data.storeAddress ||
            data.shopAddress ||
            data.merchantAddress ||
            "",
          phone:
            data.phone ||
            data.phoneNumber ||
            data.storePhone ||
            data.shopPhone ||
            data.merchantPhone ||
            "",
          coordinates,
        };

        console.groupCollapsed("🏪 [CHECKOUT] Merchant source");
        console.log("Firestore path:", `merchants/${merchantSnap.id}`);
        console.log("Raw merchant coordinates:", {
          pickupLocation: data.pickupLocation || null,
          lat: data.lat,
          lng: data.lng,
          latitude: data.latitude,
          longitude: data.longitude,
        });
        console.log("Resolved coordinates:", coordinates);
        console.log("Resolved merchant snapshot:", snapshot);
        console.groupEnd();

        if (!cancelled) setMerchantSnapshot(snapshot);
      } catch (error) {
        console.error("❌ [CHECKOUT] Lỗi lấy thông tin merchant hiện tại:", {
          merchantId: checkoutMerchantId,
          error,
        });
        if (!cancelled) setMerchantSnapshot(null);
      } finally {
        if (!cancelled) setMerchantLoading(false);
      }
    };

    fetchMerchant();

    return () => {
      cancelled = true;
    };
  }, [checkoutMerchantId]);

  // Voucher
  useEffect(() => {
    const fetchVouchers = async () => {
      try {
        const currentShopId = checkoutMerchantId;
        const querySnapshot = await getDocs(collection(db, "vouchers"));
        const list: Voucher[] = [];
        const now = new Date();

        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const isShippingVoucher =
            String(data.applyType || "").toUpperCase() === "SHIPPING";
          const isMatchingShop = !data.merchantId || data.merchantId === currentShopId;

          if (!isShippingVoucher && !isMatchingShop) return;

          const discountTypeUpper = String(data.discountType || "FIXED").toUpperCase();

          const v: Voucher = {
            id: docSnap.id,
            code: data.code || "",
            title: data.title || "",
            description: data.description || "",
            applyType: (data.applyType || "ORDER").toUpperCase() as
              | "ORDER"
              | "SHIPPING",
            discountType:
              discountTypeUpper.includes("PERCENT") || discountTypeUpper === "PERCENTAGE"
                ? "PERCENTAGE"
                : "FIXED",
            discountValue: Number(data.discountValue || data.value || 0),
            maxDiscount: data.maxDiscount ? Number(data.maxDiscount) : null,
            minOrder: data.minOrder ? Number(data.minOrder) : null,
            usageLimit: data.usageLimit ? Number(data.usageLimit) : null,
            usedCount: Number(data.usedCount || 0),
            startDate: data.startDate || null,
            endDate: data.endDate || null,
            isActive: data.isActive !== false,
          };

          if (!v.isActive) return;

          if (v.startDate) {
            const start = new Date(v.startDate);
            if (!isNaN(start.getTime()) && start > now) return;
          }

          if (v.endDate) {
            const end = new Date(v.endDate);
            if (!isNaN(end.getTime()) && end < now) return;
          }

          if (v.usageLimit && (v.usedCount || 0) >= v.usageLimit) return;
          list.push(v);
        });

        setAvailableVouchers(list);
      } catch (error) {
        console.error("❌ Lỗi tải danh sách voucher:", error);
      }
    };

    if (checkoutItems.length > 0) fetchVouchers();
  }, [checkoutItems, checkoutMerchantId]);

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
};

/**
 * Tổng tiền thực tế khách phải trả cho sản phẩm.
 *
 * Quan trọng:
 * Dùng item.unitPrice vì cùng một product có thể có:
 * - 1 dòng SALE
 * - 1 dòng giá thường
 */
const rawTotalPrice = checkoutItems.reduce(
  (sum, item: any) => {
    const unitPrice =
      Number(item.unitPrice) ||
      Number(item.product?.price) ||
      0;

    const qty = Number(item.quantity) || 0;

    return sum + unitPrice * qty;
  },
  0
);

/**
 * Tổng giá trị theo giá gốc.
 *
 * Dùng originalPrice cho cả dòng SALE và dòng thường.
 */
const rawTotalCostPrice = checkoutItems.reduce(
  (sum, item: any) => {
    const originalPrice =
      Number(item.product?.originalPrice) ||
      Number(item.product?.price) ||
      Number(item.unitPrice) ||
      0;

    const qty = Number(item.quantity) || 0;

    return sum + originalPrice * qty;
  },
  0
);

  // 📍 Khoảng cách chỉ được tính từ tọa độ merchant hiện tại + tọa độ khách hiện tại.
  // Không dùng product.distance làm nguồn dữ liệu cuối cùng.
  const calculatedDistanceKm =
    merchantSnapshot && customerCoordinates
      ? calculateHaversineKm(
        merchantSnapshot.coordinates.lat,
        merchantSnapshot.coordinates.lng,
        customerCoordinates.lat,
        customerCoordinates.lng
      )
      : null;

  const parsedDistanceInKm =
    calculatedDistanceKm !== null && Number.isFinite(calculatedDistanceKm)
      ? calculatedDistanceKm
      : 0;

  const rawDistance =
    calculatedDistanceKm !== null && Number.isFinite(calculatedDistanceKm)
      ? formatDistanceFromKm(calculatedDistanceKm)
      : "Chưa xác định";

  useEffect(() => {
    console.groupCollapsed("📏 [CHECKOUT] Distance source");
    console.log("Merchant:", merchantSnapshot
      ? {
        id: merchantSnapshot.id,
        shopName: merchantSnapshot.shopName,
        lat: merchantSnapshot.coordinates.lat,
        lng: merchantSnapshot.coordinates.lng,
      }
      : null
    );
    console.log("Customer:", customerCoordinates);
    console.log("Calculated Haversine km:", calculatedDistanceKm);
    console.log("Displayed distance:", rawDistance);
    console.groupEnd();
  }, [merchantSnapshot, customerCoordinates, calculatedDistanceKm, rawDistance]);

  const currentOrderTime = new Date();

  const baseShippingFee = calculateBaseShippingFee({
    distanceKm: parsedDistanceInKm,
  });

  const rainFee = calculateRainFee(isRaining);
  const peakHourFee = calculatePeakHourFee(currentOrderTime);
  const totalAppliedFee = rainFee + peakHourFee;

  // Trần 50.000đ áp dụng cho tổng phí ship, bao gồm phụ phí.
  const initialShippingFee = Math.min(
    MAX_SHIPPING_FEE,
    baseShippingFee + totalAppliedFee
  );

  let shippingDiscountAmount = 0;
  if (selectedShippingVoucher) {
    if (selectedShippingVoucher.discountType === "FIXED") {
      shippingDiscountAmount = Math.min(
        selectedShippingVoucher.discountValue,
        initialShippingFee
      );
    } else if (selectedShippingVoucher.discountType === "PERCENTAGE") {
      let calc =
        (initialShippingFee * selectedShippingVoucher.discountValue) / 100;
      if (selectedShippingVoucher.maxDiscount) {
        calc = Math.min(calc, selectedShippingVoucher.maxDiscount);
      }
      shippingDiscountAmount = Math.min(calc, initialShippingFee);
    }
  }

  const finalShippingFee = Math.max(
    0,
    initialShippingFee - shippingDiscountAmount
  );

  let shopDiscountAmount = 0;
  if (selectedShopVoucher) {
    if (selectedShopVoucher.discountType === "FIXED") {
      shopDiscountAmount = Math.min(
        selectedShopVoucher.discountValue,
        rawTotalPrice
      );
    } else if (selectedShopVoucher.discountType === "PERCENTAGE") {
      let calc =
        (rawTotalPrice * selectedShopVoucher.discountValue) / 100;
      if (selectedShopVoucher.maxDiscount) {
        calc = Math.min(calc, selectedShopVoucher.maxDiscount);
      }
      shopDiscountAmount = Math.min(calc, rawTotalPrice);
    }
  }

  const earnedPoints = calculateEarnedPoints(rawTotalPrice);
  const tempTotal = Math.max(
    0,
    rawTotalPrice + finalShippingFee - shopDiscountAmount
  );

  const maxPointsDiscountVnd = userPoints * 10;
  const discountFromPoints = usePoints
    ? Math.min(maxPointsDiscountVnd, tempTotal)
    : 0;
  const pointsUsed = usePoints ? Math.ceil(discountFromPoints / 10) : 0;

  const finalTotalPrice = Math.max(0, tempTotal - discountFromPoints);
  const isCodDisabled = finalTotalPrice > MAX_COD_THRESHOLD;

  useEffect(() => {
    if (isCodDisabled && paymentMethod === "cod") {
      setPaymentMethod("banking");
    }
  }, [isCodDisabled, paymentMethod]);

  const handleApplyCode = () => {
    if (!inputVoucherCode.trim()) return;

    const found = availableVouchers.find(
      (v) => v.code.toUpperCase() === inputVoucherCode.trim().toUpperCase()
    );

    if (!found) {
      alert("❌ Mã giảm giá không hợp lệ hoặc đã hết hạn!");
      return;
    }

    if (found.minOrder && rawTotalPrice < found.minOrder) {
      alert(
        `⚠️ Đơn hàng tối thiểu để áp dụng mã này là ${formatCurrency(
          found.minOrder
        )}`
      );
      return;
    }

    if (found.applyType === "SHIPPING") {
      setSelectedShippingVoucher(found);
    } else {
      setSelectedShopVoucher(found);
    }

    setShowVoucherModal(false);
    setInputVoucherCode("");
  };

  const handleSelectVoucher = (v: Voucher) => {
    if (v.minOrder && rawTotalPrice < v.minOrder) {
      alert(
        `⚠️ Đơn hàng tối thiểu để áp dụng mã này là ${formatCurrency(
          v.minOrder
        )}`
      );
      return;
    }

    if (v.applyType === "SHIPPING") {
      setSelectedShippingVoucher(
        selectedShippingVoucher?.id === v.id ? null : v
      );
    } else {
      setSelectedShopVoucher(selectedShopVoucher?.id === v.id ? null : v);
    }
  };

  const handleOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (checkoutItems.length === 0 || !user) return;

    if (!address.trim()) {
      alert("Bạn chưa cập nhật địa chỉ giao hàng!");
      router.push("/profile");
      return;
    }

    if (!customerCoordinates) {
      console.error("❌ [CHECKOUT] Customer coordinates missing", {
        address,
        userId: user.uid,
      });
      alert(
        "⚠️ Địa chỉ giao hàng chưa có tọa độ GPS. Vui lòng vào Hồ sơ, chọn/lưu lại địa chỉ giao hàng rồi thử lại."
      );
      router.push("/profile");
      return;
    }

    if (paymentMethod === "cod" && isCodDisabled) {
      alert(
        "⚠️ Đơn hàng trên 300.000đ chỉ hỗ trợ thanh toán qua Chuyển khoản QR!"
      );
      setPaymentMethod("banking");
      return;
    }

    if (merchantLoading) {
      alert("⏳ Đang lấy thông tin cửa hàng. Vui lòng thử lại sau giây lát.");
      return;
    }

    if (!merchantSnapshot) {
      alert(
        "❌ Không thể lấy tọa độ cửa hàng hiện tại. Vui lòng thử lại hoặc liên hệ hỗ trợ."
      );
      return;
    }

    setLoading(true);

    try {
      // SOURCE OF TRUTH: merchants/{merchantId}, không lấy lat/lng từ product snapshot.
      const merchantId = merchantSnapshot.id;
      const merchantCode =
        merchantSnapshot.merchantCode || firstProduct?.merchantCode || "";
      const shopName = merchantSnapshot.shopName;
      const storeAddress = merchantSnapshot.address;
      const storePhone = merchantSnapshot.phone;
      const storeLat = merchantSnapshot.coordinates.lat;
      const storeLng = merchantSnapshot.coordinates.lng;

      // SOURCE OF TRUTH: tọa độ khách đã lưu trong users/localStorage.
      const customerLat = customerCoordinates.lat;
      const customerLng = customerCoordinates.lng;

      // Tính lại khoảng cách tại thời điểm tạo đơn.
      const orderDistanceKm = calculateHaversineKm(
        storeLat,
        storeLng,
        customerLat,
        customerLng
      );
      const orderDistanceStr = formatDistanceFromKm(orderDistanceKm);

      if (!Number.isFinite(orderDistanceKm)) {
        throw new Error("Khoảng cách giao hàng không hợp lệ.");
      }

      console.groupCollapsed("🧭 [CHECKOUT] Final route calculation");
      console.log("FROM - Merchant:", {
        merchantId,
        shopName,
        storeAddress,
        lat: storeLat,
        lng: storeLng,
      });
      console.log("TO - Customer:", {
        userId: user.uid,
        customerAddress: address,
        lat: customerLat,
        lng: customerLng,
      });
      console.log("Distance:", {
        distanceKm: orderDistanceKm,
        distanceStr: orderDistanceStr,
      });
      console.groupEnd();

      // Tính lại phí ship cuối cùng theo khoảng cách hiện tại.
      const orderBaseShippingFee = calculateBaseShippingFee({
        distanceKm: orderDistanceKm,
      });
      const orderInitialShippingFee = Math.min(
        MAX_SHIPPING_FEE,
        orderBaseShippingFee + rainFee + peakHourFee
      );

      let orderShippingDiscount = 0;

      if (selectedShippingVoucher) {
        if (selectedShippingVoucher.discountType === "FIXED") {
          orderShippingDiscount = Math.min(
            selectedShippingVoucher.discountValue,
            orderInitialShippingFee
          );
        } else {
          let calc =
            (orderInitialShippingFee * selectedShippingVoucher.discountValue) /
            100;

          if (selectedShippingVoucher.maxDiscount) {
            calc = Math.min(calc, selectedShippingVoucher.maxDiscount);
          }

          orderShippingDiscount = Math.min(calc, orderInitialShippingFee);
        }
      }

      const orderFinalShippingFee = Math.max(
        0,
        orderInitialShippingFee - orderShippingDiscount
      );

      // Tính lại tổng tiền theo chính dữ liệu được lưu vào order.
      const orderTempTotal = Math.max(
        0,
        rawTotalPrice + orderFinalShippingFee - shopDiscountAmount
      );
      const orderDiscountFromPoints = usePoints
        ? Math.min(maxPointsDiscountVnd, orderTempTotal)
        : 0;
      const orderPointsUsed = usePoints
        ? Math.ceil(orderDiscountFromPoints / 10)
        : 0;
      const orderFinalTotalPrice = Math.max(
        0,
        orderTempTotal - orderDiscountFromPoints
      );

      const finalCustomerName =
        fullName.trim() || user.displayName || "Khách hàng";
      const paymentCode = `DH${Math.floor(Date.now() / 1000)}`;

      const pointsExpiryDate = new Date();
      pointsExpiryDate.setDate(
        pointsExpiryDate.getDate() + POINTS_EXPIRE_DAYS
      );

      const newOrder = {
        userId: user.uid,
        customerName: finalCustomerName,
        recipientName: finalCustomerName,
        phone,
        address,
        customerAddress: address,
        note,
        paymentMethod,
        paymentCode,

        // 📍 Tọa độ giao hàng thật của khách.
        customerLat,
        customerLng,
        lat: customerLat,
        lng: customerLng,
        location: {
          latitude: customerLat,
          longitude: customerLng,
        },
        customerLocation: {
          latitude: customerLat,
          longitude: customerLng,
        },

        shipperNote: note.trim() ? note : "Số nhà 04",

        subTotalPrice: rawTotalPrice,
        subTotalCostPrice: rawTotalCostPrice,
        shippingFee: orderFinalShippingFee,
        baseShippingFee: orderBaseShippingFee,
        appliedFee: rainFee + peakHourFee,
        rainFee,
        peakHourFee,
        discountAmount:
          orderDiscountFromPoints + shopDiscountAmount + orderShippingDiscount,

        shippingVoucherCode: selectedShippingVoucher
          ? selectedShippingVoucher.code
          : null,
        shippingVoucherDiscount: orderShippingDiscount,

        shopVoucherCode: selectedShopVoucher
          ? selectedShopVoucher.code
          : null,
        shopVoucherDiscount: shopDiscountAmount,

        pointsUsed: orderPointsUsed,
        pointsEarned: earnedPoints,
        pointsExpiresAt: pointsExpiryDate.toISOString(),

        // 📍 Khoảng cách được tính lại từ tọa độ thật tại checkout.
        distanceKm: orderDistanceKm,
        distanceStr: orderDistanceStr,

        isRaining,
        totalPrice: orderFinalTotalPrice,
        status:
          paymentMethod === "banking" ? "pending_payment" : "pending",
        createdAt: new Date().toISOString(),

        // 🏪 Snapshot merchant hiện tại.
        merchantId,
        merchantCode,
        shopName,
        storeName: shopName,
        storeAddress,
        storePhone,
        storeLat,
        storeLng,
        storeLocation: {
          latitude: storeLat,
          longitude: storeLng,
        },

        items: checkoutItems.map((item: any) => {
          const prod = item.product || item;
          const itemCostPrice =
            Number(prod.costPrice || prod.originalPrice || prod.price) || 0;

          return {
            id: prod.id,
            name: prod.name,
            price: Number(prod.price) || 0,
            costPrice: itemCostPrice,
            quantity: Number(item.quantity) || 1,
            imageUrl: prod.imageUrl || prod.image || "",
            merchantId: prod.merchantId || merchantId,
            merchantCode: prod.merchantCode || merchantCode,
          };
        }),
      };

      console.groupCollapsed("🧾 [CHECKOUT] Order GPS snapshot");
      console.log("Merchant source:", {
        merchantId,
        shopName,
        storeAddress,
        storeLat,
        storeLng,
      });
      console.log("Customer source:", {
        userId: user.uid,
        customerAddress: address,
        customerLat,
        customerLng,
      });
      console.log("Route:", {
        distanceKm: orderDistanceKm,
        distanceStr: orderDistanceStr,
        shippingFee: orderFinalShippingFee,
      });
      console.groupEnd();

      console.groupCollapsed("📦 [CHECKOUT] Firestore order payload");
      console.log("Order payload:", newOrder);
      console.log("GPS summary:", {
        storeLat: newOrder.storeLat,
        storeLng: newOrder.storeLng,
        customerLat: newOrder.customerLat,
        customerLng: newOrder.customerLng,
        distanceKm: newOrder.distanceKm,
        distanceStr: newOrder.distanceStr,
      });
      console.groupEnd();

      const docRef = await addDoc(collection(db, "orders"), newOrder);
      console.info("✅ [CHECKOUT] Order created:", docRef.id);

      const updateVoucherUsage = async (voucherId: string) => {
        try {
          const voucherRef = doc(db, "vouchers", voucherId);
          await updateDoc(voucherRef, { usedCount: increment(1) });
        } catch (vErr) {
          console.warn("⚠️ Lỗi tăng usedCount cho voucher:", vErr);
        }
      };

      if (selectedShippingVoucher?.id) {
        await updateVoucherUsage(selectedShippingVoucher.id);
      }
      if (selectedShopVoucher?.id) {
        await updateVoucherUsage(selectedShopVoucher.id);
      }

      const userRef = doc(db, "users", user.uid);
      const pointsChange = earnedPoints - orderPointsUsed;

      await updateDoc(userRef, {
        points: increment(pointsChange),
        pointsUpdatedAt: new Date().toISOString(),
      }).catch(async () => {
        await updateDoc(userRef, {
          points: Math.max(0, pointsChange),
        });
      });

      if (paymentMethod === "cod") {
        try {
          await fetch("http://localhost:3000/api/dispatch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId: docRef.id }),
          });
        } catch (dispatchError) {
          console.warn("⚠️ Dispatcher offline:", dispatchError);
        }
      }

      if (merchantId && clearMerchantItems) {
        await clearMerchantItems(merchantId);
      } else {
        await clearCart();
      }

      if (paymentMethod === "banking") {
        router.push(`/orders/${docRef.id}/payment`);
      } else {
        alert(
          `🎉 Đặt hàng thành công!\n🎁 Bạn nhận được +${earnedPoints} điểm thưởng.`
        );
        router.push("/orders");
      }
    } catch (error) {
      console.error("Lỗi đặt hàng:", error);
      alert(
        error instanceof Error
          ? `❌ ${error.message}`
          : "Có lỗi xảy ra khi tạo đơn. Vui lòng thử lại!"
      );
    } finally {
      setLoading(false);
    }
  };

  if (!isMounted || authLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-3">
        <div className="w-9 h-9 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold text-slate-400">
          Đang tải trang thanh toán...
        </p>
      </div>
    );
  }

  if (!user) return null;

  if (checkoutItems.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-3xl">
          🛍️
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-bold text-slate-800">
            Không tìm thấy sản phẩm cần thanh toán
          </h2>
          <p className="text-xs text-slate-400">
            Vui lòng quay lại giỏ hàng và chọn quán cần thanh toán
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="bg-slate-900 text-white text-xs font-bold px-6 py-3 rounded-2xl shadow-sm hover:bg-orange-600 transition cursor-pointer"
        >
          Khám phá ngay
        </button>
      </div>
    );
  }

  const filteredModalVouchers = availableVouchers.filter((v) => {
    if (activeModalTab === "SHIPPING") return v.applyType === "SHIPPING";
    if (activeModalTab === "ORDER") return v.applyType === "ORDER";
    return true;
  });

  return (
    <div className="bg-slate-50 min-h-screen text-slate-800 pb-44 font-sans">
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-100 px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-sm font-black text-slate-900">Xác nhận thanh toán</h1>
          <p className="text-[10px] text-slate-400 font-medium">
            Hoàn tất thông tin đơn hàng
          </p>
        </div>
      </header>

      <form onSubmit={handleOrder} className="max-w-lg mx-auto p-3.5 space-y-3.5">
        <section className="bg-white rounded-2xl p-4 border border-slate-100 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
              <span className="flex h-2.5 w-2.5 rounded-full bg-orange-500" />
              <span className="uppercase tracking-wide text-[11px]">Thông tin giao hàng</span>
            </div>

            <button
              type="button"
              onClick={() => router.push("/profile")}
              className="text-[11px] font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 bg-orange-50 px-2.5 py-1 rounded-lg transition cursor-pointer"
            >
              <span>Thay đổi</span>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                  Họ & Tên
                </label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={fullName || "Chưa cập nhật"}
                  className="w-full bg-slate-100 text-slate-500 text-xs p-2.5 rounded-xl border border-slate-200 font-medium cursor-not-allowed select-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                  Số điện thoại
                </label>
                <input
                  type="tel"
                  readOnly
                  disabled
                  value={phone || "Chưa cập nhật"}
                  className="w-full bg-slate-100 text-slate-500 text-xs p-2.5 rounded-xl border border-slate-200 font-medium cursor-not-allowed select-none"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                Địa chỉ chi tiết
              </label>
              <input
                type="text"
                readOnly
                disabled
                value={address || "Chưa có địa chỉ. Vui lòng bấm 'Thay đổi' để cập nhật."}
                className={`w-full text-xs p-2.5 rounded-xl border font-medium cursor-not-allowed select-none ${address ? "bg-slate-100 text-slate-500 border-slate-200" : "bg-red-50 text-red-500 border-red-200 font-semibold"}`}
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                Ghi chú cho tài xế
              </label>
              <input
                type="text"
                placeholder="Lời nhắn (Ví dụ: Đồ dễ vỡ, giao giờ hành chính...)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full bg-slate-50 focus:bg-white text-xs p-2.5 rounded-xl border border-slate-200 focus:border-orange-500 focus:outline-none transition font-medium placeholder:text-slate-300"
              />
            </div>

            <div
              className={`p-2.5 rounded-xl border text-xs font-medium flex items-center justify-between ${weatherLoading
                ? "bg-slate-50 border-slate-200 text-slate-500"
                : isRaining
                  ? "bg-blue-50 border-blue-200 text-blue-900"
                  : "bg-emerald-50 border-emerald-200 text-emerald-900"
                }`}
            >
              <div className="flex items-center gap-2">
                <span>{weatherLoading ? "⏳" : isRaining ? "🌧️" : "☀️"}</span>
                <span>
                  {weatherLoading
                    ? "Đang cập nhật thời tiết Hà Tĩnh..."
                    : isRaining
                      ? "Hà Tĩnh đang có mưa (Tự động +3.000đ)"
                      : "Thời tiết Hà Tĩnh không mưa (Không cộng phụ phí)"}
                </span>
              </div>
              {!weatherLoading && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-white/80 border border-slate-200">
                  Tự động
                </span>
              )}
            </div>

            <div
              className={`p-2.5 rounded-xl border text-[11px] font-medium flex items-center justify-between ${customerCoordinates
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-red-50 border-red-200 text-red-700"
                }`}
            >
              <span>
                {customerCoordinates
                  ? "📍 Đã xác định tọa độ giao hàng GPS"
                  : "⚠️ Địa chỉ chưa có tọa độ GPS — hãy cập nhật lại trong Hồ sơ"}
              </span>
              {customerCoordinates && (
                <span className="font-mono text-[9px] opacity-70">
                  {customerCoordinates.lat.toFixed(6)}, {customerCoordinates.lng.toFixed(6)}
                </span>
              )}
            </div>
          </div>
        </section>

        <section className="bg-amber-50/50 rounded-2xl p-3.5 border border-amber-200/60 flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0 text-base font-bold">
            🏪
          </div>
          <div className="space-y-0.5 text-xs">
            <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wider block">
              Địa điểm lấy hàng
            </span>
            <p className="font-bold text-slate-800">
              {merchantSnapshot?.shopName ||
                firstProduct?.merchantName ||
                firstProduct?.shopName ||
                firstProduct?.storeName ||
                "Cửa hàng đối tác"}
            </p>
            <p className="text-[10px] text-slate-500">
              {merchantSnapshot?.address || "Đang tải địa chỉ quán..."}
            </p>
            {merchantSnapshot && (
              <p className="text-[9px] text-slate-400 font-mono">
                GPS: {merchantSnapshot.coordinates.lat.toFixed(6)}, {merchantSnapshot.coordinates.lng.toFixed(6)}
              </p>
            )}
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-slate-100 shadow-2xs overflow-hidden">
          <button
            type="button"
            onClick={() => setShowItemsList(!showItemsList)}
            className="w-full p-4 flex items-center justify-between text-xs font-bold text-slate-900 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <span>🧺</span>
              <span>Sản phẩm đã chọn ({checkoutItems.length})</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
              <span>{formatCurrency(rawTotalPrice)}</span>
              <svg
                className={`w-4 h-4 transition-transform ${showItemsList ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {showItemsList && (
            <div className="px-4 pb-4 space-y-2.5 border-t border-slate-100 pt-3">
              {checkoutItems.map((item: any) => {
                const prod = item.product || item;
                const itemPrice = Number(prod.price) || 0;
                const itemOriginalPrice = Number(prod.originalPrice || prod.costPrice) || 0;
                const hasDiscount = itemOriginalPrice > itemPrice;

                return (
                  <div
                    key={item.lineId}
                    className="flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                        {item.quantity}x
                      </span>
                      <span className="text-slate-700 font-medium truncate">{prod.name}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {hasDiscount && (
                        <span className="line-through text-slate-400 text-[11px]">
                          {formatCurrency(itemOriginalPrice * item.quantity)}
                        </span>
                      )}
                      <span className="font-bold text-slate-900">
                        {formatCurrency(item.unitPrice * item.quantity)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="bg-white rounded-2xl p-4 border border-slate-100 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
              <span className="text-base">🎫</span>
              <span className="uppercase tracking-wide text-[11px]">Chọn Voucher Khuyến Mãi</span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">Tối đa 1 vận chuyển & 1 shop</span>
          </div>

          <div className="space-y-2.5">
            <div
              onClick={() => {
                setActiveModalTab("SHIPPING");
                setShowVoucherModal(true);
              }}
              className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer ${selectedShippingVoucher
                ? "bg-emerald-50/60 border-emerald-300 shadow-2xs"
                : "bg-slate-50/60 border-dashed border-slate-200 hover:border-orange-300"
                }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold ${selectedShippingVoucher
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-200 text-slate-600"
                    }`}
                >
                  🚚
                </div>
                <div className="truncate">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-800">Miễn Phí Vận Chuyển</span>
                    {selectedShippingVoucher && (
                      <span className="bg-emerald-100 text-emerald-800 text-[9px] font-extrabold px-1.5 py-0.5 rounded font-mono">
                        {selectedShippingVoucher.code}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">
                    {selectedShippingVoucher
                      ? `Đã áp dụng: Giảm -${formatCurrency(shippingDiscountAmount)}`
                      : "Chọn hoặc nhập mã vận chuyển"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 text-xs font-bold shrink-0">
                {selectedShippingVoucher ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedShippingVoucher(null);
                    }}
                    className="text-rose-500 hover:text-rose-700 bg-white border border-rose-200 px-2 py-1 rounded-lg text-[10px]"
                  >
                    Bỏ chọn
                  </button>
                ) : (
                  <span className="text-orange-600 flex items-center gap-0.5">
                    Chọn mã
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                )}
              </div>
            </div>

            <div
              onClick={() => {
                setActiveModalTab("ORDER");
                setShowVoucherModal(true);
              }}
              className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer ${selectedShopVoucher
                ? "bg-purple-50/60 border-purple-300 shadow-2xs"
                : "bg-slate-50/60 border-dashed border-slate-200 hover:border-orange-300"
                }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold ${selectedShopVoucher
                    ? "bg-purple-500 text-white"
                    : "bg-slate-200 text-slate-600"
                    }`}
                >
                  🏪
                </div>
                <div className="truncate">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-800">Voucher Cửa Hàng</span>
                    {selectedShopVoucher && (
                      <span className="bg-purple-100 text-purple-800 text-[9px] font-extrabold px-1.5 py-0.5 rounded font-mono">
                        {selectedShopVoucher.code}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">
                    {selectedShopVoucher
                      ? `Đã áp dụng: Giảm -${formatCurrency(shopDiscountAmount)}`
                      : "Chọn hoặc nhập mã giảm giá quán"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 text-xs font-bold shrink-0">
                {selectedShopVoucher ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedShopVoucher(null);
                    }}
                    className="text-rose-500 hover:text-rose-700 bg-white border border-rose-200 px-2 py-1 rounded-lg text-[10px]"
                  >
                    Bỏ chọn
                  </button>
                ) : (
                  <span className="text-orange-600 flex items-center gap-0.5">
                    Chọn mã
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-gradient-to-br from-emerald-50 to-teal-50/50 border border-emerald-100 rounded-2xl p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🎁</span>
              <div>
                <h3 className="text-xs font-bold text-emerald-950">Điểm thưởng tích lũy</h3>
                <p className="text-[10px] text-emerald-700 font-medium">
                  Tích +{earnedPoints} điểm (Hạn dùng {POINTS_EXPIRE_DAYS} ngày)
                </p>
              </div>
            </div>
            <span className="bg-emerald-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-2xs">
              {userPoints} Điểm
            </span>
          </div>

          {userPoints > 0 ? (
            <div className="pt-2 border-t border-emerald-200/50 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-700 block">
                  Đổi {userPoints} điểm (-{formatCurrency(maxPointsDiscountVnd)})
                </span>
                <span className="text-[9px] text-emerald-600 font-medium">
                  Tỷ lệ: 1 điểm = 10đ
                </span>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={usePoints}
                  onChange={(e) => setUsePoints(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>
          ) : (
            <p className="text-[10px] text-emerald-600/80 italic pt-1 border-t border-emerald-200/50">
              💡 Tích lũy thêm điểm để đổi giảm giá trực tiếp (10.000đ = 10 điểm = 100đ giảm giá).
            </p>
          )}
        </section>

        <section className="bg-white rounded-2xl p-4 border border-slate-100 shadow-2xs space-y-2.5">
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Hình thức thanh toán
          </h3>

          <div className="space-y-2">
            <label
              className={`flex items-center justify-between p-3 rounded-xl border transition ${isCodDisabled
                ? "bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed"
                : paymentMethod === "cod"
                  ? "bg-orange-50/50 border-orange-500 cursor-pointer"
                  : "bg-slate-50 border-slate-100 cursor-pointer"
                }`}
            >
              <div className="flex items-center gap-2.5">
                <input
                  type="radio"
                  name="payment"
                  disabled={isCodDisabled}
                  checked={paymentMethod === "cod"}
                  onChange={() => setPaymentMethod("cod")}
                  className="accent-orange-600 disabled:cursor-not-allowed"
                />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    💵 Thanh toán khi nhận hàng (COD)
                  </span>
                  {isCodDisabled && (
                    <span className="text-[10px] text-rose-500 font-medium block">
                      ⚠️ Đơn hàng trên 300.000đ không hỗ trợ COD. Vui lòng chuyển khoản.
                    </span>
                  )}
                </div>
              </div>
            </label>

            <label
              className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${paymentMethod === "banking"
                ? "bg-orange-50/50 border-orange-500"
                : "bg-slate-50 border-slate-100"
                }`}
            >
              <div className="flex items-center gap-2.5">
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === "banking"}
                  onChange={() => setPaymentMethod("banking")}
                  className="accent-orange-600"
                />
                <span className="text-xs font-bold text-slate-800">
                  🏦 Chuyển khoản QR-Code (SePay)
                </span>
              </div>
            </label>
          </div>
        </section>

        <section className="bg-white rounded-2xl p-4 border border-slate-100 shadow-2xs space-y-2.5 text-xs">
          <div className="flex justify-between text-slate-500">
            <span>Tổng giá món ({checkoutItems.length} món):</span>
            <div className="flex items-center gap-1.5">
              {rawTotalCostPrice > rawTotalPrice && (
                <span className="line-through text-slate-400 text-[11px]">
                  {formatCurrency(rawTotalCostPrice)}
                </span>
              )}
              <span className="font-semibold text-slate-800">
                {formatCurrency(rawTotalPrice)}
              </span>
            </div>
          </div>

          <div className="flex justify-between text-slate-500">
            <span>Phí giao hàng ({rawDistance}):</span>
            <span className="font-semibold text-slate-800">
              {formatCurrency(baseShippingFee)}
            </span>
          </div>

          <div className="flex justify-between items-center text-slate-500">
            <button
              type="button"
              onClick={() => setShowFeeModal(true)}
              className="flex items-center gap-1 text-left focus:outline-none group cursor-pointer"
            >
              <span>Phí áp dụng</span>
              <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-slate-400 text-slate-400 text-[10px] group-hover:border-slate-600 group-hover:text-slate-600">
                ?
              </span>
            </button>
            <span className="font-semibold text-slate-800">
              {formatCurrency(totalAppliedFee)}
            </span>
          </div>

          {(shippingDiscountAmount > 0 ||
            shopDiscountAmount > 0 ||
            (usePoints && discountFromPoints > 0)) && (
              <div className="border-t border-slate-100 my-1 pt-1.5 space-y-1.5">
                {selectedShippingVoucher && shippingDiscountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span>Voucher Vận chuyển ({selectedShippingVoucher.code}):</span>
                    <span>-{formatCurrency(shippingDiscountAmount)}</span>
                  </div>
                )}

                {selectedShopVoucher && shopDiscountAmount > 0 && (
                  <div className="flex justify-between text-purple-600 font-semibold">
                    <span>Voucher Shop ({selectedShopVoucher.code}):</span>
                    <span>-{formatCurrency(shopDiscountAmount)}</span>
                  </div>
                )}

                {usePoints && discountFromPoints > 0 && (
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span>Giảm giá điểm thưởng ({pointsUsed} điểm):</span>
                    <span>-{formatCurrency(discountFromPoints)}</span>
                  </div>
                )}
              </div>
            )}

          <div className="border-t border-slate-100 pt-2.5 flex justify-between items-center text-sm font-bold text-slate-900">
            <span>Tổng thanh toán</span>
            <span className="text-orange-600 font-black text-base">
              {formatCurrency(finalTotalPrice)}
            </span>
          </div>
        </section>

        <div className="fixed bottom-[56px] left-0 right-0 z-40 flex justify-center px-0 pointer-events-none">
          <div className="w-full max-w-lg bg-white/95 backdrop-blur-md border-t border-slate-200 p-3.5 shadow-2xl flex items-center justify-between gap-3 pointer-events-auto">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block leading-none">
                Tổng thanh toán
              </span>
              <span className="text-lg font-black text-orange-600">
                {formatCurrency(finalTotalPrice)}
              </span>
            </div>

            <button
              type="submit"
              disabled={loading || merchantLoading}
              className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-orange-500/20 active:scale-95 transition text-xs uppercase tracking-wider disabled:opacity-50 cursor-pointer"
            >
              {loading
                ? "Đang tạo đơn..."
                : paymentMethod === "banking"
                  ? "Thanh toán QR 📲"
                  : "Đặt hàng ngay 🚀"}
            </button>
          </div>
        </div>
      </form>

      {showFeeModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-t-3xl p-5 pb-32 space-y-4 max-h-[85vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-900 text-sm">Phí áp dụng</h3>
              <button
                type="button"
                onClick={() => setShowFeeModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-sm transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {rainFee > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between font-semibold text-slate-800">
                    <span>🌧️ Phí thời tiết xấu</span>
                    <span>{formatCurrency(rainFee)}</span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Phí này nhằm giúp duy trì chất lượng dịch vụ trong điều kiện thời tiết bất lợi cho quá trình giao hàng.
                  </p>
                </div>
              )}

              {peakHourFee > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between font-semibold text-slate-800">
                    <span>
                      {peakHourFee === 7000
                        ? "🌙 Phí phụ phí đêm"
                        : "⏰ Phí giờ cao điểm"}
                    </span>
                    <span>{formatCurrency(peakHourFee)}</span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    {peakHourFee === 7000
                      ? "Phí áp dụng cho các đơn hàng có thời gian giao dự kiến trong khung giờ 23:30 - 05:00 để giúp đảm bảo chất lượng dịch vụ."
                      : "Phí áp dụng cho các đơn hàng có thời gian giao dự kiến trong khung giờ cao điểm để giúp đảm bảo chất lượng dịch vụ."}
                  </p>
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 pt-3 flex justify-between items-center font-bold text-slate-900 text-sm">
              <span>Tổng cộng</span>
              <span className="text-orange-600 font-black">
                {formatCurrency(totalAppliedFee)}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowFeeModal(false)}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {showVoucherModal && (
        <div className="fixed inset-0 z-[99] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-slate-100 w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="bg-white px-4 py-3.5 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm font-black text-slate-900">Chọn Voucher Cho-Online</h3>
                <p className="text-[10px] text-slate-400">
                  Có thể chọn 1 voucher vận chuyển & 1 voucher shop
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowVoucherModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-sm transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-white px-4 py-3 border-b border-slate-200 space-y-2.5 shrink-0">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nhập mã voucher (Ví dụ: FREESHIP, SALE50K)..."
                  value={inputVoucherCode}
                  onChange={(e) => setInputVoucherCode(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold uppercase focus:border-orange-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleApplyCode}
                  className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition cursor-pointer shadow-2xs"
                >
                  Áp dụng
                </button>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setActiveModalTab("ALL")}
                  className={`flex-1 text-xs font-bold py-2 rounded-xl transition cursor-pointer ${activeModalTab === "ALL"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                >
                  Tất cả
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModalTab("SHIPPING")}
                  className={`flex-1 text-xs font-bold py-2 rounded-xl transition cursor-pointer ${activeModalTab === "SHIPPING"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    }`}
                >
                  🚚 Vận chuyển
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModalTab("ORDER")}
                  className={`flex-1 text-xs font-bold py-2 rounded-xl transition cursor-pointer ${activeModalTab === "ORDER"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "bg-purple-50 text-purple-700 hover:bg-purple-100"
                    }`}
                >
                  🏪 Shop Voucher
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 pb-6 space-y-3">
              {filteredModalVouchers.length === 0 ? (
                <div className="text-center py-12 space-y-2">
                  <div className="text-3xl">🎫</div>
                  <p className="text-xs font-bold text-slate-700">
                    Không tìm thấy mã giảm giá phù hợp
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Hãy thử nhập mã hoặc kiểm tra lại điều kiện đơn hàng.
                  </p>
                </div>
              ) : (
                filteredModalVouchers.map((v) => {
                  const isEligible = !v.minOrder || rawTotalPrice >= v.minOrder;
                  const isShipping = v.applyType === "SHIPPING";
                  const isSelected = isShipping
                    ? selectedShippingVoucher?.id === v.id
                    : selectedShopVoucher?.id === v.id;

                  return (
                    <div
                      key={v.id}
                      onClick={() => isEligible && handleSelectVoucher(v)}
                      className={`relative bg-white rounded-2xl border transition flex overflow-hidden shadow-2xs ${isSelected
                        ? isShipping
                          ? "border-emerald-500 ring-1 ring-emerald-500 bg-emerald-50/20"
                          : "border-purple-500 ring-1 ring-purple-500 bg-purple-50/20"
                        : isEligible
                          ? "border-slate-200 hover:border-slate-300 cursor-pointer"
                          : "border-slate-200 opacity-60 bg-slate-50 cursor-not-allowed"
                        }`}
                    >
                      <div
                        className={`w-24 sm:w-28 p-3 flex flex-col items-center justify-center text-center shrink-0 border-r border-dashed border-slate-200 ${isShipping
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-purple-50 text-purple-700"
                          }`}
                      >
                        <span className="text-xl mb-1">{isShipping ? "🚚" : "🏪"}</span>
                        <span className="text-[10px] font-black uppercase tracking-wider">
                          {isShipping ? "Freeship" : "Shop Giảm"}
                        </span>
                        <span className="text-[9px] opacity-75 font-mono mt-0.5">
                          {v.discountType === "PERCENTAGE"
                            ? `Giảm ${v.discountValue}%`
                            : `Giảm ${formatCurrency(v.discountValue)}`}
                        </span>
                      </div>

                      <div className="flex-1 p-3.5 flex items-center justify-between gap-3">
                        <div className="space-y-1 truncate">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-black text-xs text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                              {v.code}
                            </span>
                            {isSelected && (
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white ${isShipping ? "bg-emerald-600" : "bg-purple-600"
                                  }`}
                              >
                                Đang chọn
                              </span>
                            )}
                          </div>
                          <h4 className="text-xs font-bold text-slate-800 truncate">
                            {v.title}
                          </h4>
                          {v.description && (
                            <p className="text-[10px] text-slate-500 truncate">
                              {v.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 pt-0.5 text-[10px] text-slate-400">
                            {v.minOrder ? (
                              <span>
                                Đơn tối thiểu: <strong className="text-slate-600">{formatCurrency(v.minOrder)}</strong>
                              </span>
                            ) : (
                              <span>Không giới hạn đơn tối thiểu</span>
                            )}
                          </div>
                          {!isEligible && (
                            <p className="text-[10px] text-rose-500 font-semibold">
                              ⚠️ Cần mua thêm {formatCurrency((v.minOrder || 0) - rawTotalPrice)} để dùng mã này
                            </p>
                          )}
                        </div>

                        <div className="shrink-0">
                          <div
                            className={`w-5 h-5 rounded-full border flex items-center justify-center transition ${isSelected
                              ? isShipping
                                ? "bg-emerald-600 border-emerald-600 text-white"
                                : "bg-purple-600 border-purple-600 text-white"
                              : "border-slate-300 bg-white"
                              }`}
                          >
                            {isSelected && <span className="text-xs font-black">✓</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="bg-white p-3.5 pb-[calc(14px+env(safe-area-inset-bottom))] border-t border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => setShowVoucherModal(false)}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-wider transition cursor-pointer shadow-md"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
