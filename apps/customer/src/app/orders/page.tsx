 "use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@cho-online/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { useCartStore } from "@/store/useCartStore";

interface OrderItem {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  quantity: number;
  imageUrl?: string;
  image?: string;
  note?: string;
  merchantId?: string;
  merchantCode?: string;
  costPrice?: number;
  lat?: number;
  lng?: number;
  location?: {
    latitude?: number;
    longitude?: number;
  };
}

export interface Order {
  id: string;
  createdAt: any;
  acceptedAt?: any;
  completedAt?: any;
  updatedAt?: any;
  cancelledAt?: any;
  refundedAt?: any;

  items: OrderItem[];
  subtotalPrice?: number;
  subTotalPrice?: number;
  discountAmount?: number;

  shippingFee?: number;
  baseShippingFee?: number;
  appliedFee?: number;
  rainFee?: number;
  peakHourFee?: number;
  nightFee?: number;
  shippingVoucherDiscount?: number;
  shippingVoucherCode?: string;

  totalPrice: number;

  status:
    | "pending_payment"
    | "pending"
    | "accepted"
    | "preparing"
    | "finding_driver"
    | "delivering"
    | "completed"
    | "cancelled"
    | "refunded"
    | string;

  address?: string;
  customerAddress?: string;
  phone?: string;
  customerName?: string;
  recipientName?: string;

  paymentMethod?: string;
  paymentCode?: string;
  paymentStatus?: string;

  merchantId?: string;
  merchantCode?: string;
  shopName?: string;
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  storeLat?: number;
  storeLng?: number;
  storeLocation?: {
    latitude?: number;
    longitude?: number;
  };

  customerLat?: number;
  customerLng?: number;
  customerLocation?: {
    latitude?: number;
    longitude?: number;
  };

  distanceKm?: number;
  distanceStr?: string;
  isRaining?: boolean;

  shopVoucherCode?: string;
  shopVoucherDiscount?: number;

  driverName?: string;
  driverId?: string;
  shipperName?: string;
  shipperId?: string;
  driverNote?: string;
  shipperNote?: string;

  subTotalCostPrice?: number;
  pointsEarned?: number;
  pointsUsed?: number;
  pointsExpiresAt?: any;

  isReviewed?: boolean;
  reviewInfo?: {
    productRating?: number;
    driverRating?: number;
    productComment?: string;
    driverComment?: string;
    reviewedAt?: any;
  };

  cancelReason?: string;
  cancelledBy?: string;
}

interface ToastState {
  show: boolean;
  type: "success" | "error" | "warning" | "info";
  message: string;
}

const ORDER_STEPS = [
  { key: "pending", label: "Chờ xác nhận", icon: "⏳" },
  { key: "accepted", label: "Shop đã nhận", icon: "✓" },
  { key: "preparing", label: "Đang làm", icon: "👨‍🍳" },
  { key: "delivering", label: "Đang giao", icon: "🛵" },
  { key: "completed", label: "Hoàn thành", icon: "🎉" },
];

const CANCEL_REASONS = [
  "Tôi muốn đổi món / chọn cửa hàng khác",
  "Nhầm địa chỉ hoặc số điện thoại",
  "Đã chờ lâu / shop xác nhận chậm",
  "Đổi ý, không muốn mua nữa",
];

const PRODUCT_TAGS = [
  "Món ăn rất ngon 😋",
  "Đóng gói cẩn thận 📦",
  "Thức ăn còn nóng hổi 🔥",
  "Đúng khẩu vị ❤️",
  "Giá cả hợp lý 💰",
];

const DRIVER_TAGS = [
  "Giao hàng siêu nhanh ⚡",
  "Thái độ thân thiện 😊",
  "Nhiệt tình & Lịch sự 🤝",
  "Bảo quản hàng cẩn thận 👍",
  "Tìm nhà chuẩn xác 🗺️",
];

const toNumber = (value: unknown, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const getDateValue = (value: any) => {
  if (!value) return 0;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (value?.seconds != null) return Number(value.seconds) * 1000;
  if (value?.toDate) {
    const date = value.toDate();
    return date instanceof Date ? date.getTime() : 0;
  }
  if (value instanceof Date) return value.getTime();
  return 0;
};

const formatCurrencyValue = (amount: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(toNumber(amount));

const formatDateTimeValue = (value: any) => {
  const ms = getDateValue(value);
  if (!ms) return "Chưa cập nhật";
  return new Date(ms).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const shortId = (value?: string) =>
  value ? `#${value.slice(0, 8).toUpperCase()}` : "—";

const getCoords = (
  lat?: number,
  lng?: number,
  location?: { latitude?: number; longitude?: number }
) => {
  const latitude = toNumber(lat ?? location?.latitude, NaN);
  const longitude = toNumber(lng ?? location?.longitude, NaN);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
};

const openGoogleMaps = (lat?: number, lng?: number) => {
  const coords = getCoords(lat, lng);
  if (!coords || typeof window === "undefined") return;
  window.open(
    `https://www.google.com/maps/search/?api=1&query=${coords.latitude},${coords.longitude}`,
    "_blank",
    "noopener,noreferrer"
  );
};

export default function OrdersPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<
    "all" | "unpaid" | "processing" | "completed" | "cancelled"
  >("all");

  const [detailOrder, setDetailOrder] = useState<Order | null>(null);

  const [toast, setToast] = useState<ToastState>({
    show: false,
    type: "info",
    message: "",
  });

  const [cancelOrderTarget, setCancelOrderTarget] = useState<Order | null>(
    null
  );
  const [selectedCancelReason, setSelectedCancelReason] = useState(
    CANCEL_REASONS[0]
  );
  const [customCancelReason, setCustomCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const [reviewOrder, setReviewOrder] = useState<Order | null>(null);
  const [productRating, setProductRating] = useState(5);
  const [driverRating, setDriverRating] = useState(5);
  const [productComment, setProductComment] = useState("");
  const [driverComment, setDriverComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const addItemToCart = useCartStore((state) => state.addItem);
  const setSelectedMerchantId = useCartStore(
    (state) => state.setSelectedMerchantId
  );
  const openCart = useCartStore((state) => state.openCart);

  const showToast = (
    message: string,
    type: "success" | "error" | "warning" | "info" = "info"
  ) => {
    setToast({ show: true, type, message });
    window.setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, 3500);
  };

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        unsubscribeSnapshot?.();
        setUser(null);
        setOrders([]);
        setLoading(false);
        return;
      }

      setUser(currentUser);

      const ordersRef = collection(db, "orders");
      const q = query(ordersRef, where("userId", "==", currentUser.uid));

      unsubscribeSnapshot?.();

      unsubscribeSnapshot = onSnapshot(
        q,
        (snapshot) => {
          const fetchedOrders = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          })) as Order[];

          fetchedOrders.sort(
            (a, b) => getDateValue(b.createdAt) - getDateValue(a.createdAt)
          );

          setOrders(fetchedOrders);
          setLoading(false);
        },
        (error) => {
          console.error("Lỗi realtime đơn hàng:", error);
          showToast("Không thể tải danh sách đơn hàng!", "error");
          setLoading(false);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribeSnapshot?.();
    };
  }, []);

  const getStepIndex = (status: string) => {
    const st = (status || "").toLowerCase();
    if (st === "pending_payment" || st === "pending") return 0;
    if (st === "accepted") return 1;
    if (st === "preparing" || st === "processing") return 2;
    if (
      st === "finding_driver" ||
      st === "delivering" ||
      st === "shipping"
    ) {
      return 3;
    }
    if (st === "completed") return 4;
    return -1;
  };

  const canCancelOrder = (status: string) => {
    const st = (status || "").toLowerCase();
    return st === "pending_payment" || st === "pending" || st === "accepted";
  };

  const getStatusMeta = (order: Order) => {
    const status = (order.status || "").toLowerCase();

    if (status === "pending_payment") {
      return {
        label: "Chưa thanh toán",
        icon: "💳",
        className: "bg-red-100 text-red-700 border-red-200",
      };
    }

    if (status === "refunded") {
      return {
        label: "Đã hoàn tiền",
        icon: "💸",
        className: "bg-rose-50 text-rose-700 border-rose-200",
      };
    }

    if (status === "cancelled") {
      return {
        label: "Đã hủy",
        icon: "❌",
        className: "bg-rose-50 text-rose-700 border-rose-200",
      };
    }

    const index = getStepIndex(status);
    return {
      label: ORDER_STEPS[index]?.label || "Đang xử lý",
      icon: ORDER_STEPS[index]?.icon || "⏳",
      className: "bg-orange-50 text-[#ee4d2d] border-orange-200",
    };
  };

  const getDisplaySubtotal = (order: Order) => {
    if (order.subtotalPrice != null) return toNumber(order.subtotalPrice);
    if (order.subTotalPrice != null) return toNumber(order.subTotalPrice);

    return (order.items || []).reduce((sum, item: any) => {
      if (typeof item === "string") return sum;
      return sum + toNumber(item?.price) * toNumber(item?.quantity, 1);
    }, 0);
  };

  const getDiscountBreakdown = (order: Order) => {
    const shopVoucher = toNumber(order.shopVoucherDiscount);
    const shippingVoucher = toNumber(order.shippingVoucherDiscount);

    return {
      shopVoucher,
      shippingVoucher,
      totalVoucher: shopVoucher + shippingVoucher,
      totalDiscount: toNumber(
        order.discountAmount,
        shopVoucher + shippingVoucher
      ),
    };
  };

  const getShippingBreakdown = (order: Order) => {
    const shippingFee = toNumber(order.shippingFee);
    const baseShipping = toNumber(order.baseShippingFee, shippingFee);
    const shippingVoucher = toNumber(order.shippingVoucherDiscount);

    // Với dữ liệu của đơn hiện tại:
    // 42.000 + 3.000 phụ phí - 12.000 voucher = 33.000 phí ship thực thu.
    // appliedFee được xem là khoản phụ phí đã áp dụng tổng, không cộng lặp
    // rainFee/peakHourFee/nightFee; các khoản con chỉ dùng để giải thích.
    const appliedFee = toNumber(order.appliedFee);
    const explicitSurcharge =
      toNumber(order.rainFee) +
      toNumber(order.peakHourFee) +
      toNumber(order.nightFee);

    const surcharge =
      appliedFee > 0 ? appliedFee : Math.max(0, explicitSurcharge);

    const calculatedNetShipping = Math.max(
      0,
      baseShipping + surcharge - shippingVoucher
    );

    return {
      shippingFee,
      baseShipping,
      surcharge,
      rainFee: toNumber(order.rainFee),
      peakHourFee: toNumber(order.peakHourFee),
      nightFee: toNumber(order.nightFee),
      shippingVoucher,
      calculatedNetShipping,
    };
  };

  const getOrderTotal = (order: Order) => {
    if (Number.isFinite(Number(order.totalPrice))) {
      return toNumber(order.totalPrice);
    }

    const subtotal = getDisplaySubtotal(order);
    const { totalDiscount } = getDiscountBreakdown(order);
    const { shippingFee } = getShippingBreakdown(order);

    return Math.max(0, subtotal - totalDiscount + shippingFee);
  };

  const getPaymentLabel = (method?: string) => {
    const value = (method || "").toLowerCase();
    if (value === "cod" || value === "cash") {
      return "Thanh toán khi nhận hàng";
    }
    if (
      value === "bank_transfer" ||
      value === "banking" ||
      value === "bank"
    ) {
      return "Chuyển khoản QR";
    }
    if (value === "momo") return "MoMo";
    if (value === "vnpay") return "VNPay";
    if (value === "wallet") return "Ví Anvami";
    return method || "Chưa cập nhật";
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const st = (order.status || "").toLowerCase();

      if (activeTab === "unpaid") return st === "pending_payment";

      if (activeTab === "processing") {
        return [
          "pending",
          "accepted",
          "preparing",
          "finding_driver",
          "delivering",
          "shipping",
          "processing",
        ].includes(st);
      }

      if (activeTab === "completed") return st === "completed";

      if (activeTab === "cancelled") {
        return st === "cancelled" || st === "refunded";
      }

      return true;
    });
  }, [orders, activeTab]);

  const unpaidCount = orders.filter(
    (order) => (order.status || "").toLowerCase() === "pending_payment"
  ).length;

  const handleCancelOrder = async () => {
    if (!cancelOrderTarget || !user) return;

    if (!canCancelOrder(cancelOrderTarget.status)) {
      showToast(
        "Quán đã bắt đầu làm món, bạn không thể hủy đơn hàng này!",
        "warning"
      );
      setCancelOrderTarget(null);
      return;
    }

    const finalReason =
      selectedCancelReason === "Khác"
        ? customCancelReason.trim() || "Hủy theo yêu cầu của khách hàng"
        : selectedCancelReason;

    setCancelling(true);

    try {
      const orderRef = doc(db, "orders", cancelOrderTarget.id);

      await updateDoc(orderRef, {
        status: "cancelled",
        cancelReason: finalReason,
        cancelledBy: "Khách hàng",
        cancelledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      showToast("Đã hủy đơn hàng thành công!", "success");
      setCancelOrderTarget(null);
      setCustomCancelReason("");
    } catch (error: any) {
      console.error("Lỗi hủy đơn hàng:", error);
      showToast(
        `Lỗi hủy đơn: ${error?.message || "Vui lòng thử lại sau."}`,
        "error"
      );
    } finally {
      setCancelling(false);
    }
  };

  const toggleTag = (
    tag: string,
    currentComment: string,
    setCommentFn: (value: string) => void
  ) => {
    if (currentComment.includes(tag)) {
      setCommentFn(
        currentComment.replace(tag, "").replace(/\s+/g, " ").trim()
      );
    } else {
      setCommentFn(currentComment ? `${currentComment}, ${tag}` : tag);
    }
  };

  const resetReviewForm = () => {
    setProductRating(5);
    setDriverRating(5);
    setProductComment("");
    setDriverComment("");
  };

  const handleSubmitReview = async () => {
    if (!reviewOrder || !user) return;

    setSubmittingReview(true);

    try {
      const reviewData = {
        orderId: reviewOrder.id,
        userId: user.uid,
        userName:
          user.displayName || reviewOrder.customerName || "Khách hàng",
        productRating: Number(productRating) || 5,
        productComment: productComment || "",
        driverRating: Number(driverRating) || 5,
        driverComment: driverComment || "",
        merchantCode: reviewOrder.merchantCode ?? null,
        driverId:
          reviewOrder.driverId || reviewOrder.shipperId || null,
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, "reviews"), reviewData);

      await updateDoc(doc(db, "orders", reviewOrder.id), {
        isReviewed: true,
        reviewInfo: {
          productRating,
          driverRating,
          productComment,
          driverComment,
          reviewedAt: new Date().toISOString(),
        },
        updatedAt: serverTimestamp(),
      });

      showToast("Cảm ơn bạn đã gửi đánh giá tuyệt vời!", "success");
      setReviewOrder(null);
      resetReviewForm();
    } catch (error: any) {
      console.error("Chi tiết lỗi Firestore:", error);
      showToast(
        `Lỗi gửi đánh giá: ${error?.message || "Vui lòng thử lại sau."}`,
        "error"
      );
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleReorder = (order: Order) => {
    if (!order.items?.length) {
      showToast("Đơn hàng không có sản phẩm để đặt lại.", "warning");
      return;
    }

    const targetMerchantId =
      order.merchantId ||
      (typeof order.items[0] !== "string"
        ? order.items[0]?.merchantId
        : "") ||
      "default_merchant";

    order.items.forEach((item: any, itemIndex) => {
      const isString = typeof item === "string";
      const qty = isString ? 1 : Math.max(1, toNumber(item.quantity, 1));

      for (let i = 0; i < qty; i++) {
        addItemToCart({
          id: isString
            ? `reorder-${order.id}-${itemIndex}-${Date.now()}-${i}`
            : item.id,
          name: isString ? item : item.name,
          price: isString ? 0 : toNumber(item.price),
          unit: "món",
          category: "fruit",
          imageUrl: isString ? "" : item.imageUrl || item.image || "",
          isAvailable: true,
          merchantId: targetMerchantId,
          merchantCode: isString
            ? order.merchantCode || ""
            : item.merchantCode || order.merchantCode || "",
        } as any);
      }
    });

    setSelectedMerchantId(targetMerchantId);
    openCart();
    showToast("🎉 Đã thêm món vào giỏ hàng!", "success");
  };

  const renderPaymentSummary = (order: Order) => {
    const subtotal = getDisplaySubtotal(order);
    const discount = getDiscountBreakdown(order);
    const shipping = getShippingBreakdown(order);
    const total = getOrderTotal(order);

    // shippingFee trong order là phí ship cuối cùng khách trả.
    // Khi có voucher ship, phục dựng phí trước ưu đãi để phần tổng kết dễ hiểu.
    const shippingBeforeVoucher = Math.max(
      shipping.shippingFee + discount.shippingVoucher,
      shipping.baseShipping + shipping.surcharge
    );

    const otherDiscount = Math.max(
      0,
      discount.totalDiscount - discount.totalVoucher
    );

    return (
      <div className="rounded-2xl bg-stone-50 border border-stone-100 p-4 space-y-2.5">
        <div className="flex justify-between gap-4 text-[11px] text-stone-500">
          <span>Tiền hàng</span>
          <span className="font-semibold text-stone-700">
            {formatCurrencyValue(subtotal)}
          </span>
        </div>

        <div className="flex justify-between gap-4 text-[11px] text-stone-500">
          <span>Phí giao hàng</span>
          <span className="font-semibold text-stone-700">
            {formatCurrencyValue(shippingBeforeVoucher)}
          </span>
        </div>

        {discount.shopVoucher > 0 && (
          <div className="flex justify-between gap-4 text-[11px] text-emerald-600">
            <span className="truncate">
              Ưu đãi cửa hàng
              {order.shopVoucherCode ? ` · ${order.shopVoucherCode}` : ""}
            </span>
            <span className="font-semibold whitespace-nowrap">
              -{formatCurrencyValue(discount.shopVoucher)}
            </span>
          </div>
        )}

        {discount.shippingVoucher > 0 && (
          <div className="flex justify-between gap-4 text-[11px] text-emerald-600">
            <span className="truncate">
              Ưu đãi vận chuyển
              {order.shippingVoucherCode
                ? ` · ${order.shippingVoucherCode}`
                : ""}
            </span>
            <span className="font-semibold whitespace-nowrap">
              -{formatCurrencyValue(discount.shippingVoucher)}
            </span>
          </div>
        )}

        {otherDiscount > 0 && (
          <div className="flex justify-between gap-4 text-[11px] text-emerald-600">
            <span>Ưu đãi khác</span>
            <span className="font-semibold whitespace-nowrap">
              -{formatCurrencyValue(otherDiscount)}
            </span>
          </div>
        )}

        <div className="border-t border-stone-200 pt-2.5 flex items-center justify-between gap-4">
          <span className="text-xs font-black text-stone-900">
            Tổng thanh toán
          </span>
          <span className="text-xl font-black text-[#ee4d2d]">
            {formatCurrencyValue(total)}
          </span>
        </div>
      </div>
    );
  };


  const renderOrderItems = (order: Order, compact = false) => {
    if (!order.items?.length) {
      return (
        <div className="text-xs text-stone-400 italic">
          Chưa có dữ liệu sản phẩm.
        </div>
      );
    }

    return (
      <div className="divide-y divide-stone-100">
        {order.items.map((item: any, idx) => {
          if (typeof item === "string") {
            return (
              <div
                key={`${order.id}-item-${idx}`}
                className="py-2 text-xs font-semibold text-stone-700"
              >
                {item}
              </div>
            );
          }

          const quantity = Math.max(1, toNumber(item.quantity, 1));
          const itemPrice = toNumber(item.price);
          const originalPrice = toNumber(item.originalPrice);
          const itemTotal = itemPrice * quantity;
          const image = item.imageUrl || item.image || "";

          return (
            <div
              key={`${order.id}-item-${idx}`}
              className={`flex items-center gap-3 ${compact ? "py-2" : "py-2.5"}`}
            >
              <div
                className={`${
                  compact ? "w-11 h-11 rounded-xl" : "w-14 h-14 rounded-2xl"
                } bg-stone-100 border border-stone-200/80 overflow-hidden shrink-0 flex items-center justify-center`}
              >
                {image ? (
                  <img
                    src={image}
                    alt={item.name || "Sản phẩm"}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-lg">🍲</span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-stone-800 line-clamp-2">
                      {item.name || "Sản phẩm"}
                    </h4>
                    <p className="text-[10px] text-stone-500 mt-0.5">
                      {formatCurrencyValue(itemPrice)} × {quantity}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs font-extrabold text-stone-900">
                      {formatCurrencyValue(itemTotal)}
                    </div>
                    {originalPrice > itemPrice && (
                      <div className="text-[9px] text-stone-400 line-through mt-0.5">
                        {formatCurrencyValue(originalPrice * quantity)}
                      </div>
                    )}
                  </div>
                </div>

                {item.note && (
                  <p className="mt-1 text-[10px] text-amber-700 line-clamp-2">
                    Ghi chú: {item.note}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };


  const renderInfoRow = (
    label: string,
    value?: React.ReactNode,
    action?: React.ReactNode
  ) => {
    return (
      <div className="flex items-start justify-between gap-4 py-2 border-b border-stone-100 last:border-0">
        <span className="text-[10px] text-stone-400 shrink-0">{label}</span>
        <div className="text-right min-w-0">
          <div className="text-[11px] font-semibold text-stone-700 break-words">
            {value || "—"}
          </div>
          {action}
        </div>
      </div>
    );
  };

  const renderOrderDetailContent = (order: Order) => {
    const statusMeta = getStatusMeta(order);
    const customerCoords = getCoords(
      order.customerLat,
      order.customerLng,
      order.customerLocation
    );

    const paymentStatusLabel =
      order.paymentStatus ||
      ((order.status || "").toLowerCase() === "pending_payment"
        ? "Chưa thanh toán"
        : (order.paymentMethod || "").toLowerCase() === "cod"
        ? "Thanh toán khi nhận hàng"
        : "Đã ghi nhận");

    const itemCount = (order.items || []).reduce(
      (sum, item: any) =>
        sum +
        (typeof item === "string"
          ? 1
          : Math.max(1, toNumber(item.quantity, 1))),
      0
    );

    return (
      <div className="space-y-3">
        <div className="rounded-2xl bg-stone-50 border border-stone-100 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] text-stone-400 font-mono">
                {shortId(order.id)}
              </p>
              <h3 className="text-sm font-black text-stone-900 mt-1 truncate">
                {order.shopName || order.storeName || "Cửa hàng"}
              </h3>
              <p className="text-[10px] text-stone-400 mt-1">
                {formatDateTimeValue(order.createdAt)}
              </p>
            </div>

            <span
              className={`shrink-0 px-3 py-1.5 rounded-full border text-[10px] font-black ${statusMeta.className}`}
            >
              {statusMeta.icon} {statusMeta.label}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-stone-100 bg-white p-4">
          <div className="flex items-center justify-between gap-3 mb-2">
            <h4 className="text-xs font-black text-stone-900">
              Sản phẩm
            </h4>
            <span className="text-[10px] text-stone-400">
              {itemCount} sản phẩm
            </span>
          </div>
          {renderOrderItems(order)}
        </div>

        <div className="rounded-2xl border border-stone-100 bg-white p-4">
          <h4 className="text-xs font-black text-stone-900 mb-1">
            Giao hàng
          </h4>
          {renderInfoRow(
            "Người nhận",
            order.recipientName || order.customerName
          )}
          {order.phone && renderInfoRow("Số điện thoại", order.phone)}
          {renderInfoRow(
            "Địa chỉ",
            order.customerAddress || order.address || "Chưa cập nhật",
            customerCoords ? (
              <button
                type="button"
                onClick={() =>
                  openGoogleMaps(
                    customerCoords.latitude,
                    customerCoords.longitude
                  )
                }
                className="mt-1 text-[10px] text-blue-600 font-bold hover:underline cursor-pointer"
              >
                Mở bản đồ
              </button>
            ) : null
          )}
          {order.shipperNote &&
            renderInfoRow("Ghi chú", order.shipperNote)}
        </div>

        <div className="rounded-2xl border border-stone-100 bg-white p-4">
          <h4 className="text-xs font-black text-stone-900 mb-1">
            Cửa hàng & giao nhận
          </h4>
          {renderInfoRow(
            "Cửa hàng",
            order.shopName || order.storeName || "Chưa cập nhật"
          )}
          {order.storePhone &&
            renderInfoRow("Số điện thoại", order.storePhone)}
          {(order.distanceStr || order.distanceKm != null) &&
            renderInfoRow(
              "Khoảng cách",
              order.distanceStr ||
                `${toNumber(order.distanceKm).toFixed(2)} km`
            )}
          {(order.driverName || order.shipperName) &&
            renderInfoRow(
              "Shipper",
              order.driverName || order.shipperName
            )}
        </div>

        <div className="rounded-2xl border border-stone-100 bg-white p-4">
          <h4 className="text-xs font-black text-stone-900 mb-1">
            Thanh toán
          </h4>
          {renderInfoRow("Phương thức", getPaymentLabel(order.paymentMethod))}
          {renderInfoRow("Trạng thái", paymentStatusLabel)}
          {order.paymentCode &&
            renderInfoRow(
              "Mã thanh toán",
              <span className="font-mono">{order.paymentCode}</span>
            )}

          <div className="mt-3">{renderPaymentSummary(order)}</div>
        </div>

        {(order.status || "").toLowerCase() === "cancelled" ||
        (order.status || "").toLowerCase() === "refunded" ? (
          <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
            <h4 className="text-xs font-black text-rose-900 mb-1">
              Thông tin hủy đơn
            </h4>
            {order.cancelReason && renderInfoRow("Lý do", order.cancelReason)}
            {order.cancelledAt &&
              renderInfoRow(
                "Thời gian",
                formatDateTimeValue(order.cancelledAt)
              )}
          </div>
        ) : null}

        {order.isReviewed && order.reviewInfo && (
          <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
            <h4 className="text-xs font-black text-amber-900 mb-1">
              Đánh giá của bạn
            </h4>
            {renderInfoRow(
              "Sản phẩm",
              `${toNumber(order.reviewInfo.productRating)} / 5 ⭐`
            )}
            {renderInfoRow(
              "Giao hàng",
              `${toNumber(order.reviewInfo.driverRating)} / 5 ⭐`
            )}
          </div>
        )}
      </div>
    );
  };


  if (loading) {
    return (
      <div className="p-8 text-center space-y-3 max-w-lg mx-auto my-12">
        <div className="w-8 h-8 border-4 border-[#ee4d2d] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-bold text-stone-400">
          Đang đồng bộ đơn hàng của bạn...
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6 text-center space-y-4 pt-16 max-w-md mx-auto">
        <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto text-4xl shadow-inner">
          🛍️
        </div>
        <h2 className="text-base font-extrabold text-stone-800">
          Bạn chưa đăng nhập
        </h2>
        <p className="text-xs text-stone-500 leading-relaxed">
          Đăng nhập ngay để theo dõi tiến trình giao hàng và xem lịch sử mua
          sắm.
        </p>
        <button
          type="button"
          onClick={() => router.push("/login?redirectTo=/orders")}
          className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:opacity-90 text-white font-bold py-3.5 px-6 rounded-2xl shadow-md text-xs uppercase tracking-wider active:scale-[0.98] transition cursor-pointer"
        >
          Đăng nhập ngay
        </button>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-5 space-y-4 pb-20 max-w-2xl mx-auto font-sans relative">
      {toast.show && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-md animate-in fade-in slide-in-from-top-4 duration-300">
          <div
            className={`p-3.5 rounded-2xl shadow-2xl backdrop-blur-md flex items-center justify-between text-xs font-bold text-white ${
              toast.type === "success"
                ? "bg-emerald-600/95 ring-1 ring-emerald-400"
                : toast.type === "error"
                ? "bg-rose-600/95 ring-1 ring-rose-400"
                : toast.type === "warning"
                ? "bg-amber-600/95 ring-1 ring-amber-400"
                : "bg-slate-900/95 ring-1 ring-slate-700"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span>
                {toast.type === "success"
                  ? "🎉"
                  : toast.type === "error"
                  ? "🚨"
                  : toast.type === "warning"
                  ? "⚠️"
                  : "ℹ️"}
              </span>
              <span>{toast.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setToast((p) => ({ ...p, show: false }))}
              className="text-white/80 hover:text-white text-sm px-1.5"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between border-b border-stone-200/60 pb-3">
        <div>
          <h2 className="text-lg font-black text-stone-900 tracking-tight">
            Đơn hàng của tôi
          </h2>
          <p className="text-[11px] text-stone-400 font-medium">
            Theo dõi trạng thái và quản lý đơn hàng
          </p>
        </div>
        <span className="text-xs bg-orange-50 text-[#ee4d2d] font-black px-3 py-1 rounded-full border border-orange-200">
          {orders.length} đơn hàng
        </span>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs font-bold no-scrollbar">
        {[
          { key: "all", label: "Tất cả", count: orders.length },
          {
            key: "unpaid",
            label: "Chờ thanh toán 💳",
            count: unpaidCount,
            badgeColor: "bg-red-500 text-white",
          },
          { key: "processing", label: "Đang xử lý ⏳" },
          { key: "completed", label: "Hoàn thành 🎉" },
          { key: "cancelled", label: "Đã hủy ❌" },
        ].map((tab) => {
          const isActive = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`px-3.5 py-2 rounded-2xl whitespace-nowrap transition active:scale-95 cursor-pointer flex items-center gap-1.5 ${
                isActive
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-white text-stone-600 border border-stone-200 hover:bg-stone-50"
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    tab.badgeColor
                      ? tab.badgeColor
                      : isActive
                      ? "bg-white/20 text-white"
                      : "bg-stone-100 text-stone-600"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {filteredOrders.length === 0 ? (
        <div className="p-8 text-center space-y-3 bg-white rounded-3xl border border-stone-100 my-4 shadow-sm">
          <div className="text-4xl">📦</div>
          <p className="text-xs font-bold text-stone-600">
            Không tìm thấy đơn hàng nào ở mục này
          </p>
          <p className="text-[11px] text-stone-400">
            Hãy chuyển sang tab khác hoặc tiếp tục khám phá thực đơn nhé!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const statusLower = (order.status || "").toLowerCase();
            const isUnpaid = statusLower === "pending_payment";
            const isCancelled =
              statusLower === "cancelled" || statusLower === "refunded";
            const isRefunded = statusLower === "refunded";
            const isCompleted = statusLower === "completed";
            const cancellable = canCancelOrder(order.status);
            const currentStepIndex = getStepIndex(order.status);
            const statusMeta = getStatusMeta(order);
            const displayShopName =
              order.shopName || order.storeName || "Cửa hàng";
            const discount = getDiscountBreakdown(order);
            const total = getOrderTotal(order);

            return (
              <div
                key={order.id}
                className={`bg-white rounded-3xl border transition overflow-hidden shadow-sm ${
                  isUnpaid
                    ? "border-red-300 ring-2 ring-red-100 shadow-md"
                    : "border-stone-200/90 hover:shadow-md"
                }`}
              >
                {isUnpaid && (
                  <div className="bg-gradient-to-r from-red-500 via-orange-500 to-amber-500 text-white px-4 py-2.5 flex items-center justify-between gap-3 text-xs font-bold">
                    <span className="flex items-center gap-1.5">
                      <span>⚡</span> Đơn hàng chưa thanh toán!
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        router.push(`/orders/${order.id}/payment`)
                      }
                      className="bg-white text-red-600 px-3 py-1 rounded-xl font-extrabold hover:bg-red-50 transition cursor-pointer shadow-sm text-[11px] active:scale-95 whitespace-nowrap"
                    >
                      Thanh toán ngay →
                    </button>
                  </div>
                )}

                <div className="bg-stone-50/80 px-4 py-3 border-b border-stone-100">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black bg-amber-100/80 text-amber-900 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                          🏪 {displayShopName}
                        </span>

                        <span className="text-xs font-black text-stone-800 bg-stone-200/80 px-2 py-0.5 rounded-md font-mono">
                          {shortId(order.id)}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-[10px] text-stone-400">
                        <span>🕒 {formatDateTimeValue(order.createdAt)}</span>
                        {order.distanceKm != null && (
                          <span>
                            📍 {toNumber(order.distanceKm).toFixed(2)} km
                          </span>
                        )}
                        {order.paymentMethod && (
                          <span>💳 {getPaymentLabel(order.paymentMethod)}</span>
                        )}
                      </div>
                    </div>

                    <span
                      className={`shrink-0 text-[10px] font-black px-3 py-1 rounded-full border flex items-center gap-1 ${statusMeta.className}`}
                    >
                      {statusMeta.icon} {statusMeta.label}
                    </span>
                  </div>
                </div>

                {!isCancelled && !isUnpaid ? (
                  <div className="px-4 py-5 bg-white border-b border-stone-50">
                    <div className="relative flex items-center justify-between w-full">
                      <div className="absolute top-3.5 left-0 w-full h-1 bg-stone-100 -translate-y-1/2 rounded-full" />

                      <div
                        className="absolute top-3.5 left-0 h-1 bg-gradient-to-r from-orange-400 to-[#ee4d2d] -translate-y-1/2 transition-all duration-500 rounded-full"
                        style={{
                          width: `${
                            (Math.max(0, currentStepIndex) /
                              (ORDER_STEPS.length - 1)) *
                            100
                          }%`,
                        }}
                      />

                      {ORDER_STEPS.map((step, idx) => {
                        const isPassed = idx <= currentStepIndex;
                        const isCurrent = idx === currentStepIndex;

                        return (
                          <div
                            key={step.key}
                            className="flex flex-col items-center relative z-10"
                          >
                            <div
                              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                isCurrent
                                  ? "bg-[#ee4d2d] text-white ring-4 ring-orange-100 scale-110 shadow-md animate-pulse"
                                  : isPassed
                                  ? "bg-[#ee4d2d] text-white"
                                  : "bg-stone-200 text-stone-400"
                              }`}
                            >
                              {isPassed && !isCurrent ? "✓" : step.icon}
                            </div>
                            <span
                              className={`text-[10px] mt-2 font-bold text-center leading-tight ${
                                isCurrent
                                  ? "text-[#ee4d2d]"
                                  : isPassed
                                  ? "text-stone-800"
                                  : "text-stone-400"
                              }`}
                            >
                              {step.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : isCancelled ? (
                  <div className="p-3.5 bg-rose-50/80 border-b border-rose-100 text-rose-800 space-y-1 text-xs">
                    <div className="flex items-center justify-between gap-3 font-bold">
                      <span className="flex items-center gap-1.5 text-rose-700">
                        {isRefunded
                          ? "💸 Đơn hàng đã hủy & Hoàn tiền thành công"
                          : "🚫 Đơn hàng đã bị hủy"}
                      </span>

                      {order.cancelledAt && (
                        <span className="text-[10px] text-rose-500 font-normal">
                          {formatDateTimeValue(order.cancelledAt)}
                        </span>
                      )}
                    </div>

                    {order.cancelReason && (
                      <div className="text-[11px] text-rose-700 bg-white/70 p-2 rounded-xl border border-rose-200/60 mt-1">
                        <strong>Lý do hủy:</strong> {order.cancelReason}
                        {order.cancelledBy && (
                          <span className="ml-1 text-rose-500">
                            ({order.cancelledBy})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ) : null}

                <div className="p-4 space-y-3">
                  {renderOrderItems(order, true)}

                  {order.customerAddress || order.address ? (
                    <div className="flex items-start gap-2 rounded-2xl bg-stone-50 border border-stone-100 px-3 py-2.5">
                      <span className="text-sm shrink-0">📍</span>
                      <p className="text-[11px] font-medium text-stone-600 line-clamp-2">
                        {order.customerAddress || order.address}
                      </p>
                    </div>
                  ) : null}

                  <div className="flex items-end justify-between gap-4 pt-1">
                    <div className="min-w-0">
                      <p className="text-[9px] uppercase tracking-wide text-stone-400 font-bold">
                        {getPaymentLabel(order.paymentMethod)}
                      </p>
                      {discount.totalDiscount > 0 && (
                        <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                          Đã giảm {formatCurrencyValue(discount.totalDiscount)}
                        </p>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-[9px] text-stone-400 font-bold">
                        Tổng thanh toán
                      </p>
                      <p className="text-lg font-black text-[#ee4d2d]">
                        {formatCurrencyValue(total)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-stone-50 px-4 py-3 border-t border-stone-100">
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <button
                      type="button"
                      onClick={() => setDetailOrder(order)}
                      className="bg-white border border-stone-300 hover:border-orange-300 text-stone-700 font-bold px-3 py-1.5 rounded-xl text-xs transition active:scale-95 cursor-pointer shadow-sm hover:text-[#ee4d2d]"
                    >
                      Chi tiết
                    </button>

                    {isUnpaid && (
                      <button
                        type="button"
                        onClick={() =>
                          router.push(`/orders/${order.id}/payment`)
                        }
                        className="bg-gradient-to-r from-red-600 to-orange-500 hover:opacity-90 text-white font-extrabold px-4 py-2 rounded-xl text-xs transition active:scale-95 cursor-pointer shadow-md shadow-red-500/20"
                      >
                        Thanh toán
                      </button>
                    )}

                    {!isCancelled && cancellable && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCancelReason(CANCEL_REASONS[0]);
                          setCustomCancelReason("");
                          setCancelOrderTarget(order);
                        }}
                        className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold px-3 py-1.5 rounded-xl text-xs transition active:scale-95 cursor-pointer"
                      >
                        Hủy đơn
                      </button>
                    )}

                    {isCompleted &&
                      (order.isReviewed ? (
                        <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                          ✓ Đã đánh giá
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            resetReviewForm();
                            setReviewOrder(order);
                          }}
                          className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-3.5 py-1.5 rounded-xl text-xs transition active:scale-95 cursor-pointer"
                        >
                          Đánh giá
                        </button>
                      ))}

                    <button
                      type="button"
                      onClick={() => handleReorder(order)}
                      className="bg-white border border-stone-300 hover:border-orange-300 text-stone-700 font-bold px-3 py-1.5 rounded-xl text-xs transition active:scale-95 cursor-pointer hover:text-[#ee4d2d]"
                    >
                      Đặt lại
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {detailOrder && (
        <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-hidden shadow-2xl">
            <div className="sticky top-0 z-10 bg-white border-b border-stone-100 px-5 py-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-stone-900">
                  Chi tiết đơn hàng
                </h3>
                <p className="text-[10px] text-stone-400 font-mono mt-0.5">
                  {shortId(detailOrder.id)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setDetailOrder(null)}
                className="w-9 h-9 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 font-bold hover:bg-stone-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto max-h-[calc(92vh-76px)]">
              {renderOrderDetailContent(detailOrder)}
            </div>
          </div>
        </div>
      )}

      {cancelOrderTarget && (
        <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 text-lg">
                  🚫
                </div>
                <div>
                  <h3 className="text-base font-black text-stone-900">
                    Hủy đơn hàng
                  </h3>
                  <p className="text-[11px] text-stone-400 font-mono">
                    {shortId(cancelOrderTarget.id)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCancelOrderTarget(null)}
                className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 font-bold hover:bg-stone-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-bold text-stone-800">
                Vui lòng chọn lý do bạn muốn hủy đơn:
              </p>

              <div className="space-y-2">
                {CANCEL_REASONS.map((reason) => (
                  <label
                    key={reason}
                    className={`flex items-center gap-2.5 p-3 rounded-2xl border text-xs cursor-pointer transition ${
                      selectedCancelReason === reason
                        ? "border-rose-500 bg-rose-50/50 text-rose-900 font-bold"
                        : "border-stone-200 text-stone-700 hover:bg-stone-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="cancelReason"
                      checked={selectedCancelReason === reason}
                      onChange={() => setSelectedCancelReason(reason)}
                      className="accent-rose-600"
                    />
                    <span>{reason}</span>
                  </label>
                ))}

                <label
                  className={`flex items-center gap-2.5 p-3 rounded-2xl border text-xs cursor-pointer transition ${
                    selectedCancelReason === "Khác"
                      ? "border-rose-500 bg-rose-50/50 text-rose-900 font-bold"
                      : "border-stone-200 text-stone-700 hover:bg-stone-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="cancelReason"
                    checked={selectedCancelReason === "Khác"}
                    onChange={() => setSelectedCancelReason("Khác")}
                    className="accent-rose-600"
                  />
                  <span>Lý do khác...</span>
                </label>
              </div>

              {selectedCancelReason === "Khác" && (
                <textarea
                  rows={3}
                  value={customCancelReason}
                  onChange={(e) => setCustomCancelReason(e.target.value)}
                  placeholder="Nhập chi tiết lý do hủy đơn..."
                  className="w-full text-xs p-3 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-rose-400 outline-none resize-none"
                />
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCancelOrderTarget(null)}
                className="w-1/2 py-3 border border-stone-200 rounded-2xl text-xs font-bold text-stone-600 hover:bg-stone-50 active:scale-95 transition cursor-pointer"
              >
                Giữ lại đơn
              </button>
              <button
                type="button"
                disabled={cancelling}
                onClick={handleCancelOrder}
                className="w-1/2 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-bold shadow-md shadow-rose-600/20 disabled:opacity-50 active:scale-95 transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                {cancelling ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Đang hủy...</span>
                  </>
                ) : (
                  <span>Xác nhận hủy</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {reviewOrder && (
        <div className="fixed inset-0 z-[95] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-base font-black text-stone-900">
                  Đánh giá đơn hàng {shortId(reviewOrder.id)}
                </h3>
                <p className="text-[11px] text-stone-400">
                  Ý kiến của bạn giúp Anvami nâng cao chất lượng dịch vụ
                </p>
              </div>

              <button
                type="button"
                onClick={() => setReviewOrder(null)}
                className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 font-bold hover:bg-stone-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 bg-orange-50/50 p-4 rounded-2xl border border-orange-100">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold text-stone-800">
                  🍲 Chất lượng món ăn & sản phẩm
                </span>
                <div className="flex gap-1 text-lg">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setProductRating(star)}
                      className={`transition-transform active:scale-125 cursor-pointer ${
                        star <= productRating
                          ? "text-amber-400"
                          : "text-stone-300"
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {PRODUCT_TAGS.map((tag) => {
                  const isSelected = productComment.includes(tag);

                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() =>
                        toggleTag(tag, productComment, setProductComment)
                      }
                      className={`text-[10px] px-2.5 py-1 rounded-full font-medium border transition cursor-pointer active:scale-95 ${
                        isSelected
                          ? "bg-amber-500 text-white border-amber-500"
                          : "bg-white text-stone-600 border-stone-200 hover:border-amber-400"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>

              <textarea
                rows={3}
                value={productComment}
                onChange={(e) => setProductComment(e.target.value)}
                placeholder="Nhập thêm chia sẻ về món ăn..."
                className="w-full text-xs p-2.5 bg-white border border-stone-200 rounded-xl focus:ring-2 focus:ring-orange-400 outline-none resize-none"
              />
            </div>

            <div className="space-y-3 bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold text-stone-800">
                  🛵 Dịch vụ giao hàng (
                  {reviewOrder.driverName ||
                    reviewOrder.shipperName ||
                    "Shipper"}
                  )
                </span>
                <div className="flex gap-1 text-lg">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setDriverRating(star)}
                      className={`transition-transform active:scale-125 cursor-pointer ${
                        star <= driverRating
                          ? "text-amber-400"
                          : "text-stone-300"
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {DRIVER_TAGS.map((tag) => {
                  const isSelected = driverComment.includes(tag);

                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() =>
                        toggleTag(tag, driverComment, setDriverComment)
                      }
                      className={`text-[10px] px-2.5 py-1 rounded-full font-medium border transition cursor-pointer active:scale-95 ${
                        isSelected
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-stone-600 border-stone-200 hover:border-blue-400"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>

              <textarea
                rows={3}
                value={driverComment}
                onChange={(e) => setDriverComment(e.target.value)}
                placeholder="Nhập thêm lời nhắn gửi tài xế..."
                className="w-full text-xs p-2.5 bg-white border border-stone-200 rounded-xl focus:ring-2 focus:ring-blue-400 outline-none resize-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setReviewOrder(null)}
                className="w-1/3 py-3 border border-stone-200 rounded-2xl text-xs font-bold text-stone-600 hover:bg-stone-50 active:scale-95 transition cursor-pointer"
              >
                Hủy bỏ
              </button>

              <button
                type="button"
                disabled={submittingReview}
                onClick={handleSubmitReview}
                className="w-2/3 py-3 bg-[#ee4d2d] hover:bg-orange-600 text-white rounded-2xl text-xs font-bold shadow-md shadow-orange-500/20 disabled:opacity-50 active:scale-95 transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                {submittingReview ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Đang gửi...</span>
                  </>
                ) : (
                  <span>Gửi đánh giá</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
