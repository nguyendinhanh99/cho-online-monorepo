"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@cho-online/firebase";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { doc, getDoc, collection, addDoc, updateDoc, increment, getDocs } from "firebase/firestore";
import { useCartStore } from "@/store/useCartStore";

const MAX_SHIPPING_FEE = 50000;
const MAX_COD_THRESHOLD = 300000;
const POINTS_EXPIRE_DAYS = 90;

// Tọa độ TP. Hà Tĩnh
const HA_TINH_LAT = 18.3381;
const HA_TINH_LNG = 105.9058;

interface ShippingOptions {
  distanceKm: number;
  isRaining?: boolean;
  orderTime?: Date;
}

// 🚚 Tính phí ship: 1km đầu = 14.000đ, từ km thứ 2 trở đi mỗi km +4.000đ
const calculateShippingFee = ({ distanceKm, isRaining = false, orderTime = new Date() }: ShippingOptions): number => {
  let baseFee = 14000;

  if (distanceKm > 1) {
    const extraKm = Math.ceil(distanceKm - 1);
    baseFee = 14000 + extraKm * 4000;
  }

  baseFee = Math.min(baseFee, MAX_SHIPPING_FEE);

  // 🌧️ Phụ phí trời mưa (+3.000đ)
  const rainSurcharge = isRaining ? 3000 : 0;

  // Khung giờ cao điểm
  const hour = orderTime.getHours();
  let timeSurcharge = 0;

  if (hour >= 11 && hour < 13) {
    timeSurcharge = 3000;
  } else if (hour >= 18 && hour < 22) {
    timeSurcharge = 3000;
  } else if (hour >= 22 || hour < 5) {
    timeSurcharge = 5000;
  }

  return baseFee + rainSurcharge + timeSurcharge;
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

  // 🛡️ Cờ kiểm tra mount để tránh lỗi Hydration
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 🎯 Lọc danh sách món thuộc cửa hàng đã chọn thanh toán
  const checkoutItems = useMemo(() => {
    if (!selectedMerchantId) return items;
    return items.filter((item: any) => {
      const prod = item.product || item;
      const itemMerchantId = prod.merchantId || prod.merchantCode || prod.shopId || "default_merchant";
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

  // 🌤️ State thời tiết tự động
  const [isRaining, setIsRaining] = useState(false);
  const [weatherLoading, setWeatherLoading] = useState(true);

  const [userPoints, setUserPoints] = useState(0);
  const [usePoints, setUsePoints] = useState(false);
  const [showItemsList, setShowItemsList] = useState(false);

  const [availableVouchers, setAvailableVouchers] = useState<Voucher[]>([]);
  const [selectedShippingVoucher, setSelectedShippingVoucher] = useState<Voucher | null>(null);
  const [selectedShopVoucher, setSelectedShopVoucher] = useState<Voucher | null>(null);

  const [inputVoucherCode, setInputVoucherCode] = useState("");
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState<"ALL" | "SHIPPING" | "ORDER">("ALL");

  // 🌧️ Tự động kiểm tra thời tiết Hà Tĩnh qua Open-Meteo API
  useEffect(() => {
    const checkHaTinhWeather = async () => {
      try {
        setWeatherLoading(true);
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${HA_TINH_LAT}&longitude=${HA_TINH_LNG}&current=rain,weather_code`
        );
        const data = await res.json();

        const rainAmount = data?.current?.rain || 0;
        const code = data?.current?.weather_code || 0;

        const isRainyCode = (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;

        if (rainAmount > 0 || isRainyCode) {
          setIsRaining(true);
        } else {
          setIsRaining(false);
        }
      } catch (err) {
        console.warn("⚠️ Không thể kết nối API thời tiết, giữ mặc định không mưa:", err);
        setIsRaining(false);
      } finally {
        setWeatherLoading(false);
      }
    };

    checkHaTinhWeather();
  }, []);

  // 🟢 Xác thực người dùng & Đồng bộ giỏ hàng với Firestore
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        useCartStore.getState().setUserId(null);
        router.replace("/login?redirectTo=/checkout");
      } else {
        setUser(currentUser);
        useCartStore.getState().setUserId(currentUser.uid);

        if (currentUser.displayName) setFullName(currentUser.displayName);

        try {
          const userDoc = await getDoc(doc(db, "users", currentUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.name || data.fullName) setFullName(data.name || data.fullName);
            if (data.phone) setPhone(data.phone);
            if (data.address) setAddress(data.address);
            if (data.points) setUserPoints(data.points);
          } else {
            const localData = localStorage.getItem("user_shipping_info");
            if (localData) {
              const parsed = JSON.parse(localData);
              if (parsed.fullName || parsed.name) setFullName(parsed.fullName || parsed.name);
              if (parsed.phone) setPhone(parsed.phone);
              if (parsed.address) setAddress(parsed.address);
            } else if (currentUser.phoneNumber) {
              setPhone(currentUser.phoneNumber);
            }
          }
        } catch (err) {
          console.error("Lỗi lấy thông tin giao hàng:", err);
        }
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    const fetchVouchers = async () => {
      try {
        const firstProduct = (checkoutItems[0]?.product || checkoutItems[0]) as any;
        const currentShopId = firstProduct?.merchantId || firstProduct?.merchantCode || firstProduct?.shopId;

        const querySnapshot = await getDocs(collection(db, "vouchers"));
        const list: Voucher[] = [];
        const now = new Date();

        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const isShippingVoucher = String(data.applyType || "").toUpperCase() === "SHIPPING";
          const isMatchingShop = !data.merchantId || data.merchantId === currentShopId;

          if (!isShippingVoucher && !isMatchingShop) return;

          const discountTypeUpper = String(data.discountType || "FIXED").toUpperCase();

          const v: Voucher = {
            id: docSnap.id,
            code: data.code || "",
            title: data.title || "",
            description: data.description || "",
            applyType: (data.applyType || "ORDER").toUpperCase() as "ORDER" | "SHIPPING",
            discountType: (discountTypeUpper.includes("PERCENT") || discountTypeUpper === "PERCENTAGE" ? "PERCENTAGE" : "FIXED"),
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

    if (checkoutItems.length > 0) {
      fetchVouchers();
    }
  }, [checkoutItems]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  };

  // 💰 Tính toán giá trị dựa trên checkoutItems đã lọc
  const rawTotalPrice = checkoutItems.reduce((sum, item: any) => {
    const prod = item.product || item;
    const price = Number(prod.price) || 0;
    const qty = Number(item.quantity) || 1;
    return sum + price * qty;
  }, 0);

  const rawTotalCostPrice = checkoutItems.reduce((sum, item: any) => {
    const prod = item.product || item;
    const cost = Number(prod.costPrice || prod.originalPrice || prod.price) || 0;
    const qty = Number(item.quantity) || 1;
    return sum + cost * qty;
  }, 0);

  const firstProduct = (checkoutItems[0]?.product || checkoutItems[0] || {}) as any;

  const rawDistance = firstProduct?.distance || "100m";
  const numericDistance = parseFloat(rawDistance.replace(/[^0-9.]/g, "")) || 1.0;

  const isMeters = /m|mét/i.test(rawDistance) && !/km/i.test(rawDistance);
  const parsedDistanceInKm = isMeters ? numericDistance / 1000 : numericDistance;

  // 🕒 Tránh lệch múi giờ/giờ hệ thống bằng cách cố định mốc thời gian tính phí ship khi chưa mount
  const currentOrderTime = isMounted ? new Date() : new Date(2026, 0, 1, 10, 0, 0);

  const initialShippingFee = calculateShippingFee({
    distanceKm: parsedDistanceInKm,
    isRaining,
    orderTime: currentOrderTime,
  });

  let shippingDiscountAmount = 0;
  if (selectedShippingVoucher) {
    if (selectedShippingVoucher.discountType === "FIXED") {
      shippingDiscountAmount = Math.min(selectedShippingVoucher.discountValue, initialShippingFee);
    } else if (selectedShippingVoucher.discountType === "PERCENTAGE") {
      let calc = (initialShippingFee * selectedShippingVoucher.discountValue) / 100;
      if (selectedShippingVoucher.maxDiscount) {
        calc = Math.min(calc, selectedShippingVoucher.maxDiscount);
      }
      shippingDiscountAmount = Math.min(calc, initialShippingFee);
    }
  }
  const finalShippingFee = Math.max(0, initialShippingFee - shippingDiscountAmount);

  let shopDiscountAmount = 0;
  if (selectedShopVoucher) {
    if (selectedShopVoucher.discountType === "FIXED") {
      shopDiscountAmount = Math.min(selectedShopVoucher.discountValue, rawTotalPrice);
    } else if (selectedShopVoucher.discountType === "PERCENTAGE") {
      let calc = (rawTotalPrice * selectedShopVoucher.discountValue) / 100;
      if (selectedShopVoucher.maxDiscount) {
        calc = Math.min(calc, selectedShopVoucher.maxDiscount);
      }
      shopDiscountAmount = Math.min(calc, rawTotalPrice);
    }
  }

  const earnedPoints = calculateEarnedPoints(rawTotalPrice);
  const tempTotal = Math.max(0, rawTotalPrice + finalShippingFee - shopDiscountAmount);

  const maxPointsDiscountVnd = userPoints * 10;
  const discountFromPoints = usePoints ? Math.min(maxPointsDiscountVnd, tempTotal) : 0;
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
      alert(`⚠️ Đơn hàng tối thiểu để áp dụng mã này là ${formatCurrency(found.minOrder)}`);
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
      alert(`⚠️ Đơn hàng tối thiểu để áp dụng mã này là ${formatCurrency(v.minOrder)}`);
      return;
    }

    if (v.applyType === "SHIPPING") {
      setSelectedShippingVoucher(selectedShippingVoucher?.id === v.id ? null : v);
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

    if (paymentMethod === "cod" && isCodDisabled) {
      alert("⚠️ Đơn hàng trên 300.000đ chỉ hỗ trợ thanh toán qua Chuyển khoản QR!");
      setPaymentMethod("banking");
      return;
    }

    setLoading(true);

    try {
      const merchantId = firstProduct?.merchantId || firstProduct?.shopId || "";
      const merchantCode = firstProduct?.merchantCode || "";
      const shopName = firstProduct?.merchantName || firstProduct?.shopName || firstProduct?.storeName || "Cửa hàng";
      const storeAddress = firstProduct?.address || firstProduct?.storeAddress || firstProduct?.shopAddress || firstProduct?.merchantAddress || "501 Hà Huy Tập, thành phố Hà Tĩnh";
      const storePhone = firstProduct?.phone || firstProduct?.phoneNumber || "01234567899";
      const storeLat = firstProduct?.lat || HA_TINH_LAT;
      const storeLng = firstProduct?.lng || HA_TINH_LNG;

      const finalCustomerName = fullName.trim() || user.displayName || "Khách hàng";
      const paymentCode = `DH${Math.floor(Date.now() / 1000)}`;

      const pointsExpiryDate = new Date();
      pointsExpiryDate.setDate(pointsExpiryDate.getDate() + POINTS_EXPIRE_DAYS);

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

        subTotalPrice: rawTotalPrice,
        subTotalCostPrice: rawTotalCostPrice,
        shippingFee: finalShippingFee,
        discountAmount: discountFromPoints + shopDiscountAmount + shippingDiscountAmount,

        shippingVoucherCode: selectedShippingVoucher ? selectedShippingVoucher.code : null,
        shippingVoucherDiscount: shippingDiscountAmount,

        shopVoucherCode: selectedShopVoucher ? selectedShopVoucher.code : null,
        shopVoucherDiscount: shopDiscountAmount,

        pointsUsed,
        pointsEarned: earnedPoints,
        pointsExpiresAt: pointsExpiryDate.toISOString(),
        distanceKm: parsedDistanceInKm,
        distanceStr: rawDistance,
        isRaining,
        totalPrice: finalTotalPrice,

        status: paymentMethod === "banking" ? "pending_payment" : "pending",
        createdAt: new Date().toISOString(),

        merchantId,
        merchantCode,
        shopName,
        storeName: shopName,
        storeAddress,
        storePhone,
        storeLat,
        storeLng,

        items: checkoutItems.map((item: any) => {
          const prod = item.product || item;
          const itemCostPrice = Number(prod.costPrice || prod.originalPrice || prod.price) || 0;
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

      const docRef = await addDoc(collection(db, "orders"), newOrder);

      const updateVoucherUsage = async (voucherId: string) => {
        try {
          const voucherRef = doc(db, "vouchers", voucherId);
          await updateDoc(voucherRef, { usedCount: increment(1) });
        } catch (vErr) {
          console.warn("⚠️ Lỗi tăng usedCount cho voucher:", vErr);
        }
      };

      if (selectedShippingVoucher?.id) await updateVoucherUsage(selectedShippingVoucher.id);
      if (selectedShopVoucher?.id) await updateVoucherUsage(selectedShopVoucher.id);

      const userRef = doc(db, "users", user.uid);
      const pointsChange = earnedPoints - pointsUsed;

      await updateDoc(userRef, {
        points: increment(pointsChange),
        pointsUpdatedAt: new Date().toISOString(),
      }).catch(async () => {
        await updateDoc(userRef, { points: Math.max(0, pointsChange) });
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

      const currentMerchantId = merchantId || selectedMerchantId;
      if (currentMerchantId && clearMerchantItems) {
        await clearMerchantItems(currentMerchantId);
      } else {
        await clearCart();
      }

      if (paymentMethod === "banking") {
        router.push(`/orders/${docRef.id}/payment`);
      } else {
        alert(`🎉 Đặt hàng thành công!\n🎁 Bạn nhận được +${earnedPoints} điểm thưởng.`);
        router.push("/orders");
      }
    } catch (error) {
      console.error("Lỗi đặt hàng:", error);
      alert("Có lỗi xảy ra khi tạo đơn. Vui lòng thử lại!");
    } finally {
      setLoading(false);
    }
  };

  // 🛡️ Ngăn chặn render khác biệt trong lần đầu SSR nếu chưa mount
  if (!isMounted || authLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-3">
        <div className="w-9 h-9 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold text-slate-400">Đang tải trang thanh toán...</p>
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
          <h2 className="text-base font-bold text-slate-800">Không tìm thấy sản phẩm cần thanh toán</h2>
          <p className="text-xs text-slate-400">Vui lòng quay lại giỏ hàng và chọn quán cần thanh toán</p>
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
    <div className="bg-slate-50 min-h-screen text-slate-800 pb-36 font-sans">
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
          <p className="text-[10px] text-slate-400 font-medium">Hoàn tất thông tin đơn hàng</p>
        </div>
      </header>

      <form onSubmit={handleOrder} className="max-w-lg mx-auto p-3.5 space-y-3.5">

        {/* 1️⃣ KHỐI ĐỊA CHỈ NHẬN HÀNG */}
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

            {/* 🌤️ TRẠNG THÁI THỜI TIẾT HÀ TĨNH TỰ ĐỘNG */}
            <div className={`p-2.5 rounded-xl border text-xs font-medium flex items-center justify-between ${weatherLoading
                ? "bg-slate-50 border-slate-200 text-slate-500"
                : isRaining
                  ? "bg-blue-50 border-blue-200 text-blue-900"
                  : "bg-emerald-50 border-emerald-200 text-emerald-900"
              }`}>
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
          </div>
        </section>

        {/* 2️⃣ THÔNG TIN CỬA HÀNG */}
        <section className="bg-amber-50/50 rounded-2xl p-3.5 border border-amber-200/60 flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0 text-base font-bold">
            🏪
          </div>
          <div className="space-y-0.5 text-xs">
            <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wider block">
              Địa điểm lấy hàng
            </span>
            <p className="font-bold text-slate-800">
              {firstProduct?.merchantName || firstProduct?.shopName || firstProduct?.storeName || "Cửa hàng đối tác"}
            </p>
          </div>
        </section>

        {/* 3️⃣ DANH SÁCH MÓN */}
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
              <svg className={`w-4 h-4 transition-transform ${showItemsList ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  <div key={prod.id} className="flex items-center justify-between text-xs">
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
                        {formatCurrency(itemPrice * item.quantity)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 🎫 KHỐI KHUYẾN MÃI / VOUCHER */}
        <section className="bg-white rounded-2xl p-4 border border-slate-100 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
              <span className="text-base">🎫</span>
              <span className="uppercase tracking-wide text-[11px]">Ưu đãi & Voucher</span>
            </div>

            <button
              type="button"
              onClick={() => setShowVoucherModal(true)}
              className="text-[11px] font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 bg-orange-50 px-2.5 py-1 rounded-lg transition cursor-pointer"
            >
              <span>{selectedShippingVoucher || selectedShopVoucher ? "Thay đổi" : "Chọn mã"}</span>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="space-y-2">
            {selectedShippingVoucher ? (
              <div className="flex items-center justify-between bg-emerald-50/80 border border-emerald-200 p-2.5 rounded-xl text-xs">
                <div className="flex items-center gap-2 truncate">
                  <span className="text-emerald-700 font-black text-[10px] bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300 font-mono uppercase">
                    🚚 FREESHIP
                  </span>
                  <div className="truncate">
                    <p className="font-bold text-emerald-950 truncate">{selectedShippingVoucher.title}</p>
                    <p className="text-[10px] text-emerald-700 font-medium">Giảm -{formatCurrency(shippingDiscountAmount)} phí vận chuyển</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedShippingVoucher(null)}
                  className="text-[10px] font-bold text-rose-500 hover:text-rose-700 bg-white border border-rose-200 px-2 py-1 rounded-lg shrink-0 cursor-pointer"
                >
                  Gỡ
                </button>
              </div>
            ) : (
              <div
                onClick={() => {
                  setActiveModalTab("SHIPPING");
                  setShowVoucherModal(true);
                }}
                className="flex items-center justify-between bg-emerald-50/30 border border-dashed border-emerald-200 p-2.5 rounded-xl text-xs cursor-pointer hover:bg-emerald-50/60 transition"
              >
                <div className="flex items-center gap-2 text-emerald-700 font-medium text-[11px]">
                  <span>🚚</span>
                  <span>Chọn Voucher Miễn Phí Vận Chuyển</span>
                </div>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-md">+ Thêm</span>
              </div>
            )}

            {selectedShopVoucher ? (
              <div className="flex items-center justify-between bg-purple-50/80 border border-purple-200 p-2.5 rounded-xl text-xs">
                <div className="flex items-center gap-2 truncate">
                  <span className="text-purple-700 font-black text-[10px] bg-purple-100 px-2 py-0.5 rounded border border-purple-300 font-mono uppercase">
                    🏪 VOUCHER SHOP
                  </span>
                  <div className="truncate">
                    <p className="font-bold text-purple-950 truncate">{selectedShopVoucher.title}</p>
                    <p className="text-[10px] text-purple-700 font-medium">Giảm -{formatCurrency(shopDiscountAmount)} đơn hàng</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedShopVoucher(null)}
                  className="text-[10px] font-bold text-rose-500 hover:text-rose-700 bg-white border border-rose-200 px-2 py-1 rounded-lg shrink-0 cursor-pointer"
                >
                  Gỡ
                </button>
              </div>
            ) : (
              <div
                onClick={() => {
                  setActiveModalTab("ORDER");
                  setShowVoucherModal(true);
                }}
                className="flex items-center justify-between bg-purple-50/30 border border-dashed border-purple-200 p-2.5 rounded-xl text-xs cursor-pointer hover:bg-purple-50/60 transition"
              >
                <div className="flex items-center gap-2 text-purple-700 font-medium text-[11px]">
                  <span>🏷️</span>
                  <span>Chọn Voucher Giảm Giá Của Shop</span>
                </div>
                <span className="text-[10px] font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded-md">+ Thêm</span>
              </div>
            )}
          </div>
        </section>

        {/* 4️⃣ KHỐI TÍCH ĐIỂM */}
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
                <span className="text-[9px] text-emerald-600 font-medium">Tỷ lệ: 1 điểm = 10đ</span>
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

        {/* 5️⃣ PHƯƠNG THỨC THANH TOÁN */}
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

        {/* 6️⃣ CHI TIẾT CƯỚC PHÍ */}
        <section className="bg-white rounded-2xl p-4 border border-slate-100 shadow-2xs space-y-2.5 text-xs">
          {/* Tiền món */}
          <div className="flex justify-between text-slate-500">
            <span>Tiền món ({checkoutItems.length}):</span>
            <div className="flex items-center gap-1.5">
              {rawTotalCostPrice > rawTotalPrice && (
                <span className="line-through text-slate-400 text-[11px]">
                  {formatCurrency(rawTotalCostPrice)}
                </span>
              )}
              <span className="font-semibold text-slate-800">{formatCurrency(rawTotalPrice)}</span>
            </div>
          </div>

          {/* Bóc tách phí vận chuyển và phụ phí */}
          {(() => {
            let baseDistanceFee = 14000;
            if (parsedDistanceInKm > 1) {
              const extraKm = Math.ceil(parsedDistanceInKm - 1);
              baseDistanceFee = Math.min(14000 + extraKm * 4000, MAX_SHIPPING_FEE);
            }

            const currentHour = currentOrderTime.getHours();
            let peakFee = 0;
            if ((currentHour >= 11 && currentHour < 13) || (currentHour >= 18 && currentHour < 22)) {
              peakFee = 3000;
            } else if (currentHour >= 22 || currentHour < 5) {
              peakFee = 5000;
            }

            return (
              <>
                <div className="flex justify-between text-slate-500">
                  <span>Phí vận chuyển cơ bản ({rawDistance}):</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(baseDistanceFee)}</span>
                </div>

                {/* Phụ phí trời mưa */}
                {isRaining && (
                  <div className="flex justify-between text-amber-600 font-medium pl-3 border-l-2 border-amber-300">
                    <span>🌧️ Phụ phí trời mưa:</span>
                    <span>+{formatCurrency(3000)}</span>
                  </div>
                )}

                {/* Phụ phí giờ cao điểm */}
                {peakFee > 0 && (
                  <div className="flex justify-between text-orange-600 font-medium pl-3 border-l-2 border-orange-300">
                    <span>⏰ Phụ phí giờ cao điểm:</span>
                    <span>+{formatCurrency(peakFee)}</span>
                  </div>
                )}
              </>
            );
          })()}

          {/* Các khoản giảm giá */}
          {(shippingDiscountAmount > 0 || shopDiscountAmount > 0 || (usePoints && discountFromPoints > 0)) && (
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
        </section>

        {/* 🟢 STICKY BOTTOM ACTION BAR */}
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
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-orange-500/20 active:scale-95 transition text-xs uppercase tracking-wider disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Đang tạo đơn..." : paymentMethod === "banking" ? "Thanh toán QR 📲" : "Đặt hàng ngay 🚀"}
            </button>
          </div>
        </div>

      </form>

      {/* 🎫 MODAL CHỌN VOUCHER */}
      {showVoucherModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <span>🎫</span> Chọn Voucher Khuyến Mãi
              </h3>
              <button
                type="button"
                onClick={() => setShowVoucherModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-sm transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Nhập mã voucher..."
                value={inputVoucherCode}
                onChange={(e) => setInputVoucherCode(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold uppercase focus:border-orange-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleApplyCode}
                className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-xl transition cursor-pointer"
              >
                Áp dụng
              </button>
            </div>

            <div className="flex gap-2 border-b border-slate-100 pb-2">
              <button
                type="button"
                onClick={() => setActiveModalTab("ALL")}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition cursor-pointer ${activeModalTab === "ALL" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
              >
                Tất cả
              </button>
              <button
                type="button"
                onClick={() => setActiveModalTab("SHIPPING")}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition cursor-pointer ${activeModalTab === "SHIPPING" ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  }`}
              >
                🚚 Vận chuyển
              </button>
              <button
                type="button"
                onClick={() => setActiveModalTab("ORDER")}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition cursor-pointer ${activeModalTab === "ORDER" ? "bg-purple-600 text-white" : "bg-purple-50 text-purple-700 hover:bg-purple-100"
                  }`}
              >
                🏪 Shop Voucher
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {filteredModalVouchers.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-6">
                  Không tìm thấy mã giảm giá phù hợp.
                </p>
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
                      className={`p-3.5 rounded-2xl border transition flex items-start justify-between gap-3 cursor-pointer ${isSelected
                          ? isShipping ? "bg-emerald-50 border-emerald-500" : "bg-purple-50 border-purple-500"
                          : isEligible
                            ? isShipping
                              ? "bg-white border-slate-200 hover:border-emerald-300"
                              : "bg-white border-slate-200 hover:border-purple-300"
                            : "bg-slate-50 border-slate-100 opacity-60 cursor-not-allowed"
                        }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-mono font-bold text-[10px] px-2 py-0.5 rounded uppercase ${isShipping ? "bg-emerald-100 text-emerald-800" : "bg-purple-100 text-purple-800"
                              }`}
                          >
                            {isShipping ? "🚚 Ship" : "🏪 Shop"}
                          </span>
                          <span className="font-mono font-bold text-xs text-slate-800">{v.code}</span>
                        </div>
                        <p className="text-xs font-bold text-slate-900">{v.title}</p>
                        {v.description && (
                          <p className="text-[10px] text-slate-500">{v.description}</p>
                        )}
                        {v.minOrder && (
                          <p className="text-[10px] text-slate-400">
                            Đơn tối thiểu: {formatCurrency(v.minOrder)}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={!isEligible}
                        className={`text-xs font-bold px-3 py-1.5 rounded-xl shrink-0 transition ${isSelected
                            ? isShipping ? "bg-emerald-600 text-white" : "bg-purple-600 text-white"
                            : isEligible
                              ? isShipping
                                ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                : "bg-purple-50 text-purple-700 hover:bg-purple-100"
                              : "bg-slate-200 text-slate-400"
                          }`}
                      >
                        {isSelected ? "Đang dùng" : isEligible ? "Chọn mã" : "Chưa đủ ĐK"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowVoucherModal(false)}
                className="w-full bg-slate-900 text-white font-bold py-2.5 rounded-xl text-xs uppercase"
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