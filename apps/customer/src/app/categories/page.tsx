"use client";

import {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { useCartStore } from "@/store/useCartStore";
import { db } from "@cho-online/firebase";
import {
  collection,
  getDocs,
} from "firebase/firestore";
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
  status?: string;

  // Mức chiết khấu/hoa hồng merchant dành cho Anvami.
  // Ví dụ: 25 nghĩa là 25%.
  commissionPercent?: number;
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
  minOrderValue?: number | null;
  usageLimit?: number | null;
  usedCount?: number;
  endDate?: string | null;
  startDate?: string | null;
  isActive?: boolean;

  // Chỉ voucher do hệ thống tạo riêng cho merchant mới được
  // hiển thị trong KHO VOUCHER.
  targetType?: "ALL" | "MERCHANT" | string;
  merchantId?: string | null;
  merchantCode?: string | null;
  merchantName?: string | null;

  // Hỗ trợ dữ liệu voucher cũ/mới.
  businessCategory?: string | null;
  category?: string | null;
  source?: string | null;
  createdSource?: string | null;
  createdBy?: string | null;
  createdByRole?: string | null;
  createdByType?: string | null;
  creatorRole?: string | null;
  creatorType?: string | null;

  isSystemCreated?: boolean;
  scope?: "PLATFORM" | "MERCHANT";
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

// 🎯 HẠNG MỤC SẢN PHẨM
const CATEGORY_SUGGESTIONS: Record<string, string[]> = {
  "📱 Điện thoại & Phụ kiện": [
    "Điện thoại",
    "Sạc dự phòng",
    "Cáp sạc",
    "Tai nghe",
    "Ốp lưng",
    "Củ sạc",
    "Giá đỡ",
  ],
  "🔌 Thiết bị điện & Chiếu sáng": [
    "Bóng đèn",
    "Ổ cắm",
    "Phích cắm",
    "Dây điện",
    "Công tắc",
    "Đèn học",
    "Đèn pin",
  ],
  "🍳 Gia dụng & Điện gia dụng": [
    "Nồi cơm điện",
    "Nồi chiên",
    "Ấm siêu tốc",
    "Máy sấy tóc",
    "Quạt điện",
    "Bếp từ",
    "Máy xay",
  ],
  "🧺 Giặt xả & Vệ sinh": [
    "Nước giặt",
    "Nước xả vải",
    "Nước rửa chén",
    "Nước lau sàn",
    "Bột giặt",
    "Tẩy bồn cầu",
  ],
  "🧂 Gia vị & Bếp núc": [
    "Dầu ăn",
    "Nước mắm",
    "Hạt nêm",
    "Đường",
    "Tương ớt",
    "Nước tương",
    "Muối",
    "Bột ngọt",
  ],
  "🧻 Giấy & Tã bỉm": [
    "Giấy ăn",
    "Giấy vệ sinh",
    "Khăn ướt",
    "Tã bỉm em bé",
    "Băng vệ sinh",
  ],
  "🧴 Chăm sóc cá nhân": [
    "Dầu gội",
    "Sữa tắm",
    "Kem đánh răng",
    "Bàn chải",
    "Sữa rửa mặt",
    "Xà phòng",
  ],
  "👗 Thời trang & Quần áo": [
    "Áo thun",
    "Quần Jean",
    "Áo khoác",
    "Váy",
    "Phụ kiện",
    "Túi xách",
    "Giày dép",
  ],
};

// 🚫 DANH SÁCH TỪ KHÓA BỊ CẤM
const EXCLUDED_KEYWORDS = [
  "cafe sữa",
  "cafe dừa",
  "cafe trứng",
  "cafe đen",
  "bạc xỉu",
  "trà sữa",
  "sinh tố",
  "nước ép",
  "machiato",
  "latte tươi",
  "cà phê tươi",
  "bún đậu",
  "cơm tấm",
  "phở bò",
  "bánh mì tươi",
  "lẩu",
  "nướng quán",
];

// 🎯 Chỉ cho phép các ngành hàng này trên trang.
const ALLOWED_BUSINESS_CATEGORIES = [
  "CONSUMER_GOODS",
  "FASHION",
  "ELECTRONICS",
  "GROCERY",
  "FMCG",
  "THIẾT BỊ ĐIỆN",
  "ĐIỆN TỬ",
  "THỜI TRANG",
];

const DEFAULT_SHOP_AVATAR =
  "https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=100";

const DEFAULT_PRODUCT_IMAGE =
  "https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400";

const formatSoldCount = (count: number = 0): string => {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1).replace(".0", "")}k`;
  }
  return `${count}`;
};

/**
 * Lấy mức chiết khấu/hoa hồng merchant dành cho Anvami.
 * Hỗ trợ nhiều tên field để tương thích dữ liệu Firestore cũ/mới.
 *
 * Quy ước:
 * - commissionPercent / merchantCommissionPercent / platformCommissionPercent
 *   được hiểu trực tiếp là %.
 * - commissionRate / platformCommissionRate nếu nằm trong [0, 1]
 *   sẽ được quy đổi từ 0.2 -> 20%.
 */
const getMerchantCommissionPercent = (merchantData: Record<string, any>): number => {
  const directCandidates = [
    merchantData.commissionPercent,
    merchantData.merchantCommissionPercent,
    merchantData.platformCommissionPercent,
    merchantData.platformFeePercent,
    merchantData.discountForPlatformPercent,
  ];

  for (const value of directCandidates) {
    const numberValue = Number(value);
    if (Number.isFinite(numberValue)) {
      return numberValue;
    }
  }

  const rateCandidates = [
    merchantData.commissionRate,
    merchantData.platformCommissionRate,
    merchantData.platformFeeRate,
  ];

  for (const value of rateCandidates) {
    const numberValue = Number(value);
    if (Number.isFinite(numberValue)) {
      return numberValue > 0 && numberValue <= 1
        ? numberValue * 100
        : numberValue;
    }
  }

  return 0;
};

/**
 * Chỉ merchant đã được duyệt/đang hoạt động mới được hiển thị trên sàn.
 *
 * Dùng whitelist để:
 * - APPROVED: được duyệt
 * - ACTIVE: đang hoạt động
 *
 * Các trạng thái khác như:
 * PENDING, BLOCKED, REJECTED, SUSPENDED, INACTIVE...
 * hoặc status trống => không hiển thị.
 */
const isMerchantVisible = (merchantData: Record<string, any>): boolean => {
  const status = String(merchantData.status || "")
    .trim()
    .toUpperCase();

  return status === "APPROVED" || status === "ACTIVE";
};

const isStartInFuture = (value?: string | null): boolean => {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && Date.now() < time;
};

const isEndInPast = (value?: string | null): boolean => {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && Date.now() > time;
};

export default function CategoriesPage() {
  const [isMounted, setIsMounted] = useState(false);

  const [activeTab, setActiveTab] = useState("all");
  const [quickFilter, setQuickFilter] = useState("recommend");
  const [shops, setShops] = useState<Record<string, Shop>>({});
  const [products, setProducts] = useState<Product[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [savedVouchers, setSavedVouchers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // 🔄 Header/banner khi cuộn
  const [showBannerOnScroll, setShowBannerOnScroll] = useState(true);
  const lastScrollYRef = useRef(0);

  const [flashTab, setFlashTab] = useState<"active" | "upcoming">("active");

  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);

  const [userInfo, setUserInfo] = useState<UserLocation>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("user_shipping_info");

      if (saved) {
        try {
          const parsed = JSON.parse(saved);

          return {
            customerName:
              parsed.customerName ||
              parsed.name ||
              "Khách Hàng",
            customerPhone:
              parsed.customerPhone ||
              parsed.phone ||
              "0987654321",
            address:
              parsed.address ||
              "45 Phan Đình Phùng, TP Hà Tĩnh",
            lat:
              parsed.location?.latitude ??
              parsed.lat ??
              18.3445,
            lng:
              parsed.location?.longitude ??
              parsed.lng ??
              105.8978,
          };
        } catch (error) {
          console.warn("Không đọc được user_shipping_info:", error);
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

  useEffect(() => {
    setIsMounted(true);

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const lastScrollY = lastScrollYRef.current;

      if (currentScrollY <= 10) {
        setShowBannerOnScroll(true);
      } else if (currentScrollY > lastScrollY && currentScrollY > 60) {
        setShowBannerOnScroll(false);
      } else if (currentScrollY < lastScrollY) {
        setShowBannerOnScroll(true);
      }

      lastScrollYRef.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedSearch = localStorage.getItem("search_history_categories");
    if (savedSearch) {
      try {
        const parsed = JSON.parse(savedSearch);
        if (Array.isArray(parsed)) {
          setSearchHistory(parsed.filter((item) => typeof item === "string"));
        }
      } catch (error) {
        console.error("Không đọc được lịch sử tìm kiếm:", error);
      }
    }

    const userSavedVouchers = localStorage.getItem("saved_vouchers");
    if (userSavedVouchers) {
      try {
        const parsed = JSON.parse(userSavedVouchers);
        if (Array.isArray(parsed)) {
          setSavedVouchers(parsed.filter((item) => typeof item === "string"));
        }
      } catch (error) {
        console.error("Không đọc được voucher đã lưu:", error);
      }
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setIsSearchFocused(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Đồng bộ địa chỉ giao hàng vào localStorage.
  useEffect(() => {
    if (typeof window === "undefined") return;

    localStorage.setItem("user_shipping_info", JSON.stringify(userInfo));
  }, [userInfo]);

  const saveSearchKeyword = useCallback(
    (keyword: string) => {
      const trimmed = keyword.trim();
      if (!trimmed) return;

      const updated = [
        trimmed,
        ...searchHistory.filter((item) => item.toLowerCase() !== trimmed.toLowerCase()),
      ].slice(0, 5);

      setSearchHistory(updated);

      if (typeof window !== "undefined") {
        localStorage.setItem(
          "search_history_categories",
          JSON.stringify(updated)
        );
      }
    },
    [searchHistory]
  );

  const clearHistory = useCallback(() => {
    setSearchHistory([]);

    if (typeof window !== "undefined") {
      localStorage.removeItem("search_history_categories");
    }
  }, []);

  const handleSaveVoucher = useCallback((vCode: string) => {
    setSavedVouchers((prev) => {
      const updated = prev.includes(vCode)
        ? prev.filter((code) => code !== vCode)
        : [...prev, vCode];

      if (typeof window !== "undefined") {
        localStorage.setItem("saved_vouchers", JSON.stringify(updated));
      }

      return updated;
    });
  }, []);

  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const addItemToCart = useCartStore((state) => state.addItem);
  const openCart = useCartStore((state) => state.openCart);
  const getTotalItems = useCartStore((state) => state.getTotalItems);

  const totalCartCount = getTotalItems();

  const calculateHaversineDistance = useCallback(
    (
      lat1: number,
      lon1: number,
      lat2: number,
      lon2: number
    ): { text: string; km: number } => {
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

      if (dist < 1) {
        return {
          text: `${Math.max(100, Math.round(dist * 1000))}m`,
          km: dist,
        };
      }

      return {
        text: `${dist.toFixed(1)} km`,
        km: dist,
      };
    },
    []
  );

  const checkProductDiscount = useCallback((product: Product) => {
    const hasOriginal =
      Number(product.originalPrice) > Number(product.price);

    if (!hasOriginal) {
      return {
        isDiscountActive: false,
        currentPrice: product.price,
        discountPercent: 0,
      };
    }

    const now = Date.now();

    if (product.discountStartTime) {
      const start = new Date(product.discountStartTime).getTime();

      if (Number.isFinite(start) && now < start) {
        return {
          isDiscountActive: false,
          currentPrice: product.originalPrice,
          discountPercent: 0,
        };
      }
    }

    if (product.discountEndTime) {
      const end = new Date(product.discountEndTime).getTime();

      if (Number.isFinite(end) && now > end) {
        return {
          isDiscountActive: false,
          currentPrice: product.originalPrice,
          discountPercent: 0,
        };
      }
    }

    if (
      product.discountStock !== undefined &&
      product.discountStock !== null &&
      Number(product.discountStock) <= 0
    ) {
      return {
        isDiscountActive: false,
        currentPrice: product.originalPrice,
        discountPercent: 0,
      };
    }

    const discountPercent = Math.round(
      ((product.originalPrice - product.price) / product.originalPrice) * 100
    );

    return {
      isDiscountActive: true,
      currentPrice: product.price,
      discountPercent,
    };
  }, []);

  /**
   * FETCH FIRESTORE
   *
   * Quan trọng:
   * 1. Merchant phải APPROVED hoặc ACTIVE.
   * 2. Product phải isAvailable.
   * 3. Product phải là consumer good.
   * 4. Product phải thuộc merchant hợp lệ.
   *
   * Vì vậy BLOCKED/PENDING/REJECTED merchant sẽ không có:
   * - shop trong shops
   * - product trong products
   * - flash sale
   * - ranking
   * - category
   */
  useEffect(() => {
    let isMountedFetch = true;

    async function fetchData() {
      try {
        setLoading(true);

        const [
          merchantsSnap,
          productsSnap,
          reviewsSnap,
          vouchersSnap,
        ] = await Promise.all([
          getDocs(collection(db, "merchants")),
          getDocs(collection(db, "products")),
          getDocs(collection(db, "reviews")),
          // Không filter isActive ngay tại Firestore vì dữ liệu voucher
          // cũ có thể không có field này. Ta sẽ kiểm tra ở JS bên dưới.
          getDocs(collection(db, "vouchers")),
        ]);

        if (!isMountedFetch) return;

        const shopReviewStats: Record<
          string,
          { totalRating: number; count: number }
        > = {};

        reviewsSnap.forEach((docSnap) => {
          const revData = docSnap.data();

          const keys = [
            revData.merchantId,
            revData.shopId,
            revData.merchantCode,
          ]
            .map((value) => String(value || "").trim())
            .filter(Boolean);

          const ratingVal = Number(
            revData.productRating ?? revData.rating ?? 0
          );

          if (ratingVal <= 0 || keys.length === 0) return;

          // Ghi nhận rating theo tất cả key có thể đối chiếu.
          [...new Set(keys)].forEach((key) => {
            if (!shopReviewStats[key]) {
              shopReviewStats[key] = {
                totalRating: 0,
                count: 0,
              };
            }

            shopReviewStats[key].totalRating += ratingVal;
            shopReviewStats[key].count += 1;
          });
        });

        /**
         * ============================================================
         * MERCHANT MAP CHO VOUCHER
         * ============================================================
         *
         * Không phụ thuộc shopMap vì shopMap còn có filter status.
         * Voucher chỉ cần xác định đúng merchant + đúng ngành hàng.
         *
         * Merchant được coi là Electronics khi:
         *   businessCategory === "ELECTRONICS"
         *   AND
         *   category === "ELECTRONICS"
         *
         * Lưu nhiều alias để tương thích dữ liệu cũ:
         * - document ID
         * - merchantId
         * - merchantCode
         * - uid
         * - userId
         */
        const voucherMerchantMap: Record<
          string,
          {
            id: string;
            merchantCode: string;
            name: string;
            businessCategory: string;
            category: string;
          }
        > = {};

        const normalizeKey = (value: unknown): string =>
          String(value ?? "").trim().toUpperCase();

        merchantsSnap.forEach((docSnap) => {
          const data = docSnap.data();

          const businessCategory = normalizeKey(
            data.businessCategory ??
            data.merchantBusinessCategory
          );

          const merchantCategory = normalizeKey(
            data.category ??
            data.merchantCategory
          );

          const isElectronicsMerchant =
            businessCategory === "ELECTRONICS" &&
            merchantCategory === "ELECTRONICS";

          if (isElectronicsMerchant) {
            const merchantCode = String(
              data.merchantCode ?? ""
            ).trim();

            const merchantId = String(
              data.merchantId ?? ""
            ).trim();

            const uid = String(
              data.uid ?? ""
            ).trim();

            const userId = String(
              data.userId ?? ""
            ).trim();

            const merchantInfo = {
              id: docSnap.id,
              merchantCode,
              name:
                data.shopName ||
                data.storeName ||
                data.name ||
                data.fullName ||
                "Cửa Hàng",
              businessCategory,
              category: merchantCategory,
            };

            [
              docSnap.id,
              merchantId,
              merchantCode,
              uid,
              userId,
            ]
              .map((value) => String(value).trim())
              .filter(Boolean)
              .forEach((key) => {
                voucherMerchantMap[key] =
                  merchantInfo;
              });
          }
        });

        /**
         * ============================================================
         * SHOP MAP
         * ============================================================
         * Vẫn giữ rule cũ cho danh sách shop/product.
         * ============================================================
         */
        const shopMap: Record<string, Shop> = {};
        const merchantKeyMap: Record<string, string> = {};

        merchantsSnap.forEach((docSnap) => {
          const data = docSnap.data();

          // BLOCKED/PENDING/REJECTED không vào shopMap.
          if (!isMerchantVisible(data)) {
            return;
          }

          const bCategory = String(
            data.businessCategory || data.category || ""
          )
            .trim()
            .toUpperCase();

          const isAllowedCategory =
            ALLOWED_BUSINESS_CATEGORIES.some((category) =>
              bCategory.includes(category)
            );

          if (!isAllowedCategory) return;

          const rawAvatar = String(
            data.avatar || data.avatarUrl || ""
          ).trim();

          const merchantCode = String(
            data.merchantCode || ""
          ).trim();

          const stats =
            shopReviewStats[docSnap.id] ||
            (merchantCode
              ? shopReviewStats[merchantCode]
              : undefined);

          let calculatedRating =
            Number(data.rating) || 5;
          let calculatedReviewCount =
            Number(data.reviewCount) || 0;

          if (stats && stats.count > 0) {
            calculatedRating = Number(
              (
                stats.totalRating /
                stats.count
              ).toFixed(1)
            );
            calculatedReviewCount =
              stats.count;
          }

          const latRaw =
            data.pickupLocation?.latitude ??
            data.lat ??
            data.latitude ??
            null;

          const lngRaw =
            data.pickupLocation?.longitude ??
            data.lng ??
            data.longitude ??
            null;

          const lat = Number(latRaw);
          const lng = Number(lngRaw);

          shopMap[docSnap.id] = {
            id: docSnap.id,
            merchantCode,
            name:
              data.shopName ||
              data.storeName ||
              data.fullName ||
              "Cửa Hàng",
            avatar:
              rawAvatar || DEFAULT_SHOP_AVATAR,
            rating: calculatedRating,
            reviewCount:
              calculatedReviewCount,
            distance: "1.0 km",
            location:
              data.address ||
              data.storeAddress ||
              "Hà Tĩnh",
            lat: Number.isFinite(lat)
              ? lat
              : null,
            lng: Number.isFinite(lng)
              ? lng
              : null,
            isOpen:
              data.isOpen !== undefined
                ? Boolean(data.isOpen)
                : true,
            openTime:
              data.openTime || "07:00",
            closeTime:
              data.closeTime || "22:00",
            businessCategory:
              bCategory,
            status: String(
              data.status || ""
            )
              .trim()
              .toUpperCase(),
            commissionPercent:
              getMerchantCommissionPercent(
                data
              ),
          };

          merchantKeyMap[docSnap.id] =
            docSnap.id;

          if (merchantCode) {
            merchantKeyMap[merchantCode] =
              docSnap.id;
          }
        });

        const fetchedProducts: Product[] = [];

        productsSnap.forEach((docSnap) => {
          const data = docSnap.data();

          const isAvailable =
            data.isAvailable !== undefined
              ? Boolean(data.isAvailable)
              : true;

          if (!isAvailable) return;

          if (data.isConsumerGood !== true) return;

          const rawShopId = String(
            data.shopId || data.merchantId || ""
          ).trim();

          const rawMerchantCode = String(
            data.merchantCode || ""
          ).trim();

          // Đối chiếu bằng:
          // 1. shopId / merchantId
          // 2. merchantCode
          const matchedShopKey =
            merchantKeyMap[rawShopId] ||
            merchantKeyMap[rawMerchantCode];

          if (!matchedShopKey) return;

          const matchedShop = shopMap[matchedShopKey];

          // Double-check merchant visible.
          // Đây là lớp bảo vệ thứ 2.
          if (!matchedShop || !isMerchantVisible(matchedShop as any)) {
            return;
          }

          const prodName = String(data.name || "").toLowerCase();

          const isExcluded = EXCLUDED_KEYWORDS.some((keyword) =>
            prodName.includes(keyword)
          );

          if (isExcluded) return;

          const images: string[] =
            Array.isArray(data.imageUrls) &&
              data.imageUrls.length > 0
              ? data.imageUrls.filter(
                (image: unknown): image is string =>
                  typeof image === "string" && image.trim() !== ""
              )
              : [];

          const normalizedImages =
            images.length > 0
              ? images
              : [
                String(
                  data.imageUrl ||
                  data.image ||
                  DEFAULT_PRODUCT_IMAGE
                ),
              ];

          const price = Number(data.price) || 0;
          const rawOriginalPrice =
            Number(data.originalPrice) || price;

          const originalPrice =
            rawOriginalPrice > price
              ? rawOriginalPrice
              : price;

          fetchedProducts.push({
            id: docSnap.id,
            shopId: matchedShopKey,
            merchantId:
              String(data.merchantId || matchedShopKey),
            merchantCode:
              rawMerchantCode ||
              matchedShop.merchantCode ||
              "",
            shopName: matchedShop.name,
            name: data.name || "Sản phẩm",
            description: data.description || "",
            price,
            originalPrice,
            discountStock:
              data.discountStock !== undefined &&
                data.discountStock !== null
                ? Number(data.discountStock)
                : null,
            maxPerUser:
              data.maxPerUser !== undefined &&
                data.maxPerUser !== null
                ? Number(data.maxPerUser)
                : null,
            discountStartTime:
              data.discountStartTime ?? null,
            discountEndTime:
              data.discountEndTime ?? null,
            imageUrl: normalizedImages[0],
            imageUrls: normalizedImages,
            soldCount: Number(
              data.soldCount || data.sold || 0
            ),
            reviewCount: Number(data.reviewCount || 0),
            discountBadge: data.discountBadge || "",
            stockProgress: Number(
              data.stockProgress || 80
            ),
            category: data.category || "Danh mục",
            isFavorite:
              data.isFeatured ||
              data.isFavorite ||
              false,
            isAvailable: true,
            reviews: Array.isArray(data.reviews)
              ? data.reviews
              : [],
            unit: data.unit || "Cái",
            brand: data.brand || "Chính Hãng",
            volumeWeight:
              data.volumeWeight ||
              data.weight ||
              data.volume ||
              "",
            expiryDate: data.expiryDate || "",
            isConsumerGood: true,
          });
        });

        /**
         * ============================================================
         * 🎟️ KHO VOUCHER
         * ============================================================
         *
         * KHO VOUCHER gồm 2 nhóm:
         *
         * 1. Voucher riêng merchant do hệ thống tạo.
         * 2. Voucher của Anvami/sàn:
         *      - do hệ thống tạo rõ ràng
         *      - không gắn merchant
         *      - discountType === PERCENTAGE
         *
         * Voucher shop tự tạo vẫn không được đưa vào kho.
         */
        const fetchedVouchers: Voucher[] = [];

        const isSystemVoucher = (
          data: Record<string, any>
        ): boolean => {
          if (data.isSystemCreated === true) {
            return true;
          }

          if (data.isSystemCreated === false) {
            return false;
          }

          const normalizeValue = (value: unknown) =>
            String(value ?? "")
              .trim()
              .toUpperCase();

          const creatorValues = [
            data.source,
            data.createdSource,
            data.createdByRole,
            data.createdByType,
            data.creatorRole,
            data.creatorType,
          ];

          if (
            creatorValues.some((value) =>
              [
                "SYSTEM",
                "ADMIN",
                "ADMINISTRATOR",
              ].includes(normalizeValue(value))
            )
          ) {
            return true;
          }

          // Dữ liệu voucher cũ của Anvami:
          // merchantId / merchantCode có nghĩa đây là
          // voucher hệ thống tạo riêng cho merchant.
          const hasMerchantTarget =
            Boolean(String(data.merchantId ?? "").trim()) ||
            Boolean(String(data.merchantCode ?? "").trim()) ||
            normalizeValue(data.targetType) === "MERCHANT";

          return hasMerchantTarget;
        };

        const hasExplicitSystemMarker = (
          data: Record<string, any>
        ): boolean => {
          if (data.isSystemCreated === true) {
            return true;
          }

          const normalizeValue = (value: unknown) =>
            String(value ?? "")
              .trim()
              .toUpperCase();

          return [
            data.source,
            data.createdSource,
            data.createdByRole,
            data.createdByType,
            data.creatorRole,
            data.creatorType,
          ].some((value) =>
            [
              "SYSTEM",
              "ADMIN",
              "ADMINISTRATOR",
            ].includes(normalizeValue(value))
          );
        };

        const isMerchantTarget = (
          data: Record<string, any>
        ): boolean => {
          const targetType = String(
            data.targetType ?? ""
          )
            .trim()
            .toUpperCase();

          return (
            targetType === "MERCHANT" ||
            Boolean(String(data.merchantId ?? "").trim()) ||
            Boolean(String(data.merchantCode ?? "").trim())
          );
        };

        const isElectronicsVoucherData = (
          data: Record<string, any>
        ): boolean => {
          const businessCategory = normalizeKey(
            data.businessCategory ??
            data.merchantBusinessCategory
          );

          const category = normalizeKey(
            data.category ??
            data.merchantCategory
          );

          return (
            businessCategory === "ELECTRONICS" &&
            category === "ELECTRONICS"
          );
        };

        vouchersSnap.forEach((docSnap) => {
          const vData = docSnap.data();

          const merchantTarget = isMerchantTarget(vData);
          const discountType = normalizeKey(
            vData.discountType
          );

          // =========================================================
          // A. VOUCHER CỦA SÀN / ANVAMI
          // =========================================================
          // Chỉ nhận voucher hệ thống tạo rõ ràng, không gắn merchant
          // và là voucher giảm theo %.
          const normalizeCreator = (value: unknown) =>
            String(value ?? "").trim().toUpperCase();

          const explicitlyMerchantCreated = [
            vData.source,
            vData.createdSource,
            vData.createdByRole,
            vData.createdByType,
            vData.creatorRole,
            vData.creatorType,
          ].some((value) =>
            [
              "MERCHANT",
              "SHOP",
              "STORE",
              "SELLER",
              "PARTNER",
            ].includes(normalizeCreator(value))
          );

          const isPlatformVoucher =
            !merchantTarget &&
            discountType === "PERCENTAGE" &&
            vData.isSystemCreated !== false &&
            !explicitlyMerchantCreated;

          if (isPlatformVoucher) {
            fetchedVouchers.push({
              id: docSnap.id,
              code: String(vData.code || "").trim(),
              title:
                String(vData.title || "").trim() ||
                "Ưu đãi từ Anvami",
              description: String(vData.description || ""),
              applyType:
                discountType === "PERCENTAGE" &&
                  normalizeKey(vData.applyType) === "SHIPPING"
                  ? "SHIPPING"
                  : "ORDER",
              discountType: "PERCENTAGE",
              discountValue:
                Number(vData.discountValue) || 0,
              maxDiscount:
                vData.maxDiscount !== undefined &&
                  vData.maxDiscount !== null
                  ? Number(vData.maxDiscount)
                  : null,
              minOrder:
                vData.minOrder !== undefined &&
                  vData.minOrder !== null
                  ? Number(vData.minOrder)
                  : vData.minOrderValue !== undefined &&
                    vData.minOrderValue !== null
                    ? Number(vData.minOrderValue)
                    : null,
              minOrderValue:
                vData.minOrderValue !== undefined &&
                  vData.minOrderValue !== null
                  ? Number(vData.minOrderValue)
                  : vData.minOrder !== undefined &&
                    vData.minOrder !== null
                    ? Number(vData.minOrder)
                    : null,
              usageLimit:
                vData.usageLimit !== undefined &&
                  vData.usageLimit !== null
                  ? Number(vData.usageLimit)
                  : null,
              usedCount: Number(vData.usedCount || 0),
              startDate: vData.startDate ?? null,
              endDate: vData.endDate ?? null,
              isActive: vData.isActive !== false,
              targetType: "ALL",
              merchantId: null,
              merchantCode: null,
              merchantName: "Anvami",
              businessCategory:
                vData.businessCategory ?? null,
              category: vData.category ?? null,
              source:
                vData.source ??
                vData.createdSource ??
                null,
              createdSource: vData.createdSource ?? null,
              createdBy: vData.createdBy ?? null,
              createdByRole:
                vData.createdByRole ??
                vData.creatorRole ??
                null,
              createdByType:
                vData.createdByType ??
                vData.creatorType ??
                null,
              creatorRole: vData.creatorRole ?? null,
              creatorType: vData.creatorType ?? null,
              isSystemCreated: true,
              scope: "PLATFORM",
            });

            return;
          }

          // =========================================================
          // B. VOUCHER RIÊNG MERCHANT
          // =========================================================
          if (!isSystemVoucher(vData)) {
            return;
          }

          if (!merchantTarget) {
            return;
          }

          const voucherMerchantId = String(
            vData.merchantId ?? ""
          ).trim();

          const voucherMerchantCode = String(
            vData.merchantCode ?? ""
          ).trim();

          const matchedMerchant =
            (voucherMerchantId
              ? voucherMerchantMap[voucherMerchantId]
              : undefined) ||
            (voucherMerchantCode
              ? voucherMerchantMap[voucherMerchantCode]
              : undefined);

          const voucherHasElectronicsCategory =
            isElectronicsVoucherData(vData);

          const merchantIsElectronics =
            Boolean(matchedMerchant);

          if (
            !voucherHasElectronicsCategory &&
            !merchantIsElectronics
          ) {
            return;
          }

          const merchantName =
            vData.merchantName ||
            vData.storeName ||
            vData.shopName ||
            matchedMerchant?.name ||
            "Cửa Hàng";

          const merchantId =
            voucherMerchantId ||
            matchedMerchant?.id ||
            null;

          const merchantCode =
            voucherMerchantCode ||
            matchedMerchant?.merchantCode ||
            null;

          fetchedVouchers.push({
            id: docSnap.id,
            code: String(vData.code || "").trim(),
            title:
              String(vData.title || "").trim() ||
              "Mã giảm giá",
            description: String(vData.description || ""),
            applyType:
              normalizeKey(vData.applyType) ===
                "SHIPPING"
                ? "SHIPPING"
                : "ORDER",
            discountType:
              discountType === "PERCENTAGE"
                ? "PERCENTAGE"
                : "FIXED",
            discountValue:
              Number(vData.discountValue) || 0,
            maxDiscount:
              vData.maxDiscount !== undefined &&
                vData.maxDiscount !== null
                ? Number(vData.maxDiscount)
                : null,
            minOrder:
              vData.minOrder !== undefined &&
                vData.minOrder !== null
                ? Number(vData.minOrder)
                : vData.minOrderValue !== undefined &&
                  vData.minOrderValue !== null
                  ? Number(vData.minOrderValue)
                  : null,
            minOrderValue:
              vData.minOrderValue !== undefined &&
                vData.minOrderValue !== null
                ? Number(vData.minOrderValue)
                : vData.minOrder !== undefined &&
                  vData.minOrder !== null
                  ? Number(vData.minOrder)
                  : null,
            usageLimit:
              vData.usageLimit !== undefined &&
                vData.usageLimit !== null
                ? Number(vData.usageLimit)
                : null,
            usedCount: Number(vData.usedCount || 0),
            startDate: vData.startDate ?? null,
            endDate: vData.endDate ?? null,
            isActive: vData.isActive !== false,
            targetType: "MERCHANT",
            merchantId,
            merchantCode,
            merchantName,
            businessCategory:
              vData.businessCategory ??
              matchedMerchant?.businessCategory ??
              null,
            category:
              vData.category ??
              matchedMerchant?.category ??
              null,
            source:
              vData.source ??
              vData.createdSource ??
              null,
            createdSource: vData.createdSource ?? null,
            createdBy: vData.createdBy ?? null,
            createdByRole:
              vData.createdByRole ??
              vData.creatorRole ??
              null,
            createdByType:
              vData.createdByType ??
              vData.creatorType ??
              null,
            creatorRole: vData.creatorRole ?? null,
            creatorType: vData.creatorType ?? null,
            isSystemCreated: true,
            scope: "MERCHANT",
          });
        });

        // ============================================================
        // 5. CHỈ HIỂN THỊ VOUCHER ĐANG DÙNG ĐƯỢC
        // ============================================================
        const activeUsableVouchers =
          fetchedVouchers
            .filter((voucher) => {
              if (voucher.isActive === false) {
                return false;
              }

              if (
                voucher.startDate &&
                isStartInFuture(
                  voucher.startDate
                )
              ) {
                return false;
              }

              if (
                voucher.endDate &&
                isEndInPast(
                  voucher.endDate
                )
              ) {
                return false;
              }

              if (
                voucher.usageLimit !== null &&
                voucher.usageLimit !== undefined &&
                Number(voucher.usedCount || 0) >=
                Number(voucher.usageLimit)
              ) {
                return false;
              }

              return true;
            })
            .sort((a, b) => {
              // 1) Voucher Anvami trước
              if (a.scope === "PLATFORM" && b.scope !== "PLATFORM") return -1;
              if (a.scope !== "PLATFORM" && b.scope === "PLATFORM") return 1;

              // 2) Freeship trước voucher giảm đơn
              const aShipping = a.applyType === "SHIPPING";
              const bShipping = b.applyType === "SHIPPING";
              if (aShipping && !bShipping) return -1;
              if (!aShipping && bShipping) return 1;

              // 3) % giảm cao hơn trước
              return Number(b.discountValue || 0) - Number(a.discountValue || 0);
            });

        console.log(
          "🎟️ Anvami voucher debug:",
          {
            totalVouchers: vouchersSnap.size,
            systemMerchantVouchers:
              fetchedVouchers.length,
            visibleVouchers:
              activeUsableVouchers.length,
            electronicsMerchants:
              Object.keys(voucherMerchantMap)
                .length,
          }
        );

        if (isMountedFetch) {
          setShops(shopMap);
          setProducts(fetchedProducts);
          setVouchers(activeUsableVouchers);
        }
      } catch (error) {
        console.error("❌ Lỗi khi fetch dữ liệu:", error);

        if (isMountedFetch) {
          setShops({});
          setProducts([]);
          setVouchers([]);
        }
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

  /**
   * ============================================================
   * 🤝 SHOP NỔI BẬT
   * ============================================================
   * Chỉ hiển thị merchant có mức chiết khấu/hoa hồng dành cho Anvami >= 20%.
   * Đây là khu vực quảng bá shop theo chính sách hỗ trợ của sàn.
   */
  const partnerShops = useMemo(() => {
    return Object.values(shops)
      .filter(
        (shop) =>
          Number(shop.commissionPercent || 0) >= 20
      )
      .sort(
        (a, b) =>
          Number(b.commissionPercent || 0) -
          Number(a.commissionPercent || 0)
      );
  }, [shops]);

  /**
   * ============================================================
   * 🚚 TRỢ GIÁ PHÍ SHIP
   * ============================================================
   * Một sản phẩm được gắn nhãn "Sàn trợ giá" khi shop có voucher
   * SHIPPING đang hoạt động trong KHO VOUCHER.
   *
   * - Voucher riêng shop: map theo merchantId / merchantCode.
   * - Voucher sàn: áp dụng cho toàn hệ thống.
   *
   * Không tính mức đủ điều kiện cuối cùng ở card sản phẩm vì điều kiện
   * như khoảng cách, giá trị đơn... có thể chỉ xác định chính xác
   * ở checkout. Card chỉ thông báo rằng shop/sản phẩm đang có hỗ trợ.
   */
  const shippingSubsidyByMerchant = useMemo(() => {
    const map: Record<string, Voucher> = {};

    vouchers.forEach((voucher) => {
      if (voucher.isActive === false) return;
      if (voucher.applyType !== "SHIPPING") return;

      const keys = [
        voucher.merchantId,
        voucher.merchantCode,
      ]
        .map((value) => String(value ?? "").trim())
        .filter(Boolean);

      keys.forEach((key) => {
        const current = map[key];

        // Ưu tiên voucher % cao hơn; nếu bằng nhau thì maxDiscount cao hơn.
        if (!current) {
          map[key] = voucher;
          return;
        }

        const currentPercent =
          current.discountType === "PERCENTAGE"
            ? Number(current.discountValue || 0)
            : 0;

        const nextPercent =
          voucher.discountType === "PERCENTAGE"
            ? Number(voucher.discountValue || 0)
            : 0;

        if (
          nextPercent > currentPercent ||
          (nextPercent === currentPercent &&
            Number(voucher.maxDiscount || 0) >
            Number(current.maxDiscount || 0))
        ) {
          map[key] = voucher;
        }
      });
    });

    return map;
  }, [vouchers]);

  const platformShippingSubsidy = useMemo(() => {
    return (
      vouchers
        .filter(
          (voucher) =>
            voucher.scope === "PLATFORM" &&
            voucher.isActive !== false &&
            voucher.applyType === "SHIPPING"
        )
        .sort(
          (a, b) =>
            Number(b.discountValue || 0) -
            Number(a.discountValue || 0)
        )[0] ?? null
    );
  }, [vouchers]);

  const getShippingSubsidyForProduct = useCallback(
    (product: Product): Voucher | null => {
      return (
        shippingSubsidyByMerchant[String(product.merchantId || "").trim()] ||
        shippingSubsidyByMerchant[String(product.merchantCode || "").trim()] ||
        platformShippingSubsidy ||
        null
      );
    },
    [shippingSubsidyByMerchant, platformShippingSubsidy]
  );

  const calculatedDistances = useMemo(() => {
    const distances: Record<
      string,
      { text: string; km: number }
    > = {};

    const userLat =
      typeof userInfo.lat === "number"
        ? userInfo.lat
        : Number(userInfo.lat);

    const userLng =
      typeof userInfo.lng === "number"
        ? userInfo.lng
        : Number(userInfo.lng);

    const hasUserCoords =
      Number.isFinite(userLat) &&
      Number.isFinite(userLng);

    for (const shop of Object.values(shops)) {
      const shopLat =
        typeof shop.lat === "number"
          ? shop.lat
          : Number(shop.lat);

      const shopLng =
        typeof shop.lng === "number"
          ? shop.lng
          : Number(shop.lng);

      const hasShopCoords =
        Number.isFinite(shopLat) &&
        Number.isFinite(shopLng);

      if (hasUserCoords && hasShopCoords) {
        distances[shop.id] =
          calculateHaversineDistance(
            userLat,
            userLng,
            shopLat,
            shopLng
          );
      } else {
        distances[shop.id] = {
          text: shop.distance || "1.0 km",
          km: 1.0,
        };
      }
    }

    return distances;
  }, [
    userInfo.lat,
    userInfo.lng,
    shops,
    calculateHaversineDistance,
  ]);

  const getShopDistance = useCallback(
    (shop?: Shop) => {
      if (!shop) return "Kho Hà Tĩnh";

      return (
        calculatedDistances[shop.id]?.text ||
        shop.distance ||
        "1.0 km"
      );
    },
    [calculatedDistances]
  );

  const formatCurrency = useCallback(
    (amount: number) => {
      return new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
      }).format(amount);
    },
    []
  );

  /**
   * 🛒 Chỉ thêm vào cart.
   *
   * KHÔNG giảm stock tại đây.
   * Stock phải được trừ khi order được tạo/thanh toán thành công.
   */
  const handleAddToCart = useCallback(
    async (product: Product) => {
      const shop = shops[product.shopId];

      if (!shop) {
        console.warn(
          "Không tìm thấy merchant hợp lệ cho product:",
          product.id
        );
        return;
      }

      // Lớp bảo vệ client cuối cùng:
      if (!isMerchantVisible(shop as any)) {
        console.warn(
          "Chặn thêm cart vì merchant không còn hoạt động:",
          shop.id,
          shop.status
        );
        return;
      }

      if (shop.isOpen === false) {
        return;
      }

      const discountInfo =
        checkProductDiscount(product);

      const cartProduct = {
        ...product,
        price: discountInfo.currentPrice,
      };

      const distance =
        getShopDistance(shop);

      (addItemToCart as any)(
        cartProduct,
        distance
      );
    },
    [
      shops,
      getShopDistance,
      addItemToCart,
      checkProductDiscount,
    ]
  );

  const {
    activeDeals,
    upcomingDeals,
  } = useMemo(() => {
    const now = Date.now();

    const active: (Product & {
      _discountPercent: number;
    })[] = [];

    const upcoming: Product[] = [];

    products.forEach((product) => {
      const {
        isDiscountActive,
        discountPercent,
      } = checkProductDiscount(product);

      if (isDiscountActive) {
        active.push({
          ...product,
          _discountPercent: discountPercent,
        });

        return;
      }

      if (
        product.originalPrice > product.price &&
        product.discountStartTime
      ) {
        const start = new Date(
          product.discountStartTime
        ).getTime();

        if (
          Number.isFinite(start) &&
          start > now
        ) {
          upcoming.push(product);
        }
      }
    });

    active.sort(
      (a, b) =>
        b._discountPercent -
        a._discountPercent
    );

    return {
      activeDeals: active,
      upcomingDeals: upcoming,
    };
  }, [
    products,
    checkProductDiscount,
  ]);

  const rankedProducts = useMemo(() => {
    return products.map((product) => {
      const shop =
        shops[product.shopId];

      const distKm =
        calculatedDistances[
          product.shopId
        ]?.km ?? 1.0;

      const rating =
        shop?.rating || 5.0;

      const {
        isDiscountActive,
        discountPercent,
      } = checkProductDiscount(product);

      const popularityScore =
        Math.min(
          100,
          product.soldCount * 0.8
        );

      const promoScore =
        isDiscountActive
          ? discountPercent * 2.5
          : 0;

      const ratingScore =
        rating * 20;

      const totalScore =
        popularityScore * 0.45 +
        promoScore * 0.35 +
        ratingScore * 0.2;

      return {
        ...product,
        totalScore,
        distanceKm: distKm,
      };
    });
  }, [
    products,
    shops,
    calculatedDistances,
    checkProductDiscount,
  ]);

  const filteredProducts = useMemo(() => {
    let result = [...rankedProducts];

    const search =
      searchQuery.trim().toLowerCase();

    if (search) {
      result = result.filter(
        (product) =>
          product.name
            .toLowerCase()
            .includes(search) ||
          product.description
            .toLowerCase()
            .includes(search) ||
          product.shopName
            .toLowerCase()
            .includes(search) ||
          product.category
            .toLowerCase()
            .includes(search) ||
          Boolean(
            product.brand &&
            product.brand
              .toLowerCase()
              .includes(search)
          )
      );
    }

    if (activeTab !== "all") {
      result = result.filter(
        (product) => {
          const category =
            product.category.toLowerCase();

          const tabLower =
            activeTab.toLowerCase();

          if (
            category.includes(tabLower) ||
            tabLower.includes(category)
          ) {
            return true;
          }

          const subItems =
            CATEGORY_SUGGESTIONS[
            activeTab
            ];

          return Boolean(
            subItems?.some(
              (subItem) =>
                product.name
                  .toLowerCase()
                  .includes(
                    subItem.toLowerCase()
                  ) ||
                category.includes(
                  subItem.toLowerCase()
                )
            )
          );
        }
      );
    }

    if (
      quickFilter ===
      "recommend"
    ) {
      result.sort(
        (a, b) =>
          b.totalScore -
          a.totalScore
      );
    } else if (
      quickFilter === "fast"
    ) {
      result.sort(
        (a, b) =>
          a.distanceKm -
          b.distanceKm
      );
    } else if (
      quickFilter === "discount"
    ) {
      result.sort(
        (a, b) =>
          checkProductDiscount(b)
            .discountPercent -
          checkProductDiscount(a)
            .discountPercent
      );
    } else if (
      quickFilter ===
      "bestseller"
    ) {
      result.sort(
        (a, b) =>
          b.soldCount -
          a.soldCount
      );
    }

    return result;
  }, [
    searchQuery,
    activeTab,
    quickFilter,
    rankedProducts,
    checkProductDiscount,
  ]);

  /**
   * ShopDetailModal chỉ nhận sản phẩm của đúng quán.
   */
  const selectedShopProducts = useMemo(() => {
    if (!selectedShop) return [];

    return products.filter(
      (product) =>
        product.shopId ===
        selectedShop.id
    );
  }, [products, selectedShop]);

  // Chặn render SSR trước khi đọc localStorage.
  if (!isMounted) {
    return (
      <div className="bg-[#f0f4f8] min-h-screen flex items-center justify-center">
        <div className="text-slate-500 text-xs font-bold animate-pulse">
          Đang tải ứng dụng...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#f0f4f8] min-h-screen pb-24 font-sans text-slate-800">
      {/* HEADER */}
      <div
        className={`sticky top-0 z-40 transition-all duration-300 shadow-md ${showBannerOnScroll
            ? "translate-y-0 opacity-100"
            : "-translate-y-full opacity-0"
          }`}
      >
        <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-600 p-3 text-white space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 overflow-hidden flex-1 bg-white/15 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20">
              <span className="text-sm shrink-0">
                📍
              </span>

              <div className="text-[11px] leading-tight truncate flex-1">
                <span className="text-[9px] opacity-80 block font-medium">
                  Giao hàng đến:
                </span>

                <input
                  type="text"
                  value={userInfo.address}
                  onChange={(event) =>
                    setUserInfo(
                      (prev) => ({
                        ...prev,
                        address:
                          event.target
                            .value,
                      })
                    )
                  }
                  placeholder="Nhập địa chỉ giao hàng..."
                  className="bg-transparent text-white font-bold text-xs focus:outline-none w-full truncate placeholder:text-white/70"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={openCart}
              className="relative p-2 bg-white/15 hover:bg-white/25 rounded-full transition cursor-pointer border border-white/20"
            >
              <span className="text-xl">
                🛒
              </span>

              {totalCartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-cyan-400 text-blue-950 text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-white shadow-sm animate-pulse">
                  {totalCartCount}
                </span>
              )}
            </button>
          </div>

          {/* SEARCH */}
          <div
            className="relative"
            ref={searchRef}
          >
            <div className="relative flex items-center">
              <input
                type="text"
                value={searchQuery}
                onFocus={() =>
                  setIsSearchFocused(true)
                }
                onChange={(event) =>
                  setSearchQuery(
                    event.target.value
                  )
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    saveSearchKeyword(
                      searchQuery
                    );
                    setIsSearchFocused(
                      false
                    );
                  }
                }}
                placeholder="Tìm đồ gia dụng, điện tử, thời trang, quần áo..."
                className="w-full bg-white text-slate-800 text-xs py-2.5 pl-9 pr-20 rounded-xl outline-none placeholder:text-slate-400 shadow-inner font-medium"
              />

              <span className="absolute left-3 text-slate-400 text-xs">
                🔍
              </span>

              {searchQuery && (
                <button
                  type="button"
                  onClick={() =>
                    setSearchQuery("")
                  }
                  className="absolute right-14 text-slate-400 hover:text-slate-600 p-1 text-xs font-bold"
                >
                  ✕
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  saveSearchKeyword(
                    searchQuery
                  );
                  setIsSearchFocused(
                    false
                  );
                }}
                className="absolute right-1 top-1 bottom-1 bg-blue-600 hover:bg-blue-700 text-white px-3.5 rounded-lg text-[11px] font-bold transition"
              >
                Tìm kiếm
              </button>
            </div>

            {isSearchFocused && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 p-3 z-50 text-slate-800 space-y-3">
                {searchHistory.length >
                  0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                        <span>
                          LỊCH SỬ TÌM KIẾM
                        </span>

                        <button
                          type="button"
                          onClick={
                            clearHistory
                          }
                          className="hover:text-blue-600"
                        >
                          Xóa
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {searchHistory.map(
                          (
                            item,
                            index
                          ) => (
                            <button
                              type="button"
                              key={`${item}-${index}`}
                              onClick={() => {
                                setSearchQuery(
                                  item
                                );
                                setIsSearchFocused(
                                  false
                                );
                              }}
                              className="bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600 text-[11px] px-2.5 py-1 rounded-full cursor-pointer transition font-medium"
                            >
                              🕒 {item}
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  )}

                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold text-slate-400">
                    🔥 TÌM KIẾM NHIỀU NHẤT
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {HOT_KEYWORDS.map(
                      (keyword) => (
                        <button
                          type="button"
                          key={keyword}
                          onClick={() => {
                            setSearchQuery(
                              keyword
                            );
                            saveSearchKeyword(
                              keyword
                            );
                            setIsSearchFocused(
                              false
                            );
                          }}
                          className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[11px] px-2.5 py-1 rounded-full cursor-pointer transition font-bold"
                        >
                          {keyword}
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 🎟️ KHO VOUCHER */}
      {!searchQuery &&
        vouchers.length > 0 && (
          <div className="bg-white py-1.5 border-b border-blue-100">
            <div className="px-3 flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-sm">🎟️</span>
                <h3 className="text-[10px] font-black text-slate-900 tracking-tight flex items-center gap-1 truncate">
                  KHO VOUCHER
                  <span className="bg-blue-600 text-white text-[7px] font-extrabold px-1.5 py-0.5 rounded-full">
                    {vouchers.length}
                  </span>
                </h3>
              </div>

              <button
                type="button"
                onClick={openCart}
                className="text-[9px] text-blue-700 font-bold hover:underline flex items-center gap-0.5 shrink-0"
              >
                Ví Voucher ({savedVouchers.length}) →
              </button>
            </div>

            <div className="flex gap-1.5 overflow-x-auto no-scrollbar px-3 pb-0.5">
              {vouchers.map((voucher) => {
                const isSaved = savedVouchers.includes(voucher.code);
                const isFreeship = voucher.applyType === "SHIPPING";
                const isPlatformVoucher = voucher.scope === "PLATFORM";

                return (
                  <div
                    key={voucher.id}
                    className={`min-w-[205px] max-w-[205px] h-[72px] rounded-lg border overflow-hidden flex shrink-0 transition ${isFreeship
                        ? isSaved
                          ? "bg-emerald-50/60 border-emerald-500"
                          : "bg-white border-emerald-200"
                        : isSaved
                          ? "bg-blue-50/40 border-emerald-500"
                          : "bg-white border-blue-200"
                      }`}
                  >
                    <div
                      className={`w-11 shrink-0 flex flex-col items-center justify-center text-white ${isFreeship
                          ? "bg-gradient-to-br from-emerald-500 to-teal-600"
                          : "bg-gradient-to-br from-blue-600 to-indigo-600"
                        }`}
                    >
                      <span className="text-base leading-none">
                        {isFreeship ? "🚚" : "🏷️"}
                      </span>
                      <span className="text-[7px] font-black mt-0.5">
                        {isFreeship ? "SHIP" : "VOUCHER"}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0 px-2 py-1.5 flex flex-col justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="font-mono text-[9px] font-black text-slate-700 bg-slate-100 px-1 py-px rounded truncate">
                            {voucher.code}
                          </span>
                          {isPlatformVoucher ? (
                            <span className="text-[7px] font-black text-blue-700 bg-blue-50 px-1 py-px rounded shrink-0">
                              ANVAMI
                            </span>
                          ) : (
                            <span className="text-[7px] font-black text-slate-500 bg-slate-50 px-1 py-px rounded shrink-0">
                              SHOP
                            </span>
                          )}
                        </div>

                        <div className={`text-[10px] font-black leading-none mt-1 ${isFreeship ? "text-emerald-600" : "text-rose-600"
                          }`}>
                          {voucher.discountType === "PERCENTAGE"
                            ? `Giảm ${voucher.discountValue}%${isFreeship ? " phí ship" : ""}`
                            : `Giảm ${formatCurrency(voucher.discountValue)}`}
                          {voucher.maxDiscount
                            ? ` • ≤ ${formatCurrency(voucher.maxDiscount)}`
                            : ""}
                        </div>

                        <div className="text-[8px] text-slate-400 truncate mt-0.5">
                          {voucher.minOrder && voucher.minOrder > 0
                            ? `Đơn từ ${formatCurrency(voucher.minOrder)}`
                            : voucher.merchantName || "Ưu đãi đang áp dụng"}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <span
                          className={`text-[8px] font-bold leading-none whitespace-nowrap shrink-0 ${isFreeship ? "text-emerald-600" : "text-slate-400"
                            }`}
                        >
                          {isPlatformVoucher
                            ? "🎟️ Voucher sàn"
                            : voucher.merchantName || "Ưu đãi shop"}
                        </span>

                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      {/* ⭐ SHOP NỔI BẬT */}
      {!searchQuery &&
        partnerShops.length > 0 && (
          <div className="bg-white my-2 py-3 border-y border-amber-100 shadow-2xs">
            <div className="px-3 flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-base">🤝</span>

                <h3 className="text-[11px] font-black text-slate-900 tracking-tight flex items-center gap-1">
                  SHOP NỔI BẬT
                  <span className="bg-amber-500 text-white text-[8px] font-extrabold px-1.5 py-0.2 rounded-full uppercase">
                    {partnerShops.length} shop
                  </span>
                </h3>
              </div>

              <span className="text-[9px] text-amber-700 font-bold bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full shrink-0">
                NỔI BẬT
              </span>
            </div>

            <div className="px-3 mb-2 text-[8px] text-slate-500 font-medium">
              ✨ Những shop nổi bật được Anvami ưu tiên giới thiệu tới khách hàng.
            </div>

            <div className="flex gap-2 overflow-x-auto no-scrollbar px-3 py-0.5">
              {partnerShops.map((shop) => {
                return (
                  <button
                    type="button"
                    key={shop.id}
                    onClick={() =>
                      setSelectedShop(shop)
                    }
                    className="min-w-[180px] max-w-[180px] bg-white border border-amber-200 rounded-xl p-2 text-left hover:border-amber-400 hover:shadow-md transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <img
                        src={shop.avatar}
                        alt={shop.name}
                        loading="lazy"
                        className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0 bg-slate-100"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 mb-0.5">
                          <span className="text-[8px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 px-1 py-0.5 rounded">
                            NỔI BẬT
                          </span>
                        </div>

                        <h4 className="text-[10px] font-black text-slate-800 truncate">
                          {shop.name}
                        </h4>

                        <div className="flex items-center gap-1 text-[8px] text-slate-500 mt-0.5">
                          <span className="text-amber-500 font-bold">
                            ★ {shop.rating || 5}
                          </span>
                          <span>•</span>
                          <span className="truncate">
                            {getShopDistance(shop)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-[9px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-1 rounded-lg">
                        ⭐
                      </span>

                      <span className="text-[9px] font-bold text-blue-600">
                        Xem shop →
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

      {/* DANH MỤC NỔI BẬT */}
      <div className="bg-white py-2 px-3 border-b border-slate-200/80 shadow-2xs space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-black text-slate-800 tracking-tight flex items-center gap-1">
            <span>🛒</span>
            DANH MỤC NỔI BẬT
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
              <span>
                Điện Máy & Công Nghệ
              </span>
            </div>

            <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {[
                {
                  id: "smart_tech",
                  label: "Điện Thoại & Phụ Kiện",
                  emoji: "📱",
                  desc: "Sạc dự phòng, Tai nghe",
                  category:
                    "📱 Điện thoại & Phụ kiện",
                  filter: "recommend",
                },
                {
                  id: "smart_electric",
                  label: "Thiết Bị Điện",
                  emoji: "🔌",
                  desc: "Bóng đèn, Ổ cắm, Pin",
                  category:
                    "🔌 Thiết bị điện & Chiếu sáng",
                  filter: "recommend",
                },
                {
                  id: "smart_home",
                  label: "Điện Gia Dụng",
                  emoji: "🍳",
                  desc: "Nồi chiên, Ấm siêu tốc",
                  category:
                    "🍳 Gia dụng & Điện gia dụng",
                  filter: "bestseller",
                },
              ].map((item) => {
                const isActive =
                  activeTab ===
                  item.category &&
                  searchQuery === "";

                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => {
                      if (isActive) {
                        setActiveTab("all");
                        setQuickFilter(
                          "recommend"
                        );
                      } else {
                        setActiveTab(
                          item.category
                        );
                        setQuickFilter(
                          item.filter
                        );
                        setSearchQuery(
                          ""
                        );
                      }
                    }}
                    className={`min-w-[115px] max-w-[125px] rounded-lg p-1.5 cursor-pointer transition-all duration-200 shrink-0 space-y-0.5 relative border text-left ${isActive
                        ? "bg-gradient-to-br from-blue-700 to-indigo-700 text-white border-blue-800 shadow-sm ring-1 ring-blue-400/50"
                        : "bg-blue-50/30 border-blue-100 text-slate-800 hover:border-blue-300 hover:bg-blue-50/60"
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm">
                        {item.emoji}
                      </span>

                      <span
                        className={`text-[7px] font-black px-1 py-0.1 rounded ${isActive
                            ? "bg-white text-blue-800"
                            : "bg-blue-100 text-blue-800"
                          }`}
                      >
                        {isActive
                          ? "✓ Chọn"
                          : "Công Nghệ"}
                      </span>
                    </div>

                    <div>
                      <p
                        className={`text-[10px] font-bold leading-tight truncate ${isActive
                            ? "text-white"
                            : "text-slate-800"
                          }`}
                      >
                        {item.label}
                      </p>

                      <p
                        className={`text-[8px] leading-tight truncate ${isActive
                            ? "text-blue-100"
                            : "text-slate-500"
                          }`}
                      >
                        {item.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* HÀNG 2 */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-800 uppercase tracking-wider">
              <span>🧺</span>
              <span>
                Bách Hóa & Thời Trang
              </span>
            </div>

            <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {[
                {
                  id: "smart_laundry",
                  label: "Giặt Xả Giá Sốc",
                  emoji: "🧺",
                  desc: "Nước giặt, Xả vải",
                  category:
                    "🧺 Giặt xả & Vệ sinh",
                  filter: "discount",
                },
                {
                  id: "smart_spices",
                  label: "Gia Vị Nhà Bếp",
                  emoji: "🧂",
                  desc: "Dầu ăn, Nước mắm",
                  category:
                    "🧂 Gia vị & Bếp núc",
                  filter: "bestseller",
                },
                {
                  id: "smart_fashion",
                  label: "Thời Trang & Quần Áo",
                  emoji: "👗",
                  desc: "Áo thun, Quần, Váy",
                  category:
                    "👗 Thời trang & Quần áo",
                  filter: "recommend",
                },
              ].map((item) => {
                const isActive =
                  activeTab ===
                  item.category &&
                  searchQuery === "";

                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => {
                      if (isActive) {
                        setActiveTab("all");
                        setQuickFilter(
                          "recommend"
                        );
                      } else {
                        setActiveTab(
                          item.category
                        );
                        setQuickFilter(
                          item.filter
                        );
                        setSearchQuery(
                          ""
                        );
                      }
                    }}
                    className={`min-w-[115px] max-w-[125px] rounded-lg p-1.5 cursor-pointer transition-all duration-200 shrink-0 space-y-0.5 relative border text-left ${isActive
                        ? "bg-gradient-to-br from-emerald-600 to-teal-700 text-white border-emerald-800 shadow-sm ring-1 ring-emerald-400/50"
                        : "bg-emerald-50/30 border-emerald-100 text-slate-800 hover:border-emerald-300 hover:bg-emerald-50/60"
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm">
                        {item.emoji}
                      </span>

                      <span
                        className={`text-[7px] font-black px-1 py-0.1 rounded ${isActive
                            ? "bg-white text-emerald-800"
                            : "bg-emerald-100 text-emerald-800"
                          }`}
                      >
                        {isActive
                          ? "✓ Chọn"
                          : "Mua Sắm"}
                      </span>
                    </div>

                    <div>
                      <p
                        className={`text-[10px] font-bold leading-tight truncate ${isActive
                            ? "text-white"
                            : "text-slate-800"
                          }`}
                      >
                        {item.label}
                      </p>

                      <p
                        className={`text-[8px] leading-tight truncate ${isActive
                            ? "text-emerald-100"
                            : "text-slate-500"
                          }`}
                      >
                        {item.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* QUICK FILTERS */}
      <div className="px-2 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar bg-slate-200/60 sticky top-0 z-30 backdrop-blur-md">
        {[
          {
            id: "recommend",
            label: "🎯 Gợi ý tốt nhất",
          },
          {
            id: "bestseller",
            label: "👑 Bán chạy nhất",
          },
          {
            id: "discount",
            label: "💥 Giảm giá sâu",
          },
          {
            id: "fast",
            label: "🚚 Giao nhanh",
          },
        ].map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() =>
              setQuickFilter(filter.id)
            }
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap border transition cursor-pointer shrink-0 ${quickFilter ===
                filter.id
                ? "bg-blue-700 text-white border-blue-700 shadow-2xs"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* FLASH SALE */}
      {!searchQuery &&
        (activeDeals.length > 0 ||
          upcomingDeals.length > 0) && (
          <div className="bg-white my-2 py-3 border-y border-slate-200 shadow-2xs">
            <div className="px-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="bg-gradient-to-r from-blue-700 to-cyan-600 text-white font-black italic text-xs px-2.5 py-1 rounded-lg tracking-wider flex items-center gap-1 shadow-xs">
                    <span>⚡</span>
                    GIỜ VÀNG XẢ KHO
                  </div>

                  {flashTab === "active" &&
                    activeDeals.length >
                    0 && (
                      <span className="bg-slate-900 text-cyan-400 font-mono text-[10px] px-1.5 py-0.5 rounded-md font-bold">
                        ĐANG DIỄN RA
                      </span>
                    )}
                </div>
              </div>

              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <button
                  type="button"
                  onClick={() =>
                    setFlashTab("active")
                  }
                  disabled={
                    activeDeals.length ===
                    0
                  }
                  className={`text-xs font-bold px-3 py-1 rounded-full transition cursor-pointer flex items-center gap-1.5 ${flashTab === "active"
                      ? "bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs"
                      : "text-slate-500 hover:bg-slate-100"
                    } ${activeDeals.length === 0
                      ? "opacity-40 cursor-not-allowed"
                      : ""
                    }`}
                >
                  <span>
                    🔥 Đang giảm giá (
                    {
                      activeDeals.length
                    }
                    )
                  </span>
                </button>

                {upcomingDeals.length >
                  0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setFlashTab(
                          "upcoming"
                        )
                      }
                      className={`text-xs font-bold px-3 py-1 rounded-full transition cursor-pointer flex items-center gap-1.5 ${flashTab ===
                          "upcoming"
                          ? "bg-cyan-50 text-cyan-800 border border-cyan-200 shadow-2xs"
                          : "text-slate-500 hover:bg-slate-100"
                        }`}
                    >
                      <span>
                        ⏰ Sắp xả kho (
                        {
                          upcomingDeals.length
                        }
                        )
                      </span>
                    </button>
                  )}
              </div>
            </div>

            <div className="flex gap-2.5 overflow-x-auto no-scrollbar px-3 pt-2">
              {(flashTab ===
                "active"
                ? activeDeals
                : upcomingDeals
              ).map((item) => {
                const {
                  currentPrice,
                  discountPercent,
                } = checkProductDiscount(
                  item
                );

                const displayPrice =
                  flashTab ===
                    "active"
                    ? currentPrice
                    : item.price;

                return (
                  <div
                    key={item.id}
                    onClick={() =>
                      setSelectedProduct(
                        item
                      )
                    }
                    className="min-w-[145px] max-w-[145px] bg-white border border-slate-200 rounded-2xl p-2 relative flex flex-col justify-between shadow-2xs cursor-pointer hover:border-blue-500 hover:shadow-md transition duration-200 group"
                  >
                    {discountPercent >
                      0 && (
                        <div className="absolute top-0 right-0 bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-bl-xl rounded-tr-2xl z-10 shadow-xs">
                          -{discountPercent}%
                        </div>
                      )}

                    <div className="space-y-1.5">
                      <div className="aspect-square bg-slate-100 rounded-xl overflow-hidden relative group-hover:scale-[1.02] transition duration-200">
                        <img
                          src={
                            item.imageUrl
                          }
                          alt={
                            item.name
                          }
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />

                        <span className="absolute top-1 left-1 bg-black/60 text-cyan-300 text-[8px] font-extrabold px-1.5 py-0.5 rounded-md backdrop-blur-xs">
                          🏷️{" "}
                          {item.brand ||
                            "Chính hãng"}
                        </span>

                        <span className="absolute bottom-1 left-1 bg-slate-900/80 text-white text-[8px] font-semibold px-1.5 py-0.5 rounded-md backdrop-blur-xs">
                          📦{" "}
                          {item.volumeWeight ||
                            item.unit ||
                            "Cái"}
                        </span>
                      </div>

                      <div>
                        <p className="text-[9px] font-semibold text-slate-400 truncate">
                          🏢{" "}
                          {
                            item.shopName
                          }
                        </p>

                        <h4 className="text-[11px] font-bold text-slate-800 line-clamp-1 group-hover:text-blue-600 transition">
                          {item.name}
                        </h4>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-1.5 border-t border-slate-100 mt-1">
                      <div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xs font-black text-blue-700">
                            {formatCurrency(
                              displayPrice
                            )}
                          </span>
                        </div>

                        {item.originalPrice >
                          displayPrice && (
                            <div className="text-[9px] text-slate-400 line-through">
                              {formatCurrency(
                                item.originalPrice
                              )}
                            </div>
                          )}
                      </div>

                      <button
                        type="button"
                        onClick={(
                          event
                        ) => {
                          event.stopPropagation();

                          handleAddToCart(
                            item
                          );
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

      {/* TABS DANH MỤC */}
      <div className="bg-white border-b border-slate-200 my-1 py-2">
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-3 whitespace-nowrap">
          <button
            type="button"
            onClick={() =>
              setActiveTab("all")
            }
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition shrink-0 cursor-pointer ${activeTab === "all"
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
          >
            📦 Tất cả sản phẩm (
            {products.length})
          </button>

          {Object.keys(
            CATEGORY_SUGGESTIONS
          ).map((category) => (
            <button
              type="button"
              key={category}
              onClick={() =>
                setActiveTab(category)
              }
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition shrink-0 cursor-pointer ${activeTab === category
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* GRID PRODUCT */}
      {loading ? (
        <div className="p-2 grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map(
            (number) => (
              <div
                key={number}
                className="bg-white rounded-xl p-2 space-y-2 animate-pulse border border-slate-200"
              >
                <div className="aspect-square bg-slate-200 rounded-lg" />
                <div className="h-3 bg-slate-200 rounded-xs w-3/4" />
                <div className="h-3 bg-slate-200 rounded-xs w-1/2" />
              </div>
            )
          )}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="p-8 text-center space-y-2">
          <span className="text-4xl">
            🛒
          </span>

          <p className="text-xs font-bold text-slate-600">
            Không tìm thấy sản phẩm tiêu dùng hoặc thời trang phù hợp.
          </p>

          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setActiveTab("all");
              setQuickFilter(
                "recommend"
              );
            }}
            className="text-xs text-blue-600 font-bold underline cursor-pointer"
          >
            Tải lại toàn bộ danh mục
          </button>
        </div>
      ) : (
        <div className="p-2 grid grid-cols-2 gap-2">
          {filteredProducts.map(
            (product) => {
              const shop =
                shops[product.shopId];

              const {
                isDiscountActive,
                currentPrice,
                discountPercent,
              } =
                checkProductDiscount(
                  product
                );

              const shippingSubsidy =
                getShippingSubsidyForProduct(product);

              return (
                <div
                  key={product.id}
                  className="bg-white rounded-xl overflow-hidden border border-slate-200/80 shadow-2xs hover:shadow-md transition flex flex-col justify-between group"
                >
                  <div>
                    {shop && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedShop(
                            shop
                          );
                        }}
                        className="w-full flex items-center gap-1.5 p-1.5 bg-slate-50 border-b border-slate-100 cursor-pointer hover:bg-slate-100 transition text-left"
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

                        <span className="text-[8px] text-slate-400 shrink-0">
                          ➔
                        </span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        setSelectedProduct(
                          product
                        )
                      }
                      className="w-full text-left cursor-pointer"
                    >
                      <div className="relative aspect-square bg-slate-100 overflow-hidden">
                        <img
                          src={
                            product.imageUrl
                          }
                          alt={
                            product.name
                          }
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />

                        <div className="absolute top-1 left-1 flex flex-col gap-1 items-start z-10">
                          <span className="bg-slate-900/80 text-cyan-300 text-[8px] font-extrabold px-1.5 py-0.5 rounded-md backdrop-blur-xs">
                            🏷️{" "}
                            {product.brand ||
                              "Chính Hãng"}
                          </span>
                        </div>

                        {isDiscountActive &&
                          discountPercent >
                          0 && (
                            <div className="absolute top-0 right-0 bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-bl-lg shadow-2xs">
                              -
                              {
                                discountPercent
                              }
                              %
                            </div>
                          )}

                        {shippingSubsidy && (
                          <div
                            className="absolute bottom-1 left-1 bg-emerald-500/95 text-white text-[7px] px-1.5 py-1 rounded-md font-black shadow-sm backdrop-blur-xs max-w-[58%] truncate"
                            title={shippingSubsidy.description || "Sàn trợ giá phí vận chuyển"}
                          >
                            🚚 -{shippingSubsidy.discountType === "PERCENTAGE"
                              ? `${shippingSubsidy.discountValue}%`
                              : formatCurrency(shippingSubsidy.discountValue)} SHIP
                          </div>
                        )}

                        <div className="absolute bottom-1 right-1 bg-slate-900/80 text-white text-[8px] px-1.5 py-0.5 rounded-md backdrop-blur-xs font-semibold">
                          📦{" "}
                          {product.volumeWeight ||
                            product.unit ||
                            "Cái"}
                        </div>
                      </div>

                      <div className="p-2 space-y-1">
                        <h3 className="text-[11px] font-bold text-slate-800 line-clamp-2 leading-snug group-hover:text-blue-600 transition">
                          {product.name}
                        </h3>
                      </div>
                    </button>
                  </div>

                  <div className="p-2 pt-0 space-y-1.5">
                    <div className="space-y-0.5">
                      <div className="flex items-baseline gap-1">
                        <span className="text-xs font-black text-blue-700">
                          {formatCurrency(
                            currentPrice
                          )}
                        </span>

                        {product.unit && (
                          <span className="text-[9px] font-medium text-slate-400">
                            /
                            {
                              product.unit
                            }
                          </span>
                        )}
                      </div>

                      {isDiscountActive &&
                        product.originalPrice >
                        currentPrice && (
                          <div className="text-[9px] text-slate-400 line-through">
                            {formatCurrency(
                              product.originalPrice
                            )}
                          </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between text-[9px] text-slate-500 pt-1.5 border-t border-slate-100">
                      <div className="flex items-center gap-1 truncate">
                        <span className="text-amber-500 font-bold">
                          ★{" "}
                          {shop?.rating ||
                            5.0}
                        </span>

                        <span>•</span>

                        <span className="text-slate-500 font-medium">
                          Đã bán{" "}
                          {formatSoldCount(
                            product.soldCount
                          )}
                        </span>
                      </div>

                      <button
                        type="button"
                        disabled={
                          !shop ||
                          shop.isOpen ===
                          false
                        }
                        onClick={(
                          event
                        ) => {
                          event.stopPropagation();

                          handleAddToCart(
                            product
                          );
                        }}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed active:scale-95 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg transition shadow-2xs cursor-pointer shrink-0"
                      >
                        {shop?.isOpen ===
                          false
                          ? "Tạm đóng"
                          : "+ Chọn"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            }
          )}
        </div>
      )}

      {/* PRODUCT MODAL */}
      <ProductDetailModal
        product={selectedProduct}
        shop={
          selectedProduct
            ? (shops[
              selectedProduct.shopId
            ] as any)
            : undefined
        }
        onClose={() =>
          setSelectedProduct(null)
        }
        onAddToCart={
          handleAddToCart
        }
        formatCurrency={
          formatCurrency
        }
      />

      {/* SHOP MODAL */}
      <ShopDetailModal
        shop={selectedShop}
        products={
          selectedShopProducts
        }
        distanceStr={
          selectedShop
            ? getShopDistance(
              selectedShop
            )
            : "Kho Hà Tĩnh"
        }
        onClose={() =>
          setSelectedShop(null)
        }
        onAddToCart={
          handleAddToCart
        }
        onProductClick={(
          product
        ) => {
          setSelectedShop(null);
          setSelectedProduct(
            product
          );
        }}
        formatCurrency={
          formatCurrency
        }
      />
    </div>
  );
}
