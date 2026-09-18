"use client";

import {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import { useCartStore } from "@/store/useCartStore";
import { db } from "@cho-online/firebase";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import ProductDetailModal from "@/components/ProductDetailModal";
import ShopDetailModal from "@/components/ShopDetailModal";

/**
 * ============================================================
 * TYPES
 * ============================================================
 */

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

  /**
   * Trạng thái tài khoản merchant trong Firestore.
   * Chỉ merchant APPROVED / ACTIVE mới được phép xuất hiện
   * trên sàn khách hàng.
   */
  status: string;

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

  /**
   * Mức chiết khấu/commission mà quán dành cho Sàn.
   * Dùng nội bộ để xác định nhóm quán được ưu tiên hiển thị.
   */
  commissionPercent?: number;
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

  /**
   * Giá bán hiện tại.
   */
  price: number;

  /**
   * Giá niêm yết / giá gốc.
   */
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

  discountType:
    | "FIXED"
    | "PERCENTAGE";

  discountValue: number;

  maxDiscount?: number | null;
  minOrder?: number | null;

  usageLimit?: number | null;
  usedCount?: number;

  startDate?: string | null;
  endDate?: string | null;

  isActive?: boolean;

  // Voucher có thể áp dụng toàn hệ thống
  // hoặc chỉ dành riêng cho một quán.
  targetType?: "ALL" | "MERCHANT";

  merchantId?: string | null;
  merchantName?: string | null;
  merchantCode?: string | null;
  merchantCommissionPercent?: number | null;

  /**
   * Voucher do hệ thống tạo riêng cho merchant.
   * Hỗ trợ cả dữ liệu mới và dữ liệu cũ.
   */
  isSystemCreated?: boolean;
  source?: string | null;
  createdByRole?: string | null;
  createdByType?: string | null;
}

interface ToastMessage {
  id: string;
  type:
    | "success"
    | "warning"
    | "info"
    | "error";
  title: string;
  message: string;
}

interface PromotionInfo {
  originalPrice: number;
  currentPrice: number;

  hasDiscount: boolean;

  hasSchedule: boolean;

  isDiscountActive: boolean;

  isFlashSale: boolean;

  isUpcoming: boolean;

  discountPercent: number;
}

interface ProductView extends Product {
  promotion: PromotionInfo;

  distanceKm: number;

  distanceText: string;

  estimatedDeliveryTime: number;

  searchText: string;

  // Voucher đang áp dụng riêng cho quán của món này.
  merchantVouchers: Voucher[];
}

/**
 * ============================================================
 * CONSTANTS
 * ============================================================
 */

const HOT_KEYWORDS = [
  "Cơm tấm",
  "Trà sữa",
  "Bún đậu",
  "Bánh mì",
  "Cafe",
  "Gà rán",
  "Lẩu",
];

const CATEGORY_SUGGESTIONS: Record<
  string,
  string[]
> = {
  "☕ Cà phê": [
    "Cà phê đen đá",
    "Cà phê sữa đá",
    "Bạc xỉu",
    "Cà phê muối",
    "Capuchino",
    "Espresso",
    "Americano",
    "Latte",
    "Cà phê cốt dừa",
  ],

  "🧋 Trà sữa": [
    "Trà sữa truyền thống",
    "Trà sữa trân châu đường đen",
    "Trà sữa Ô long",
    "Trà sữa Matcha",
    "Trà sữa Khoai môn",
    "Trà sữa Thái xanh/đỏ",
  ],

  "🍹 Trà trái cây & Trà ủ": [
    "Trà đào cam sả",
    "Trà vải măng cầu",
    "Trà dâu tằm",
    "Trà tắc xí muội",
    "Trà mãng cầu",
    "Trà ổi hồng",
    "Trà hoa cúc",
  ],

  "🥤 Nước ép & Sinh tố": [
    "Nước ép cam tươi",
    "Nước ép táo cần tây",
    "Nước ép dưa hấu",
    "Nước ép dứa",
    "Sinh tố bơ",
    "Sinh tố xoài",
    "Sinh tố mảng cầu",
  ],

  "🥛 Sữa chua & Bingsu": [
    "Sữa chua trân châu Hạ Long",
    "Sữa chua hoa quả",
    "Sữa chua nếp cẩm",
    "Bingsu dâu tây",
    "Bingsu xoài",
    "Bingsu matcha",
  ],

  "🍾 Đồ uống đóng chai": [
    "Nước khoáng",
    "Nước ngọt có ga",
    "Trà xanh C2/0 độ",
    "Nước tăng lực Redbull",
    "Bia đóng chai/lon",
    "Rượu chát",
  ],

  "🍳 Điểm tâm & Ăn sáng": [
    "Bánh mì ốp la",
    "Bánh mì pate thịt",
    "Xôi mặn",
    "Xôi xéo",
    "Bánh cuộn",
    "Bánh bao",
    "Bánh mì chảo",
  ],

  "🍚 Cơm & Món chính": [
    "Cơm tấm sườn nướng",
    "Cơm gà xối mỡ",
    "Cơm văn phòng",
    "Cơm chiên Dương Châu",
    "Cơm bò lúc lắc",
    "Cơm sườn xào chua ngọt",
  ],

  "🍜 Bún, Phở & Mì": [
    "Phở bò",
    "Phở gà",
    "Bún bò Huế",
    "Bún thịt nướng",
    "Mì Quảng",
    "Bún đậu mắm tôm",
    "Mì xào hải sản",
    "Hủ tiếu Nam Vang",
  ],

  "🍲 Lẩu & Nướng": [
    "Lẩu Thai Tomyum",
    "Lẩu Tứ Xuyên",
    "Lẩu riêu cua bắp bò",
    "Lẩu hải sản",
    "Thịt nướng BBQ",
    "Chân gà nướng",
    "Hải sản nướng",
  ],

  "🥣 Yến & Cháo bổ dưỡng": [
    "Cháo sườn",
    "Cháo gà",
    "Cháo ếch Singapore",
    "Cháo tổ yến",
    "Yến chưng đường phèn",
    "Yến chưng hạt sen",
    "Súp bào ngư",
  ],

  "🍿 Đồ ăn vặt": [
    "Cá viên chiên",
    "Bánh tráng trộn",
    "Khoai tây chiên",
    "Chân gà sả tắc",
    "Nem chua rán",
    "Bột chiên",
    "Xúc xích nướng",
  ],

  "🍰 Bánh & Tráng miệng": [
    "Bánh mì tỏi phô mai",
    "Bánh Tiramisu",
    "Bánh bông lan trứng muối",
    "Chè Bưởi",
    "Tào phớ",
    "Chè thái",
    "Flan",
  ],

  "🥗 Món Chay & Health": [
    "Cơm chay thanh tịnh",
    "Bún chay",
    "Lẩu nấm chay",
    "Salad ức gà",
    "Poke Bowl",
    "Bánh mì đen Healthy",
    "Granola",
  ],

  "🍻 Món nhậu & Mồi bén": [
    "Mực khô nướng",
    "Đậu hũ lướt ván",
    "Gỏi ngó sen tôm thịt",
    "Bò lúc lắc",
    "Sụn gà rang muối",
    "Ếch sapo",
  ],

  "🔥 Best Seller & Hot Trend": [
    "Món bán chạy nhất",
    "Món mới ra mắt",
    "Trending tuần này",
  ],

  "🍱 Combo Tiết Kiệm": [
    "Combo Đơn (1 người)",
    "Combo Đôi (2 người)",
    "Combo Gia Đình",
    "Combo Văn Phòng",
    "Combo Tiệc Bè Bạn",
  ],

  "🏷️ Món Khuyến Mãi Flash Sale": [
    "Giảm sâu 50%",
    "Đồng giá 19k",
    "Mua 1 Tặng 1",
    "Món 0đ",
  ],
};

const SMART_SUGGESTIONS = [
  {
    id: "smart_lunch",
    label: "Cơm Trưa Nóng",
    emoji: "🍱",
    desc: "No lâu, ship nhanh",
    category: "🍚 Cơm & Món chính",
    filter: "fast",
  },

  {
    id: "smart_milktea",
    label: "Trà Sữa & Cafe",
    emoji: "🧋",
    desc: "Giảm sâu hôm nay",
    category: "🧋 Trà sữa",
    filter: "discount",
  },

  {
    id: "smart_noodle",
    label: "Bún - Phở - Mì",
    emoji: "🍜",
    desc: "Nước dùng đậm đà",
    category: "🍜 Bún, Phở & Mì",
    filter: "recommend",
  },

  {
    id: "smart_dessert",
    label: "Bánh & Tráng Miệng",
    emoji: "🍰",
    desc: "Chè bưởi, Bánh ngọt",
    category: "🍰 Bánh & Tráng miệng",
    filter: "recommend",
  },

  {
    id: "smart_coffee",
    label: "Cà Phê Sáng",
    emoji: "☕",
    desc: "Năng lượng ngày mới",
    category: "☕ Cà phê",
    filter: "bestseller",
  },
];

/**
 * ============================================================
 * PURE HELPERS
 * ============================================================
 */

const formatSoldCount = (
  count = 0
): string => {
  if (count >= 1000) {
    return `${(count / 1000)
      .toFixed(1)
      .replace(".0", "")}k`;
  }

  return `${count}`;
};

const calculateTravelTime = (
  distanceKm: number
): number => {
  let velocity = 20;

  if (distanceKm >= 20) {
    velocity = 40;
  } else if (distanceKm >= 10) {
    velocity = 35;
  } else if (distanceKm >= 5) {
    velocity = 30;
  } else if (distanceKm >= 3) {
    velocity = 25;
  }

  return Math.round(
    (distanceKm / velocity) * 60
  );
};

const calculateETA = (
  prepTime = 15,
  distanceKm = 2,
  shipperToShopTime = 5
): number => {
  const travelTime =
    calculateTravelTime(
      distanceKm
    );

  return (
    Math.max(
      prepTime,
      shipperToShopTime
    ) + travelTime
  );
};

const calculateDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): {
  text: string;
  km: number;
  meters: number;
} => {
  if (
    !Number.isFinite(lat1) ||
    !Number.isFinite(lng1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lng2) ||
    Math.abs(lat1) > 90 ||
    Math.abs(lat2) > 90 ||
    Math.abs(lng1) > 180 ||
    Math.abs(lng2) > 180
  ) {
    return {
      text: "0 m",
      km: 0,
      meters: 0,
    };
  }

  const EARTH_RADIUS_KM =
    6371.0088;

  const ROAD_FACTOR = 1.13;

  const toRad = (
    degree: number
  ) =>
    (degree * Math.PI) / 180;

  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);

  const deltaPhi = toRad(
    lat2 - lat1
  );

  const deltaLambda = toRad(
    lng2 - lng1
  );

  const sinLat =
    Math.sin(deltaPhi / 2);

  const sinLng =
    Math.sin(deltaLambda / 2);

  const a =
    sinLat * sinLat +
    Math.cos(phi1) *
      Math.cos(phi2) *
      sinLng *
      sinLng;

  const safeA = Math.min(
    1,
    Math.max(0, a)
  );

  const c =
    2 *
    Math.atan2(
      Math.sqrt(safeA),
      Math.sqrt(1 - safeA)
    );

  const straightLineKm =
    EARTH_RADIUS_KM * c;

  let roadKm =
    straightLineKm *
    ROAD_FACTOR;

  if (straightLineKm < 0.1) {
    roadKm = straightLineKm;
  }

  const km = Number(
    roadKm.toFixed(2)
  );

  const meters = Math.round(
    km * 1000
  );

  return {
    text:
      km < 1
        ? `${meters} m`
        : `${km.toFixed(2)} km`,
    km,
    meters,
  };
};

/**
 * ============================================================
 * PROMOTION LOGIC
 * ============================================================
 *
 * Quy tắc:
 *
 * originalPrice > price
 * => sản phẩm đang có giá giảm.
 *
 * Không có start/end:
 * => giá giảm có hiệu lực.
 *
 * Có start/end:
 * => kiểm tra thời gian.
 *
 * discountStock không được dùng để biến:
 * 81.000 -> 90.000.
 *
 * Nó chỉ là thông tin giới hạn số lượng.
 */
const getPromotionInfo = (
  product: Product,
  nowMs = Date.now()
): PromotionInfo => {
  const originalPrice =
    Number(product.originalPrice) ||
    Number(product.price) ||
    0;

  const currentPrice =
    Number(product.price) ||
    originalPrice;

  const hasDiscount =
    currentPrice > 0 &&
    originalPrice > currentPrice;

  if (!hasDiscount) {
    return {
      originalPrice,
      currentPrice,
      hasDiscount: false,
      hasSchedule: false,
      isDiscountActive: false,
      isFlashSale: false,
      isUpcoming: false,
      discountPercent: 0,
    };
  }

  const hasSchedule = Boolean(
    product.discountStartTime ||
      product.discountEndTime
  );

  /**
   * Giá giảm không có lịch.
   *
   * Ví dụ:
   *
   * 90.000 -> 81.000
   * start = null
   * end = null
   *
   * => luôn hiển thị 81.000.
   */
  if (!hasSchedule) {
    return {
      originalPrice,
      currentPrice,
      hasDiscount: true,
      hasSchedule: false,
      isDiscountActive: true,
      isFlashSale: false,
      isUpcoming: false,
      discountPercent: Math.round(
        ((originalPrice -
          currentPrice) /
          originalPrice) *
          100
      ),
    };
  }

  const start = product.discountStartTime
    ? new Date(
        product.discountStartTime
      ).getTime()
    : -Infinity;

  const end = product.discountEndTime
    ? new Date(
        product.discountEndTime
      ).getTime()
    : Infinity;

  if (
    Number.isNaN(start) ||
    Number.isNaN(end)
  ) {
    return {
      originalPrice,
      currentPrice: originalPrice,
      hasDiscount: true,
      hasSchedule: true,
      isDiscountActive: false,
      isFlashSale: false,
      isUpcoming: false,
      discountPercent: 0,
    };
  }

  const isUpcoming =
    nowMs < start;

  const isActive =
    nowMs >= start &&
    nowMs <= end;

  return {
    originalPrice,

    currentPrice:
      isActive
        ? currentPrice
        : originalPrice,

    hasDiscount: true,

    hasSchedule: true,

    isDiscountActive: isActive,

    isFlashSale: isActive,

    isUpcoming,

    discountPercent: isActive
      ? Math.round(
          ((originalPrice -
            currentPrice) /
            originalPrice) *
            100
        )
      : 0,
  };
};

/**
 * ============================================================
 * DEFAULT IMAGE
 * ============================================================
 */

const DEFAULT_PRODUCT_IMAGE =
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400";

const DEFAULT_SHOP_AVATAR =
  "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=100";

/**
 * ============================================================
 * MERCHANT VISIBILITY
 * ============================================================
 *
 * Chỉ merchant đã được hệ thống duyệt / kích hoạt mới được
 * xuất hiện trên sàn khách hàng.
 *
 * BLOCKED / PENDING / REJECTED / SUSPENDED / INACTIVE /
 * hoặc status rỗng đều bị ẩn.
 *
 * Việc dùng whitelist thay vì blacklist rất quan trọng:
 * nếu một merchant mới tạo chưa có status thì mặc định KHÔNG
 * được hiển thị cho khách.
 */
const PUBLIC_MERCHANT_STATUSES = new Set([
  "APPROVED",
  "ACTIVE",
]);

const isMerchantVisible = (status: unknown): boolean => {
  const normalizedStatus = String(
    status ??
      ""
  )
    .trim()
    .toUpperCase();

  return PUBLIC_MERCHANT_STATUSES.has(
    normalizedStatus
  );
};

/**
 * ============================================================
 * PAGE
 * ============================================================
 */

export default function HomePage() {
  /**
   * ==========================================================
   * UI STATE
   * ==========================================================
   */

  const [activeTab, setActiveTab] =
    useState("all");

  const [quickFilter, setQuickFilter] =
    useState("recommend");

  const [shops, setShops] =
    useState<Record<string, Shop>>({});

  const [products, setProducts] =
    useState<Product[]>([]);

  const [vouchers, setVouchers] =
    useState<Voucher[]>([]);

  const [
    savedVouchers,
    setSavedVouchers,
  ] = useState<string[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [showNavbar, setShowNavbar] =
    useState(true);

  const [
    isMounted,
    setIsMounted,
  ] = useState(false);

  const [
    flashTab,
    setFlashTab,
  ] = useState<
    "active" | "upcoming"
  >("active");

  const [
    reminders,
    setReminders,
  ] = useState<
    Record<string, boolean>
  >({});

  const [
    searchQuery,
    setSearchQuery,
  ] = useState("");

  const [
    isSearchFocused,
    setIsSearchFocused,
  ] = useState(false);

  const [
    searchHistory,
    setSearchHistory,
  ] = useState<string[]>([]);

  const [
    shopCoordinates,
    setShopCoordinates,
  ] = useState<
    Record<
      string,
      {
        lat: number;
        lng: number;
      }
    >
  >({});

  const [
    toasts,
    setToasts,
  ] = useState<ToastMessage[]>([]);

  const [
    selectedShop,
    setSelectedShop,
  ] = useState<Shop | null>(
    null
  );

  const [
    selectedProduct,
    setSelectedProduct,
  ] = useState<Product | null>(
    null
  );

  const [
    userInfo,
    setUserInfo,
  ] = useState<UserLocation>({
    customerName: "Khách Hàng",
    customerPhone: "0987654321",
    address:
      "45 Phan Đình Phùng, TP Hà Tĩnh",
    lat: 18.3445,
    lng: 105.8978,
  });

  const [
    timeLeft,
    setTimeLeft,
  ] = useState(3600);

  const lastScrollY =
    useRef(0);

  const searchRef =
    useRef<HTMLDivElement>(null);

  /**
   * ==========================================================
   * CART SELECTORS
   * ==========================================================
   *
   * Không subscribe cả store.
   *
   * Chỉ subscribe đúng items / actions.
   */
  const cartItems = useCartStore(
    (state) => state.items
  );

  const addItemToCart =
    useCartStore(
      (state) => state.addItem
    );

  const openCart =
    useCartStore(
      (state) => state.openCart
    );

  /**
   * Không dùng getTotalItems() ở đây.
   *
   * Đếm trực tiếp từ items.
   */
  const totalCartCount = useMemo(
    () =>
      isMounted
        ? cartItems.reduce(
            (sum, item) =>
              sum + item.quantity,
            0
          )
        : 0,
    [cartItems, isMounted]
  );

  /**
   * ==========================================================
   * FORMATTERS
   * ==========================================================
   */

  const formatCurrency =
    useCallback(
      (amount: number) => {
        return new Intl.NumberFormat(
          "vi-VN",
          {
            style: "currency",
            currency: "VND",
          }
        ).format(amount);
      },
      []
    );

  const formatTime = useCallback(
    (seconds: number) => {
      const h = Math.floor(
        seconds / 3600
      );

      const m = Math.floor(
        (seconds % 3600) / 60
      );

      const s =
        seconds % 60;

      return `${String(h).padStart(
        2,
        "0"
      )} : ${String(m).padStart(
        2,
        "0"
      )} : ${String(s).padStart(
        2,
        "0"
      )}`;
    },
    []
  );

  /**
   * ==========================================================
   * TOAST
   * ==========================================================
   */

  const showToast =
    useCallback(
      (
        title: string,
        message: string,
        type:
          | "success"
          | "warning"
          | "info"
          | "error" = "success"
      ) => {
        const id =
          Math.random()
            .toString(36)
            .substring(
              2,
              10
            );

        setToasts((prev) => [
          ...prev,
          {
            id,
            title,
            message,
            type,
          },
        ]);

        window.setTimeout(
          () => {
            setToasts((prev) =>
              prev.filter(
                (toast) =>
                  toast.id !== id
              )
            );
          },
          3500
        );
      },
      []
    );

  /**
   * ==========================================================
   * INITIAL LOCAL STORAGE
   * ==========================================================
   */

  useEffect(() => {
    setIsMounted(true);

    try {
      const savedHistory =
        localStorage.getItem(
          "search_history_fnb"
        );

      if (savedHistory) {
        const parsed =
          JSON.parse(
            savedHistory
          );

        if (
          Array.isArray(parsed)
        ) {
          setSearchHistory(
            parsed
          );
        }
      }

      const savedVoucherData =
        localStorage.getItem(
          "saved_vouchers"
        );

      if (savedVoucherData) {
        const parsed =
          JSON.parse(
            savedVoucherData
          );

        if (
          Array.isArray(parsed)
        ) {
          setSavedVouchers(
            parsed
          );
        }
      }
    } catch (error) {
      console.warn(
        "Không thể đọc localStorage:",
        error
      );
    }
  }, []);

  /**
   * ==========================================================
   * NAVBAR SCROLL
   * ==========================================================
   */

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (ticking) {
        return;
      }

      ticking = true;

      window.requestAnimationFrame(
        () => {
          const currentScrollY =
            window.scrollY;

          if (
            currentScrollY >
              lastScrollY.current &&
            currentScrollY > 80
          ) {
            setShowNavbar(false);
          } else {
            setShowNavbar(true);
          }

          lastScrollY.current =
            currentScrollY;

          ticking = false;
        }
      );
    };

    window.addEventListener(
      "scroll",
      handleScroll,
      {
        passive: true,
      }
    );

    return () =>
      window.removeEventListener(
        "scroll",
        handleScroll
      );
  }, []);

  /**
   * ==========================================================
   * SEARCH OUTSIDE CLICK
   * ==========================================================
   */

  useEffect(() => {
    const handleClickOutside = (
      event: MouseEvent
    ) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(
          event.target as Node
        )
      ) {
        setIsSearchFocused(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleClickOutside
    );

    return () =>
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
  }, []);

  /**
   * ==========================================================
   * USER FROM FIREBASE
   * ==========================================================
   */

  useEffect(() => {
    let cancelled = false;

    const fetchUser =
      async () => {
        try {
          const targetPhone =
            localStorage.getItem(
              "user_phone"
            );

          if (!targetPhone) {
            return;
          }

          const usersRef =
            collection(
              db,
              "users"
            );

          const q = query(
            usersRef,
            where(
              "phone",
              "==",
              targetPhone
            )
          );

          const snapshot =
            await getDocs(q);

          if (
            cancelled ||
            snapshot.empty
          ) {
            return;
          }

          const userData =
            snapshot.docs[0].data();

          setUserInfo((prev) => ({
            ...prev,

            customerName:
              userData.fullName ||
              userData.name ||
              userData.customerName ||
              prev.customerName,

            customerPhone:
              userData.phone ||
              userData.phoneNumber ||
              targetPhone,

            address:
              userData.address ||
              userData.streetAddress ||
              prev.address,

            lat:
              userData.lat ??
              userData.location
                ?.latitude ??
              prev.lat,

            lng:
              userData.lng ??
              userData.location
                ?.longitude ??
              prev.lng,
          }));
        } catch (error) {
          if (!cancelled) {
            console.error(
              "❌ Lỗi tải user:",
              error
            );
          }
        }
      };

    void fetchUser();

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * ==========================================================
   * SHIPPING INFO FROM LOCAL STORAGE
   * ==========================================================
   */

  useEffect(() => {
    try {
      const saved =
        localStorage.getItem(
          "user_shipping_info"
        );

      if (!saved) {
        return;
      }

      const parsed =
        JSON.parse(saved);

      setUserInfo((prev) => ({
        ...prev,

        customerName:
          parsed.customerName ||
          parsed.name ||
          prev.customerName,

        customerPhone:
          parsed.customerPhone ||
          parsed.phone ||
          prev.customerPhone,

        address:
          parsed.address ||
          prev.address,

        lat:
          parsed.location
            ?.latitude ??
          parsed.lat ??
          prev.lat,

        lng:
          parsed.location
            ?.longitude ??
          parsed.lng ??
          prev.lng,
      }));
    } catch (error) {
      console.warn(
        "Lỗi đọc user_shipping_info:",
        error
      );
    }
  }, []);

  /**
   * ==========================================================
   * SEARCH
   * ==========================================================
   */

  const saveSearchKeyword =
    useCallback(
      (keyword: string) => {
        const trimmed =
          keyword.trim();

        if (!trimmed) {
          return;
        }

        setSearchHistory(
          (prev) => {
            const updated = [
              trimmed,
              ...prev.filter(
                (item) =>
                  item !==
                  trimmed
              ),
            ].slice(0, 5);

            localStorage.setItem(
              "search_history_fnb",
              JSON.stringify(
                updated
              )
            );

            return updated;
          }
        );
      },
      []
    );

  const clearHistory =
    useCallback(() => {
      setSearchHistory([]);

      localStorage.removeItem(
        "search_history_fnb"
      );
    }, []);

  /**
   * ==========================================================
   * VOUCHERS
   * ==========================================================
   */

  const handleSaveVoucher =
    useCallback(
      (code: string) => {
        setSavedVouchers(
          (prev) => {
            const exists =
              prev.includes(code);

            const updated =
              exists
                ? prev.filter(
                    (item) =>
                      item !== code
                  )
                : [...prev, code];

            localStorage.setItem(
              "saved_vouchers",
              JSON.stringify(
                updated
              )
            );

            if (exists) {
              showToast(
                "Bỏ lưu voucher",
                `Đã xóa mã ${code} khỏi ví của bạn.`,
                "info"
              );
            } else {
              showToast(
                "Lưu mã thành công! 🎉",
                `Đã thêm mã ${code} vào ví voucher.`,
                "success"
              );
            }

            return updated;
          }
        );
      },
      [showToast]
    );

  /**
   * ==========================================================
   * GEOCODING
   * ==========================================================
   */

  const geocodeAddress =
    useCallback(
      async (
        address: string
      ): Promise<{
        lat: number;
        lng: number;
      } | null> => {
        if (
          !address ||
          address.trim()
            .length < 3
        ) {
          return null;
        }

        try {
          const response =
            await fetch(
              `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
                address
              )}&limit=1`
            );

          if (!response.ok) {
            return null;
          }

          const data =
            await response.json();

          if (
            !Array.isArray(data) ||
            data.length === 0
          ) {
            return null;
          }

          const lat =
            parseFloat(
              data[0].lat
            );

          const lng =
            parseFloat(
              data[0].lon
            );

          if (
            !Number.isFinite(lat) ||
            !Number.isFinite(lng)
          ) {
            return null;
          }

          return {
            lat,
            lng,
          };
        } catch (error) {
          console.warn(
            "Geocoding failed:",
            error
          );

          return null;
        }
      },
      []
    );

  /**
   * Geocode customer address.
   *
   * Chỉ chạy sau 800ms khi người dùng ngừng nhập.
   */
  useEffect(() => {
    const address =
      userInfo.address?.trim();

    if (
      !address ||
      address.length < 3
    ) {
      return;
    }

    const timer =
      window.setTimeout(
        async () => {
          const coords =
            await geocodeAddress(
              address
            );

          if (!coords) {
            return;
          }

          setUserInfo(
            (prev) => {
              /**
               * Tránh setState nếu tọa độ
               * thực tế không thay đổi.
               */
              if (
                prev.lat ===
                  coords.lat &&
                prev.lng ===
                  coords.lng
              ) {
                return prev;
              }

              return {
                ...prev,
                lat: coords.lat,
                lng: coords.lng,
              };
            }
          );
        },
        800
      );

    return () =>
      window.clearTimeout(
        timer
      );
  }, [
    userInfo.address,
    geocodeAddress,
  ]);

  /**
   * ==========================================================
   * FETCH MAIN DATA
   * ==========================================================
   */

  useEffect(() => {
    let cancelled = false;

    const fetchData =
      async () => {
        try {
          setLoading(true);

          const [
            merchantsSnap,
            productsSnap,
            reviewsSnap,
            vouchersSnap,
          ] =
            await Promise.all([
              getDocs(
                collection(
                  db,
                  "merchants"
                )
              ),

              getDocs(
                collection(
                  db,
                  "products"
                )
              ),

              getDocs(
                collection(
                  db,
                  "reviews"
                )
              ),

              getDocs(
                query(
                  collection(
                    db,
                    "vouchers"
                  ),
                  where(
                    "isActive",
                    "==",
                    true
                  )
                )
              ),
            ]);

          if (cancelled) {
            return;
          }

          /**
           * ====================================================
           * REVIEW STATS
           * ====================================================
           */

          const shopReviewStats: Record<
            string,
            {
              totalRating: number;
              count: number;
            }
          > = {};

          reviewsSnap.forEach(
            (docSnap) => {
              const data =
                docSnap.data();

              const rating =
                Number(
                  data.productRating ||
                    data.rating ||
                    0
                );

              if (
                rating <= 0
              ) {
                return;
              }

              const shopId =
                data.merchantId ||
                data.shopId;

              const shopCode =
                data.merchantCode;

              const key =
                shopId ||
                shopCode;

              if (!key) {
                return;
              }

              if (
                !shopReviewStats[
                  key
                ]
              ) {
                shopReviewStats[
                  key
                ] = {
                  totalRating: 0,
                  count: 0,
                };
              }

              shopReviewStats[
                key
              ].totalRating +=
                rating;

              shopReviewStats[
                key
              ].count += 1;
            }
          );

          /**
           * ====================================================
           * SHOPS
           * ====================================================
           *
           * Tạo thêm merchantCodeMap
           * để không phải Object.keys().find()
           * cho từng product.
           * ====================================================
           */

          const shopMap: Record<
            string,
            Shop
          > = {};

          const shopCodeMap: Record<
            string,
            string
          > = {};

          const coordsToFetch: Record<
            string,
            string
          > = {};

          merchantsSnap.forEach(
            (docSnap) => {
              const data =
                docSnap.data();

              const businessCategory =
                data.businessCategory;

              const categoryText =
                String(
                  businessCategory ||
                    ""
                ).toLowerCase();

              const isFnb =
                businessCategory ===
                  "F&B" ||
                businessCategory ===
                  "FNB" ||
                categoryText.includes(
                  "f&b"
                ) ||
                categoryText.includes(
                  "fnb"
                );

              if (!isFnb) {
                return;
              }

              /**
               * ==================================================
               * QUAN TRỌNG: KIỂM TRA TRẠNG THÁI MERCHANT
               * ==================================================
               *
               * Merchant BLOCKED / PENDING / REJECTED hoặc
               * bất kỳ trạng thái nào không nằm trong whitelist
               * sẽ không được đưa vào shopMap.
               *
               * Vì products chỉ được ghép với merchant có trong
               * shopMap nên toàn bộ sản phẩm của merchant này
               * cũng tự động bị loại khỏi sàn.
               */
              const merchantStatus = String(
                data.status ??
                  ""
              )
                .trim()
                .toUpperCase();

              if (!isMerchantVisible(merchantStatus)) {
                console.log(
                  "🚫 [MARKETPLACE] Ẩn merchant không đủ điều kiện:",
                  {
                    merchantId: docSnap.id,
                    merchantCode: data.merchantCode || "",
                    shopName:
                      data.shopName ||
                      data.storeName ||
                      data.name ||
                      "",
                    status: merchantStatus || "EMPTY",
                  }
                );

                return;
              }

              const rawAddress =
                data.address ||
                data.storeAddress ||
                data.shopAddress ||
                data.pickupLocation
                  ?.address ||
                data.location ||
                "";

              const lat =
                data.lat ??
                data.latitude ??
                data.pickupLocation
                  ?.latitude ??
                null;

              const lng =
                data.lng ??
                data.longitude ??
                data.pickupLocation
                  ?.longitude ??
                null;

              const merchantCode =
                String(
                  data.merchantCode ||
                    ""
                );

              const stats =
                shopReviewStats[
                  docSnap.id
                ] ||
                (merchantCode
                  ? shopReviewStats[
                      merchantCode
                    ]
                  : null);

              let rating =
                Number(
                  data.rating ||
                    5
                );

              let reviewCount =
                Number(
                  data.reviewCount ||
                    0
                );

              if (
                stats &&
                stats.count > 0
              ) {
                rating = Number(
                  (
                    stats.totalRating /
                    stats.count
                  ).toFixed(1)
                );

                reviewCount =
                  stats.count;
              }

              const shop: Shop =
                {
                  id: docSnap.id,

                  merchantCode,

                  status:
                    merchantStatus,

                  name:
                    data.shopName ||
                    data.storeName ||
                    data.fullName ||
                    data.name ||
                    "Quán Ăn ngon",

                  avatar:
                    typeof data.avatar ===
                      "string" &&
                    data.avatar.trim()
                      ? data.avatar
                      : typeof data.avatarUrl ===
                          "string" &&
                        data.avatarUrl.trim()
                      ? data.avatarUrl
                      : DEFAULT_SHOP_AVATAR,

                  rating,

                  reviewCount,

                  distance:
                    data.distance ||
                    "2.0 km",

                  location:
                    typeof rawAddress ===
                    "string"
                      ? rawAddress
                      : "Hà Tĩnh",

                  address:
                    typeof rawAddress ===
                    "string"
                      ? rawAddress
                      : "Hà Tĩnh",

                  storeAddress:
                    typeof rawAddress ===
                    "string"
                      ? rawAddress
                      : "Hà Tĩnh",

                  lat:
                    lat !== null
                      ? Number(lat)
                      : null,

                  lng:
                    lng !== null
                      ? Number(lng)
                      : null,

                  isOpen:
                    data.isOpen !==
                    undefined
                      ? Boolean(
                          data.isOpen
                        )
                      : true,

                  openTime:
                    data.openTime ||
                    "00:00",

                  closeTime:
                    data.closeTime ||
                    "23:00",

                  commissionPercent:
                    Number(
                      data.commissionPercent ??
                        0
                    ) || 0,
                };

              shopMap[
                docSnap.id
              ] = shop;

              if (
                merchantCode
              ) {
                shopCodeMap[
                  merchantCode
                ] = docSnap.id;
              }

              if (
                (lat === null ||
                  lng === null) &&
                typeof rawAddress ===
                  "string" &&
                rawAddress
              ) {
                coordsToFetch[
                  docSnap.id
                ] = rawAddress;
              }
            }
          );

          /**
           * ====================================================
           * PRODUCTS
           * ====================================================
           */

          const fetchedProducts: Product[] =
            [];

          productsSnap.forEach(
            (docSnap) => {
              const data =
                docSnap.data();

              const isAvailable =
                data.isAvailable !==
                undefined
                  ? Boolean(
                      data.isAvailable
                    )
                  : true;

              if (!isAvailable) {
                return;
              }

              /**
               * Chỉ F&B.
               */
              if (
                data.isConsumerGood !==
                false
              ) {
                return;
              }

              const rawShopId =
                String(
                  data.shopId ||
                    data.merchantId ||
                    ""
                );

              /**
               * Ưu tiên shopId.
               * Nếu không có thì tìm bằng merchantCode.
               */
              const matchedShopKey =
                shopMap[
                  rawShopId
                ]
                  ? rawShopId
                  : shopCodeMap[
                      String(
                        data.merchantCode ||
                          ""
                      )
                    ];

              if (
                !matchedShopKey
              ) {
                return;
              }

              const matchedShop =
                shopMap[
                  matchedShopKey
                ];

              if (!matchedShop) {
                return;
              }

              /**
               * Bảo vệ tầng PRODUCT một lần nữa.
               * Nếu dữ liệu merchant bị thay đổi bất thường hoặc
               * có product cũ trỏ tới merchant không còn hợp lệ,
               * sản phẩm vẫn không được lọt ra giao diện.
               */
              if (!isMerchantVisible(matchedShop.status)) {
                console.warn(
                  "🚫 [MARKETPLACE] Bỏ qua product của merchant không hợp lệ:",
                  {
                    productId: docSnap.id,
                    merchantId: matchedShop.id,
                    merchantCode: matchedShop.merchantCode || "",
                    merchantStatus: matchedShop.status,
                  }
                );

                return;
              }

              const images =
                Array.isArray(
                  data.imageUrls
                ) &&
                data.imageUrls.length >
                  0
                  ? data.imageUrls.filter(
                      (
                        image: unknown
                      ): image is string =>
                        typeof image ===
                        "string"
                    )
                  : [];

              const normalizedImages =
                images.length > 0
                  ? images
                  : [
                      data.imageUrl ||
                        DEFAULT_PRODUCT_IMAGE,
                    ];

              const price =
                Number(
                  data.price
                ) || 0;

              const rawOriginalPrice =
                Number(
                  data.originalPrice
                ) || price;

              /**
               * originalPrice luôn >= price.
               *
               * Nhưng KHÔNG thay price.
               */
              const originalPrice =
                rawOriginalPrice >
                price
                  ? rawOriginalPrice
                  : price;

              const productReviews =
                Array.isArray(
                  data.reviews
                )
                  ? data.reviews
                  : [];

              fetchedProducts.push({
                id: docSnap.id,

                shopId:
                  matchedShopKey,

                merchantId:
                  data.merchantId ||
                  data.shopId ||
                  "",

                merchantCode:
                  data.merchantCode ||
                  matchedShop.merchantCode ||
                  "",

                shopName:
                  matchedShop.name ||
                  data.shopName ||
                  "Quán ngon",

                address:
                  matchedShop.address,

                storeAddress:
                  matchedShop.storeAddress,

                name:
                  data.name ||
                  "Món ăn ngon",

                description:
                  data.description ||
                  "",

                /**
                 * QUAN TRỌNG:
                 *
                 * price = giá bán hiện tại.
                 */
                price,

                /**
                 * originalPrice = giá gốc.
                 */
                originalPrice,

                discountStock:
                  data.discountStock ??
                  null,

                maxPerUser:
                  data.maxPerUser !==
                    undefined &&
                  data.maxPerUser !==
                    null
                    ? Number(
                        data.maxPerUser
                      )
                    : null,

                discountStartTime:
                  data.discountStartTime ??
                  null,

                discountEndTime:
                  data.discountEndTime ??
                  null,

                imageUrl:
                  normalizedImages[0],

                imageUrls:
                  normalizedImages,

                soldCount: Number(
                  data.soldCount ||
                    data.sold ||
                    data.totalSold ||
                    0
                ),

                reviewCount:
                  productReviews.length ||
                  Number(
                    data.reviewCount ||
                      0
                  ),

                discountBadge:
                  data.discountBadge ||
                  "",

                stockProgress:
                  Number(
                    data.stockProgress
                  ) || 60,

                category:
                  data.category ||
                  "food",

                prepTime:
                  Number(
                    data.prepTime
                  ) || 15,

                isFavorite:
                  Boolean(
                    data.isFeatured ||
                      data.isFavorite
                  ),

                isAvailable: true,

                reviews:
                  productReviews,
              });
            }
          );

          /**
           * ====================================================
           * VOUCHERS
           * ====================================================
           */

          const fetchedVouchers: Voucher[] =
            [];

          vouchersSnap.forEach(
            (docSnap) => {
              const data =
                docSnap.data();

              fetchedVouchers.push({
                id: docSnap.id,

                code:
                  data.code || "",

                title:
                  data.title || "",

                description:
                  data.description ||
                  "",

                applyType:
                  data.applyType ===
                  "SHIPPING"
                    ? "SHIPPING"
                    : "ORDER",

                discountType:
                  data.discountType ===
                  "PERCENTAGE"
                    ? "PERCENTAGE"
                    : "FIXED",

                discountValue:
                  Number(
                    data.discountValue ||
                      0
                  ),

                maxDiscount:
                  data.maxDiscount !==
                    undefined &&
                  data.maxDiscount !==
                    null
                    ? Number(
                        data.maxDiscount
                      )
                    : null,

                minOrder:
                  data.minOrder !==
                    undefined &&
                  data.minOrder !==
                    null
                    ? Number(
                        data.minOrder
                      )
                    : null,

                usageLimit:
                  data.usageLimit !==
                    undefined &&
                  data.usageLimit !==
                    null
                    ? Number(
                        data.usageLimit
                      )
                    : null,

                usedCount: Number(
                  data.usedCount ||
                    0
                ),

                startDate:
                  data.startDate ??
                  null,

                endDate:
                  data.endDate ??
                  null,

                isActive:
                  data.isActive !==
                  false,

                // -------------------------------------------
                // TARGET SHOP
                // -------------------------------------------

                targetType:
                  data.targetType ===
                  "MERCHANT"
                    ? "MERCHANT"
                    : data.merchantId
                    ? "MERCHANT"
                    : "ALL",

                merchantId:
                  data.merchantId ||
                  null,

                merchantName:
                  data.merchantName ||
                  null,

                merchantCode:
                  data.merchantCode ||
                  null,

                merchantCommissionPercent:
                  data.merchantCommissionPercent !==
                    undefined &&
                  data.merchantCommissionPercent !==
                    null
                    ? Number(
                        data.merchantCommissionPercent
                      )
                    : null,

                source:
                  data.source ??
                  data.createdSource ??
                  null,

                createdByRole:
                  data.createdByRole ??
                  data.creatorRole ??
                  null,

                createdByType:
                  data.createdByType ??
                  data.creatorType ??
                  null,

                isSystemCreated:
                  data.isSystemCreated === true ||
                  String(
                    data.source ??
                      data.createdSource ??
                      data.createdByRole ??
                      data.creatorRole ??
                      data.createdByType ??
                      data.creatorType ??
                      ""
                  ).toUpperCase() ===
                    "SYSTEM" ||
                  String(
                    data.createdBy ??
                      ""
                  ).toUpperCase() ===
                    "SYSTEM" ||
                  (Boolean(
                    data.merchantCommissionPercent
                  ) &&
                    (data.targetType ===
                      "MERCHANT" ||
                      Boolean(data.merchantId))),
              });
            }
          );

          if (cancelled) {
            return;
          }

          /**
           * Chỉ setState một lần cho dữ liệu chính.
           */
          setShops(shopMap);
          setProducts(
            fetchedProducts
          );
          setVouchers(
            fetchedVouchers
          );

          /**
           * ==================================================
           * GEOCODE SHOPS
           * ==================================================
           *
           * Geocode song song.
           * Chỉ setState MỘT LẦN.
           */
          if (
            Object.keys(
              coordsToFetch
            ).length > 0
          ) {
            const entries =
              await Promise.all(
                Object.entries(
                  coordsToFetch
                ).map(
                  async ([
                    shopId,
                    address,
                  ]) => {
                    const coords =
                      await geocodeAddress(
                        address
                      );

                    if (!coords) {
                      return null;
                    }

                    return [
                      shopId,
                      coords,
                    ] as const;
                  }
                )
              );

            if (
              cancelled
            ) {
              return;
            }

            const coordinateMap: Record<
              string,
              {
                lat: number;
                lng: number;
              }
            > = {};

            entries.forEach(
              (entry) => {
                if (!entry) {
                  return;
                }

                coordinateMap[
                  entry[0]
                ] = entry[1];
              }
            );

            if (
              Object.keys(
                coordinateMap
              ).length > 0
            ) {
              setShopCoordinates(
                coordinateMap
              );
            }
          }
        } catch (error) {
          if (!cancelled) {
            console.error(
              "❌ Lỗi lấy dữ liệu Firebase:",
              error
            );
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      };

    void fetchData();

    return () => {
      cancelled = true;
    };
  }, [geocodeAddress]);

  /**
   * ==========================================================
   * CALCULATE SHOP DISTANCES
   * ==========================================================
   */

  const calculatedDistances =
    useMemo(() => {
      const result: Record<
        string,
        {
          text: string;
          km: number;
        }
      > = {};

      const userLat =
        userInfo.lat;

      const userLng =
        userInfo.lng;

      const canCalculate =
        Number.isFinite(
          userLat
        ) &&
        Number.isFinite(
          userLng
        );

      Object.values(
        shops
      ).forEach((shop) => {
        const shopLat =
          shop.lat ??
          shopCoordinates[
            shop.id
          ]?.lat ??
          null;

        const shopLng =
          shop.lng ??
          shopCoordinates[
            shop.id
          ]?.lng ??
          null;

        if (
          canCalculate &&
          Number.isFinite(
            shopLat
          ) &&
          Number.isFinite(
            shopLng
          )
        ) {
          const distance =
            calculateDistance(
              userLat as number,
              userLng as number,
              shopLat as number,
              shopLng as number
            );

          result[
            shop.id
          ] = {
            text: distance.text,
            km: distance.km,
          };
        } else {
          result[
            shop.id
          ] = {
            text:
              shop.distance ||
              "2.0 km",
            km: 2,
          };
        }
      });

      return result;
    }, [
      userInfo.lat,
      userInfo.lng,
      shops,
      shopCoordinates,
    ]);

  /**
   * ==========================================================
   * FEATURED HIGH-COMMISSION SHOPS
   * ==========================================================
   *
   * Đây là quyền lợi hiển thị dành cho các quán có mức
   * commission từ 15% trở lên.
   * Không hiển thị % chiết khấu cho khách hàng.
   */

  const HIGH_COMMISSION_THRESHOLD = 15;

  const featuredShops = useMemo(() => {
    return Object.values(shops)
      .filter(
        (shop) =>
          Number(
            shop.commissionPercent ?? 0
          ) >= HIGH_COMMISSION_THRESHOLD
      )
      .sort((a, b) => {
        const commissionDiff =
          Number(b.commissionPercent ?? 0) -
          Number(a.commissionPercent ?? 0);

        if (commissionDiff !== 0) {
          return commissionDiff;
        }

        const ratingDiff =
          Number(b.rating ?? 0) -
          Number(a.rating ?? 0);

        if (ratingDiff !== 0) {
          return ratingDiff;
        }

        return 0;
      })
      .slice(0, 8);
  }, [shops]);

  /**
   * ==========================================================
   * MERCHANT VOUCHER MAP
   * ==========================================================
   *
   * Chỉ lấy voucher:
   * - đang hoạt động
   * - trong thời gian hiệu lực
   * - chưa dùng hết lượt
   * - có merchantId
   * - là voucher do hệ thống tạo riêng cho merchant
   *
   * Map theo cả merchantId và merchantCode để tương thích
   * với dữ liệu sản phẩm cũ.
   */

  const merchantVoucherMap =
    useMemo(() => {
      const map: Record<
        string,
        Voucher[]
      > = {};

      const now = Date.now();

      vouchers.forEach((voucher) => {
        if (voucher.isActive === false) {
          return;
        }

        if (
          voucher.targetType !==
            "MERCHANT" ||
          !voucher.merchantId ||
          voucher.isSystemCreated !== true
        ) {
          return;
        }

        // Chưa tới thời gian bắt đầu
        if (voucher.startDate) {
          const start = new Date(
            voucher.startDate
          ).getTime();

          if (
            Number.isFinite(start) &&
            now < start
          ) {
            return;
          }
        }

        // Đã hết hạn
        if (voucher.endDate) {
          const end = new Date(
            voucher.endDate
          ).getTime();

          if (
            Number.isFinite(end) &&
            now > end
          ) {
            return;
          }
        }

        // Đã dùng hết voucher
        if (
          voucher.usageLimit !==
            null &&
          voucher.usageLimit !==
            undefined &&
          Number(voucher.usedCount || 0) >=
            Number(voucher.usageLimit)
        ) {
          return;
        }

        const keys = [
          voucher.merchantId,
          voucher.merchantCode,
        ].filter(
          (value): value is string =>
            Boolean(value)
        );

        keys.forEach((key) => {
          if (!map[key]) {
            map[key] = [];
          }

          // Tránh push trùng cùng một voucher
          if (
            !map[key].some(
              (item) =>
                item.id ===
                voucher.id
            )
          ) {
            map[key].push(voucher);
          }
        });
      });

      // Voucher shipping được ưu tiên hiển thị trước
      Object.values(map).forEach(
        (list) => {
          list.sort((a, b) => {
            if (
              a.applyType ===
                "SHIPPING" &&
              b.applyType !==
                "SHIPPING"
            ) {
              return -1;
            }

            if (
              a.applyType !==
                "SHIPPING" &&
              b.applyType ===
                "SHIPPING"
            ) {
              return 1;
            }

            return (
              b.discountValue -
              a.discountValue
            );
          });
        }
      );

      return map;
    }, [vouchers]);

  /**
   * ==========================================================
   * PRODUCT VIEW MODEL
   * ==========================================================
   *
   * Toàn bộ:
   * - promotion
   * - merchant vouchers
   * - distance
   * - ETA
   * - search text
   *
   * được tính MỘT LẦN.
   */

  const productViews =
    useMemo<ProductView[]>(() => {
      const nowMs =
        Date.now();

      const visibleProducts =
        products.filter((product) => {
          const shop =
            shops[
              product.shopId
            ];

          return (
            Boolean(shop) &&
            isMerchantVisible(
              shop?.status
            )
          );
        });

      return visibleProducts.map(
        (product) => {
          const promotion =
            getPromotionInfo(
              product,
              nowMs
            );

          const distance =
            calculatedDistances[
              product.shopId
            ] ?? {
              text: "2.0 km",
              km: 2,
            };

          const estimatedDeliveryTime =
            calculateETA(
              product.prepTime ||
                15,
              distance.km
            );

          const searchText =
            `${product.name} ${product.description} ${product.shopName} ${product.category}`
              .toLowerCase();

          const voucherKeys = [
            product.merchantId,
            product.shopId,
            product.merchantCode,
          ].filter(
            (value): value is string =>
              Boolean(value)
          );

          const merchantVouchers: Voucher[] =
            [];

          voucherKeys.forEach((key) => {
            const list =
              merchantVoucherMap[key];

            if (!list) {
              return;
            }

            list.forEach((voucher) => {
              if (
                !merchantVouchers.some(
                  (item) =>
                    item.id ===
                    voucher.id
                )
              ) {
                merchantVouchers.push(
                  voucher
                );
              }
            });
          });

          return {
            ...product,

            promotion,

            distanceKm:
              distance.km,

            distanceText:
              distance.text,

            estimatedDeliveryTime,

            searchText,

            merchantVouchers,
          };
        }
      );
    }, [
      products,
      calculatedDistances,
      merchantVoucherMap,
    ]);

  /**
   * ==========================================================
   * FLASH DEALS
   * ==========================================================
   */

  const {
    activeDeals,
    upcomingDeals,
  } = useMemo(() => {
    const active =
      productViews.filter(
        (product) =>
          product.promotion
            .isFlashSale
      );

    const upcoming =
      productViews.filter(
        (product) =>
          product.promotion
            .isUpcoming
      );

    active.sort(
      (a, b) =>
        b.promotion
          .discountPercent -
        a.promotion
          .discountPercent
    );

    return {
      activeDeals: active,
      upcomingDeals: upcoming,
    };
  }, [productViews]);

  /**
   * Nếu không có Flash Deal active
   * nhưng có upcoming -> mở tab upcoming.
   */
  useEffect(() => {
    if (
      activeDeals.length === 0 &&
      upcomingDeals.length > 0
    ) {
      setFlashTab("upcoming");
    }
  }, [
    activeDeals.length,
    upcomingDeals.length,
  ]);

  /**
   * ==========================================================
   * RANKING
   * ==========================================================
   */

  const rankedProducts =
    useMemo(() => {
      const currentHour =
        new Date().getHours();

      return productViews.map(
        (product) => {
          const shop =
            shops[
              product.shopId
            ];

          const rating =
            shop?.rating || 5;

          const distanceScore =
            Math.max(
              0,
              (10 -
                product.distanceKm) *
                10
            );

          const ratingScore =
            rating * 20;

          const popularityScore =
            Math.min(
              100,
              product.soldCount *
                0.5
            );

          const promoScore =
            product.promotion
              .isDiscountActive
              ? product.promotion
                  .discountPercent *
                2
              : 0;

          const category =
            product.category.toLowerCase();

          const name =
            product.name.toLowerCase();

          let timeScore = 0;

          if (
            currentHour >= 6 &&
            currentHour <= 9
          ) {
            if (
              category.includes(
                "cafe"
              ) ||
              name.includes(
                "bánh mì"
              ) ||
              name.includes(
                "phở"
              )
            ) {
              timeScore = 100;
            }
          } else if (
            currentHour >= 11 &&
            currentHour <= 13
          ) {
            if (
              category.includes(
                "food"
              ) ||
              name.includes(
                "cơm"
              ) ||
              name.includes(
                "bún"
              )
            ) {
              timeScore = 100;
            }
          } else if (
            currentHour >= 14 &&
            currentHour <= 17
          ) {
            if (
              category.includes(
                "trà sữa"
              ) ||
              category.includes(
                "snack"
              ) ||
              name.includes(
                "trà"
              )
            ) {
              timeScore = 100;
            }
          } else if (
            currentHour >= 18 &&
            currentHour <= 21
          ) {
            if (
              name.includes(
                "lẩu"
              ) ||
              name.includes(
                "nướng"
              ) ||
              category.includes(
                "food"
              )
            ) {
              timeScore = 100;
            }
          }

          const totalScore =
            distanceScore *
              0.3 +
            ratingScore *
              0.2 +
            popularityScore *
              0.2 +
            promoScore *
              0.15 +
            timeScore *
              0.15;

          return {
            ...product,
            totalScore,
          };
        }
      );
    }, [
      productViews,
      shops,
    ]);

  /**
   * ==========================================================
   * FILTERED PRODUCTS
   * ==========================================================
   */

  const filteredProducts =
    useMemo(() => {
      let result = [
        ...rankedProducts,
      ];

      const search =
        searchQuery
          .trim()
          .toLowerCase();

      if (search) {
        result =
          result.filter(
            (product) =>
              product.searchText.includes(
                search
              )
          );
      }

      if (
        activeTab !==
        "all"
      ) {
        const tabLower =
          activeTab.toLowerCase();

        const suggestions =
          CATEGORY_SUGGESTIONS[
            activeTab
          ];

        result =
          result.filter(
            (product) => {
              const category =
                product.category.toLowerCase();

              if (
                category.includes(
                  tabLower
                ) ||
                tabLower.includes(
                  category
                )
              ) {
                return true;
              }

              if (
                suggestions &&
                suggestions.some(
                  (suggestion) =>
                    product.name
                      .toLowerCase()
                      .includes(
                        suggestion.toLowerCase()
                      )
                )
              ) {
                return true;
              }

              /**
               * Filter Flash Sale.
               */
              if (
                activeTab ===
                  "🏷️ Món Khuyến Mãi Flash Sale"
              ) {
                return (
                  product.promotion
                    .isDiscountActive
                );
              }

              return false;
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
        quickFilter ===
        "fast"
      ) {
        result.sort(
          (a, b) =>
            a.distanceKm -
            b.distanceKm
        );
      } else if (
        quickFilter ===
        "discount"
      ) {
        result.sort(
          (a, b) =>
            b.promotion
              .discountPercent -
            a.promotion
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
    ]);

  /**
   * ==========================================================
   * SHOP HELPERS
   * ==========================================================
   */

  const getShopDistance =
    useCallback(
      (shop?: Shop) => {
        if (!shop) {
          return "2.0 km";
        }

        return (
          calculatedDistances[
            shop.id
          ]?.text ||
          shop.distance ||
          "2.0 km"
        );
      },
      [calculatedDistances]
    );

  const getShopDistanceKm =
    useCallback(
      (shop?: Shop) => {
        if (!shop) {
          return 2;
        }

        return (
          calculatedDistances[
            shop.id
          ]?.km ?? 2
        );
      },
      [calculatedDistances]
    );

  /**
   * ==========================================================
   * ADD TO CART
   * ==========================================================
   *
   * KHÔNG trừ stock ở đây.
   *
   * Stock/soldCount phải xử lý khi order
   * được tạo thành công.
   */

  const handleAddToCart =
    useCallback(
      (product: Product) => {
        const shop =
          shops[
            product.shopId
          ];

        if (
          shop &&
          !shop.isOpen
        ) {
          showToast(
            "Quán đang đóng cửa",
            "Quán hiện đang đóng cửa, vui lòng quay lại sau!",
            "warning"
          );

          return;
        }

        const distanceStr =
          getShopDistance(
            shop
          );

        /**
         * Store hiện tại:
         *
         * addItem(product, distance, quantity)
         *
         * Không truyền deliveryTime.
         */
        addItemToCart(
          product as any,
          distanceStr,
          1
        );

        showToast(
          "Thêm vào giỏ thành công! 🛒",
          `Đã thêm "${product.name}" vào giỏ hàng.`,
          "success"
        );
      },
      [
        shops,
        getShopDistance,
        addItemToCart,
        showToast,
      ]
    );

  const handleAddToCartModal =
    useCallback(
      (
        product: any,
        quantity: number
      ) => {
        const realProduct =
          product as Product;

        const shop =
          shops[
            realProduct.shopId
          ];

        if (
          shop &&
          !shop.isOpen
        ) {
          showToast(
            "Quán đang đóng cửa",
            "Quán hiện đang đóng cửa, vui lòng quay lại sau!",
            "warning"
          );

          return;
        }

        addItemToCart(
          realProduct as any,
          getShopDistance(
            shop
          ),
          quantity
        );

        showToast(
          "Thêm món thành công! 🛒",
          `Đã thêm ${quantity} × "${realProduct.name}" vào giỏ.`,
          "success"
        );
      },
      [
        shops,
        getShopDistance,
        addItemToCart,
        showToast,
      ]
    );

  /**
   * ==========================================================
   * REMINDER
   * ==========================================================
   */

  const toggleReminder =
    useCallback(
      (
        id: string,
        event: React.MouseEvent
      ) => {
        event.stopPropagation();

        setReminders(
          (prev) => {
            const enabled =
              !prev[id];

            if (enabled) {
              showToast(
                "Đã đặt nhắc nhở! ⏰",
                "Bạn sẽ nhận thông báo khi khung giờ ưu đãi bắt đầu.",
                "info"
              );
            } else {
              showToast(
                "Đã hủy nhắc nhở",
                "Đã gỡ lịch nhắc nhở cho ưu đãi này.",
                "info"
              );
            }

            return {
              ...prev,
              [id]: enabled,
            };
          }
        );
      },
      [showToast]
    );

  /**
   * ==========================================================
   * FLASH TIMER
   * ==========================================================
   *
   * Dùng countdown chung cho UI hiện tại.
   */
  useEffect(() => {
    const timer =
      window.setInterval(
        () => {
          setTimeLeft(
            (prev) =>
              prev > 0
                ? prev - 1
                : 0
          );
        },
        1000
      );

    return () =>
      window.clearInterval(
        timer
      );
  }, []);

  /**
   * ==========================================================
   * RENDER
   * ==========================================================
   */

  return (
    <div className="bg-[#f4f5f7] min-h-screen pb-24 font-sans text-stone-800 relative">
      {/* ======================================================
          TOASTS
          ====================================================== */}

      <div className="fixed top-20 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map(
          (toast) => {
            let bgGradient =
              "bg-gradient-to-r from-stone-900 to-stone-800 border-stone-700 text-white";

            let icon = "🔔";

            if (
              toast.type ===
              "success"
            ) {
              bgGradient =
                "bg-gradient-to-r from-emerald-600 to-teal-600 border-emerald-500 text-white";
              icon = "✅";
            } else if (
              toast.type ===
              "warning"
            ) {
              bgGradient =
                "bg-gradient-to-r from-amber-500 to-orange-600 border-amber-400 text-white";
              icon = "⚠️";
            } else if (
              toast.type ===
              "info"
            ) {
              bgGradient =
                "bg-gradient-to-r from-sky-600 to-blue-600 border-sky-500 text-white";
              icon = "💡";
            } else if (
              toast.type ===
              "error"
            ) {
              bgGradient =
                "bg-gradient-to-r from-rose-600 to-red-600 border-rose-500 text-white";
              icon = "❌";
            }

            return (
              <div
                key={
                  toast.id
                }
                className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl shadow-xl border backdrop-blur-md transform transition-all duration-300 animate-in fade-in slide-in-from-top-2 ${bgGradient}`}
              >
                <span className="text-xl shrink-0 mt-0.5">
                  {icon}
                </span>

                <div className="flex-1 space-y-0.5">
                  <h5 className="text-xs font-black tracking-wide">
                    {
                      toast.title
                    }
                  </h5>

                  <p className="text-[11px] opacity-95 leading-snug">
                    {
                      toast.message
                    }
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setToasts(
                      (prev) =>
                        prev.filter(
                          (
                            item
                          ) =>
                            item.id !==
                            toast.id
                        )
                    )
                  }
                  className="text-white/70 hover:text-white p-1 text-xs font-bold transition shrink-0 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            );
          }
        )}
      </div>

      {/* ======================================================
          TOP NAV
          ====================================================== */}

      <div
        className={`sticky top-0 z-40 bg-gradient-to-r from-[#ff4500] via-[#ee4d2d] to-[#ff6036] p-3 text-white shadow-md space-y-2.5 transition-transform duration-300 ${
          showNavbar
            ? "translate-y-0"
            : "-translate-y-full"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 overflow-hidden flex-1 bg-black/15 px-3 py-1.5 rounded-full border border-white/25 shadow-inner">
            <span className="text-sm shrink-0 animate-bounce">
              🛵
            </span>

            <div className="text-[11px] leading-tight truncate flex-1">
              <span className="text-[9px] opacity-85 block font-medium">
                Khách:{" "}
                <strong>
                  {
                    userInfo.customerName
                  }
                </strong>{" "}
                - Giao tới:
              </span>

              <input
                type="text"
                value={
                  userInfo.address
                }
                onChange={(event) =>
                  setUserInfo(
                    (prev) => ({
                      ...prev,
                      address:
                        event
                          .target
                          .value,
                    })
                  )
                }
                placeholder="Nhập địa chỉ của bạn..."
                className="bg-transparent text-white font-bold text-xs focus:outline-none w-full truncate placeholder:text-white/70"
              />
            </div>
          </div>

          <div
            onClick={
              openCart
            }
            className="relative p-2 bg-white/10 hover:bg-white/20 rounded-full transition cursor-pointer shadow-sm"
          >
            <span className="text-xl">
              🛒
            </span>

            {totalCartCount >
              0 && (
              <span className="absolute -top-1 -right-1 bg-amber-300 text-[#ee4d2d] text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-[#ee4d2d] shadow-sm animate-pulse">
                {
                  totalCartCount
                }
              </span>
            )}
          </div>
        </div>

        {/* SEARCH */}

        <div
          className="relative"
          ref={searchRef}
        >
          <div className="relative flex items-center">
            <input
              type="text"
              value={
                searchQuery
              }
              onFocus={() =>
                setIsSearchFocused(
                  true
                )
              }
              onChange={(event) =>
                setSearchQuery(
                  event.target.value
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key ===
                  "Enter"
                ) {
                  saveSearchKeyword(
                    searchQuery
                  );

                  setIsSearchFocused(
                    false
                  );
                }
              }}
              placeholder="Thèm gì hôm nay? Cơm tấm, Trà sữa, Bún đậu..."
              className="w-full bg-white text-stone-800 text-xs py-2.5 pl-9 pr-20 rounded-xl outline-none placeholder:text-stone-400 shadow-inner font-medium"
            />

            <span className="absolute left-3 text-stone-400 text-xs">
              🔍
            </span>

            {searchQuery && (
              <button
                type="button"
                onClick={() =>
                  setSearchQuery(
                    ""
                  )
                }
                className="absolute right-14 text-stone-400 hover:text-stone-600 p-1 text-xs font-bold cursor-pointer"
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
              className="absolute right-1 top-1 bottom-1 bg-[#ee4d2d] hover:bg-[#d73f20] text-white px-3.5 rounded-lg text-[11px] font-bold transition cursor-pointer shadow-sm"
            >
              Tìm
            </button>
          </div>

          {isSearchFocused && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-stone-200/80 p-3 z-50 text-stone-800 space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
              {searchHistory.length >
                0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-bold text-stone-400">
                    <span>
                      LỊCH SỬ
                      TÌM KIẾM
                    </span>

                    <button
                      type="button"
                      onClick={
                        clearHistory
                      }
                      className="text-stone-400 hover:text-[#ee4d2d] cursor-pointer"
                    >
                      Xóa
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {searchHistory.map(
                      (
                        item
                      ) => (
                        <span
                          key={
                            item
                          }
                          onClick={() => {
                            setSearchQuery(
                              item
                            );

                            setIsSearchFocused(
                              false
                            );
                          }}
                          className="bg-stone-100 hover:bg-orange-50 hover:text-[#ee4d2d] text-stone-600 text-[11px] px-2.5 py-1 rounded-full cursor-pointer transition font-medium"
                        >
                          🕒{" "}
                          {
                            item
                          }
                        </span>
                      )
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <div className="text-[10px] font-bold text-stone-400 flex items-center gap-1">
                  🔥 TÌM KIẾM
                  PHỔ BIẾN
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {HOT_KEYWORDS.map(
                    (keyword) => (
                      <span
                        key={
                          keyword
                        }
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
                        className="bg-orange-50 hover:bg-orange-100 text-[#ee4d2d] border border-orange-200/60 text-[11px] px-2.5 py-1 rounded-full cursor-pointer transition font-bold"
                      >
                        {
                          keyword
                        }
                      </span>
                    )
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ======================================================
          VOUCHERS
          ====================================================== */}

      {/*
        KHO VOUCHER:
        Hiển thị TOÀN BỘ voucher đang hoạt động trên sàn.
        Không lọc theo targetType / merchant / isSystemCreated ở UI này.
        Voucher thuộc quán vẫn hiển thị, nhưng logic áp dụng voucher
        ở checkout phải kiểm tra đúng merchant tương ứng.
      */}
      {!searchQuery &&
        vouchers.length >
          0 && (
          <div className="bg-gradient-to-b from-amber-500/10 via-orange-500/5 to-transparent py-2.5 border-b border-orange-200/40">
            <div className="px-3 flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-base">
                  🎟️
                </span>

                <h3 className="text-[11px] font-black text-stone-900 tracking-tight">
                  KHO VOUCHER
                </h3>
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto no-scrollbar px-3 py-0.5">
              {vouchers.map(
                (voucher) => {
                  const isSaved =
                    savedVouchers.includes(
                      voucher.code
                    );

                  const isFreeship =
                    voucher.applyType ===
                    "SHIPPING";

                  const used =
                    voucher.usedCount ||
                    0;

                  const limit =
                    voucher.usageLimit ||
                    100;

                  const usedPercent =
                    Math.min(
                      100,
                      Math.round(
                        (used /
                          limit) *
                          100
                      )
                    );

                  return (
                    <div
                      key={
                        voucher.id
                      }
                      className={`min-w-[210px] max-w-[210px] bg-white rounded-xl border shadow-2xs flex overflow-hidden relative transition-all duration-200 hover:shadow-sm ${
                        isSaved
                          ? "border-emerald-500/80 bg-emerald-50/10"
                          : "border-amber-200/80"
                      }`}
                    >
                      <div
                        className={`w-14 shrink-0 flex flex-col items-center justify-center p-1.5 text-white text-center relative border-r border-dashed border-stone-200 ${
                          isFreeship
                            ? "bg-gradient-to-br from-emerald-500 to-teal-600"
                            : "bg-gradient-to-br from-orange-500 to-[#ee4d2d]"
                        }`}
                      >
                        <span className="text-lg mb-0.5">
                          {isFreeship
                            ? "🚚"
                            : "💵"}
                        </span>

                        <span className="text-[8px] font-black uppercase leading-tight">
                          {isFreeship
                            ? "FREESHIP"
                            : "GIẢM ĐƠN"}
                        </span>

                        <div className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-[#f4f5f7]" />
                        <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 rounded-full bg-[#f4f5f7]" />
                      </div>

                      <div className="flex-1 p-1.5 flex flex-col justify-between space-y-1">
                        <div>
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-mono text-[9px] font-black text-stone-800 bg-stone-100 px-1 py-0.2 rounded border border-stone-200 truncate">
                              {
                                voucher.code
                              }
                            </span>

                            {voucher.minOrder &&
                              voucher.minOrder >
                                0 && (
                                <span className="text-[8px] font-bold text-amber-700 bg-amber-50 px-1 py-0.2 rounded shrink-0">
                                  ≥
                                  {formatCurrency(
                                    voucher.minOrder
                                  )}
                                </span>
                              )}
                          </div>

                          <h4 className="text-[10px] font-bold text-stone-800 leading-tight mt-1 line-clamp-1">
                            {
                              voucher.title
                            }
                          </h4>

                          {voucher.targetType ===
                            "MERCHANT" &&
                            voucher.merchantName && (
                            <div className="mt-1 flex items-center gap-1 min-w-0">
                              <span className="text-[7px] text-stone-400 shrink-0">
                                Tại
                              </span>

                              <span className="text-[8px] font-extrabold text-orange-600 truncate">
                                {voucher.merchantName}
                              </span>
                            </div>
                          )}

                          {voucher.targetType !==
                            "MERCHANT" && (
                            <div className="mt-1 text-[7px] font-bold text-sky-600">
                              Toàn hệ thống
                            </div>
                          )}
                        </div>

                        <div className="space-y-0.5">
                          <div className="flex justify-between items-center text-[7px] text-stone-400 font-medium">
                            <span>
                              Đã dùng{" "}
                              {
                                usedPercent
                              }
                              %
                            </span>

                            {voucher.endDate && (
                              <span>
                                HSD:{" "}
                                {new Date(
                                  voucher.endDate
                                ).toLocaleDateString(
                                  "vi-VN"
                                )}
                              </span>
                            )}
                          </div>

                          <div className="w-full bg-stone-100 h-1 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                isFreeship
                                  ? "bg-teal-500"
                                  : "bg-[#ee4d2d]"
                              }`}
                              style={{
                                width: `${
                                  usedPercent >
                                  0
                                    ? usedPercent
                                    : 10
                                }%`,
                              }}
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            handleSaveVoucher(
                              voucher.code
                            )
                          }
                          className={`w-full py-0.5 text-[9px] font-bold rounded-md transition active:scale-95 ${
                            isSaved
                              ? "bg-emerald-600 text-white"
                              : "bg-orange-100 hover:bg-orange-200 text-[#ee4d2d]"
                          }`}
                        >
                          {isSaved
                            ? "✓ Đã lưu"
                            : "Lưu mã"}
                        </button>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </div>
        )}

      {/* ======================================================
          FEATURED SHOPS
          ====================================================== */}

      {!searchQuery &&
        featuredShops.length > 0 && (
          <div className="bg-white py-2.5 border-b border-stone-200/60 shadow-2xs">
            <div className="px-3 flex items-center justify-between mb-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-base">🌟</span>
                  <h3 className="text-[11px] font-black text-stone-900 tracking-tight">
                    QUÁN ƯU ĐÃI NỔI BẬT
                  </h3>
                </div>
                <p className="text-[8px] text-stone-400 font-medium ml-6 mt-0.5">
                  Được ưu tiên hiển thị nhờ chính sách hợp tác nổi bật
                </p>
              </div>

              <span className="shrink-0 bg-orange-50 text-[#ee4d2d] border border-orange-200/70 text-[8px] font-black px-2 py-1 rounded-full">
                Ưu đãi từ Sàn
              </span>
            </div>

            <div className="flex gap-2 overflow-x-auto no-scrollbar px-3 pb-0.5">
              {featuredShops.map((shop) => {
                const systemVoucherCount =
                  (merchantVoucherMap[shop.id] || []).length ||
                  (shop.merchantCode
                    ? (merchantVoucherMap[shop.merchantCode] || []).length
                    : 0);

                return (
                  <button
                    key={shop.id}
                    type="button"
                    onClick={() =>
                      setSelectedShop({
                        ...shop,
                        distance: getShopDistance(shop),
                      })
                    }
                    className="min-w-[142px] max-w-[142px] text-left bg-gradient-to-br from-white to-orange-50/40 border border-orange-200/70 rounded-xl p-2 hover:border-[#ee4d2d] hover:shadow-sm transition active:scale-[0.98] shrink-0"
                  >
                    <div className="flex items-center gap-2">
                      <div className="relative shrink-0">
                        <img
                          src={shop.avatar}
                          alt={shop.name}
                          loading="lazy"
                          className="w-9 h-9 rounded-full object-cover border-2 border-white shadow-sm"
                        />
                        {shop.isOpen && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-black text-stone-800 truncate">
                          {shop.name}
                        </p>
                        <p className="text-[8px] text-stone-500 mt-0.5">
                          ⭐ {Number(shop.rating || 0).toFixed(1)} · {getShopDistance(shop)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-1">
                      <span className="text-[8px] font-black text-[#ee4d2d] bg-orange-100 px-1.5 py-0.5 rounded-md">
                        Quán nổi bật
                      </span>

                      {systemVoucherCount > 0 ? (
                        <span className="text-[7px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-md truncate">
                          🎁 Có voucher
                        </span>
                      ) : (
                        <span className="text-[7px] font-bold text-stone-400 truncate">
                          Xem quán →
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

      {/* ======================================================
          SMART SUGGESTIONS
          ====================================================== */}

      <div className="bg-white py-3 px-3 border-b border-stone-200/60 shadow-2xs space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black text-stone-800 tracking-tight flex items-center gap-1">
            ✨ ĐỀ XUẤT MÓN
            ĂN CHO BẠN
          </h3>

          <span className="text-[10px] text-[#ee4d2d] font-bold bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200/50">
            AI gợi ý
          </span>
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
          {SMART_SUGGESTIONS.map(
            (item) => {
              const isActive =
                activeTab ===
                  item.category &&
                searchQuery ===
                  "";

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    if (
                      isActive
                    ) {
                      setActiveTab(
                        "all"
                      );

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
                  className={`min-w-[130px] rounded-xl p-2.5 cursor-pointer transition-all duration-200 shrink-0 space-y-1 relative active:scale-95 border ${
                    isActive
                      ? "bg-gradient-to-br from-orange-500 to-[#ee4d2d] text-white border-[#ee4d2d] shadow-md -translate-y-0.5 ring-2 ring-orange-300/50"
                      : "bg-gradient-to-br from-orange-50/60 to-amber-50/30 border-orange-200/60 text-stone-800 hover:border-[#ee4d2d] hover:bg-orange-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">
                      {
                        item.emoji
                      }
                    </span>

                    <span
                      className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                        isActive
                          ? "bg-white text-[#ee4d2d]"
                          : "bg-orange-200/60 text-orange-900"
                      }`}
                    >
                      {isActive
                        ? "✓ Đang chọn"
                        : "Gợi ý"}
                    </span>
                  </div>

                  <div>
                    <p
                      className={`text-[11px] font-bold truncate ${
                        isActive
                          ? "text-white"
                          : "text-stone-800"
                      }`}
                    >
                      {
                        item.label
                      }
                    </p>

                  </div>
                </div>
              );
            }
          )}
        </div>
      </div>

      {/* ======================================================
          QUICK FILTER
          ====================================================== */}

      <div className="px-2 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar bg-stone-100/85 sticky top-[0px] z-30 backdrop-blur-md">
        {[
          {
            id: "recommend",
            label: "🎯 Gợi ý cho bạn (AI)",
          },
          {
            id: "fast",
            label: "⚡ Giao gần nhất",
          },
          {
            id: "discount",
            label: "🔥 Giảm giá sâu",
          },
          {
            id: "bestseller",
            label: "👑 Bán chạy nhất",
          },
        ].map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() =>
              setQuickFilter(
                filter.id
              )
            }
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap border transition shrink-0 ${
              quickFilter ===
              filter.id
                ? "bg-[#ee4d2d] text-white border-[#ee4d2d]"
                : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"
            }`}
          >
            {
              filter.label
            }
          </button>
        ))}
      </div>

      {/* ======================================================
          SEARCH RESULT
          ====================================================== */}

      {searchQuery && (
        <div className="px-3 py-2 bg-orange-100/70 border-b border-orange-200 flex items-center justify-between text-xs">
          <span>
            Kết quả cho từ
            khóa:{" "}
            <strong className="text-[#ee4d2d]">
              "{searchQuery}"
            </strong>{" "}
            ({filteredProducts.length}{" "}
            món)
          </span>

          <button
            type="button"
            onClick={() =>
              setSearchQuery(
                ""
              )
            }
            className="text-[11px] text-[#ee4d2d] font-bold underline cursor-pointer"
          >
            Xóa tìm kiếm
          </button>
        </div>
      )}

      {/* ======================================================
          FLASH DEAL
          ====================================================== */}

      {!searchQuery &&
        (activeDeals.length >
          0 ||
          upcomingDeals.length >
            0) && (
          <div className="bg-white my-2 py-3.5 border-y border-stone-200/70 shadow-2xs">
            <div className="px-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="bg-gradient-to-r from-red-600 to-[#ee4d2d] text-white font-black italic text-xs px-2.5 py-1 rounded-lg tracking-wider flex items-center gap-1 shadow-xs">
                    <span className="animate-bounce">
                      ⚡
                    </span>
                    FLASH DEAL
                    CỬA HÀNG
                  </div>

                  {flashTab ===
                    "active" && (
                    <div className="flex items-center gap-1 text-[11px] font-bold text-stone-700">
                      <span className="text-stone-400 font-normal">
                        Kết thúc:
                      </span>

                      <span className="bg-stone-900 text-amber-400 font-mono text-[10px] px-1.5 py-0.5 rounded-md font-bold">
                        {formatTime(
                          timeLeft
                        )}
                      </span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="text-[11px] text-[#ee4d2d] font-bold hover:underline cursor-pointer"
                >
                  Xem tất cả
                  <span className="text-[9px] ml-0.5">
                    ➔
                  </span>
                </button>
              </div>

              <div className="flex items-center gap-2 border-b border-stone-100 pb-2">
                <button
                  type="button"
                  onClick={() =>
                    setFlashTab(
                      "active"
                    )
                  }
                  className={`text-xs font-bold px-3 py-1 rounded-full ${
                    flashTab ===
                    "active"
                      ? "bg-rose-50 text-[#ee4d2d] border border-rose-200"
                      : "text-stone-500 hover:bg-stone-100"
                  }`}
                >
                  🔥 Đang ưu đãi{" "}
                  <span className="bg-[#ee4d2d] text-white text-[9px] px-1.5 py-0.2 rounded-full ml-1">
                    {
                      activeDeals.length
                    }
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
                    className={`text-xs font-bold px-3 py-1 rounded-full ${
                      flashTab ===
                      "upcoming"
                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                        : "text-stone-500 hover:bg-stone-100"
                    }`}
                  >
                    ⏰ Sắp mở bán{" "}
                    <span className="bg-amber-500 text-white text-[9px] px-1.5 py-0.2 rounded-full ml-1">
                      {
                        upcomingDeals.length
                      }
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
              ).map(
                (item) => {
                  const shop =
                    shops[
                      item.shopId
                    ];

                  const isShopOpen =
                    shop
                      ? shop.isOpen
                      : true;

                  const price =
                    item.promotion
                      .isDiscountActive
                      ? item.promotion
                          .currentPrice
                      : item.price;

                  const distanceStr =
                    item.distanceText;

                  return (
                    <div
                      key={
                        item.id
                      }
                      onClick={() =>
                        setSelectedProduct(
                          item
                        )
                      }
                      className={`min-w-[145px] max-w-[145px] bg-white border border-stone-200/95 rounded-2xl p-2 relative flex flex-col justify-between shadow-2xs cursor-pointer hover:border-[#ee4d2d] hover:shadow-md transition ${
                        !isShopOpen
                          ? "opacity-60"
                          : ""
                      }`}
                    >
                      {item
                        .promotion
                        .discountPercent >
                        0 && (
                        <div
                          className={`absolute top-0 right-0 text-white text-[10px] font-black px-2 py-0.5 rounded-bl-xl rounded-tr-2xl z-10 shadow-xs ${
                            item.promotion
                              .discountPercent >=
                            30
                              ? "bg-gradient-to-b from-purple-600 via-red-600 to-[#ee4d2d]"
                              : "bg-gradient-to-b from-red-500 to-[#ee4d2d]"
                          }`}
                        >
                          -
                          {
                            item
                              .promotion
                              .discountPercent
                          }%
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <div className="h-24 bg-stone-100 rounded-xl overflow-hidden relative">
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

                          <span className="absolute top-1 left-1 bg-black/70 text-amber-300 text-[8px] font-extrabold px-1.5 py-0.5 rounded-md">
                            📍{" "}
                            {
                              distanceStr
                            }
                          </span>

                          <div className="absolute bottom-1 left-1 bg-orange-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-md shadow-xs">
                            ⚡ Giao ~
                            {
                              item.estimatedDeliveryTime
                            }
                            p
                          </div>

                          {item.discountBadge && (
                            <div className="absolute top-6 left-1">
                              <span className="bg-stone-900/80 text-amber-300 text-[7px] font-extrabold px-1 py-0.5 rounded-xs">
                                🏷️{" "}
                                {
                                  item.discountBadge
                                }
                              </span>
                            </div>
                          )}
                        </div>

                        <div>
                          <p className="text-[9px] font-semibold text-stone-400 truncate">
                            🏬{" "}
                            {
                              item.shopName
                            }
                          </p>

                          <h4 className="text-[11px] font-bold text-stone-800 line-clamp-1">
                            {
                              item.name
                            }
                          </h4>
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-1.5 border-t border-stone-100 mt-1">
                        <div>
                          <span className="text-xs font-black text-[#ee4d2d]">
                            {formatCurrency(
                              price
                            )}
                          </span>

                          {item.originalPrice >
                            price && (
                            <div className="text-[9px] text-stone-400 line-through">
                              {formatCurrency(
                                item.originalPrice
                              )}
                            </div>
                          )}
                        </div>

                        {flashTab ===
                          "active" && (
                          <div className="space-y-1">
                            {item.maxPerUser !==
                              null &&
                              item.maxPerUser !==
                                undefined &&
                              Number(
                                item.maxPerUser
                              ) >
                                0 ? (
                              <div className="bg-purple-50 border border-purple-100 text-purple-700 rounded-full text-center py-0.5">
                                <span className="text-[8px] font-black">
                                  👑 Tối đa{" "}
                                  {
                                    item.maxPerUser
                                  }{" "}
                                  món/khách
                                </span>
                              </div>
                            ) : item.discountStock !==
                                null &&
                              item.discountStock !==
                                undefined &&
                              Number(
                                item.discountStock
                              ) >
                                0 ? (
                              <div className="bg-rose-50 border border-rose-100 text-[#ee4d2d] rounded-full text-center py-0.5">
                                <span className="text-[8px] font-black">
                                  🔥 Còn{" "}
                                  {
                                    item.discountStock
                                  }{" "}
                                  suất giảm giá
                                </span>
                              </div>
                            ) : null}

                            <button
                              type="button"
                              disabled={
                                !isShopOpen
                              }
                              onClick={(
                                event
                              ) => {
                                event.stopPropagation();

                                handleAddToCart(
                                  item
                                );
                              }}
                              className="w-full bg-[#ee4d2d] hover:bg-[#d73f20] text-white text-[10px] font-bold py-1 rounded-lg transition active:scale-95"
                            >
                              + Thêm món
                            </button>
                          </div>
                        )}

                        {flashTab ===
                          "upcoming" && (
                          <div className="space-y-1">
                            <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-md text-center py-0.5">
                              <span className="text-[8px] font-bold">
                                ⏰ Mở bán{" "}
                                {item.discountStartTime
                                  ? new Date(
                                      item.discountStartTime
                                    ).toLocaleTimeString(
                                      "vi-VN",
                                      {
                                        hour: "2-digit",
                                        minute:
                                          "2-digit",
                                      }
                                    )
                                  : "Sắp tới"}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={(
                                event
                              ) =>
                                toggleReminder(
                                  item.id,
                                  event
                                )
                              }
                              className={`w-full text-[10px] font-bold py-1 rounded-lg border ${
                                reminders[
                                  item.id
                                ]
                                  ? "bg-amber-500 text-white border-amber-500"
                                  : "bg-white text-amber-600 border-amber-400"
                              }`}
                            >
                              {reminders[
                                item.id
                              ]
                                ? "✓ Đã đặt"
                                : "🔔 Nhắc tôi"}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </div>
        )}

      {/* ======================================================
          CATEGORIES
          ====================================================== */}

      <div className="bg-white border-b border-stone-200/80 shadow-2xs mt-1 py-2">
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-3 whitespace-nowrap">
          <button
            type="button"
            onClick={() =>
              setActiveTab(
                "all"
              )
            }
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border shrink-0 ${
              activeTab ===
              "all"
                ? "bg-stone-900 text-white border-stone-900"
                : "bg-stone-50 text-stone-600 border-stone-200"
            }`}
          >
            🌈 Tất cả (
            {
              products.length
            }
            )
          </button>

          {Object.keys(
            CATEGORY_SUGGESTIONS
          ).map(
            (category) => (
              <button
                key={
                  category
                }
                type="button"
                onClick={() =>
                  setActiveTab(
                    category
                  )
                }
                className={`px-3.5 py-2 rounded-xl text-xs font-bold border shrink-0 ${
                  activeTab ===
                  category
                    ? "bg-orange-500 text-white border-orange-500"
                    : "bg-white text-stone-600 border-stone-200"
                }`}
              >
                {
                  category
                }
              </button>
            )
          )}
        </div>
      </div>

      {/* ======================================================
          PRODUCT GRID
          ====================================================== */}

      {loading ? (
        <div className="p-2 grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map(
            (item) => (
              <div
                key={item}
                className="bg-white rounded-xl p-2 space-y-2 animate-pulse border border-stone-200/60"
              >
                <div className="aspect-square bg-stone-200 rounded-lg" />

                <div className="h-3 bg-stone-200 rounded-xs w-3/4" />

                <div className="h-3 bg-stone-200 rounded-xs w-1/2" />
              </div>
            )
          )}
        </div>
      ) : filteredProducts.length ===
        0 ? (
        <div className="p-8 text-center space-y-2">
          <span className="text-4xl">
            🔍
          </span>

          <p className="text-xs font-bold text-stone-600">
            Không tìm thấy món
            nào phù hợp với
            danh mục hoặc từ
            khóa hiện tại.
          </p>

          <button
            type="button"
            onClick={() => {
              setSearchQuery(
                ""
              );

              setActiveTab(
                "all"
              );
            }}
            className="text-xs text-[#ee4d2d] font-bold underline"
          >
            Xóa tìm kiếm &
            xem tất cả món
          </button>
        </div>
      ) : (
        <div className="p-2 grid grid-cols-2 gap-2">
          {filteredProducts.map(
            (product) => {
              const shop =
                shops[
                  product.shopId
                ];

              const isShopOpen =
                shop
                  ? shop.isOpen
                  : true;

              const {
                isDiscountActive,
                currentPrice,
                discountPercent,
              } =
                product.promotion;

              return (
                <div
                  key={
                    product.id
                  }
                  className={`bg-white rounded-xl overflow-hidden border border-stone-200/70 shadow-2xs hover:shadow-md transition flex flex-col justify-between group ${
                    !isShopOpen
                      ? "opacity-75"
                      : ""
                  }`}
                >
                  <div>
                    {/* SHOP */}

                    {shop && (
                      <div
                        onClick={(
                          event
                        ) => {
                          event.stopPropagation();

                          setSelectedShop(
                            {
                              ...shop,
                              distance:
                                product.distanceText,
                            }
                          );
                        }}
                        className="flex items-center justify-between p-1.5 bg-stone-50 border-b border-stone-100 cursor-pointer"
                      >
                        <div className="flex items-center gap-1.5 overflow-hidden flex-1">
                          <img
                            src={
                              shop.avatar
                            }
                            alt={
                              shop.name
                            }
                            loading="lazy"
                            className="w-4 h-4 rounded-full object-cover border border-stone-200 shrink-0"
                          />

                          <span className="text-[10px] font-bold text-stone-700 truncate">
                            {
                              shop.name
                            }
                          </span>
                        </div>

                        <span className="bg-orange-100 text-[#ee4d2d] font-bold text-[9px] px-1.5 py-0.5 rounded-md shrink-0">
                          ⏱️ ~
                          {
                            product.estimatedDeliveryTime
                          }
                          p
                        </span>
                      </div>
                    )}

                    {/* PRODUCT IMAGE */}

                    <div
                      onClick={() =>
                        setSelectedProduct(
                          product
                        )
                      }
                      className="cursor-pointer"
                    >
                      <div className="relative aspect-square bg-stone-100 overflow-hidden">
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
                          <span className="bg-black/70 text-amber-300 border border-amber-300/30 text-[8px] font-extrabold px-1.5 py-0.5 rounded-md">
                            📍{" "}
                            {
                              product.distanceText
                            }
                          </span>

                          {quickFilter ===
                            "recommend" &&
                            product.totalScore >
                              65 && (
                              <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-r-md">
                                Gợi Ý Hot 🔥
                              </span>
                            )}
                        </div>

                        {isDiscountActive &&
                          discountPercent >
                            0 && (
                            <div className="absolute top-0 right-0 bg-[#ee4d2d] text-white text-[9px] font-black px-1.5 py-0.5 rounded-bl-lg shadow-2xs">
                              -
                              {
                                discountPercent
                              }
                              %
                            </div>
                          )}

                        {/* ====================================
                            VOUCHER CỦA QUÁN
                            ==================================== */}

                        {product.merchantVouchers.length >
                          0 && (
                          <div className="absolute bottom-1.5 left-1.5 right-1.5 z-10">
                            <div className="flex items-center gap-1.5 max-w-full rounded-lg bg-white/95 backdrop-blur-sm border border-emerald-200 shadow-sm px-2 py-1">
                              <span className="shrink-0 text-[10px] leading-none">
                                🎁
                              </span>

                              <span className="truncate text-[8px] font-extrabold text-emerald-700">
                                {(() => {
                                  const voucher =
                                    product.merchantVouchers[0];

                                  if (
                                    voucher.applyType ===
                                    "SHIPPING"
                                  ) {
                                    if (
                                      voucher.discountType ===
                                      "PERCENTAGE"
                                    ) {
                                      return `Giảm ${voucher.discountValue}% phí ship`;
                                    }

                                    return `Giảm ${formatCurrency(
                                      voucher.discountValue
                                    )} phí ship`;
                                  }

                                  if (
                                    voucher.discountType ===
                                    "PERCENTAGE"
                                  ) {
                                    return `Giảm ${voucher.discountValue}% đơn`;
                                  }

                                  return `Giảm ${formatCurrency(
                                    voucher.discountValue
                                  )}`;
                                })()}
                              </span>

                              {product.merchantVouchers.length >
                                1 && (
                                <span className="shrink-0 text-[7px] font-bold text-emerald-600 bg-emerald-50 rounded px-1 py-0.5">
                                  +{product.merchantVouchers.length - 1}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="p-2 space-y-1">
                        <h3 className="text-[11px] font-bold text-stone-800 line-clamp-2 leading-snug group-hover:text-[#ee4d2d] transition">
                          {
                            product.name
                          }
                        </h3>

                        {isDiscountActive &&
                          product.maxPerUser !==
                            null &&
                          product.maxPerUser !==
                            undefined &&
                          Number(
                            product.maxPerUser
                          ) >
                            0 && (
                            <div className="inline-block bg-purple-50 text-purple-700 font-extrabold text-[8px] px-1.5 py-0.5 rounded-md border border-purple-100">
                              👑 Max{" "}
                              {
                                product.maxPerUser
                              }{" "}
                              món/khách
                            </div>
                          )}
                      </div>
                    </div>
                  </div>

                  {/* PRICE */}

                  <div className="p-2 pt-0 space-y-1.5">
                    <div className="space-y-0.5">
                      <div className="flex items-baseline gap-1">
                        <span className="text-xs font-black text-[#ee4d2d]">
                          {formatCurrency(
                            currentPrice
                          )}
                        </span>
                      </div>

                      {product
                        .originalPrice >
                        currentPrice && (
                        <div className="text-[9px] text-stone-400 line-through">
                          {formatCurrency(
                            product.originalPrice
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[9px] text-stone-500 pt-1.5 border-t border-stone-100">
                      <div className="flex items-center gap-1 flex-wrap truncate">
                        <span className="text-amber-500 font-bold">
                          ★{" "}
                          {
                            shop?.rating ||
                            5
                          }
                        </span>

                        <span className="text-stone-400 font-medium">
                          (
                          {
                            product.reviewCount ||
                              0
                          }
                          )
                        </span>
                      </div>

                      <button
                        type="button"
                        disabled={
                          !isShopOpen
                        }
                        onClick={(
                          event
                        ) => {
                          event.stopPropagation();

                          handleAddToCart(
                            product
                          );
                        }}
                        className={`${
                          isShopOpen
                            ? "bg-[#ee4d2d] hover:bg-[#d73f20]"
                            : "bg-stone-300 text-stone-500 cursor-not-allowed"
                        } active:scale-95 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg transition shadow-2xs flex items-center gap-0.5 shrink-0 ml-1`}
                      >
                        {
                          isShopOpen
                            ? "+ Thêm"
                            : "Tạm đóng"
                        }
                      </button>
                    </div>
                  </div>
                </div>
              );
            }
          )}
        </div>
      )}

      {/* ======================================================
          PRODUCT MODAL
          ====================================================== */}

      <ProductDetailModal
        product={
          selectedProduct
        }
        shop={
          selectedProduct
            ? shops[
                selectedProduct
                  .shopId
              ]
              ? (shops[
                  selectedProduct
                    .shopId
                ] as any)
              : undefined
            : undefined
        }
        distanceStr={
          selectedProduct
            ? getShopDistance(
                shops[
                  selectedProduct
                    .shopId
                ]
              )
            : "2.0 km"
        }
        deliveryTime={
          selectedProduct
            ? calculateETA(
                selectedProduct.prepTime ||
                  15,
                getShopDistanceKm(
                  shops[
                    selectedProduct
                      .shopId
                  ]
                )
              )
            : 20
        }
        onClose={() =>
          setSelectedProduct(
            null
          )
        }
        onAddToCart={
          handleAddToCartModal
        }
        formatCurrency={
          formatCurrency
        }
      />

      {/* ======================================================
          SHOP MODAL
          ====================================================== */}

      <ShopDetailModal
        shop={selectedShop}
        products={products}
        distanceStr={
          selectedShop
            ? getShopDistance(
                selectedShop
              )
            : "2.0 km"
        }
        deliveryTime={
          selectedShop
            ? calculateETA(
                15,
                getShopDistanceKm(
                  selectedShop
                )
              )
            : 20
        }
        onClose={() =>
          setSelectedShop(
            null
          )
        }
        onAddToCart={
          handleAddToCart
        }
        onProductClick={(
          product
        ) => {
          setSelectedShop(
            null
          );

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