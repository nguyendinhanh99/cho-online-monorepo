"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@cho-online/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
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
}

export interface Order {
  id: string;
  createdAt: any;
  items: OrderItem[];
  subtotalPrice?: number;
  discountAmount?: number;
  shippingFee?: number;
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
  address: string;
  phone: string;
  customerName?: string;
  paymentMethod?: string;
  merchantId?: string;
  merchantCode?: string;
  shopName?: string;
  storeName?: string;
  distanceKm?: number;
  isReviewed?: boolean;
  driverName?: string;
  driverId?: string;
  cancelReason?: string;
  cancelledBy?: string;
  cancelledAt?: any;
  refundedAt?: any;
  paymentCode?: string;
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

export default function OrdersPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "all" | "unpaid" | "processing" | "completed" | "cancelled"
  >("all");

  // TOAST NOTIFICATION UI
  const [toast, setToast] = useState<ToastState>({
    show: false,
    type: "info",
    message: "",
  });

  const showToast = (
    message: string,
    type: "success" | "error" | "warning" | "info" = "info"
  ) => {
    setToast({ show: true, type, message });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, 3500);
  };

  // States quản lý Modal Hủy Đơn
  const [cancelOrderTarget, setCancelOrderTarget] = useState<Order | null>(
    null
  );
  const [selectedCancelReason, setSelectedCancelReason] = useState<string>(
    CANCEL_REASONS[0]
  );
  const [customCancelReason, setCustomCancelReason] = useState<string>("");
  const [cancelling, setCancelling] = useState<boolean>(false);

  // States quản lý Modal Đánh Giá
  const [reviewOrder, setReviewOrder] = useState<Order | null>(null);
  const [productRating, setProductRating] = useState<number>(5);
  const [driverRating, setDriverRating] = useState<number>(5);
  const [productComment, setProductComment] = useState<string>("");
  const [driverComment, setDriverComment] = useState<string>("");
  const [submittingReview, setSubmittingReview] = useState<boolean>(false);

  const addItemToCart = useCartStore((state) => state.addItem);

  useEffect(() => {
    let unsubscribeSnapshot: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        setUser(null);
        setOrders([]);
        setLoading(false);
        return;
      }

      setUser(currentUser);

      const ordersRef = collection(db, "orders");
      const q = query(ordersRef, where("userId", "==", currentUser.uid));

      unsubscribeSnapshot = onSnapshot(
        q,
        (snapshot) => {
          const fetchedOrders: Order[] = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          })) as Order[];

          fetchedOrders.sort((a, b) => {
            const getTime = (val: any) => {
              if (!val) return 0;
              if (typeof val === "string") return new Date(val).getTime();
              if (val.seconds) return val.seconds * 1000;
              if (val instanceof Date) return val.getTime();
              return 0;
            };
            return getTime(b.createdAt) - getTime(a.createdAt);
          });

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
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount || 0);
  };

  const formatTime = (createdAt: any) => {
    if (!createdAt) return "Vừa xong";
    try {
      let dateObj: Date;
      if (typeof createdAt === "string") {
        dateObj = new Date(createdAt);
      } else if (createdAt.seconds) {
        dateObj = new Date(createdAt.seconds * 1000);
      } else {
        dateObj = new Date(createdAt);
      }

      return dateObj.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Vừa xong";
    }
  };

  const getStepIndex = (status: string) => {
    const st = (status || "").toLowerCase();
    if (st === "pending_payment" || st === "pending") return 0;
    if (st === "accepted") return 1;
    if (st === "preparing" || st === "processing") return 2;
    if (st === "finding_driver" || st === "delivering" || st === "shipping")
      return 3;
    if (st === "completed") return 4;
    return -1;
  };

  // Kiểm tra đơn hàng có thể hủy không
  const canCancelOrder = (status: string) => {
    const st = (status || "").toLowerCase();
    return st === "pending_payment" || st === "pending" || st === "accepted";
  };

  // XỬ LÝ HỦY ĐƠN HÀNG TRÊN FIRESTORE
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
        ? customCancelReason || "Hủy theo yêu cầu của khách hàng"
        : selectedCancelReason;

    setCancelling(true);
    try {
      const orderRef = doc(db, "orders", cancelOrderTarget.id);
      await updateDoc(orderRef, {
        status: "cancelled",
        cancelReason: finalReason,
        cancelledBy: "Khách hàng",
        cancelledAt: serverTimestamp(),
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
    setCommentFn: (val: string) => void
  ) => {
    if (currentComment.includes(tag)) {
      setCommentFn(
        currentComment.replace(tag, "").replace(/\s+/g, " ").trim()
      );
    } else {
      setCommentFn(currentComment ? `${currentComment}, ${tag}` : tag);
    }
  };

  const handleSubmitReview = async () => {
    if (!reviewOrder || !user) return;
    setSubmittingReview(true);

    try {
      const reviewData = {
        orderId: reviewOrder.id || "",
        userId: user.uid,
        userName: user.displayName || reviewOrder.customerName || "Khách hàng",
        productRating: Number(productRating) || 5,
        productComment: productComment || "",
        driverRating: Number(driverRating) || 5,
        driverComment: driverComment || "",
        merchantCode: reviewOrder.merchantCode ?? null,
        driverId: reviewOrder.driverId ?? null,
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, "reviews"), reviewData);

      const orderRef = doc(db, "orders", reviewOrder.id);
      await updateDoc(orderRef, {
        isReviewed: true,
        reviewInfo: {
          productRating,
          driverRating,
          productComment,
          driverComment,
          reviewedAt: new Date().toISOString(),
        },
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

  const resetReviewForm = () => {
    setProductRating(5);
    setDriverRating(5);
    setProductComment("");
    setDriverComment("");
  };

  // BỘ LỌC ĐƠN HÀNG THEO TAB
  const filteredOrders = orders.filter((order) => {
    const st = (order.status || "").toLowerCase();
    if (activeTab === "unpaid") return st === "pending_payment";
    if (activeTab === "processing")
      return [
        "pending",
        "accepted",
        "preparing",
        "finding_driver",
        "delivering",
      ].includes(st);
    if (activeTab === "completed") return st === "completed";
    if (activeTab === "cancelled")
      return st === "cancelled" || st === "refunded";
    return true; // "all"
  });

  const unpaidCount = orders.filter(
    (o) => (o.status || "").toLowerCase() === "pending_payment"
  ).length;

  if (loading) {
    return (
      <div className="p-8 text-center space-y-3 max-w-lg mx-auto my-12">
        <div className="w-8 h-8 border-4 border-[#ee4d2d] border-t-transparent rounded-full animate-spin mx-auto"></div>
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
          className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:opacity-90 text-white font-bold py-3.5 px-6 rounded-2xl shadow-md text-xs uppercase tracking-wider active:scale-98 transition cursor-pointer"
        >
          Đăng nhập ngay
        </button>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-5 space-y-4 pb-20 max-w-2xl mx-auto font-sans relative">
      {/* TOAST NOTIFICATION FLOATING UI */}
      {toast.show && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-md animate-in fade-in slide-in-from-top-4 duration-300">
          <div
            className={`p-3.5 rounded-2xl shadow-2xl backdrop-blur-md flex items-center justify-between text-xs font-bold text-white transition-all ${
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
              <span className="text-base">
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
              onClick={() => setToast((p) => ({ ...p, show: false }))}
              className="text-white/80 hover:text-white text-sm px-1.5"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* HEADER PAGE */}
      <div className="flex items-center justify-between border-b border-stone-200/60 pb-3">
        <div>
          <h2 className="text-lg font-black text-stone-900 tracking-tight">
            Đơn hàng của tôi
          </h2>
          <p className="text-[11px] text-stone-400 font-medium">
            Theo dõi lịch sử & Quản lý thanh toán
          </p>
        </div>
        <span className="text-xs bg-orange-50 text-[#ee4d2d] font-black px-3 py-1 rounded-full border border-orange-200">
          {orders.length} đơn hàng
        </span>
      </div>

      {/* THANH TAB PHÂN LOẠI TRẠNG THÁI */}
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
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-3.5 py-2 rounded-2xl whitespace-nowrap transition active:scale-95 cursor-pointer flex items-center gap-1.5 ${
                isActive
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-white text-stone-600 border border-stone-200 hover:bg-stone-50"
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
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

      {/* DANH SÁCH ĐƠN HÀNG */}
      {filteredOrders.length === 0 ? (
        <div className="p-8 text-center space-y-3 bg-white rounded-3xl border border-stone-100 my-4 shadow-xs">
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
            const currentStepIndex = getStepIndex(order.status);
            const isCompleted = statusLower === "completed";
            const cancellable = canCancelOrder(order.status);

            const calculatedSubtotal = order.items?.reduce((acc, item) => {
              if (typeof item === "string") return acc;
              const price = item.price || 0;
              return acc + price * (item.quantity || 1);
            }, 0);

            const displaySubtotal =
              order.subtotalPrice || calculatedSubtotal || 0;
            const displayShopName = order.shopName || order.storeName;

            // ✅ LOẠI BỎ PHÍ SHIP: Mặc định bằng 0
            const actualShippingFee = 0;
            
            // ✅ TÍNH THÀNH TIỀN: Tiền món - Voucher
            const finalTotal = Math.max(
              0,
              displaySubtotal - (order.discountAmount || 0)
            );

            return (
              <div
                key={order.id}
                className={`bg-white rounded-3xl border transition overflow-hidden shadow-xs ${
                  isUnpaid
                    ? "border-red-300 ring-2 ring-red-100 shadow-md"
                    : "border-stone-200/90 hover:shadow-md"
                }`}
              >
                {/* 🚨 BANNER THÔNG BÁO CHO ĐƠN CHƯA THANH TOÁN */}
                {isUnpaid && (
                  <div className="bg-gradient-to-r from-red-500 via-orange-500 to-amber-500 text-white px-4 py-2.5 flex items-center justify-between text-xs font-bold animate-pulse">
                    <span className="flex items-center gap-1.5">
                      <span>⚡</span> Đơn hàng chưa thanh toán!
                    </span>
                    <button
                      onClick={() =>
                        router.push(`/orders/${order.id}/payment`)
                      }
                      className="bg-white text-red-600 px-3 py-1 rounded-xl font-extrabold hover:bg-red-50 transition cursor-pointer shadow-xs text-[11px] active:scale-95"
                    >
                      Thanh toán ngay →
                    </button>
                  </div>
                )}

                {/* Header Card */}
                <div className="bg-stone-50/80 px-4 py-3 border-b border-stone-100 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      {displayShopName && (
                        <span className="text-xs font-black bg-amber-100/80 text-amber-900 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                          🏪 {displayShopName}
                        </span>
                      )}
                      <span className="text-xs font-black text-stone-800 bg-stone-200/80 px-2 py-0.5 rounded-md font-mono">
                        #{order.id.slice(0, 8).toUpperCase()}
                      </span>
                      <span className="text-[11px] text-stone-400 font-medium">
                        ⏱ {formatTime(order.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* CỘT HIỂN THỊ TRẠNG THÁI */}
                  {isUnpaid ? (
                    <span className="bg-red-100 text-red-700 font-black text-[11px] px-3 py-1 rounded-full border border-red-200 flex items-center gap-1">
                      💳 Chưa thanh toán
                    </span>
                  ) : isRefunded ? (
                    <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1">
                      💸 Đã hoàn tiền
                    </span>
                  ) : isCancelled ? (
                    <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold px-3 py-1 rounded-full">
                      ❌ Đã hủy
                    </span>
                  ) : (
                    <span className="bg-orange-50 text-[#ee4d2d] border border-orange-200 text-[11px] font-bold px-3 py-1 rounded-full">
                      {ORDER_STEPS[currentStepIndex]?.label || "Đang xử lý"}
                    </span>
                  )}
                </div>

                {/* Tiến trình giao hàng / Chi tiết Đơn Hủy */}
                {!isCancelled && !isUnpaid ? (
                  <div className="px-4 py-5 bg-white border-b border-stone-50">
                    <div className="relative flex items-center justify-between w-full">
                      <div className="absolute top-3.5 left-0 w-full h-1 bg-stone-100 -translate-y-1/2 -z-0 rounded-full"></div>

                      <div
                        className="absolute top-3.5 left-0 h-1 bg-gradient-to-r from-orange-400 to-[#ee4d2d] -translate-y-1/2 transition-all duration-500 -z-0 rounded-full"
                        style={{
                          width: `${
                            (Math.max(0, currentStepIndex) /
                              (ORDER_STEPS.length - 1)) *
                            100
                          }%`,
                        }}
                      ></div>

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
                              className={`text-[10px] mt-2 font-bold text-center leading-tight transition-colors ${
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
                    <div className="flex items-center justify-between font-bold">
                      <span className="flex items-center gap-1.5 text-rose-700">
                        {isRefunded
                          ? "💸 Đơn hàng đã hủy & Hoàn tiền thành công"
                          : "🚫 Đơn hàng đã bị hủy"}
                      </span>
                      {order.cancelledAt && (
                        <span className="text-[10px] text-rose-500 font-normal">
                          Thời gian: {formatTime(order.cancelledAt)}
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

                {/* Danh sách món ăn */}
                <div className="p-4 space-y-3">
                  <div className="space-y-2.5">
                    {order.items && order.items.length > 0 ? (
                      order.items.map((item, idx) => {
                        if (typeof item === "string") {
                          return (
                            <div
                              key={idx}
                              className="text-xs text-stone-700 font-medium"
                            >
                              • {item}
                            </div>
                          );
                        }

                        return (
                          <div key={idx} className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-stone-100 border border-stone-200/80 overflow-hidden flex-shrink-0 flex items-center justify-center text-lg">
                              {item.imageUrl || item.image ? (
                                <img
                                  src={item.imageUrl || item.image}
                                  alt={item.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                "🍲"
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <h4 className="text-xs font-bold text-stone-800 truncate">
                                {item.name}
                              </h4>
                              {item.note && (
                                <p className="text-[10px] text-amber-600 font-medium italic truncate">
                                  Ghi chú: {item.note}
                                </p>
                              )}
                              <div className="text-[11px] text-stone-500 font-medium mt-0.5">
                                Số lượng:{" "}
                                <strong className="text-stone-900">
                                  x{item.quantity}
                                </strong>
                              </div>
                            </div>

                            <div className="text-right flex-shrink-0">
                              <div className="text-xs font-extrabold text-stone-900">
                                {formatCurrency(item.price * item.quantity)}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-xs text-stone-400 italic">
                        Đang cập nhật chi tiết món...
                      </div>
                    )}
                  </div>

                  {/* BẢNG CHI TIẾT THANH TOÁN */}
                  <div className="bg-stone-50 rounded-2xl p-3 border border-stone-100 space-y-1.5 text-[11px] mt-3">
                    <div className="flex justify-between text-stone-500">
                      <span>Tổng tiền món:</span>
                      <span className="font-semibold text-stone-700">
                        {formatCurrency(displaySubtotal)}
                      </span>
                    </div>

                    {(order.discountAmount ?? 0) > 0 && (
                      <div className="flex justify-between text-emerald-600 font-medium">
                        <span>Giảm giá Voucher:</span>
                        <span>-{formatCurrency(order.discountAmount!)}</span>
                      </div>
                    )}

                    <div className="border-t border-dashed border-stone-200 pt-1.5 my-1">
                      <div className="flex justify-between text-stone-600 font-semibold">
                        <span className="flex items-center gap-1">
                          🛵 Phí vận chuyển:
                        </span>
                        <span>{formatCurrency(actualShippingFee)}</span>
                      </div>
                    </div>

                    <div className="border-t border-stone-200/60 pt-2 mt-1 flex justify-between items-center text-xs">
                      <span className="font-bold text-stone-800">
                        Thành tiền:
                      </span>
                      <span className="text-base font-black text-[#ee4d2d]">
                        {formatCurrency(finalTotal)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer Card: Nút Thanh toán, Hủy đơn, Đánh giá & Đặt lại */}
                <div className="bg-stone-50 px-4 py-3 border-t border-stone-100 flex items-center justify-between gap-2 flex-wrap">
                  <div className="text-[10px] text-stone-400 font-medium">
                    {order.paymentMethod
                      ? `Thanh toán: ${order.paymentMethod}`
                      : "Chuyển khoản Ngân hàng"}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* ⚡ NÚT THANH TOÁN NGAY CHO ĐƠN CHƯA THANH TOÁN */}
                    {isUnpaid && (
                      <button
                        type="button"
                        onClick={() =>
                          router.push(`/orders/${order.id}/payment`)
                        }
                        className="bg-gradient-to-r from-red-600 to-orange-500 hover:opacity-90 text-white font-extrabold px-4 py-2 rounded-xl text-xs transition active:scale-95 cursor-pointer shadow-md shadow-red-500/20 flex items-center gap-1"
                      >
                        💳 Thanh toán ngay
                      </button>
                    )}

                    {/* Nút HỦY ĐƠN HÀNG */}
                    {!isCancelled && cancellable && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCancelReason(CANCEL_REASONS[0]);
                          setCustomCancelReason("");
                          setCancelOrderTarget(order);
                        }}
                        className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold px-3 py-1.5 rounded-xl text-xs transition active:scale-95 cursor-pointer flex items-center gap-1"
                      >
                        🚫 Hủy đơn
                      </button>
                    )}

                    {/* Nút Đánh Giá khi nhận hàng thành công */}
                    {isCompleted &&
                      (order.isReviewed ? (
                        <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-1">
                          ✓ Đã đánh giá
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            resetReviewForm();
                            setReviewOrder(order);
                          }}
                          className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-3.5 py-1.5 rounded-xl text-xs transition active:scale-95 cursor-pointer shadow-xs flex items-center gap-1"
                        >
                          ⭐ Đánh giá ngay
                        </button>
                      ))}

                    {/* Nút ĐẶT LẠI */}
                    <button
                      type="button"
                      onClick={() => {
                        if (!order.items || order.items.length === 0) return;

                        order.items.forEach((item) => {
                          const isString = typeof item === "string";
                          addItemToCart({
                            id: isString ? `reorder-${Date.now()}` : item.id,
                            name: isString ? item : item.name,
                            price: isString ? 0 : item.price || 0,
                            unit: "món",
                            category: "fruit",
                            imageUrl: isString
                              ? ""
                              : item.imageUrl || item.image || "",
                            isAvailable: true,
                            merchantId: isString
                              ? order.merchantId || ""
                              : item.merchantId || order.merchantId || "",
                            merchantCode: isString
                              ? order.merchantCode || ""
                              : item.merchantCode || order.merchantCode || "",
                          } as any);
                        });
                        showToast("🎉 Đã thêm tất cả món vào giỏ hàng!", "success");
                      }}
                      className="bg-white border border-stone-300 hover:border-orange-300 text-stone-700 font-bold px-3 py-1.5 rounded-xl text-xs transition active:scale-95 cursor-pointer shadow-2xs hover:text-[#ee4d2d] flex items-center gap-1.5"
                    >
                      <span>🔄</span> Đặt lại
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL XÁC NHẬN HỦY ĐƠN HÀNG UI CẢI TIẾN */}
      {cancelOrderTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
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
                    #{cancelOrderTarget.id.slice(0, 8).toUpperCase()}
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
                  rows={2}
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
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
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

      {/* MODAL ĐÁNH GIÁ (SẢN PHẨM & TÀI XẾ) */}
      {reviewOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-base font-black text-stone-900">
                  Đánh giá đơn hàng #{reviewOrder.id.slice(0, 8).toUpperCase()}
                </h3>
                <p className="text-[11px] text-stone-400">
                  Ý kiến của bạn giúp sàn nâng cao chất lượng dịch vụ
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

            {/* SECTION 1: ĐÁNH GIÁ SẢN PHẨM / QUÁN */}
            <div className="space-y-3 bg-orange-50/50 p-4 rounded-2xl border border-orange-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-800 flex items-center gap-1">
                  🍲 Chất lượng món ăn & Sản phẩm
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

              <div className="flex flex-wrap gap-1.5 pt-1">
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
                          ? "bg-amber-500 text-white border-amber-500 shadow-2xs"
                          : "bg-white text-stone-600 border-stone-200 hover:border-amber-400"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>

              <textarea
                rows={2}
                value={productComment}
                onChange={(e) => setProductComment(e.target.value)}
                placeholder="Nhập thêm chia sẻ về món ăn..."
                className="w-full text-xs p-2.5 bg-white border border-stone-200 rounded-xl focus:ring-2 focus:ring-orange-400 outline-none resize-none"
              />
            </div>

            {/* SECTION 2: ĐÁNH GIÁ TÀI XẾ */}
            <div className="space-y-3 bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-800 flex items-center gap-1">
                  🛵 Dịch vụ giao hàng (Tài xế{" "}
                  {reviewOrder.driverName || "Shipper"})
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

              <div className="flex flex-wrap gap-1.5 pt-1">
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
                          ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                          : "bg-white text-stone-600 border-stone-200 hover:border-blue-400"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>

              <textarea
                rows={2}
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
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Đang gửi...</span>
                  </>
                ) : (
                  <span>Gửi Đánh Giá</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}