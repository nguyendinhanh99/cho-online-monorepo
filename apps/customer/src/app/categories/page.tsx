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
  lat?: number | null;
  lng?: number | null;
  isOpen: boolean;
  openTime?: string;
  closeTime?: string;
  businessCategory?: string;
}

interface Product {
  id: string;
  shopId: string;
  merchantId: string;
  merchantCode: string;
  shopName: string;
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
  reviews: Review[];
  unit?: string;
  brand?: string;
  volumeWeight?: string;
  expiryDate?: string;
  isConsumerGood?: boolean;
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

// 🎯 TỪ KHÓA TÌM KIẾM HOT
const HOT_KEYWORDS = [
  "Nước giặt",
  "Tai nghe Bluetooth",
  "Bóng đèn LED",
  "Dầu ăn",
  "Nồi chiên không dầu",
  "Ổ cắm điện",
  "Giấy vệ sinh",
  "Sạc dự phòng",
  "Nước rửa chén",
];

// 🎯 HẠNG MỤC SẢN PHẨM PHÙ HỢP CONSUMER_GOODS & FASHION
const CATEGORY_SUGGESTIONS: Record<string, string[]> = {
  "📱 Điện thoại & Phụ kiện": ["Điện thoại", "Sạc dự phòng", "Cáp sạc", "Tai nghe", "Ốp lưng", "Củ sạc", "Giá đỡ"],
  "🔌 Thiết bị điện & Chiếu sáng": ["Bóng đèn", "Ổ cắm", "Phích cắm", "Dây điện", "Công tắc", "Đèn học", "Đèn pin"],
  "🍳 Gia dụng & Điện gia dụng": ["Nồi cơm điện", "Nồi chiên", "Ấm siêu tốc", "Máy sấy tóc", "Quạt điện", "Bếp từ", "Máy xay"],
  "🧺 Giặt xả & Vệ sinh": ["Nước giặt", "Nước xả vải", "Nước rửa chén", "Nước lau sàn", "Bột giặt", "Tẩy bồn cầu"],
  "🧂 Gia vị & Bếp núc": ["Dầu ăn", "Nước mắm", "Hạt nêm", "Đường", "Tương ớt", "Nước tương", "Muối", "Bột ngọt"],
  "🧻 Giấy & Tã bỉm": ["Giấy ăn", "Giấy vệ sinh", "Khăn ướt", "Tã bỉm em bé", "Băng vệ sinh"],
  "🧴 Chăm sóc cá nhân": ["Dầu gội", "Sữa tắm", "Kem đánh răng", "Bàn chải", "Sữa rửa mặt", "Xà phòng"],
  "👗 Thời trang & Quần áo": ["Áo thun", "Quần Jean", "Áo khoác", "Váy", "Phụ kiện", "Túi xách", "Giày dép"],
};

// 🚫 DANH SÁCH TỪ KHÓA BỊ CẤM
const EXCLUDED_KEYWORDS = [
  "cafe sữa", "cafe dừa", "cafe trứng", "cafe đen", "bạc xỉu", 
  "trà sữa", "sinh tố", "nước ép", "machiato", "latte tươi", "cà phê tươi",
  "bún đậu", "cơm tấm", "phở bò", "bánh mì tươi", "lẩu", "nướng quán"
];

// 🎯 CẬP NHẬT: Chỉ cho phép CONSUMER_GOODS và FASHION
const ALLOWED_BUSINESS_CATEGORIES = [
  "CONSUMER_GOODS", 
  "FASHION", 
  "ELECTRONICS", 
  "GROCERY", 
  "FMCG", 
  "THIẾT BỊ ĐIỆN", 
  "ĐIỆN TỬ", 
  "THỜI TRANG"
];

const formatSoldCount = (count: number = 0): string => {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1).replace(".0", "")}k`;
  }
  return `${count}`;
};

export default function CategoriesPage() {
  const [isMounted, setIsMounted] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<string>("all");
  const [quickFilter, setQuickFilter] = useState<string>("recommend");
  const [shops, setShops] = useState<Record<string, Shop>>({});
  const [products, setProducts] = useState<Product[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [savedVouchers, setSavedVouchers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // 🔄 Trạng thái ẩn/hiện phần banner & header khi cuộn trang
  const [showBannerOnScroll, setShowBannerOnScroll] = useState<boolean>(true);
  const [lastScrollY, setLastScrollY] = useState<number>(0);

  const [flashTab, setFlashTab] = useState<"active" | "upcoming">("active");

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);

  // 📜 Xử lý sự kiện cuộn trang
  useEffect(() => {
    setIsMounted(true);

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY <= 10) {
        setShowBannerOnScroll(true);
      } else if (currentScrollY > lastScrollY && currentScrollY > 60) {
        setShowBannerOnScroll(false);
      } else if (currentScrollY < lastScrollY) {
        setShowBannerOnScroll(true);
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("search_history_grocery");
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
      localStorage.setItem("search_history_grocery", JSON.stringify(updated));
    }
  };

  const clearHistory = () => {
    setSearchHistory([]);
    if (typeof window !== "undefined") {
      localStorage.removeItem("search_history_grocery");
    }
  };

  const handleSaveVoucher = (vCode: string) => {
    let updated: string[];
    if (savedVouchers.includes(vCode)) {
      updated = savedVouchers.filter((c) => c !== vCode);
    } else {
      updated = [...savedVouchers, vCode];
    }
    setSavedVouchers(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem("saved_vouchers", JSON.stringify(updated));
    }
  };

  const [userInfo, setUserInfo] = useState<UserLocation>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("user_shipping_info");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return {
            customerName: parsed.customerName || parsed.name || "Khách Hàng",
            customerPhone: parsed.customerPhone || parsed.phone || "0987654321",
            address: parsed.address || "45 Phan Đình Phùng, TP Hà Tĩnh",
            lat: parsed.location?.latitude ?? parsed.lat ?? 18.3445,
            lng: parsed.location?.longitude ?? parsed.lng ?? 105.8978,
          };
        } catch (e) {
          console.warn(e);
        }
      }
    }
    return {
      customerName: "Khách Hàng",
      customerPhone: "0987654321",
      address: "45 Phan Đình Phùng, TP Hà Tĩnh",
      lat: 18.3445,
      lng: 105.8978,
    };
  });

  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const addItemToCart = useCartStore((state) => state.addItem);
  const openCart = useCartStore((state) => state.openCart);
  const getTotalItems = useCartStore((state) => state.getTotalItems);
  const totalCartCount = getTotalItems();

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
      const dist = R * c;
      if (dist < 1) return { text: `${Math.max(100, Math.round(dist * 1000))}m`, km: dist };
      return { text: `${dist.toFixed(1)} km`, km: dist };
    },
    []
  );

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
        await updateDoc(productRef, { discountStock: increment(-qty), soldCount: increment(qty), updatedAt: new Date() });
      } else {
        await updateDoc(productRef, { soldCount: increment(qty), stock: increment(-qty), updatedAt: new Date() });
      }
      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId
            ? {
                ...p,
                discountStock:
                  isDiscount && p.discountStock !== null && p.discountStock !== undefined
                    ? Math.max(0, p.discountStock - qty)
                    : p.discountStock,
                soldCount: (p.soldCount || 0) + qty,
              }
            : p
        )
      );
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    let isMountedFetch = true;
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
          const key = revData.merchantId || revData.shopId || revData.merchantCode;
          const ratingVal = Number(revData.productRating || revData.rating || 0);
          if (ratingVal > 0 && key) {
            if (!shopReviewStats[key]) shopReviewStats[key] = { totalRating: 0, count: 0 };
            shopReviewStats[key].totalRating += ratingVal;
            shopReviewStats[key].count += 1;
          }
        });

        const shopMap: Record<string, Shop> = {};
        merchantsSnap.forEach((docSnap) => {
          const data = docSnap.data();
          const bCategory = (data.businessCategory || data.category || "").toUpperCase();
          const isAllowedCategory = ALLOWED_BUSINESS_CATEGORIES.some((cat) => bCategory.includes(cat));

          if (!isAllowedCategory) return;

          const rawAvatar = data.avatar || data.avatarUrl || "";
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
            name: data.shopName || data.storeName || data.fullName || "Cửa Hàng",
            avatar: rawAvatar.trim() !== "" ? rawAvatar : "https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=100",
            rating: calculatedRating,
            reviewCount: calculatedReviewCount,
            distance: "1.0 km",
            location: data.address || "Hà Tĩnh",
            lat: data.pickupLocation?.latitude ?? data.lat ?? null,
            lng: data.pickupLocation?.longitude ?? data.lng ?? null,
            isOpen: data.isOpen !== undefined ? Boolean(data.isOpen) : true,
            openTime: data.openTime || "07:00",
            closeTime: data.closeTime || "22:00",
            businessCategory: bCategory
          };
        });

        const fetchedProducts: Product[] = [];

        productsSnap.forEach((docSnap) => {
          const data = docSnap.data();
          
          const isAvailable = data.isAvailable !== undefined ? Boolean(data.isAvailable) : true;
          if (!isAvailable) return;

          if (data.isConsumerGood !== true) return;

          const rawShopId = String(data.shopId || data.merchantId || "");
          const matchedShopKey = Object.keys(shopMap).find(
            (key) => key === rawShopId || (shopMap[key].merchantCode && shopMap[key].merchantCode === data.merchantCode)
          );

          if (!matchedShopKey) return;
          const matchedShop = shopMap[matchedShopKey];

          const prodName = (data.name || "").toLowerCase();
          const isExcluded = EXCLUDED_KEYWORDS.some((ex) => prodName.includes(ex));
          if (isExcluded) return;

          const images: string[] =
            Array.isArray(data.imageUrls) && data.imageUrls.length > 0
              ? data.imageUrls
              : [data.imageUrl || data.image || "https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400"];

          const price = Number(data.price) || 0;
          const originalPrice = Number(data.originalPrice) || price;

          fetchedProducts.push({
            id: docSnap.id,
            shopId: matchedShopKey,
            merchantId: data.merchantId || matchedShopKey,
            merchantCode: data.merchantCode || matchedShop.merchantCode || "",
            shopName: matchedShop.name,
            name: data.name || "Sản phẩm",
            description: data.description || "",
            price: price,
            originalPrice: originalPrice > price ? originalPrice : price,
            discountStock: data.discountStock ?? null,
            maxPerUser: data.maxPerUser !== undefined && data.maxPerUser !== null ? Number(data.maxPerUser) : null,
            discountStartTime: data.discountStartTime ?? null,
            discountEndTime: data.discountEndTime ?? null,
            imageUrl: images[0],
            imageUrls: images,
            soldCount: Number(data.soldCount || data.sold || 0),
            reviewCount: Number(data.reviewCount || 0),
            discountBadge: data.discountBadge || "",
            stockProgress: data.stockProgress || 80,
            category: data.category || "Danh mục",
            isFavorite: data.isFeatured || data.isFavorite || false,
            isAvailable: isAvailable,
            reviews: data.reviews || [],
            unit: data.unit || "Cái",
            brand: data.brand || "Chính Hãng",
            volumeWeight: data.volumeWeight || data.weight || data.volume || "",
            expiryDate: data.expiryDate || "",
            isConsumerGood: true,
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

        if (isMountedFetch) {
          setShops(shopMap);
          setProducts(fetchedProducts);
          setVouchers(fetchedVouchers);
        }
      } catch (error) {
        console.error("Lỗi khi fetch dữ liệu:", error);
      } finally {
        if (isMountedFetch) {
          setLoading(false);
        }
      }
    }
    fetchData();
    return () => {
      isMountedFetch = false;
    };
  }, []);

  const calculatedDistances = useMemo(() => {
    const distances: Record<string, { text: string; km: number }> = {};
    for (const shop of Object.values(shops)) {
      if (userInfo.lat && userInfo.lng && shop.lat && shop.lng) {
        distances[shop.id] = calculateHaversineDistance(userInfo.lat, userInfo.lng, shop.lat, shop.lng);
      } else {
        distances[shop.id] = { text: shop.distance || "1.0 km", km: 1.0 };
      }
    }
    return distances;
  }, [userInfo.lat, userInfo.lng, shops, calculateHaversineDistance]);

  const getShopDistance = useCallback(
    (shop?: Shop) => {
      if (!shop) return "Kho Hà Tĩnh";
      return calculatedDistances[shop.id]?.text || shop.distance || "1.0 km";
    },
    [calculatedDistances]
  );

  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
  }, []);

  const handleAddToCart = useCallback(
    async (product: Product) => {
      const shop = shops[product.shopId];
      const distance = getShopDistance(shop);
      (addItemToCart as any)(product, distance);
      const { isDiscountActive } = checkProductDiscount(product);
      await updateProductStockInDb(product.id, 1, isDiscountActive);
    },
    [shops, getShopDistance, addItemToCart, checkProductDiscount]
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

  const rankedProducts = useMemo(() => {
    return products.map((product) => {
      const shop = shops[product.shopId];
      const distKm = calculatedDistances[product.shopId]?.km ?? 1.0;
      const rating = shop?.rating || 5.0;
      const { isDiscountActive, discountPercent } = checkProductDiscount(product);

      const popularityScore = Math.min(100, product.soldCount * 0.8);
      const promoScore = isDiscountActive ? discountPercent * 2.5 : 0;
      const ratingScore = rating * 20;

      const totalScore = popularityScore * 0.45 + promoScore * 0.35 + ratingScore * 0.2;
      return { ...product, totalScore, distanceKm: distKm };
    });
  }, [products, shops, calculatedDistances, checkProductDiscount]);

  const filteredProducts = useMemo(() => {
    let result = [...rankedProducts];

    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.shopName.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          (p.brand && p.brand.toLowerCase().includes(q))
      );
    }

    if (activeTab !== "all") {
      result = result.filter((p) => {
        const catLower = p.category.toLowerCase();
        const tabLower = activeTab.toLowerCase();
        if (catLower.includes(tabLower) || tabLower.includes(catLower)) return true;

        const subItems = CATEGORY_SUGGESTIONS[activeTab];
        if (
          subItems &&
          subItems.some(
            (sub) => p.name.toLowerCase().includes(sub.toLowerCase()) || catLower.includes(sub.toLowerCase())
          )
        ) {
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

  // Chặn render giao diện chính cho đến khi client mount xong để tránh lệch SSR với localStorage
  if (!isMounted) {
    return (
      <div className="bg-[#f0f4f8] min-h-screen flex items-center justify-center">
        <div className="text-slate-500 text-xs font-bold animate-pulse">Đang tải ứng dụng...</div>
      </div>
    );
  }

  return (
    <div className="bg-[#f0f4f8] min-h-screen pb-24 font-sans text-slate-800">
      {/* 🔴 VÙNG HEADER & BANNER CỐ ĐỊNH */}
      <div
        className={`sticky top-0 z-40 transition-all duration-300 shadow-md ${
          showBannerOnScroll ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
        }`}
      >
        {/* 💙 HEADER */}
        <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-600 p-3 text-white space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 overflow-hidden flex-1 bg-white/15 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20">
              <span className="text-sm shrink-0">📍</span>
              <div className="text-[11px] leading-tight truncate flex-1">
                <span className="text-[9px] opacity-80 block font-medium">Giao hàng đến:</span>
                <input
                  type="text"
                  value={userInfo.address}
                  onChange={(e) => setUserInfo((prev) => ({ ...prev, address: e.target.value }))}
                  placeholder="Nhập địa chỉ giao hàng..."
                  className="bg-transparent text-white font-bold text-xs focus:outline-none w-full truncate placeholder:text-white/70"
                />
              </div>
            </div>

            <div
              onClick={openCart}
              className="relative p-2 bg-white/15 hover:bg-white/25 rounded-full transition cursor-pointer border border-white/20"
            >
              <span className="text-xl">🛒</span>
              {totalCartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-cyan-400 text-blue-950 text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-white shadow-sm animate-pulse">
                  {totalCartCount}
                </span>
              )}
            </div>
          </div>

          {/* 🔍 SEARCH BAR THÔNG MINH */}
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
                placeholder="Tìm đồ gia dụng, điện tử, thời trang, quần áo..."
                className="w-full bg-white text-slate-800 text-xs py-2.5 pl-9 pr-20 rounded-xl outline-none placeholder:text-slate-400 shadow-inner font-medium"
              />
              <span className="absolute left-3 text-slate-400 text-xs">🔍</span>

              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-14 text-slate-400 hover:text-slate-600 p-1 text-xs font-bold"
                >
                  ✕
                </button>
              )}

              <button
                onClick={() => {
                  saveSearchKeyword(searchQuery);
                  setIsSearchFocused(false);
                }}
                className="absolute right-1 top-1 bottom-1 bg-blue-600 hover:bg-blue-700 text-white px-3.5 rounded-lg text-[11px] font-bold transition"
              >
                Tìm kiếm
              </button>
            </div>

            {isSearchFocused && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 p-3 z-50 text-slate-800 space-y-3">
                {searchHistory.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                      <span>LỊCH SỬ TÌM KIẾM</span>
                      <button onClick={clearHistory} className="hover:text-blue-600">
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
                          className="bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600 text-[11px] px-2.5 py-1 rounded-full cursor-pointer transition font-medium"
                        >
                          🕒 {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold text-slate-400">
                    <span>🔥 TÌM KIẾM NHIỀU NHẤT</span>
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
                        className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[11px] px-2.5 py-1 rounded-full cursor-pointer transition font-bold"
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
      </div>

      {/* 🎟️ VOUCHER KHUYẾN MÃI */}
      {!searchQuery && vouchers.length > 0 && (
        <div className="bg-blue-900/5 py-2.5 border-b border-blue-100">
          <div className="px-3 flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-base">🎟️</span>
              <h3 className="text-[11px] font-black text-slate-900 tracking-tight flex items-center gap-1">
                MÃ GIẢM GIÁ MUA SẮM
                <span className="bg-blue-600 text-white text-[8px] font-extrabold px-1.5 py-0.2 rounded-full uppercase">
                  Tiết kiệm
                </span>
              </h3>
            </div>

            <button
              onClick={openCart}
              className="text-[10px] text-blue-700 font-bold hover:underline flex items-center gap-0.5 shrink-0"
            >
              Ví Voucher ({savedVouchers.length}) ➔
            </button>
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
                  className={`min-w-[210px] max-w-[210px] bg-white rounded-xl border shadow-2xs flex overflow-hidden relative transition-all duration-200 hover:shadow-sm ${
                    isSaved ? "border-emerald-500 bg-emerald-50/20" : "border-blue-200"
                  }`}
                >
                  <div
                    className={`w-14 shrink-0 flex flex-col items-center justify-center p-1.5 text-white text-center relative border-r border-dashed border-slate-200 ${
                      isFreeship
                        ? "bg-gradient-to-br from-emerald-500 to-teal-600"
                        : "bg-gradient-to-br from-blue-600 to-indigo-600"
                    }`}
                  >
                    <span className="text-lg mb-0.5">{isFreeship ? "🚚" : "🏷️"}</span>
                    <span className="text-[8px] font-black uppercase leading-tight">
                      {isFreeship ? "FREESHIP" : "GIẢM ĐƠN"}
                    </span>
                  </div>

                  <div className="flex-1 p-1.5 flex flex-col justify-between space-y-1">
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono text-[9px] font-black text-slate-800 bg-slate-100 px-1 py-0.2 rounded border border-slate-200 truncate">
                          {v.code}
                        </span>
                        {v.minOrder && v.minOrder > 0 && (
                          <span className="text-[8px] font-bold text-blue-800 bg-blue-50 px-1 py-0.2 rounded shrink-0">
                            ≥{formatCurrency(v.minOrder)}
                          </span>
                        )}
                      </div>
                      <h4 className="text-[10px] font-bold text-slate-800 leading-tight mt-1 line-clamp-1">
                        {v.title}
                      </h4>
                    </div>

                    <div className="space-y-0.5">
                      <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isFreeship ? "bg-teal-500" : "bg-blue-600"}`}
                          style={{ width: `${usedPercent > 0 ? usedPercent : 15}%` }}
                        ></div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSaveVoucher(v.code)}
                      className={`w-full py-0.5 text-[9px] font-bold rounded-md transition flex items-center justify-center ${
                        isSaved ? "bg-emerald-600 text-white" : "bg-blue-50 hover:bg-blue-100 text-blue-700"
                      }`}
                    >
                      {isSaved ? "✓ Đã lưu" : "Lưu mã"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ⚡ DANH MỤC NỔI BẬT */}
      <div className="bg-white py-2 px-3 border-b border-slate-200/80 shadow-2xs space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-black text-slate-800 tracking-tight flex items-center gap-1">
            <span>🛒</span> DANH MỤC NỔI BẬT
          </h3>
          <span className="text-[9px] text-blue-700 font-bold bg-blue-50 px-1.5 py-0.2 rounded-full border border-blue-200">
            Hàng Chính Hãng
          </span>
        </div>

        <div className="space-y-1.5">
          {/* HÀNG 1 */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-[9px] font-bold text-blue-800 uppercase tracking-wider">
              <span>⚡</span>
              <span>Điện Máy & Công Nghệ</span>
            </div>

            <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {[
                { id: "smart_tech", label: "Điện Thoại & Phụ Kiện", emoji: "📱", desc: "Sạc dự phòng, Tai nghe", category: "📱 Điện thoại & Phụ kiện", filter: "recommend" },
                { id: "smart_electric", label: "Thiết Bị Điện", emoji: "🔌", desc: "Bóng đèn, Ổ cắm, Pin", category: "🔌 Thiết bị điện & Chiếu sáng", filter: "recommend" },
                { id: "smart_home", label: "Điện Gia Dụng", emoji: "🍳", desc: "Nồi chiên, Ấm siêu tốc", category: "🍳 Gia dụng & Điện gia dụng", filter: "bestseller" },
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
                    className={`min-w-[115px] max-w-[125px] rounded-lg p-1.5 cursor-pointer transition-all duration-200 shrink-0 space-y-0.5 relative border ${
                      isActive
                        ? "bg-gradient-to-br from-blue-700 to-indigo-700 text-white border-blue-800 shadow-sm ring-1 ring-blue-400/50"
                        : "bg-blue-50/30 border-blue-100 text-slate-800 hover:border-blue-300 hover:bg-blue-50/60"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm">{item.emoji}</span>
                      <span
                        className={`text-[7px] font-black px-1 py-0.1 rounded ${
                          isActive ? "bg-white text-blue-800" : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {isActive ? "✓ Chọn" : "Công Nghệ"}
                      </span>
                    </div>
                    <div>
                      <p className={`text-[10px] font-bold leading-tight truncate ${isActive ? "text-white" : "text-slate-800"}`}>
                        {item.label}
                      </p>
                      <p className={`text-[8px] leading-tight truncate ${isActive ? "text-blue-100" : "text-slate-500"}`}>
                        {item.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* HÀNG 2 */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-800 uppercase tracking-wider">
              <span>🧺</span>
              <span>Bách Hóa & Thời Trang</span>
            </div>

            <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {[
                { id: "smart_laundry", label: "Giặt Xả Giá Sốc", emoji: "🧺", desc: "Nước giặt, Xả vải", category: "🧺 Giặt xả & Vệ sinh", filter: "discount" },
                { id: "smart_spices", label: "Gia Vị Nhà Bếp", emoji: "🧂", desc: "Dầu ăn, Nước mắm", category: "🧂 Gia vị & Bếp núc", filter: "bestseller" },
                { id: "smart_fashion", label: "Thời Trang & Quần Áo", emoji: "👗", desc: "Áo thun, Quần, Váy", category: "👗 Thời trang & Quần áo", filter: "recommend" },
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
                    className={`min-w-[115px] max-w-[125px] rounded-lg p-1.5 cursor-pointer transition-all duration-200 shrink-0 space-y-0.5 relative border ${
                      isActive
                        ? "bg-gradient-to-br from-emerald-600 to-teal-700 text-white border-emerald-800 shadow-sm ring-1 ring-emerald-400/50"
                        : "bg-emerald-50/30 border-emerald-100 text-slate-800 hover:border-emerald-300 hover:bg-emerald-50/60"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm">{item.emoji}</span>
                      <span
                        className={`text-[7px] font-black px-1 py-0.1 rounded ${
                          isActive ? "bg-white text-emerald-800" : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {isActive ? "✓ Chọn" : "Mua Sắm"}
                      </span>
                    </div>
                    <div>
                      <p className={`text-[10px] font-bold leading-tight truncate ${isActive ? "text-white" : "text-slate-800"}`}>
                        {item.label}
                      </p>
                      <p className={`text-[8px] leading-tight truncate ${isActive ? "text-emerald-100" : "text-slate-500"}`}>
                        {item.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* QUICK FILTERS */}
      <div className="px-2 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar bg-slate-200/60 sticky top-0 z-30 backdrop-blur-md">
        {[
          { id: "recommend", label: "🎯 Gợi ý tốt nhất" },
          { id: "bestseller", label: "👑 Bán chạy nhất" },
          { id: "discount", label: "💥 Giảm giá sâu" },
          { id: "fast", label: "🚚 Giao nhanh" },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setQuickFilter(f.id)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap border transition cursor-pointer shrink-0 ${
              quickFilter === f.id
                ? "bg-blue-700 text-white border-blue-700 shadow-2xs"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 🌊 FLASH SALE */}
      {!searchQuery && (activeDeals.length > 0 || upcomingDeals.length > 0) && (
        <div className="bg-white my-2 py-3 border-y border-slate-200 shadow-2xs">
          <div className="px-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="bg-gradient-to-r from-blue-700 to-cyan-600 text-white font-black italic text-xs px-2.5 py-1 rounded-lg tracking-wider flex items-center gap-1 shadow-xs">
                  <span>⚡</span> GIỜ VÀNG XẢ KHO
                </div>
                {flashTab === "active" && (
                  <span className="bg-slate-900 text-cyan-400 font-mono text-[10px] px-1.5 py-0.5 rounded-md font-bold">
                    08 : 15 : 40
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <button
                onClick={() => setFlashTab("active")}
                className={`text-xs font-bold px-3 py-1 rounded-full transition cursor-pointer flex items-center gap-1.5 ${
                  flashTab === "active"
                    ? "bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs"
                    : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                <span>🔥 Đang giảm giá ({activeDeals.length})</span>
              </button>
              {upcomingDeals.length > 0 && (
                <button
                  onClick={() => setFlashTab("upcoming")}
                  className={`text-xs font-bold px-3 py-1 rounded-full transition cursor-pointer flex items-center gap-1.5 ${
                    flashTab === "upcoming"
                      ? "bg-cyan-50 text-cyan-800 border border-cyan-200 shadow-2xs"
                      : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  <span>⏰ Sắp xả kho ({upcomingDeals.length})</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-2.5 overflow-x-auto no-scrollbar px-3 pt-2">
            {(flashTab === "active" ? activeDeals : upcomingDeals).map((item) => {
              const { currentPrice, discountPercent } = checkProductDiscount(item);

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedProduct(item)}
                  className="min-w-[145px] max-w-[145px] bg-white border border-slate-200 rounded-2xl p-2 relative flex flex-col justify-between shadow-2xs cursor-pointer hover:border-blue-500 hover:shadow-md transition duration-200 group"
                >
                  {discountPercent > 0 && (
                    <div className="absolute top-0 right-0 bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-bl-xl rounded-tr-2xl z-10 shadow-xs">
                      -{discountPercent}%
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <div className="aspect-square bg-slate-100 rounded-xl overflow-hidden relative group-hover:scale-[1.02] transition duration-200">
                      <img src={item.imageUrl} alt={item.name} loading="lazy" className="w-full h-full object-cover" />
                      <span className="absolute top-1 left-1 bg-black/60 text-cyan-300 text-[8px] font-extrabold px-1.5 py-0.5 rounded-md backdrop-blur-xs">
                        🏷️ {item.brand || "Chính hãng"}
                      </span>
                      <span className="absolute bottom-1 left-1 bg-slate-900/80 text-white text-[8px] font-semibold px-1.5 py-0.5 rounded-md backdrop-blur-xs">
                        📦 {item.volumeWeight || item.unit || "Cái"}
                      </span>
                    </div>

                    <div>
                      <p className="text-[9px] font-semibold text-slate-400 truncate">🏢 {item.shopName}</p>
                      <h4 className="text-[11px] font-bold text-slate-800 line-clamp-1 group-hover:text-blue-600 transition">
                        {item.name}
                      </h4>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1.5 border-t border-slate-100 mt-1">
                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xs font-black text-blue-700">
                          {formatCurrency(flashTab === "active" ? currentPrice : item.price)}
                        </span>
                      </div>
                      {item.originalPrice > (flashTab === "active" ? currentPrice : item.price) && (
                        <div className="text-[9px] text-slate-400 line-through">
                          {formatCurrency(item.originalPrice)}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddToCart(item);
                      }}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold py-1 rounded-lg transition active:scale-95 shadow-2xs flex items-center justify-center gap-1 cursor-pointer"
                    >
                      + Chọn mua
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB DANH MỤC SẢN PHẨM */}
      <div className="bg-white border-b border-slate-200 my-1 py-2">
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-3 whitespace-nowrap">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition shrink-0 cursor-pointer ${
              activeTab === "all"
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
            }`}
          >
            📦 Tất cả sản phẩm ({products.length})
          </button>

          {Object.keys(CATEGORY_SUGGESTIONS).map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveTab(cat)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition shrink-0 cursor-pointer ${
                activeTab === cat
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* GRID PRODUCT SẢN PHẨM */}
      {loading ? (
        <div className="p-2 grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="bg-white rounded-xl p-2 space-y-2 animate-pulse border border-slate-200">
              <div className="aspect-square bg-slate-200 rounded-lg"></div>
              <div className="h-3 bg-slate-200 rounded-xs w-3/4"></div>
              <div className="h-3 bg-slate-200 rounded-xs w-1/2"></div>
            </div>
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="p-8 text-center space-y-2">
          <span className="text-4xl">🛒</span>
          <p className="text-xs font-bold text-slate-600">
            Không tìm thấy sản phẩm tiêu dùng hoặc thời trang phù hợp.
          </p>
          <button
            onClick={() => {
              setSearchQuery("");
              setActiveTab("all");
            }}
            className="text-xs text-blue-600 font-bold underline cursor-pointer"
          >
            Tải lại toàn bộ danh mục
          </button>
        </div>
      ) : (
        <div className="p-2 grid grid-cols-2 gap-2">
          {filteredProducts.map((product) => {
            const shop = shops[product.shopId];
            const { isDiscountActive, currentPrice, discountPercent } = checkProductDiscount(product);

            return (
              <div
                key={product.id}
                className="bg-white rounded-xl overflow-hidden border border-slate-200/80 shadow-2xs hover:shadow-md transition flex flex-col justify-between group"
              >
                <div>
                  {shop && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedShop(shop);
                      }}
                      className="flex items-center gap-1.5 p-1.5 bg-slate-50 border-b border-slate-100 cursor-pointer hover:bg-slate-100 transition"
                    >
                      <img
                        src={shop.avatar}
                        alt={shop.name}
                        loading="lazy"
                        className="w-4 h-4 rounded-full object-cover border border-slate-200 shrink-0"
                      />
                      <span className="text-[10px] font-bold text-slate-700 truncate flex-1">
                        {shop.name}
                      </span>
                      <span className="text-[8px] text-slate-400 shrink-0">➔</span>
                    </div>
                  )}

                  <div onClick={() => setSelectedProduct(product)} className="cursor-pointer">
                    <div className="relative aspect-square bg-slate-100 overflow-hidden">
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />

                      <div className="absolute top-1 left-1 flex flex-col gap-1 items-start z-10">
                        <span className="bg-slate-900/80 text-cyan-300 text-[8px] font-extrabold px-1.5 py-0.5 rounded-md backdrop-blur-xs">
                          🏷️ {product.brand || "Chính Hãng"}
                        </span>
                      </div>

                      {isDiscountActive && discountPercent > 0 && (
                        <div className="absolute top-0 right-0 bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-bl-lg shadow-2xs">
                          -{discountPercent}%
                        </div>
                      )}

                      <div className="absolute bottom-1 right-1 bg-slate-900/80 text-white text-[8px] px-1.5 py-0.5 rounded-md backdrop-blur-xs font-semibold">
                        📦 {product.volumeWeight || product.unit || "Cái"}
                      </div>
                    </div>

                    <div className="p-2 space-y-1">
                      <h3 className="text-[11px] font-bold text-slate-800 line-clamp-2 leading-snug group-hover:text-blue-600 transition">
                        {product.name}
                      </h3>
                    </div>
                  </div>
                </div>

                <div className="p-2 pt-0 space-y-1.5">
                  <div className="space-y-0.5">
                    <div className="flex items-baseline gap-1">
                      <span className="text-xs font-black text-blue-700">
                        {formatCurrency(currentPrice)}
                      </span>
                      {product.unit && (
                        <span className="text-[9px] font-medium text-slate-400">/{product.unit}</span>
                      )}
                    </div>

                    {isDiscountActive && product.originalPrice > currentPrice && (
                      <div className="text-[9px] text-slate-400 line-through">
                        {formatCurrency(product.originalPrice)}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[9px] text-slate-500 pt-1.5 border-t border-slate-100">
                    <div className="flex items-center gap-1 truncate">
                      <span className="text-amber-500 font-bold">★ {shop?.rating || 5.0}</span>
                      <span>•</span>
                      <span className="text-slate-500 font-medium">Đã bán {formatSoldCount(product.soldCount)}</span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddToCart(product);
                      }}
                      className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg transition shadow-2xs cursor-pointer shrink-0"
                    >
                      + Chọn
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODALS */}
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
        distanceStr={selectedShop ? getShopDistance(selectedShop) : "Kho Hà Tĩnh"}
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