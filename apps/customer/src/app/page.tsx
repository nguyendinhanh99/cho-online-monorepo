"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useCartStore } from "@/store/useCartStore";
import { db } from "@cho-online/firebase";
import { collection, getDocs, doc, updateDoc, increment, query, where } from "firebase/firestore";
import ProductDetailModal from "@/components/ProductDetailModal";
import ShopDetailModal from "@/components/ShopDetailModal";

interface Review {
  id: string;
  userName: string;
  avatar: string;
  rating: number;
  date: string;
  comment: string;
}

interface Shop {
  id: string;
  merchantCode?: string;
  name: string;
  avatar: string;
  rating: number;
  reviewCount: number;
  distance: string;
  location: string;
  address?: string;
  storeAddress?: string;
  lat?: number | null;
  lng?: number | null;
  isOpen: boolean;
  openTime?: string;
  closeTime?: string;
}

interface Product {
  id: string;
  shopId: string;
  merchantId: string;
  merchantCode: string;
  shopName: string;
  address?: string;
  storeAddress?: string;
  isFavorite?: boolean;
  isAvailable?: boolean;
  name: string;
  description: string;
  price: number;
  originalPrice: number;
  discountStock?: number | null;
  maxPerUser?: number | null;
  discountStartTime?: string | null;
  discountEndTime?: string | null;
  imageUrl: string;
  imageUrls: string[];
  soldCount: number;
  reviewCount?: number;
  discountBadge?: string;
  stockProgress?: number;
  category: string;
  prepTime?: number;
  reviews: Review[];
}

interface UserLocation {
  customerName: string;
  customerPhone: string;
  address: string;
  lat?: number | null;
  lng?: number | null;
}

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
  endDate?: string | null;
  isActive?: boolean;
}

const HOT_KEYWORDS = ["Cơm tấm", "Trà sữa", "Bún đậu", "Bánh mì", "Cafe", "Gà rán", "Lẩu"];

const CATEGORY_SUGGESTIONS: Record<string, string[]> = {
  "☕ Cà phê": [
    "Cà phê đen đá", "Cà phê sữa đá", "Bạc xỉu", "Cà phê muối", "Capuchino", "Espresso", "Americano", "Latte", "Cà phê cốt dừa"
  ],
  "🧋 Trà sữa": [
    "Trà sữa truyền thống", "Trà sữa trân châu đường đen", "Trà sữa Ô long", "Trà sữa Matcha", "Trà sữa Khoai môn", "Trà sữa Thái xanh/đỏ"
  ],
  "🍹 Trà trái cây & Trà ủ": [
    "Trà đào cam sả", "Trà vải măng cầu", "Trà dâu tằm", "Trà tắc xí muội", "Trà mãng cầu", "Trà ổi hồng", "Trà hoa cúc"
  ],
  "🥤 Nước ép & Sinh tố": [
    "Nước ép cam tươi", "Nước ép táo cần tây", "Nước ép dưa hấu", "Nước ép dứa", "Sinh tố bơ", "Sinh tố xoài", "Sinh tố mảng cầu"
  ],
  "🥛 Sữa chua & Bingsu": [
    "Sữa chua trân châu Hạ Long", "Sữa chua hoa quả", "Sữa chua nếp cẩm", "Bingsu dâu tây", "Bingsu xoài", "Bingsu matcha"
  ],
  "🍾 Đồ uống đóng chai": [
    "Nước khoáng", "Nước ngọt có ga", "Trà xanh C2/0 độ", "Nước tăng lực Redbull", "Bia đóng chai/lon", "Rượu chát"
  ],
  "🍳 Điểm tâm & Ăn sáng": [
    "Bánh mì ốp la", "Bánh mì pate thịt", "Xôi mặn", "Xôi xéo", "Bánh cuộn", "Bánh bao", "Bánh mì chảo"
  ],
  "🍚 Cơm & Món chính": [
    "Cơm tấm sườn nướng", "Cơm gà xối mỡ", "Cơm văn phòng", "Cơm chiên Dương Châu", "Cơm bò lúc lắc", "Cơm sườn xào chua ngọt"
  ],
  "🍜 Bún, Phở & Mì": [
    "Phở bò", "Phở gà", "Bún bò Huế", "Bún thịt nướng", "Mì Quảng", "Bún đậu mắm tôm", "Mì xào hải sản", "Hủ tiếu Nam Vang"
  ],
  "🍲 Lẩu & Nướng": [
    "Lẩu Thai Tomyum", "Lẩu Tứ Xuyên", "Lẩu riêu cua bắp bò", "Lẩu hải sản", "Thịt nướng BBQ", "Chân gà nướng", "Hải sản nướng"
  ],
  "🥣 Yến & Cháo bổ dưỡng": [
    "Cháo sườn", "Cháo gà", "Cháo ếch Singapore", "Cháo tổ yến", "Yến chưng đường phèn", "Yến chưng hạt sen", "Súp bào ngư"
  ],
  "🍿 Đồ ăn vặt": [
    "Cá viên chiên", "Bánh tráng trộn", "Khoai tây chiên", "Chân gà sả tắc", "Nem chua rán", "Bột chiên", "Xúc xích nướng"
  ],
  "🍰 Bánh & Tráng miệng": [
    "Bánh mì tỏi phô mai", "Bánh Tiramisu", "Bánh bông lan trứng muối", "Chè Bưởi", "Tào phớ", "Chè thái", "Flan"
  ],
  "🥗 Món Chay & Health": [
    "Cơm chay thanh tịnh", "Bún chay", "Lẩu nấm chay", "Salad ức gà", "Poke Bowl", "Bánh mì đen Healthy", "Granola"
  ],
  "🍻 Món nhậu & Mồi bén": [
    "Mực khô nướng", "Đậu hũ lướt ván", "Gỏi ngó sen tôm thịt", "Bò lúc lắc", "Sụn gà rang muối", "Ếch sapo"
  ],
  "🔥 Best Seller & Hot Trend": [
    "Món bán chạy nhất", "Món mới ra mắt", "Trending tuần này"
  ],
  "🍱 Combo Tiết Kiệm": [
    "Combo Đơn (1 người)", "Combo Đôi (2 người)", "Combo Gia Đình", "Combo Văn Phòng", "Combo Tiệc Bè Bạn"
  ],
  "🏷️ Món Khuyến Mãi Flash Sale": [
    "Giảm sâu 50%", "Đồng giá 19k", "Mua 1 Tặng 1", "Món 0đ"
  ]
};

const formatSoldCount = (count: number = 0): string => {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1).replace(".0", "")}k`;
  }
  return `${count}`;
};

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<string>("all");
  const [quickFilter, setQuickFilter] = useState<string>("recommend");
  const [shops, setShops] = useState<Record<string, Shop>>({});
  const [products, setProducts] = useState<Product[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [savedVouchers, setSavedVouchers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // State kiểm tra Client Mount chống lỗi Hydration
  const [isMounted, setIsMounted] = useState(false);

  // State thông tin người dùng / địa chỉ giao hàng
  const [userInfo, setUserInfo] = useState<UserLocation>({
    customerName: "Khách Hàng",
    customerPhone: "0987654321",
    address: "45 Phan Đình Phùng, TP Hà Tĩnh",
    lat: 18.3445,
    lng: 105.8978,
  });

  // FLASH SALE TABS & REMINDERS STATE
  const [flashTab, setFlashTab] = useState<"active" | "upcoming">("active");
  const [reminders, setReminders] = useState<Record<string, boolean>>({});

  // 🔍 STATE TÌM KIẾM
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);

  // 📍 TỌA ĐỘ ĐÃ GEOCODE CỦA CÁC QUÁN
  const [shopCoordinates, setShopCoordinates] = useState<Record<string, { lat: number; lng: number }>>({});

  // 🔔 UI/UX CUSTOM NOTIFICATION STATE (Toast Messages)
  interface ToastMessage {
    id: string;
    type: "success" | "warning" | "info" | "error";
    title: string;
    message: string;
  }
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((title: string, message: string, type: "success" | "warning" | "info" | "error" = "success") => {
    const id = Math.random().toString(36).substring(2, 10);
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  useEffect(() => {
    setIsMounted(true); // Đánh dấu Client mount thành công

    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("search_history_fnb");
      if (saved) {
        try {
          setSearchHistory(JSON.parse(saved));
        } catch (e) {
          console.error(e);
        }
      }
      const userSavedVouchers = localStorage.getItem("saved_vouchers");
      if (userSavedVouchers) {
        try {
          setSavedVouchers(JSON.parse(userSavedVouchers));
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const saveSearchKeyword = (keyword: string) => {
    const trimmed = keyword.trim();
    if (!trimmed) return;
    const updated = [trimmed, ...searchHistory.filter((k) => k !== trimmed)].slice(0, 5);
    setSearchHistory(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem("search_history_fnb", JSON.stringify(updated));
    }
  };

  const clearHistory = () => {
    setSearchHistory([]);
    if (typeof window !== "undefined") {
      localStorage.removeItem("search_history_fnb");
    }
  };

  const handleSaveVoucher = (vCode: string) => {
    let updated: string[];
    if (savedVouchers.includes(vCode)) {
      updated = savedVouchers.filter((c) => c !== vCode);
      showToast("Bỏ lưu voucher", `Đã xóa mã ${vCode} khỏi ví của bạn.`, "info");
    } else {
      updated = [...savedVouchers, vCode];
      showToast("Lưu mã thành công! 🎉", `Đã thêm mã ${vCode} vào ví voucher.`, "success");
    }
    setSavedVouchers(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem("saved_vouchers", JSON.stringify(updated));
    }
  };

  // 🌟 TỰ ĐỘNG LẤY THÔNG TIN USER TỪ FIRESTORE
  useEffect(() => {
    async function fetchUserFromFirebase() {
      try {
        const targetPhone = localStorage.getItem("user_phone") || "0987654321";

        const usersRef = collection(db, "users");
        const q = query(usersRef, where("phone", "==", targetPhone));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const userData = querySnapshot.docs[0].data();

          setUserInfo((prev) => ({
            ...prev,
            customerName: userData.fullName || userData.name || userData.customerName || prev.customerName,
            customerPhone: userData.phone || userData.phoneNumber || targetPhone,
            address: userData.address || userData.streetAddress || prev.address,
            lat: userData.lat ?? userData.location?.latitude ?? prev.lat,
            lng: userData.lng ?? userData.location?.longitude ?? prev.lng,
          }));
        } else {
          console.warn("⚠️ Không tìm thấy thông tin user trong Firestore với SĐT:", targetPhone);
        }
      } catch (error) {
        console.error("❌ Lỗi khi tải thông tin user từ Firebase:", error);
      }
    }

    fetchUserFromFirebase();
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("user_shipping_info");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setUserInfo((prev) => ({
            ...prev,
            customerName: parsed.customerName || parsed.name || prev.customerName,
            customerPhone: parsed.customerPhone || parsed.phone || prev.customerPhone,
            address: parsed.address || prev.address,
            lat: parsed.location?.latitude ?? parsed.lat ?? prev.lat,
            lng: parsed.location?.longitude ?? parsed.lng ?? prev.lng,
          }));
        } catch (e) {
          console.warn("Lỗi đọc vị trí:", e);
        }
      }
    }
  }, []);

  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Zustand Cart Store
  const addItemToCart = useCartStore((state) => state.addItem);
  const openCart = useCartStore((state) => state.openCart);
  const getTotalItems = useCartStore((state) => state.getTotalItems);

  const totalCartCount = isMounted ? getTotalItems() : 0;

  // 📏 HÀM TÍNH KHOẢNG CÁCH HAVERSINE (CỘNG THÊM 1 KM)
  const calculateHaversineDistance = useCallback(
    (lat1: number, lon1: number, lat2: number, lon2: number): { text: string; km: number } => {
      const R = 6371;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;

      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      const dist = R * c + 1;

      if (dist < 1) {
        return { text: `${Math.max(100, Math.round(dist * 1000))}m`, km: dist };
      }
      return { text: `${dist.toFixed(1)} km`, km: dist };
    },
    []
  );

  // 🗺️ HÀM TỰ ĐỘNG CHUYỂN CHUỖI ĐỊA CHỈ THÀNH TỌA ĐỘ LAT/LNG (GEOCODING)
  const geocodeAddress = useCallback(async (addressStr: string): Promise<{ lat: number; lng: number } | null> => {
    if (!addressStr || addressStr.trim().length < 3) return null;
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressStr)}&limit=1`
      );
      const data = await res.json();
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
        };
      }
    } catch (err) {
      console.warn("Geocoding failed for address:", addressStr, err);
    }
    return null;
  }, []);

  useEffect(() => {
    if (!userInfo.address) return;
    const timer = setTimeout(async () => {
      const coords = await geocodeAddress(userInfo.address);
      if (coords) {
        setUserInfo((prev) => ({
          ...prev,
          lat: coords.lat,
          lng: coords.lng,
        }));
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [userInfo.address, geocodeAddress]);

  const checkProductDiscount = useCallback((product: Product) => {
    const hasOriginal = product.originalPrice && product.originalPrice > product.price;
    if (!hasOriginal) return { isDiscountActive: false, currentPrice: product.price, discountPercent: 0 };

    const now = new Date();

    if (product.discountStartTime && now < new Date(product.discountStartTime)) {
      return { isDiscountActive: false, currentPrice: product.originalPrice, discountPercent: 0 };
    }

    if (product.discountEndTime && now > new Date(product.discountEndTime)) {
      return { isDiscountActive: false, currentPrice: product.originalPrice, discountPercent: 0 };
    }

    if (product.discountStock !== undefined && product.discountStock !== null && product.discountStock <= 0) {
      return { isDiscountActive: false, currentPrice: product.originalPrice, discountPercent: 0 };
    }

    const discountPercent = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
    return { isDiscountActive: true, currentPrice: product.price, discountPercent };
  }, []);

  const updateProductStockInDb = async (productId: string, qty: number, isDiscount: boolean) => {
    try {
      const productRef = doc(db, "products", productId);

      if (isDiscount) {
        await updateDoc(productRef, {
          discountStock: increment(-qty),
          soldCount: increment(qty),
          updatedAt: new Date(),
        });
      } else {
        await updateDoc(productRef, {
          soldCount: increment(qty),
          stock: increment(-qty),
          updatedAt: new Date(),
        });
      }

      setProducts((prev) =>
        prev.map((p) => {
          if (p.id === productId) {
            return {
              ...p,
              discountStock:
                isDiscount && p.discountStock !== null && p.discountStock !== undefined
                  ? Math.max(0, p.discountStock - qty)
                  : p.discountStock,
              soldCount: (p.soldCount || 0) + qty,
            };
          }
          return p;
        })
      );
    } catch (error) {
      console.error("❌ Lỗi cập nhật Database Firebase:", error);
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      try {
        setLoading(true);

        const [merchantsSnap, productsSnap, reviewsSnap, vouchersSnap] = await Promise.all([
          getDocs(collection(db, "merchants")),
          getDocs(collection(db, "products")),
          getDocs(collection(db, "reviews")),
          getDocs(query(collection(db, "vouchers"), where("isActive", "==", true))),
        ]);

        const shopReviewStats: Record<string, { totalRating: number; count: number }> = {};
        reviewsSnap.forEach((docSnap) => {
          const revData = docSnap.data();
          const shopCode = revData.merchantCode;
          const shopId = revData.merchantId || revData.shopId;
          const ratingVal = Number(revData.productRating || revData.rating || 0);

          if (ratingVal > 0) {
            const key = shopId || shopCode;
            if (key) {
              if (!shopReviewStats[key]) {
                shopReviewStats[key] = { totalRating: 0, count: 0 };
              }
              shopReviewStats[key].totalRating += ratingVal;
              shopReviewStats[key].count += 1;
            }
          }
        });

        const shopMap: Record<string, Shop> = {};
        const coordsToFetch: Record<string, string> = {};

        merchantsSnap.forEach((docSnap) => {
          const data = docSnap.data();

          if (data.businessCategory !== "F&B" && data.category !== "F&B") {
            return;
          }

          const rawAddress =
            data.address ||
            data.storeAddress ||
            data.shopAddress ||
            data.pickupLocation?.address ||
            data.location ||
            "";

          const lat = data.lat ?? data.latitude ?? data.pickupLocation?.latitude ?? null;
          const lng = data.lng ?? data.longitude ?? data.pickupLocation?.longitude ?? null;

          const rawAvatar = data.avatar || data.avatarUrl || "";
          const defaultAvatar = "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=100";

          const stats = shopReviewStats[docSnap.id] || (data.merchantCode ? shopReviewStats[data.merchantCode] : null);
          let calculatedRating = data.rating || 5.0;
          let calculatedReviewCount = data.reviewCount || 0;

          if (stats && stats.count > 0) {
            calculatedRating = Number((stats.totalRating / stats.count).toFixed(1));
            calculatedReviewCount = stats.count;
          }

          shopMap[docSnap.id] = {
            id: docSnap.id,
            merchantCode: data.merchantCode || "",
            name: data.shopName || data.storeName || data.fullName || data.name || "Quán Ăn ngon",
            avatar: rawAvatar.trim() !== "" ? rawAvatar : defaultAvatar,
            rating: calculatedRating,
            reviewCount: calculatedReviewCount,
            distance: data.distance || "2.0 km",
            location: typeof rawAddress === "string" ? rawAddress : "Hà Tĩnh",
            address: typeof rawAddress === "string" ? rawAddress : "Hà Tĩnh",
            storeAddress: typeof rawAddress === "string" ? rawAddress : "Hà Tĩnh",
            lat: lat !== null ? Number(lat) : null,
            lng: lng !== null ? Number(lng) : null,
            isOpen: data.isOpen !== undefined ? Boolean(data.isOpen) : true,
            openTime: data.openTime || "00:00",
            closeTime: data.closeTime || "23:00",
          };

          if ((lat === null || lng === null) && typeof rawAddress === "string" && rawAddress) {
            coordsToFetch[docSnap.id] = rawAddress;
          }
        });

        const fetchedProducts: Product[] = [];
        productsSnap.forEach((docSnap) => {
          const data = docSnap.data();

          const isAvailable = data.isAvailable !== undefined ? Boolean(data.isAvailable) : true;
          if (!isAvailable) return;

          const rawShopId = String(data.shopId || data.merchantId || "");
          const matchedShopKey = Object.keys(shopMap).find(
            (key) => key === rawShopId || shopMap[key].merchantCode === data.merchantCode
          );

          if (!matchedShopKey) return;

          const matchedShop = shopMap[matchedShopKey];

          const images: string[] =
            Array.isArray(data.imageUrls) && data.imageUrls.length > 0
              ? data.imageUrls
              : [data.imageUrl || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400"];

          const price = Number(data.price) || 0;
          const originalPrice = Number(data.originalPrice) || price;
          const productReviews = data.reviews || [];

          fetchedProducts.push({
            id: docSnap.id,
            shopId: matchedShopKey,
            merchantId: data.merchantId || data.shopId || "",
            merchantCode: data.merchantCode || matchedShop.merchantCode || "",
            shopName: matchedShop.name || data.shopName || "Quán ngon",
            address: matchedShop.address,
            storeAddress: matchedShop.storeAddress,
            name: data.name || "Món ăn ngon",
            description: data.description || "",
            price: price,
            originalPrice: originalPrice > price ? originalPrice : price,
            discountStock: data.discountStock ?? null,
            maxPerUser: data.maxPerUser !== undefined && data.maxPerUser !== null ? Number(data.maxPerUser) : null,
            discountStartTime: data.discountStartTime ?? null,
            discountEndTime: data.discountEndTime ?? null,
            imageUrl: images[0],
            imageUrls: images,
            soldCount: Number(data.soldCount || data.sold || data.totalSold || 0),
            reviewCount: productReviews.length || Number(data.reviewCount || 0),
            discountBadge: data.discountBadge || "",
            stockProgress: data.stockProgress || 60,
            category: data.category || "food",
            prepTime: data.prepTime || 15,
            isFavorite: data.isFeatured || data.isFavorite || false,
            isAvailable: isAvailable,
            reviews: productReviews,
          });
        });

        const fetchedVouchers: Voucher[] = [];
        vouchersSnap.forEach((docSnap) => {
          const vData = docSnap.data();
          fetchedVouchers.push({
            id: docSnap.id,
            code: vData.code || "",
            title: vData.title || "",
            description: vData.description || "",
            applyType: vData.applyType || "ORDER",
            discountType: vData.discountType || "FIXED",
            discountValue: Number(vData.discountValue || 0),
            maxDiscount: vData.maxDiscount ? Number(vData.maxDiscount) : null,
            minOrder: vData.minOrder ? Number(vData.minOrder) : null,
            usageLimit: vData.usageLimit ? Number(vData.usageLimit) : null,
            usedCount: Number(vData.usedCount || 0),
            endDate: vData.endDate || null,
            isActive: vData.isActive !== false,
          });
        });

        if (isMounted) {
          setShops(shopMap);
          setProducts(fetchedProducts);
          setVouchers(fetchedVouchers);
        }

        Object.entries(coordsToFetch).forEach(async ([sId, addressStr]) => {
          const res = await geocodeAddress(addressStr);
          if (res && isMounted) {
            setShopCoordinates((prev) => ({
              ...prev,
              [sId]: res,
            }));
          }
        });

      } catch (error) {
        console.error("❌ Lỗi lấy dữ liệu từ Firebase:", error);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchData();
    return () => {
      isMounted = false;
    };
  }, [geocodeAddress]);

  const calculatedDistances = useMemo(() => {
    const distances: Record<string, { text: string; km: number }> = {};
    const userLat = userInfo.lat;
    const userLng = userInfo.lng;

    for (const shop of Object.values(shops)) {
      const shopLat = shop.lat ?? shopCoordinates[shop.id]?.lat ?? null;
      const shopLng = shop.lng ?? shopCoordinates[shop.id]?.lng ?? null;

      if (userLat && userLng && shopLat && shopLng) {
        distances[shop.id] = calculateHaversineDistance(userLat, userLng, shopLat, shopLng);
      } else {
        distances[shop.id] = { text: shop.distance || "2.0 km", km: 2.0 };
      }
    }
    return distances;
  }, [userInfo.lat, userInfo.lng, shops, shopCoordinates, calculateHaversineDistance]);

  const getShopDistance = useCallback(
    (shop?: Shop) => {
      if (!shop) return "2.0 km";
      return calculatedDistances[shop.id]?.text || shop.distance || "2.0 km";
    },
    [calculatedDistances]
  );

  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  }, []);

  const handleAddToCart = useCallback(
    async (product: Product) => {
      const shop = shops[product.shopId];
      if (shop && !shop.isOpen) {
        showToast("Quán đang đóng cửa", "Quán hiện đang đóng cửa, vui lòng quay lại sau!", "warning");
        return;
      }

      const distance = getShopDistance(shop);

      (addItemToCart as any)(product, distance);
      showToast("Thêm vào giỏ thành công! 🛒", `Đã thêm "${product.name}" vào giỏ hàng.`, "success");

      const { isDiscountActive } = checkProductDiscount(product);
      await updateProductStockInDb(product.id, 1, isDiscountActive);
    },
    [shops, getShopDistance, addItemToCart, checkProductDiscount, showToast]
  );

  const { activeDeals, upcomingDeals } = useMemo(() => {
    const now = new Date();
    const active: (Product & { _discountPercent: number })[] = [];
    const upcoming: Product[] = [];

    products.forEach((p) => {
      const { isDiscountActive, discountPercent } = checkProductDiscount(p);
      if (isDiscountActive) {
        active.push({ ...p, _discountPercent: discountPercent });
      } else if (p.originalPrice > p.price && p.discountStartTime && new Date(p.discountStartTime) > now) {
        upcoming.push(p);
      }
    });

    active.sort((a, b) => b._discountPercent - a._discountPercent);

    return { activeDeals: active, upcomingDeals: upcoming };
  }, [products, checkProductDiscount]);

  useEffect(() => {
    if (activeDeals.length === 0 && upcomingDeals.length > 0) {
      setFlashTab("upcoming");
    }
  }, [activeDeals.length, upcomingDeals.length]);

  const toggleReminder = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setReminders((prev) => {
      const isSet = !prev[id];
      if (isSet) {
        showToast("Đã đặt nhắc nhở! ⏰", "Bạn sẽ nhận thông báo khi khung giờ ưu đãi bắt đầu.", "info");
      } else {
        showToast("Đã hủy nhắc nhở", "Đã gỡ lịch nhắc nhở cho ưu đãi này.", "info");
      }
      return { ...prev, [id]: isSet };
    });
  };

  const rankedProducts = useMemo(() => {
    const currentHour = new Date().getHours();

    return products.map((product) => {
      const shop = shops[product.shopId];
      const distKm = calculatedDistances[product.shopId]?.km ?? 2.0;
      const rating = shop?.rating || 5.0;
      const { isDiscountActive, discountPercent } = checkProductDiscount(product);

      const distanceScore = Math.max(0, (10 - distKm) * 10);
      const ratingScore = rating * 20;
      const popularityScore = Math.min(100, product.soldCount * 0.5);
      const promoScore = isDiscountActive ? discountPercent * 2 : 0;

      let timeScore = 0;
      const cat = product.category.toLowerCase();
      const name = product.name.toLowerCase();

      if (currentHour >= 6 && currentHour <= 9) {
        if (cat.includes("cafe") || name.includes("bánh mì") || name.includes("phở")) timeScore = 100;
      } else if (currentHour >= 11 && currentHour <= 13) {
        if (cat.includes("food") || name.includes("cơm") || name.includes("bún")) timeScore = 100;
      } else if (currentHour >= 14 && currentHour <= 17) {
        if (cat.includes("trà sữa") || cat.includes("snack") || name.includes("trà")) timeScore = 100;
      } else if (currentHour >= 18 && currentHour <= 21) {
        if (name.includes("lẩu") || name.includes("nướng") || cat.includes("food")) timeScore = 100;
      }

      const totalScore =
        distanceScore * 0.30 +
        ratingScore * 0.20 +
        popularityScore * 0.20 +
        promoScore * 0.15 +
        timeScore * 0.15;

      return {
        ...product,
        totalScore,
        distanceKm: distKm,
      };
    });
  }, [products, shops, calculatedDistances, checkProductDiscount]);

  // Thêm state lưu tổng số giây còn lại (1 tiếng = 3600 giây)
  const [timeLeft, setTimeLeft] = useState<number>(3600);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Hàm chuyển đổi giây sang định dạng HH : MM : SS
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, "0")} : ${String(m).padStart(2, "0")} : ${String(s).padStart(2, "0")}`;
  };

  const filteredProducts = useMemo(() => {
    let result = [...rankedProducts];

    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.shopName.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      );
    }

    if (activeTab !== "all") {
      result = result.filter((p) => {
        const catLower = p.category.toLowerCase();
        const tabLower = activeTab.toLowerCase();
        if (catLower.includes(tabLower) || tabLower.includes(catLower)) return true;

        const subItems = CATEGORY_SUGGESTIONS[activeTab];
        if (subItems && subItems.some((sub) => p.name.toLowerCase().includes(sub.toLowerCase()) || catLower.includes(sub.toLowerCase()))) {
          return true;
        }
        return false;
      });
    }

    if (quickFilter === "recommend") {
      result.sort((a, b) => b.totalScore - a.totalScore);
    } else if (quickFilter === "fast") {
      result.sort((a, b) => a.distanceKm - b.distanceKm);
    } else if (quickFilter === "discount") {
      result.sort((a, b) => {
        const discA = checkProductDiscount(a).discountPercent;
        const discB = checkProductDiscount(b).discountPercent;
        return discB - discA;
      });
    } else if (quickFilter === "bestseller") {
      result.sort((a, b) => b.soldCount - a.soldCount);
    }

    return result;
  }, [searchQuery, activeTab, quickFilter, rankedProducts, checkProductDiscount]);

  return (
    <div className="bg-[#f4f5f7] min-h-screen pb-24 font-sans text-stone-800 relative">
      {/* 🔔 MODERN FLOATING TOAST NOTIFICATION CONTAINER */}
      <div className="fixed top-20 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((toast) => {
          let bgGradient = "bg-gradient-to-r from-stone-900 to-stone-800 border-stone-700 text-white";
          let icon = "🔔";
          if (toast.type === "success") {
            bgGradient = "bg-gradient-to-r from-emerald-600 to-teal-600 border-emerald-500 text-white";
            icon = "✅";
          } else if (toast.type === "warning") {
            bgGradient = "bg-gradient-to-r from-amber-500 to-orange-600 border-amber-400 text-white";
            icon = "⚠️";
          } else if (toast.type === "info") {
            bgGradient = "bg-gradient-to-r from-sky-600 to-blue-600 border-sky-500 text-white";
            icon = "💡";
          } else if (toast.type === "error") {
            bgGradient = "bg-gradient-to-r from-rose-600 to-red-600 border-rose-500 text-white";
            icon = "❌";
          }

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl shadow-xl border backdrop-blur-md transform transition-all duration-300 animate-in fade-in slide-in-from-top-2 ${bgGradient}`}
            >
              <span className="text-xl shrink-0 mt-0.5">{icon}</span>
              <div className="flex-1 space-y-0.5">
                <h5 className="text-xs font-black tracking-wide">{toast.title}</h5>
                <p className="text-[11px] opacity-95 leading-snug">{toast.message}</p>
              </div>
              <button
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                className="text-white/70 hover:text-white p-1 text-xs font-bold transition shrink-0 cursor-pointer"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      {/* HEADER TÌM KIẾM & ĐỊA CHỈ */}
      <div className="sticky top-0 z-40 bg-gradient-to-r from-[#ff4500] via-[#ee4d2d] to-[#ff6036] p-3 text-white shadow-md space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 overflow-hidden flex-1 bg-black/15 px-3 py-1.5 rounded-full border border-white/25 shadow-inner">
            <span className="text-sm shrink-0 animate-bounce">🛵</span>
            <div className="text-[11px] leading-tight truncate flex-1">
              <span className="text-[9px] opacity-85 block font-medium">
                Khách: <strong>{userInfo.customerName}</strong> - Giao tới:
              </span>
              <input
                type="text"
                value={userInfo.address}
                onChange={(e) =>
                  setUserInfo((prev) => ({ ...prev, address: e.target.value }))
                }
                placeholder="Nhập địa chỉ của bạn..."
                className="bg-transparent text-white font-bold text-xs focus:outline-none w-full truncate placeholder:text-white/70"
              />
            </div>
          </div>

          <div
            onClick={openCart}
            className="relative p-2 bg-white/10 hover:bg-white/20 rounded-full transition cursor-pointer shadow-sm"
          >
            <span className="text-xl">🛒</span>
            {totalCartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-amber-300 text-[#ee4d2d] text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-[#ee4d2d] shadow-sm animate-pulse">
                {totalCartCount}
              </span>
            )}
          </div>
        </div>

        {/* SEARCH BAR */}
        <div className="relative" ref={searchRef}>
          <div className="relative flex items-center">
            <input
              type="text"
              value={searchQuery}
              onFocus={() => setIsSearchFocused(true)}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  saveSearchKeyword(searchQuery);
                  setIsSearchFocused(false);
                }
              }}
              placeholder="Thèm gì hôm nay? Cơm tấm, Trà sữa, Bún đậu..."
              className="w-full bg-white text-stone-800 text-xs py-2.5 pl-9 pr-20 rounded-xl outline-none placeholder:text-stone-400 shadow-inner font-medium"
            />
            <span className="absolute left-3 text-stone-400 text-xs">🔍</span>

            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-14 text-stone-400 hover:text-stone-600 p-1 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            )}

            <button
              onClick={() => {
                saveSearchKeyword(searchQuery);
                setIsSearchFocused(false);
              }}
              className="absolute right-1 top-1 bottom-1 bg-[#ee4d2d] hover:bg-[#d73f20] text-white px-3.5 rounded-lg text-[11px] font-bold transition cursor-pointer shadow-sm"
            >
              Tìm
            </button>
          </div>

          {isSearchFocused && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-stone-200/80 p-3 z-50 text-stone-800 space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
              {searchHistory.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-bold text-stone-400">
                    <span>LỊCH SỬ TÌM KIẾM</span>
                    <button
                      onClick={clearHistory}
                      className="text-stone-400 hover:text-[#ee4d2d] cursor-pointer"
                    >
                      Xóa
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {searchHistory.map((item, idx) => (
                      <span
                        key={idx}
                        onClick={() => {
                          setSearchQuery(item);
                          setIsSearchFocused(false);
                        }}
                        className="bg-stone-100 hover:bg-orange-50 hover:text-[#ee4d2d] text-stone-600 text-[11px] px-2.5 py-1 rounded-full cursor-pointer transition font-medium"
                      >
                        🕒 {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <div className="text-[10px] font-bold text-stone-400 flex items-center gap-1">
                  <span>🔥 TÌM KIẾM PHỔ BIẾN</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {HOT_KEYWORDS.map((kw, idx) => (
                    <span
                      key={idx}
                      onClick={() => {
                        setSearchQuery(kw);
                        saveSearchKeyword(kw);
                        setIsSearchFocused(false);
                      }}
                      className="bg-orange-50 hover:bg-orange-100 text-[#ee4d2d] border border-orange-200/60 text-[11px] px-2.5 py-1 rounded-full cursor-pointer transition font-bold"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 🎟️ PHẦN VOUCHER & KHUYẾN MÃI TOÀN SÀN */}
      {!searchQuery && vouchers.length > 0 && (
        <div className="bg-gradient-to-b from-amber-500/10 via-orange-500/5 to-transparent py-2.5 border-b border-orange-200/40">
          <div className="px-3 flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-base">🎟️</span>
              <div>
                <h3 className="text-[11px] font-black text-stone-900 tracking-tight flex items-center gap-1">
                  KHO VOUCHER
                </h3>
              </div>
            </div>

          </div>

          <div className="flex gap-2 overflow-x-auto no-scrollbar px-3 py-0.5">
            {vouchers.map((v) => {
              const isSaved = savedVouchers.includes(v.code);
              const isFreeship = v.applyType === "SHIPPING";

              const used = v.usedCount || 0;
              const limit = v.usageLimit || 100;
              const usedPercent = Math.min(100, Math.round((used / limit) * 100));

              return (
                <div
                  key={v.id}
                  className={`min-w-[210px] max-w-[210px] bg-white rounded-xl border shadow-2xs flex overflow-hidden relative transition-all duration-200 hover:shadow-sm ${isSaved ? "border-emerald-500/80 bg-emerald-50/10" : "border-amber-200/80"
                    }`}
                >
                  <div
                    className={`w-14 shrink-0 flex flex-col items-center justify-center p-1.5 text-white text-center relative border-r border-dashed border-stone-200 ${isFreeship
                      ? "bg-gradient-to-br from-emerald-500 to-teal-600"
                      : "bg-gradient-to-br from-orange-500 to-[#ee4d2d]"
                      }`}
                  >
                    <span className="text-lg mb-0.5">{isFreeship ? "🚚" : "💵"}</span>
                    <span className="text-[8px] font-black uppercase leading-tight">
                      {isFreeship ? "FREESHIP" : "GIẢM ĐƠN"}
                    </span>

                    <div className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-[#f4f5f7]"></div>
                    <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 rounded-full bg-[#f4f5f7]"></div>
                  </div>

                  <div className="flex-1 p-1.5 flex flex-col justify-between space-y-1">
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono text-[9px] font-black text-stone-800 bg-stone-100 px-1 py-0.2 rounded border border-stone-200 truncate">
                          {v.code}
                        </span>
                        {v.minOrder && v.minOrder > 0 && (
                          <span className="text-[8px] font-bold text-amber-700 bg-amber-50 px-1 py-0.2 rounded shrink-0">
                            ≥{formatCurrency(v.minOrder)}
                          </span>
                        )}
                      </div>

                      <h4 className="text-[10px] font-bold text-stone-800 leading-tight mt-1 line-clamp-1">
                        {v.title}
                      </h4>
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex justify-between items-center text-[7px] text-stone-400 font-medium">
                        <span>Đã dùng {usedPercent}%</span>
                        {v.endDate && (
                          <span>HSD: {new Date(v.endDate).toLocaleDateString("vi-VN")}</span>
                        )}
                      </div>
                      <div className="w-full bg-stone-100 h-1 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${isFreeship ? "bg-teal-500" : "bg-[#ee4d2d]"
                            }`}
                          style={{ width: `${usedPercent > 0 ? usedPercent : 10}%` }}
                        ></div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSaveVoucher(v.code)}
                      className={`w-full py-0.5 text-[9px] font-bold rounded-md transition active:scale-95 flex items-center justify-center cursor-pointer ${isSaved
                        ? "bg-emerald-600 text-white"
                        : "bg-orange-100 hover:bg-orange-200 text-[#ee4d2d]"
                        }`}
                    >
                      <span>{isSaved ? "✓ Đã lưu" : "Lưu mã"}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUGGESTION / RECOMMENDATION */}
      <div className="bg-white py-3 px-3 border-b border-stone-200/60 shadow-2xs space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black text-stone-800 tracking-tight flex items-center gap-1">
            <span>✨</span> ĐỀ XUẤT MÓN ĂN CHO BẠN
          </h3>
          <span className="text-[10px] text-[#ee4d2d] font-bold bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200/50">
            AI gợi ý
          </span>
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
          {[
            { id: "smart_lunch", label: "Cơm Trưa Nóng", emoji: "🍱", desc: "No lâu, ship 15p", category: "🍚 Cơm & Món chính", filter: "fast" },
            { id: "smart_milktea", label: "Trà Sữa & Cafe", emoji: "🧋", desc: "Giảm sâu hôm nay", category: "🧋 Trà sữa", filter: "discount" },
            { id: "smart_noodle", label: "Bún - Phở - Mì", emoji: "🍜", desc: "Nước dùng đậm đà", category: "🍜 Bún, Phở & Mì", filter: "recommend" },
            { id: "smart_dessert", label: "Bánh & Tráng Miệng", emoji: "🍰", desc: "Chè bưởi, Bánh ngọt", category: "🍰 Bánh & Tráng miệng", filter: "recommend" },
            { id: "smart_coffee", label: "Cà Phê Sáng", emoji: "☕", desc: "Năng lượng ngày mới", category: "☕ Cà phê", filter: "bestseller" },
          ].map((item) => {
            const isActive = activeTab === item.category && searchQuery === "";

            return (
              <div
                key={item.id}
                onClick={() => {
                  if (isActive) {
                    setActiveTab("all");
                    setQuickFilter("recommend");
                  } else {
                    setActiveTab(item.category);
                    setQuickFilter(item.filter);
                    setSearchQuery("");
                  }
                }}
                className={`min-w-[130px] rounded-xl p-2.5 cursor-pointer transition-all duration-200 shrink-0 space-y-1 relative active:scale-95 border ${isActive
                  ? "bg-gradient-to-br from-orange-500 to-[#ee4d2d] text-white border-[#ee4d2d] shadow-md -translate-y-0.5 ring-2 ring-orange-300/50"
                  : "bg-gradient-to-br from-orange-50/60 to-amber-50/30 border-orange-200/60 text-stone-800 hover:border-[#ee4d2d] hover:bg-orange-50"
                  }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{item.emoji}</span>
                  <span
                    className={`text-[9px] font-black px-1.5 py-0.5 rounded-md transition ${isActive
                      ? "bg-white text-[#ee4d2d] shadow-xs"
                      : "bg-orange-200/60 text-orange-900"
                      }`}
                  >
                    {isActive ? "✓ Đang chọn" : "Gợi ý"}
                  </span>
                </div>

                <div className="pt-0.5">
                  <p className={`text-[11px] font-bold truncate ${isActive ? "text-white" : "text-stone-800"}`}>
                    {item.label}
                  </p>
                  <p className={`text-[9px] truncate ${isActive ? "text-orange-100 font-medium" : "text-stone-500"}`}>
                    {item.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* QUICK FILTERS */}
      <div className="px-2 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar bg-stone-100/85 sticky top-[108px] z-30 backdrop-blur-md">
        {[
          { id: "recommend", label: "🎯 Gợi ý cho bạn (AI)" },
          { id: "fast", label: "⚡ Giao gần nhất" },
          { id: "discount", label: "🔥 Giảm giá sâu" },
          { id: "bestseller", label: "👑 Bán chạy nhất" },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setQuickFilter(f.id)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap border transition cursor-pointer shrink-0 ${quickFilter === f.id
              ? "bg-[#ee4d2d] text-white border-[#ee4d2d] shadow-2xs"
              : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"
              }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {searchQuery && (
        <div className="px-3 py-2 bg-orange-100/70 border-b border-orange-200 flex items-center justify-between text-xs">
          <span>
            Kết quả cho từ khóa: <strong className="text-[#ee4d2d]">"{searchQuery}"</strong> ({filteredProducts.length} món)
          </span>
          <button
            onClick={() => setSearchQuery("")}
            className="text-[11px] text-[#ee4d2d] font-bold underline cursor-pointer"
          >
            Xóa tìm kiếm
          </button>
        </div>
      )}

      {/* FLASH DEAL */}
      {!searchQuery && (activeDeals.length > 0 || upcomingDeals.length > 0) && (
        <div className="bg-white my-2 py-3.5 border-y border-stone-200/70 shadow-2xs">
          <div className="px-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="bg-gradient-to-r from-red-600 to-[#ee4d2d] text-white font-black italic text-xs px-2.5 py-1 rounded-lg tracking-wider flex items-center gap-1 shadow-xs">
                  <span className="animate-bounce">⚡</span> FLASH DEAL CỬA HÀNG
                </div>

                {flashTab === "active" && (
                  <div className="flex items-center gap-1 text-[11px] font-bold text-stone-700">
                    <span className="text-stone-400 font-normal">Kết thúc:</span>
                    {flashTab === "active" && (
                      <div className="flex items-center gap-1 text-[11px] font-bold text-stone-700">
                        <span className="bg-stone-900 text-amber-400 font-mono text-[10px] px-1.5 py-0.5 rounded-md font-bold">
                          {formatTime(timeLeft)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button className="text-[11px] text-[#ee4d2d] font-bold hover:underline flex items-center gap-0.5 cursor-pointer">
                Xem tất cả <span className="text-[9px]">➔</span>
              </button>
            </div>

            <div className="flex items-center gap-2 border-b border-stone-100 pb-2">
              <button
                onClick={() => setFlashTab("active")}
                className={`text-xs font-bold px-3 py-1 rounded-full transition cursor-pointer flex items-center gap-1.5 ${flashTab === "active"
                  ? "bg-rose-50 text-[#ee4d2d] border border-rose-200 shadow-2xs"
                  : "text-stone-500 hover:bg-stone-100"
                  }`}
              >
                <span>🔥 Đang ưu đãi</span>
                <span className="bg-[#ee4d2d] text-white text-[9px] px-1.5 py-0.2 rounded-full font-extrabold">
                  {activeDeals.length}
                </span>
              </button>

              {upcomingDeals.length > 0 && (
                <button
                  onClick={() => setFlashTab("upcoming")}
                  className={`text-xs font-bold px-3 py-1 rounded-full transition cursor-pointer flex items-center gap-1.5 ${flashTab === "upcoming"
                    ? "bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs"
                    : "text-stone-500 hover:bg-stone-100"
                    }`}
                >
                  <span>⏰ Sắp mở bán</span>
                  <span className="bg-amber-500 text-white text-[9px] px-1.5 py-0.2 rounded-full font-extrabold">
                    {upcomingDeals.length}
                  </span>
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-2.5 overflow-x-auto no-scrollbar px-3 pt-2">
            {(flashTab === "active" ? activeDeals : upcomingDeals).map((item) => {
              const shop = shops[item.shopId];
              const isShopOpen = shop ? shop.isOpen : true;
              const { isDiscountActive, currentPrice, discountPercent } = checkProductDiscount(item);
              const distanceStr = getShopDistance(shop);

              const startTimeFormatted = item.discountStartTime
                ? new Date(item.discountStartTime).toLocaleTimeString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
                : "Sắp tới";

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedProduct(item)}
                  className={`min-w-[145px] max-w-[145px] bg-white border border-stone-200/90 rounded-2xl p-2 relative flex flex-col justify-between shadow-2xs cursor-pointer hover:border-[#ee4d2d] hover:shadow-md transition-all duration-200 group ${!isShopOpen ? "opacity-60" : ""
                    }`}
                >
                  {discountPercent > 0 && (
                    <div
                      className={`absolute top-0 right-0 text-white text-[10px] font-black px-2 py-0.5 rounded-bl-xl rounded-tr-2xl z-10 shadow-xs flex flex-col items-center leading-none ${discountPercent >= 30
                        ? "bg-gradient-to-b from-purple-600 via-red-600 to-[#ee4d2d] animate-pulse"
                        : "bg-gradient-to-b from-red-500 to-[#ee4d2d]"
                        }`}
                    >
                      <span>-{discountPercent}%</span>
                      <span className="text-[7px] font-medium uppercase text-amber-200">
                        {discountPercent >= 30 ? "HOT SALE" : "OFF"}
                      </span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    {/* ĐÃ CẬP NHẬT: Thay aspect-square bằng h-24 để khung ảnh thấp hơn */}
                    <div className="h-24 bg-stone-100 rounded-xl overflow-hidden relative group-hover:scale-[1.02] transition duration-200">
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />

                      <span className="absolute top-1 left-1 bg-black/70 text-amber-300 border border-amber-300/30 text-[8px] font-extrabold px-1.5 py-0.5 rounded-md backdrop-blur-xs">
                        📍 {distanceStr}
                      </span>

                      <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[8px] font-semibold px-1.5 py-0.5 rounded-md backdrop-blur-xs">
                        ⏱️ ~{item.prepTime || 15}p
                      </span>

                      {item.discountBadge && (
                        <div className="absolute top-6 left-1">
                          <span className="bg-stone-900/80 text-amber-300 backdrop-blur-xs border border-amber-300/30 text-[7px] font-extrabold px-1 py-0.5 rounded-xs shadow-2xs">
                            🏷️ {item.discountBadge}
                          </span>
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="text-[9px] font-semibold text-stone-400 truncate">
                        🏬 {item.shopName}
                      </p>
                      <h4 className="text-[11px] font-bold text-stone-800 line-clamp-1 group-hover:text-[#ee4d2d] transition">
                        {item.name}
                      </h4>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1.5 border-t border-stone-100 mt-1">
                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xs font-black text-[#ee4d2d]">
                          {formatCurrency(flashTab === "active" ? currentPrice : item.price)}
                        </span>
                      </div>
                      {item.originalPrice > (flashTab === "active" ? currentPrice : item.price) && (
                        <div className="text-[9px] text-stone-400 line-through">
                          {formatCurrency(item.originalPrice)}
                        </div>
                      )}
                    </div>

                    {flashTab === "active" && (
                      <div className="space-y-1">
                        {item.maxPerUser !== undefined && item.maxPerUser !== null && Number(item.maxPerUser) > 0 ? (
                          <div className="bg-purple-50 border border-purple-100 text-purple-700 rounded-full text-center py-0.5">
                            <span className="text-[8px] font-black">
                              👑 Tối đa {item.maxPerUser} món/khách
                            </span>
                          </div>
                        ) : item.discountStock !== undefined && item.discountStock !== null ? (
                          <div className="bg-rose-50 border border-rose-100 text-[#ee4d2d] rounded-full text-center py-0.5">
                            <span className="text-[8px] font-black">
                              🔥 Còn {item.discountStock} suất giảm giá
                            </span>
                          </div>
                        ) : (
                          <div className="relative w-full bg-orange-100 h-3.5 rounded-full overflow-hidden text-center">
                            <div
                              className="bg-gradient-to-r from-orange-500 to-[#ee4d2d] h-full rounded-full transition-all"
                              style={{ width: `${Math.min(100, (item.soldCount / 100) * 100)}%` }}
                            ></div>
                            <span className="absolute inset-0 text-[8px] font-black text-white leading-3.5 uppercase tracking-tight">
                              Đã bán {formatSoldCount(item.soldCount)}
                            </span>
                          </div>
                        )}

                        <button
                          type="button"
                          disabled={!isShopOpen}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddToCart(item);
                          }}
                          className="w-full bg-[#ee4d2d] hover:bg-[#d73f20] text-white text-[10px] font-bold py-1 rounded-lg transition active:scale-95 shadow-2xs flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <span>+ Thêm món</span>
                        </button>
                      </div>
                    )}

                    {flashTab === "upcoming" && (
                      <div className="space-y-1">
                        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-md text-center py-0.5">
                          <span className="text-[8px] font-bold">
                            ⏰ Mở bán {startTimeFormatted}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => toggleReminder(item.id, e)}
                          className={`w-full text-[10px] font-bold py-1 rounded-lg transition active:scale-95 flex items-center justify-center gap-1 border cursor-pointer ${reminders[item.id]
                            ? "bg-amber-500 text-white border-amber-500"
                            : "bg-white text-amber-600 border-amber-400 hover:bg-amber-50"
                            }`}
                        >
                          <span>{reminders[item.id] ? "✓ Đã đặt" : "🔔 Nhắc tôi"}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CATEGORY COMPREHENSIVE TABS */}
      <div className="bg-white border-b border-stone-200/80 shadow-2xs mt-1 py-2">
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-3 whitespace-nowrap">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition shrink-0 cursor-pointer ${activeTab === "all"
              ? "bg-stone-900 text-white border-stone-900 shadow-xs"
              : "bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100"
              }`}
          >
            🌈 Tất cả ({products.length})
          </button>

          {Object.keys(CATEGORY_SUGGESTIONS).map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveTab(cat)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition shrink-0 cursor-pointer ${activeTab === cat
                ? "bg-orange-500 text-white border-orange-500 shadow-xs"
                : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"
                }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* DANH SÁCH TẤT CẢ SẢN PHẨM */}
      {loading ? (
        <div className="p-2 grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="bg-white rounded-xl p-2 space-y-2 animate-pulse border border-stone-200/60">
              <div className="aspect-square bg-stone-200 rounded-lg"></div>
              <div className="h-3 bg-stone-200 rounded-xs w-3/4"></div>
              <div className="h-3 bg-stone-200 rounded-xs w-1/2"></div>
            </div>
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="p-8 text-center space-y-2">
          <span className="text-4xl">🔍</span>
          <p className="text-xs font-bold text-stone-600">
            Không tìm thấy món nào phù hợp với danh mục hoặc từ khóa hiện tại.
          </p>
          <button
            onClick={() => {
              setSearchQuery("");
              setActiveTab("all");
            }}
            className="text-xs text-[#ee4d2d] font-bold underline cursor-pointer"
          >
            Xóa tìm kiếm & xem tất cả món
          </button>
        </div>
      ) : (
        <div className="p-2 grid grid-cols-2 gap-2">
          {filteredProducts.map((product) => {
            const shop = shops[product.shopId];
            const isShopOpen = shop ? shop.isOpen : true;
            const { isDiscountActive, currentPrice, discountPercent } = checkProductDiscount(product);
            const distanceStr = getShopDistance(shop);

            return (
              <div
                key={product.id}
                className={`bg-white rounded-xl overflow-hidden border border-stone-200/70 shadow-2xs hover:shadow-md transition flex flex-col justify-between group ${!isShopOpen ? "opacity-75" : ""
                  }`}
              >
                <div>
                  {shop && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedShop({
                          ...shop,
                          distance: distanceStr,
                        });
                      }}
                      className="flex items-center gap-1.5 p-1.5 bg-stone-50 border-b border-stone-100 cursor-pointer hover:bg-stone-100 transition"
                    >
                      <div className="relative shrink-0">
                        <img
                          src={shop.avatar}
                          alt={shop.name}
                          loading="lazy"
                          className="w-4 h-4 rounded-full object-cover border border-stone-200"
                        />
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <span className="text-[10px] font-bold text-stone-700 truncate block">
                          {shop.name}
                        </span>
                        {shop.address && (
                          <span className="text-[8px] text-stone-400 truncate block">
                            📍 {shop.address}
                          </span>
                        )}
                      </div>
                      {!isShopOpen && (
                        <span className="text-[8px] bg-stone-200 text-stone-600 font-bold px-1 rounded-xs shrink-0">
                          Đóng cửa
                        </span>
                      )}
                      <span className="text-[8px] text-stone-400 shrink-0">➔</span>
                    </div>
                  )}

                  <div
                    onClick={() => setSelectedProduct(product)}
                    className="cursor-pointer"
                  >
                    <div className="relative aspect-square bg-stone-100 overflow-hidden">
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />

                      <div className="absolute top-1 left-1 flex flex-col gap-1 items-start z-10">
                        <span className="bg-black/70 text-amber-300 border border-amber-300/30 text-[8px] font-extrabold px-1.5 py-0.5 rounded-md backdrop-blur-xs">
                          📍 {distanceStr}
                        </span>

                        {quickFilter === "recommend" && (product as any).totalScore > 65 && (
                          <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-r-md shadow-2xs">
                            Gợi Ý Hot 🔥
                          </span>
                        )}
                      </div>

                      {isDiscountActive && discountPercent > 0 && (
                        <div className="absolute top-0 right-0 bg-[#ee4d2d] text-white text-[9px] font-black px-1.5 py-0.5 rounded-bl-lg shadow-2xs">
                          -{discountPercent}%
                        </div>
                      )}

                      <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[8px] px-1.5 py-0.5 rounded-md backdrop-blur-xs font-semibold">
                        ⏱️ ~{product.prepTime || 15}p
                      </div>
                    </div>

                    <div className="p-2 space-y-1">
                      <h3 className="text-[11px] font-bold text-stone-800 line-clamp-2 leading-snug group-hover:text-[#ee4d2d] transition">
                        {product.name}
                      </h3>

                      {isDiscountActive && product.maxPerUser !== undefined && product.maxPerUser !== null && Number(product.maxPerUser) > 0 && (
                        <div className="inline-block bg-purple-50 text-purple-700 font-extrabold text-[8px] px-1.5 py-0.5 rounded-md border border-purple-100">
                          👑 Max {product.maxPerUser} món/khách
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-2 pt-0 space-y-1.5">
                  <div className="space-y-0.5">
                    <div className="flex items-baseline gap-1">
                      <span className="text-xs font-black text-[#ee4d2d]">
                        {formatCurrency(currentPrice)}
                      </span>
                    </div>

                    {isDiscountActive && product.originalPrice > currentPrice && (
                      <div className="flex items-center gap-1 text-[9px]">
                        <span className="text-stone-400 line-through">
                          {formatCurrency(product.originalPrice)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[9px] text-stone-500 pt-1.5 border-t border-stone-100">
                    <div className="flex items-center gap-1 flex-wrap truncate">
                      <span className="text-amber-500 font-bold">★ {shop?.rating || 5.0}</span>
                      <span className="text-stone-400 font-medium">({product.reviewCount || 0})</span>
                      <span>•</span>
                      <span className="font-bold text-emerald-600">📍 {distanceStr}</span>
                      <span>•</span>
                      <span className="text-stone-500 font-medium truncate">Đã bán {formatSoldCount(product.soldCount)}</span>
                    </div>

                    <button
                      type="button"
                      disabled={!isShopOpen}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddToCart(product);
                      }}
                      className={`${isShopOpen
                        ? "bg-[#ee4d2d] hover:bg-[#d73f20] cursor-pointer"
                        : "bg-stone-300 text-stone-500 cursor-not-allowed"
                        } active:scale-95 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg transition shadow-2xs flex items-center gap-0.5 shrink-0 ml-1`}
                    >
                      <span>{isShopOpen ? "+ Thêm" : "Tạm đóng"}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <ProductDetailModal
        product={selectedProduct}
        shop={(selectedProduct && shops ? shops[selectedProduct.shopId] : undefined) as any}
        onClose={() => setSelectedProduct(null)}
        onAddToCart={handleAddToCart}
        formatCurrency={formatCurrency}
      />

      <ShopDetailModal
        shop={selectedShop}
        products={products}
        distanceStr={selectedShop ? getShopDistance(selectedShop) : "2.0 km"}
        onClose={() => setSelectedShop(null)}
        onAddToCart={handleAddToCart}
        onProductClick={(prod) => {
          setSelectedShop(null);
          setSelectedProduct(prod);
        }}
        formatCurrency={formatCurrency}
      />
    </div>
  );
}