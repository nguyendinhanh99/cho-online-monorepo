"use client";

import { useState, useMemo, useEffect } from "react";
import {
  db,
  auth,
} from "@cho-online/firebase";
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  query,
  orderBy,
  where,
  getDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export interface OrderItem {
  id?: string;
  name: string;
  quantity: number;
  price?: number;
  originalPrice?: number;
  note?: string;
  image?: string;
  imageUrl?: string;
}

export interface ReviewInfo {
  productRating?: number;
  productComment?: string;
  driverRating?: number;
  driverComment?: string;
  reviewedAt?: string;
}

export interface Order {
  id: string;

  // =========================
  // CUSTOMER
  // =========================
  customerName: string;
  phone: string;
  address: string;
  note?: string;

  // =========================
  // ITEMS
  // =========================
  items: (string | OrderItem)[];

  // =========================
  // MONEY
  // =========================
  //
  // subtotalPrice = tiền món thực tế
  // shippingFee = phí giao hàng của khách
  // totalPrice = tổng toàn đơn bao gồm ship
  //
  // Trang QUÁN không hiển thị shippingFee
  // và không dùng totalPrice làm tổng tiền món.
  //

  subtotalPrice?: number;
  discountAmount?: number;
  shippingFee?: number;
  totalPrice: number;

  // =========================
  // PAYMENT
  // =========================
  paymentMethod?: string;

  // =========================
  // STATUS
  // =========================
  status: string;

  // =========================
  // TIME
  // =========================
  createdAt: string;

  // =========================
  // MERCHANT
  // =========================
  merchantCode?: string;
  storeName?: string;
  shopName?: string;

  // =========================
  // REVIEW
  // =========================
  reviewInfo?: ReviewInfo;

  // =========================
  // CANCEL
  // =========================
  cancelReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  refundedAt?: string;
}

interface OrdersTabProps {
  formatCurrency?: (amount: number) => string;
}

type FilterStatus =
  | "all"
  | "pending"
  | "accepted"
  | "preparing"
  | "ready_for_pickup"
  | "delivering"
  | "completed"
  | "cancelled";

// =========================================================
// ORDER STEPS
// =========================================================

const ORDER_STEPS = [
  {
    key: "pending",
    label: "Chờ xác nhận",
  },
  {
    key: "accepted",
    label: "Shop đã nhận",
  },
  {
    key: "preparing",
    label: "Đang làm",
  },
  {
    key: "ready_for_pickup",
    label: "Chờ lấy món",
  },
  {
    key: "delivering",
    label: "Đang giao",
  },
  {
    key: "completed",
    label: "Hoàn thành",
  },
];

// =========================================================
// CANCEL REASONS
// =========================================================

const CANCEL_REASONS = [
  "Quán hết món / tạm ngừng phục vụ",
  "Quán quá tải, không thể làm kịp",
  "Khách hàng yêu cầu hủy đơn",
  "Không thể liên hệ với khách hàng",
  "Lý do khác",
];

// =========================================================
// MASK PHONE
// =========================================================

const maskPhoneNumber = (phone: string): string => {
  if (!phone) return "N/A";

  const cleanPhone = phone.trim();

  if (cleanPhone.length < 6) {
    return cleanPhone;
  }

  const start = cleanPhone.slice(0, 3);
  const end = cleanPhone.slice(-3);

  return `${start}...${end}`;
};

// =========================================================
// COMPONENT
// =========================================================

export default function OrdersTab({
  formatCurrency = (amount) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount || 0),
}: OrdersTabProps) {
  // =========================================================
  // STATE
  // =========================================================

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] =
    useState<FilterStatus>("all");

  const [searchQuery, setSearchQuery] =
    useState("");

  const [updatingId, setUpdatingId] =
    useState<string | null>(null);

  const [merchantNotFound, setMerchantNotFound] =
    useState(false);

  const [reviewsMap, setReviewsMap] =
    useState<Record<string, ReviewInfo>>({});

  const [
    cancelModalOrder,
    setCancelModalOrder,
  ] = useState<Order | null>(null);

  const [customReason, setCustomReason] =
    useState("");

  const [
    selectedReason,
    setSelectedReason,
  ] = useState(CANCEL_REASONS[0]);

  // =========================================================
  // FIRESTORE
  // =========================================================

  useEffect(() => {
    let unsubscribeOrders:
      | (() => void)
      | null = null;

    let unsubscribeReviews:
      | (() => void)
      | null = null;

    const unsubscribeAuth =
      onAuthStateChanged(
        auth,
        async (user) => {
          if (!user) {
            setOrders([]);
            setLoading(false);

            if (unsubscribeOrders) {
              unsubscribeOrders();
            }

            if (unsubscribeReviews) {
              unsubscribeReviews();
            }

            return;
          }

          try {
            setMerchantNotFound(false);

            let merchantCode:
              | string
              | null = null;

            // =================================================
            // FIND MERCHANT
            // =================================================

            const merchantDoc = await getDoc(
              doc(db, "merchants", user.uid)
            );

            if (merchantDoc.exists()) {
              merchantCode =
                merchantDoc.data()?.merchantCode ||
                user.uid;
            } else {
              const userDoc = await getDoc(
                doc(db, "users", user.uid)
              );

              if (userDoc.exists()) {
                merchantCode =
                  userDoc.data()?.merchantCode ||
                  user.uid;
              } else {
                merchantCode = user.uid;
              }
            }

            if (!merchantCode) {
              console.warn(
                "Không tìm thấy thông tin cửa hàng cho tài khoản này."
              );

              setMerchantNotFound(true);
              setLoading(false);
              return;
            }

            // =================================================
            // REVIEWS
            // =================================================

            const reviewsQuery = query(
              collection(db, "reviews"),
              where(
                "merchantCode",
                "==",
                merchantCode
              )
            );

            unsubscribeReviews =
              onSnapshot(
                reviewsQuery,
                (snapshot) => {
                  const rMap: Record<
                    string,
                    ReviewInfo
                  > = {};

                  snapshot.docs.forEach(
                    (docSnap) => {
                      const data =
                        docSnap.data();

                      const orderId =
                        data.orderId ||
                        data.orderCode ||
                        docSnap.id;

                      const rev =
                        data.reviewInfo ||
                        data;

                      if (orderId) {
                        rMap[orderId] = {
                          productRating: Number(
                            rev.productRating ||
                            rev.rating ||
                            5
                          ),

                          productComment:
                            rev.productComment ||
                            rev.comment ||
                            rev.reviewText ||
                            "",

                          driverRating: Number(
                            rev.driverRating ||
                            0
                          ),

                          driverComment:
                            rev.driverComment ||
                            "",

                          reviewedAt:
                            rev.reviewedAt ||
                            rev.createdAt,
                        };
                      }
                    }
                  );

                  setReviewsMap(rMap);
                }
              );

            // =================================================
            // ORDERS
            // =================================================

            const q = query(
              collection(db, "orders"),
              where(
                "merchantCode",
                "==",
                merchantCode
              ),
              orderBy(
                "createdAt",
                "desc"
              )
            );

            unsubscribeOrders =
              onSnapshot(
                q,
                (snapshot) => {
                  const fetchedOrders: Order[] =
                    snapshot.docs
                      .map(
                        (docSnap) => {
                          const data =
                            docSnap.data();

                          // =====================================
                          // REAL SUBTOTAL
                          // =====================================
                          //
                          // Ưu tiên subTotalPrice vì
                          // đây là field đơn hàng thực tế.
                          //

                          const subtotalPrice =
                            Number(
                              data.subTotalPrice ??
                              data.subtotalPrice ??
                              0
                            ) || 0;

                          // =====================================
                          // SHIPPING FEE
                          // =====================================
                          //
                          // Vẫn đọc vào model để dữ liệu đầy đủ,
                          // nhưng KHÔNG HIỂN THỊ ở giao diện quán.
                          //

                          const shippingFee =
                            Number(
                              data.shippingFee ??
                              0
                            ) || 0;

                          // =====================================
                          // TOTAL PRICE
                          // =====================================

                          const totalPrice =
                            Number(
                              data.totalPrice ??
                              0
                            ) || 0;

                          return {
                            id: docSnap.id,

                            customerName:
                              data.customerName ||
                              data.recipientName ||
                              "Khách hàng",

                            phone:
                              data.phone ||
                              data.customerPhone ||
                              "N/A",

                            address:
                              data.address ||
                              data.customerAddress ||
                              "N/A",

                            note:
                              data.note || "",

                            items:
                              data.items || [],

                            subtotalPrice,

                            discountAmount:
                              Number(
                                data.discountAmount ??
                                0
                              ) || 0,

                            shippingFee,

                            totalPrice,

                            paymentMethod:
                              data.paymentMethod ||
                              "COD",

                            status:
                              data.status
                                ? String(
                                  data.status
                                ).toLowerCase()
                                : "pending",

                            createdAt:
                              data.createdAt
                                ? typeof data.createdAt ===
                                  "string"
                                  ? data.createdAt
                                  : new Date(
                                    data.createdAt.seconds *
                                    1000
                                  ).toLocaleString(
                                    "vi-VN"
                                  )
                                : "Vừa xong",

                            merchantCode:
                              data.merchantCode,

                            shopName:
                              data.shopName ||
                              data.storeName,

                            cancelReason:
                              data.cancelReason ||
                              "",

                            cancelledBy:
                              data.cancelledBy ||
                              "",

                            cancelledAt:
                              data.cancelledAt
                                ? typeof data.cancelledAt ===
                                  "string"
                                  ? data.cancelledAt
                                  : new Date(
                                    data.cancelledAt.seconds *
                                    1000
                                  ).toLocaleString(
                                    "vi-VN"
                                  )
                                : undefined,

                            refundedAt:
                              data.refundedAt
                                ? typeof data.refundedAt ===
                                  "string"
                                  ? data.refundedAt
                                  : new Date(
                                    data.refundedAt.seconds *
                                    1000
                                  ).toLocaleString(
                                    "vi-VN"
                                  )
                                : undefined,

                            reviewInfo:
                              data.reviewInfo
                                ? {
                                  productRating:
                                    Number(
                                      data
                                        .reviewInfo
                                        .productRating ||
                                      5
                                    ),

                                  productComment:
                                    data
                                      .reviewInfo
                                      .productComment ||
                                    "",

                                  driverRating:
                                    Number(
                                      data
                                        .reviewInfo
                                        .driverRating ||
                                      0
                                    ),

                                  driverComment:
                                    data
                                      .reviewInfo
                                      .driverComment ||
                                    "",

                                  reviewedAt:
                                    data
                                      .reviewInfo
                                      .reviewedAt
                                      ? new Date(
                                        data
                                          .reviewInfo
                                          .reviewedAt
                                      ).toLocaleString(
                                        "vi-VN"
                                      )
                                      : undefined,
                                }
                                : undefined,
                          };
                        }
                      )
                      .filter(
                        (ord) =>
                          ord.status !==
                          "pending_payment" &&
                          ord.status !== "unpaid"
                      );

                  setOrders(
                    fetchedOrders
                  );

                  setLoading(false);
                },
                (error) => {
                  console.error(
                    "Lỗi lấy danh sách đơn hàng:",
                    error
                  );

                  setLoading(false);
                }
              );
          } catch (err) {
            console.error(
              "Lỗi lấy thông tin merchant:",
              err
            );

            setLoading(false);
          }
        }
      );

    return () => {
      unsubscribeAuth();

      if (unsubscribeOrders) {
        unsubscribeOrders();
      }

      if (unsubscribeReviews) {
        unsubscribeReviews();
      }
    };
  }, []);

  // =========================================================
  // UPDATE STATUS
  // =========================================================

  const handleUpdateStatus = async (
    id: string,
    newStatus: string
  ) => {
    try {
      setUpdatingId(id);

      const orderRef = doc(
        db,
        "orders",
        id
      );

      await updateDoc(orderRef, {
        status: newStatus,
        updatedAt:
          new Date().toISOString(),
      });
    } catch (error) {
      console.error(
        "Lỗi cập nhật trạng thái:",
        error
      );

      alert(
        "Cập nhật thất bại, vui lòng thử lại!"
      );
    } finally {
      setUpdatingId(null);
    }
  };

  // =========================================================
  // CANCEL ORDER
  // =========================================================

  const handleConfirmCancel = async () => {
    if (!cancelModalOrder) {
      return;
    }

    const finalReason =
      selectedReason === "Lý do khác"
        ? customReason
        : selectedReason;

    if (!finalReason.trim()) {
      alert(
        "Vui lòng nhập lý do hủy đơn!"
      );
      return;
    }

    try {
      setUpdatingId(
        cancelModalOrder.id
      );

      const orderRef = doc(
        db,
        "orders",
        cancelModalOrder.id
      );

      await updateDoc(orderRef, {
        status: "cancelled",
        cancelReason: finalReason,
        cancelledBy: "Quán ăn",
        cancelledAt:
          new Date().toISOString(),
      });

      setCancelModalOrder(null);
      setCustomReason("");
      setSelectedReason(
        CANCEL_REASONS[0]
      );
    } catch (error) {
      console.error(
        "Lỗi khi hủy đơn hàng:",
        error
      );

      alert(
        "Không thể hủy đơn hàng, vui lòng thử lại!"
      );
    } finally {
      setUpdatingId(null);
    }
  };

  // =========================================================
  // STEP INDEX
  // =========================================================

  const getStepIndex = (
    status: string
  ) => {
    const st =
      (status || "").toLowerCase();

    if (st === "pending") {
      return 0;
    }

    if (st === "accepted") {
      return 1;
    }

    if (
      st === "preparing" ||
      st === "processing"
    ) {
      return 2;
    }

    if (
      st === "ready_for_pickup" ||
      st === "ready"
    ) {
      return 3;
    }

    if (
      st === "finding_driver" ||
      st === "delivering" ||
      st === "shipping" ||
      st === "picking_up"
    ) {
      return 4;
    }

    if (st === "completed") {
      return 5;
    }

    return -1;
  };

  // =========================================================
  // COUNTS
  // =========================================================

  const counts = useMemo(() => {
    return {
      all: orders.length,

      pending: orders.filter(
        (o) =>
          (o.status || "").toLowerCase() ===
          "pending"
      ).length,

      accepted: orders.filter(
        (o) =>
          (o.status || "").toLowerCase() ===
          "accepted"
      ).length,

      preparing: orders.filter((o) => {
        const st =
          (o.status || "").toLowerCase();

        return (
          st === "preparing" ||
          st === "processing"
        );
      }).length,

      ready_for_pickup:
        orders.filter((o) => {
          const st =
            (o.status || "").toLowerCase();

          return (
            st ===
            "ready_for_pickup" ||
            st === "ready"
          );
        }).length,

      delivering: orders.filter((o) => {
        const st =
          (o.status || "").toLowerCase();

        return [
          "delivering",
          "finding_driver",
          "shipping",
          "picking_up",
        ].includes(st);
      }).length,

      completed: orders.filter(
        (o) =>
          (o.status || "").toLowerCase() ===
          "completed"
      ).length,

      cancelled: orders.filter((o) => {
        const st =
          (o.status || "").toLowerCase();

        return (
          st === "cancelled" ||
          st === "refunded"
        );
      }).length,
    };
  }, [orders]);

  // =========================================================
  // FILTER ORDERS
  // =========================================================

  const filteredOrders = useMemo(() => {
    return orders.filter((ord) => {
      const st =
        (ord.status || "").toLowerCase();

      let matchesTab = false;

      if (activeTab === "all") {
        matchesTab = true;
      } else if (
        activeTab === "delivering"
      ) {
        matchesTab =
          st === "delivering" ||
          st === "finding_driver" ||
          st === "shipping" ||
          st === "picking_up";
      } else if (
        activeTab === "preparing"
      ) {
        matchesTab =
          st === "preparing" ||
          st === "processing";
      } else if (
        activeTab ===
        "ready_for_pickup"
      ) {
        matchesTab =
          st ===
          "ready_for_pickup" ||
          st === "ready";
      } else if (
        activeTab === "cancelled"
      ) {
        matchesTab =
          st === "cancelled" ||
          st === "refunded";
      } else {
        matchesTab =
          st === activeTab;
      }

      // ===============================================
      // SEARCH
      // ===============================================

      const queryStr =
        searchQuery
          .toLowerCase()
          .trim();

      const matchesSearch =
        !queryStr ||
        ord.id
          .toLowerCase()
          .includes(queryStr) ||
        ord.customerName
          .toLowerCase()
          .includes(queryStr) ||
        ord.phone
          .includes(queryStr) ||
        ord.address
          .toLowerCase()
          .includes(queryStr);

      return (
        matchesTab &&
        matchesSearch
      );
    });
  }, [
    orders,
    activeTab,
    searchQuery,
  ]);

  // =========================================================
  // STATUS BADGE
  // =========================================================

  const renderStatusBadge = (
    status: string
  ) => {
    const st =
      (status || "").toLowerCase();

    switch (st) {
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 text-[11px] px-2.5 py-0.5 rounded-full font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Chờ xác nhận
          </span>
        );

      case "accepted":
        return (
          <span className="inline-flex items-center gap-1 bg-orange-50 text-[#ee4d2d] border border-orange-200 text-[11px] px-2.5 py-0.5 rounded-full font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ee4d2d]" />
            Shop đã nhận
          </span>
        );

      case "preparing":
      case "processing":
        return (
          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 text-[11px] px-2.5 py-0.5 rounded-full font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            Đang chế biến
          </span>
        );

      case "ready_for_pickup":
      case "ready":
        return (
          <span className="inline-flex items-center gap-1 bg-teal-50 text-teal-700 border border-teal-200 text-[11px] px-2.5 py-0.5 rounded-full font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-ping" />
            Đã xong món - Chờ lấy
          </span>
        );

      case "delivering":
      case "finding_driver":
      case "shipping":
      case "picking_up":
        return (
          <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-200 text-[11px] px-2.5 py-0.5 rounded-full font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
            Đang giao hàng
          </span>
        );

      case "completed":
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] px-2.5 py-0.5 rounded-full font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Hoàn tất
          </span>
        );

      case "cancelled":
      case "refunded":
        return (
          <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200 text-[11px] px-2.5 py-0.5 rounded-full font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />

            {st === "refunded"
              ? "Đã hoàn tiền"
              : "Đã hủy"}
          </span>
        );

      default:
        return (
          <span className="bg-stone-100 text-stone-600 text-[11px] px-2 py-0.5 rounded-full font-bold uppercase">
            {status}
          </span>
        );
    }
  };

  // =========================================================
  // ACTION BUTTONS
  // =========================================================

  const renderActionButtons = (
    ord: Order
  ) => {
    const isUpdating =
      updatingId === ord.id;

    if (isUpdating) {
      return (
        <span className="text-[11px] text-stone-400 font-bold animate-pulse">
          Đang cập nhật...
        </span>
      );
    }

    const currentStatus =
      (ord.status || "")
        .toString()
        .toLowerCase();

    switch (currentStatus) {
      case "pending":
        return (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setCancelModalOrder(ord)
              }
              className="px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs transition active:scale-95 cursor-pointer"
            >
              ❌ Hủy đơn
            </button>

            <button
              type="button"
              onClick={() =>
                handleUpdateStatus(
                  ord.id,
                  "accepted"
                )
              }
              className="px-4 py-1.5 rounded-xl bg-[#ee4d2d] hover:bg-orange-600 text-white font-bold text-xs shadow-sm transition active:scale-95 cursor-pointer flex items-center gap-1"
            >
              <span>✓</span>
              Nhận đơn
            </button>
          </div>
        );

      case "accepted":
        return (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setCancelModalOrder(ord)
              }
              className="px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs transition cursor-pointer"
            >
              ❌ Hủy đơn
            </button>

            <button
              type="button"
              onClick={() =>
                handleUpdateStatus(
                  ord.id,
                  "preparing"
                )
              }
              className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition active:scale-95 cursor-pointer flex items-center gap-1"
            >
              <span>👨‍🍳</span>
              Chế biến món
            </button>
          </div>
        );

      case "preparing":
      case "processing":
        return (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setCancelModalOrder(ord)
              }
              className="px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs transition cursor-pointer"
            >
              ❌ Hủy đơn
            </button>

            <button
              type="button"
              onClick={() =>
                handleUpdateStatus(
                  ord.id,
                  "ready_for_pickup"
                )
              }
              className="px-4 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm transition active:scale-95 cursor-pointer flex items-center gap-1"
            >
              <span>📢</span>
              Đã xong món (Báo shipper)
            </button>
          </div>
        );

      case "ready_for_pickup":
      case "ready":
        return (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-teal-700 font-bold bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200 flex items-center gap-1">
              <span>🔔</span>
              Đã báo Shipper tới lấy món
            </span>

            <button
              type="button"
              onClick={() =>
                handleUpdateStatus(
                  ord.id,
                  "delivering"
                )
              }
              className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-sm transition active:scale-95 cursor-pointer flex items-center gap-1"
            >
              <span>🛵</span>
              Chuyển sang giao hàng
            </button>
          </div>
        );

      case "delivering":
      case "shipping":
      case "finding_driver":
      case "picking_up":
        return (
          <button
            type="button"
            onClick={() =>
              handleUpdateStatus(
                ord.id,
                "completed"
              )
            }
            className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition active:scale-95 cursor-pointer flex items-center gap-1"
          >
            <span>🎉</span>
            Hoàn thành đơn
          </button>
        );

      case "completed":
        return (
          <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
            <span>✓</span>
            Đã hoàn tất thành công
          </span>
        );

      case "cancelled":
      case "refunded":
        return (
          <span className="text-[11px] text-rose-500 font-bold">
            {currentStatus ===
              "refunded"
              ? "Đã hoàn tiền cho khách"
              : "Đơn hàng đã bị hủy"}
          </span>
        );

      default:
        return (
          <button
            type="button"
            onClick={() =>
              handleUpdateStatus(
                ord.id,
                "accepted"
              )
            }
            className="px-4 py-1.5 rounded-xl bg-[#ee4d2d] hover:bg-orange-600 text-white font-bold text-xs shadow-sm transition active:scale-95 cursor-pointer flex items-center gap-1"
          >
            <span>✓</span>
            Nhận đơn
          </button>
        );
    }
  };

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="p-8 text-center space-y-2">
        <div className="w-6 h-6 border-2 border-[#ee4d2d] border-t-transparent rounded-full animate-spin mx-auto" />

        <p className="text-xs text-stone-400 font-bold">
          Đang tải danh sách đơn hàng của cửa hàng...
        </p>
      </div>
    );
  }

  // =========================================================
  // MERCHANT NOT FOUND
  // =========================================================

  if (merchantNotFound) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center space-y-2">
        <div className="text-3xl">
          🏪
        </div>

        <h3 className="font-bold text-amber-800 text-sm">
          Tài khoản chưa khởi tạo cửa hàng
        </h3>

        <p className="text-xs text-amber-600">
          Tài khoản này chưa gắn mã
          `merchantCode`. Vui lòng cập
          nhật thông tin cửa hàng trong
          Firestore.
        </p>
      </div>
    );
  }

  // =========================================================
  // MAIN UI
  // =========================================================

  return (
    <div className="space-y-4 text-xs font-sans relative">
      {/* =====================================================
          HEADER
      ====================================================== */}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-extrabold text-stone-800 uppercase tracking-wide">
            Quản Lý Đơn Hàng Cửa Hàng
          </h2>

          <p className="text-[11px] text-stone-400">
            Xử lý và chuyển đổi trạng thái
            đơn hàng của shop
          </p>
        </div>

        {/* SEARCH */}

        <div className="relative min-w-[240px]">
          <input
            type="text"
            placeholder="Tìm mã đơn, tên, SĐT, địa chỉ..."
            value={searchQuery}
            onChange={(e) =>
              setSearchQuery(
                e.target.value
              )
            }
            className="w-full pl-8 pr-3 py-1.5 border border-stone-300 rounded-xl text-xs bg-white focus:outline-none focus:border-[#ee4d2d] transition"
          />

          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400">
            🔍
          </span>

          {searchQuery && (
            <button
              onClick={() =>
                setSearchQuery("")
              }
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 font-bold text-xs cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* =====================================================
          TABS
      ====================================================== */}

      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-stone-200 scrollbar-none">
        {[
          {
            id: "all",
            label: "Tất cả",
            count: counts.all,
          },
          {
            id: "pending",
            label: "Mới nhận",
            count: counts.pending,
            highlight:
              counts.pending > 0,
          },
          {
            id: "accepted",
            label: "Shop đã nhận",
            count: counts.accepted,
          },
          {
            id: "preparing",
            label: "Đang làm",
            count: counts.preparing,
          },
          {
            id: "ready_for_pickup",
            label: "Chờ lấy món 🛍️",
            count:
              counts.ready_for_pickup,
          },
          {
            id: "delivering",
            label: "Đang giao 🛵",
            count: counts.delivering,
          },
          {
            id: "completed",
            label: "Hoàn tất",
            count: counts.completed,
          },
          {
            id: "cancelled",
            label: "Đã hủy / Hoàn tiền",
            count: counts.cancelled,
          },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() =>
              setActiveTab(
                tab.id as FilterStatus
              )
            }
            className={`whitespace-nowrap px-3 py-2 rounded-t-lg font-bold transition flex items-center gap-1.5 cursor-pointer relative ${activeTab === tab.id
                ? "text-[#ee4d2d] border-b-2 border-[#ee4d2d] bg-orange-50/50"
                : "text-stone-500 hover:text-stone-800 hover:bg-stone-50"
              }`}
          >
            {tab.label}

            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-medium ${tab.highlight
                  ? "bg-[#ee4d2d] text-white font-bold"
                  : activeTab ===
                    tab.id
                    ? "bg-orange-100 text-[#ee4d2d]"
                    : "bg-stone-100 text-stone-600"
                }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* =====================================================
          EMPTY STATE
      ====================================================== */}

      {filteredOrders.length ===
        0 ? (
        <div className="bg-white border border-dashed border-stone-300 rounded-2xl p-8 text-center space-y-2">
          <div className="text-4xl">
            📦
          </div>

          <h3 className="font-bold text-stone-700 text-xs">
            Chưa có đơn hàng nào
          </h3>

          <p className="text-[11px] text-stone-400">
            {searchQuery
              ? "Không tìm thấy kết quả từ khóa tìm kiếm."
              : "Đơn hàng mới thuộc về cửa hàng của bạn sẽ hiển thị ở đây."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map(
            (ord) => {
              // =============================================
              // STATUS
              // =============================================

              const currentStepIndex =
                getStepIndex(
                  ord.status
                );

              const isCancelled =
                [
                  "cancelled",
                  "refunded",
                ].includes(
                  (
                    ord.status || ""
                  ).toLowerCase()
                );

              // =============================================
              // REVIEW
              // =============================================

              const review =
                ord.reviewInfo ||
                reviewsMap[ord.id];

              // =============================================
              // SUBTOTAL
              // =============================================
              //
              // ƯU TIÊN giá trị từ Firestore.
              //
              // Không cộng lại từ item.originalPrice,
              // vì giá gốc không nhất thiết là số tiền
              // thực tế khách đã thanh toán cho món.
              //

              const displaySubtotal =
                Number(
                  ord.subtotalPrice ||
                  0
                ) || 0;

              return (
                <div
                  key={ord.id}
                  className="bg-white rounded-2xl border border-stone-200/90 shadow-xs hover:shadow-md transition overflow-hidden"
                >
                  {/* =================================================
                      ORDER HEADER
                  ================================================== */}

                  <div className="bg-stone-50/80 px-4 py-2.5 border-b border-stone-100 flex flex-wrap justify-between items-center gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-stone-800 text-xs bg-stone-200/70 px-2 py-0.5 rounded-md font-mono">
                        #
                        {ord.id
                          .slice(
                            0,
                            8
                          )
                          .toUpperCase()}
                      </span>

                      <span className="text-[10px] text-stone-400 border-l border-stone-200 pl-2">
                        ⏱{" "}
                        {
                          ord.createdAt
                        }
                      </span>
                    </div>

                    <div>
                      {renderStatusBadge(
                        ord.status
                      )}
                    </div>
                  </div>

                  {/* =================================================
                      PROGRESS
                  ================================================== */}

                  {!isCancelled ? (
                    <div className="px-6 py-3 bg-stone-50/40 border-b border-stone-100">
                      <div className="relative flex items-center justify-between w-full">
                        <div className="absolute top-2 left-0 w-full h-0.5 bg-stone-200 -translate-y-1/2 -z-0" />

                        <div
                          className="absolute top-2 left-0 h-0.5 bg-[#ee4d2d] -translate-y-1/2 transition-all duration-300 -z-0"
                          style={{
                            width: `${(Math.max(
                              0,
                              currentStepIndex
                            ) /
                                (ORDER_STEPS.length -
                                  1)) *
                              100
                              }%`,
                          }}
                        />

                        {ORDER_STEPS.map(
                          (
                            step,
                            idx
                          ) => {
                            const isPassed =
                              idx <=
                              currentStepIndex;

                            const isCurrent =
                              idx ===
                              currentStepIndex;

                            return (
                              <div
                                key={
                                  step.key
                                }
                                className="flex flex-col items-center relative z-10"
                              >
                                <div
                                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${isCurrent
                                      ? "bg-[#ee4d2d] text-white ring-2 ring-orange-200"
                                      : isPassed
                                        ? "bg-[#ee4d2d] text-white"
                                        : "bg-stone-200 text-stone-400"
                                    }`}
                                >
                                  {isPassed
                                    ? "✓"
                                    : idx +
                                    1}
                                </div>

                                <span
                                  className={`text-[9px] mt-1 font-semibold ${isCurrent
                                      ? "text-[#ee4d2d] font-bold"
                                      : "text-stone-400"
                                    }`}
                                >
                                  {
                                    step.label
                                  }
                                </span>
                              </div>
                            );
                          }
                        )}
                      </div>
                    </div>
                  ) : (
                    /* =================================================
                       CANCELLED BANNER
                    ================================================== */

                    <div className="p-3 bg-rose-50/90 border-b border-rose-100 text-rose-800 space-y-1 text-xs">
                      <div className="flex items-center justify-between font-bold">
                        <span className="flex items-center gap-1.5 text-rose-700">
                          {ord.status.toLowerCase() ===
                            "refunded"
                            ? "💸 Đơn hàng đã hủy & Hoàn tiền thành công"
                            : "🚫 Đơn hàng đã bị hủy"}
                        </span>

                        {ord.cancelledAt && (
                          <span className="text-[10px] text-rose-500 font-normal">
                            Thời gian hủy:{" "}
                            {
                              ord.cancelledAt
                            }
                          </span>
                        )}
                      </div>

                      {ord.cancelReason && (
                        <div className="text-[11px] text-rose-700 bg-white/60 p-2 rounded-lg border border-rose-200/60">
                          <strong>
                            Lý do hủy:
                          </strong>{" "}
                          {
                            ord.cancelReason
                          }

                          {ord.cancelledBy && (
                            <span className="ml-1 text-rose-500">
                              (
                              {
                                ord.cancelledBy
                              }
                              )
                            </span>
                          )}
                        </div>
                      )}

                      {ord.refundedAt && (
                        <div className="text-[10px] text-emerald-700 font-medium">
                          ✓ Đã hoàn tiền vào tài khoản khách lúc:{" "}
                          {
                            ord.refundedAt
                          }
                        </div>
                      )}
                    </div>
                  )}

                  {/* =================================================
                      MAIN CONTENT
                  ================================================== */}

                  <div className="p-4 space-y-3">
                    {/* =================================================
                        CUSTOMER
                    ================================================== */}

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-stone-50/60 p-2.5 rounded-xl border border-stone-100">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-stone-800 text-xs">
                            👤{" "}
                            {
                              ord.customerName
                            }
                          </span>

                          <span className="text-stone-600 bg-stone-100 border border-stone-200 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-0.5">
                            📞{" "}
                            {maskPhoneNumber(
                              ord.phone
                            )}
                          </span>
                        </div>

                        <div className="text-stone-600 text-[11px] flex items-start gap-1">
                          <span className="flex-shrink-0">
                            📍
                          </span>

                          <span className="line-clamp-2">
                            {
                              ord.address
                            }
                          </span>
                        </div>
                      </div>

                      {ord.paymentMethod && (
                        <span className="self-start sm:self-center text-[9px] font-bold px-2 py-0.5 rounded bg-stone-200/60 text-stone-600 uppercase tracking-wider">
                          {
                            ord.paymentMethod
                          }
                        </span>
                      )}
                    </div>

                    {/* =================================================
                        ITEM LIST
                    ================================================== */}

                    <div className="space-y-1.5">
                      <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                        Chi tiết món ăn (
                        {
                          ord
                            .items
                            .length
                        }
                        )
                      </div>

                      <div className="divide-y divide-stone-100 bg-stone-50/30 rounded-xl px-3 py-1 border border-stone-100">
                        {ord.items.map(
                          (item, idx) => {
                            // =======================================
                            // STRING ITEM
                            // =======================================

                            if (typeof item === "string") {
                              return (
                                <div
                                  key={`${ord.id}-item-string-${idx}`}
                                  className="py-1.5 flex justify-between items-center text-stone-800 text-xs"
                                >
                                  <span className="font-medium">
                                    • {item}
                                  </span>
                                </div>
                              );
                            }

                            // =======================================
                            // ITEM
                            // =======================================

                            const hasDiscount =
                              Boolean(
                                item.originalPrice &&
                                item.originalPrice >
                                (item.price || 0)
                              );

                            return (
                              <div
                                key={`${ord.id}-item-${item.id || "unknown"}-${idx}`}
                                className="py-2 flex items-center gap-2.5"
                              >
                                {(item.imageUrl || item.image) && (
                                  <img
                                    src={
                                      item.imageUrl ||
                                      item.image
                                    }
                                    alt={item.name}
                                    className="w-10 h-10 rounded-lg object-cover border border-stone-200 flex-shrink-0"
                                  />
                                )}

                                <div className="flex-1 min-w-0">
                                  <div className="flex justify-between items-center">
                                    <span className="font-bold text-stone-800 truncate">
                                      {item.name}
                                    </span>

                                    <span className="font-bold text-stone-700 ml-2">
                                      x{item.quantity}
                                    </span>
                                  </div>

                                  {item.note && (
                                    <p className="text-[10px] text-amber-600 italic">
                                      Ghi chú: {item.note}
                                    </p>
                                  )}
                                </div>

                                <div className="text-right flex-shrink-0 ml-2">
                                  <span className="text-stone-800 font-bold text-xs">
                                    {formatCurrency(
                                      (item.price || 0) *
                                      item.quantity
                                    )}
                                  </span>

                                  {hasDiscount && (
                                    <div className="text-[9px] text-stone-400 line-through">
                                      {formatCurrency(
                                        item.originalPrice! *
                                        item.quantity
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          }
                        )}
                      </div>
                    </div>

                    {/* =================================================
                        MONEY SUMMARY
                        CHỈ HIỂN THỊ PHẦN CỦA QUÁN
                    ================================================== */}

                    <div className="bg-stone-50 rounded-xl p-3 border border-stone-100 space-y-1.5">
                      {/* TIỀN MÓN */}

                      <div className="flex justify-between text-stone-600">
                        <span>
                          Tiền món:
                        </span>

                        <span className="font-bold text-stone-800">
                          {formatCurrency(
                            displaySubtotal
                          )}
                        </span>
                      </div>

                      {/* DISCOUNT */}

                      {(ord.discountAmount ??
                        0) > 0 && (
                          <div className="flex justify-between text-emerald-600 font-medium">
                            <span>
                              Giảm giá:
                            </span>

                            <span>
                              -
                              {formatCurrency(
                                ord.discountAmount!
                              )}
                            </span>
                          </div>
                        )}

                      {/* IMPORTANT:
                          KHÔNG HIỂN THỊ SHIPPING FEE
                      */}

                      <div className="border-t border-stone-200/60 pt-1.5 mt-1 flex justify-between items-center">
                        <span className="text-xs font-bold text-stone-800">
                          Tổng tiền món:
                        </span>

                        <span className="text-sm font-black text-[#ee4d2d]">
                          {formatCurrency(
                            displaySubtotal
                          )}
                        </span>
                      </div>
                    </div>

                    {/* =================================================
                        NOTE
                    ================================================== */}

                    {ord.note && (
                      <div className="bg-amber-50/80 border border-amber-200/60 text-amber-800 text-[11px] p-2 rounded-lg flex items-start gap-1.5">
                        <span>
                          📝
                        </span>

                        <div>
                          <strong className="font-bold">
                            Ghi chú từ khách:
                          </strong>{" "}
                          {
                            ord.note
                          }
                        </div>
                      </div>
                    )}

                    {/* =================================================
                        REVIEW
                    ================================================== */}

                    {review && (
                      <div className="bg-amber-50/60 border border-amber-200/70 p-3 rounded-xl space-y-2 text-xs">
                        {/* PRODUCT REVIEW */}

                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-stone-800 flex items-center gap-1">
                                💬 Đánh giá món ăn:
                              </span>

                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-extrabold text-[10px]">
                                {"⭐".repeat(
                                  review.productRating ||
                                  5
                                )}{" "}
                                {
                                  review.productRating ||
                                  5
                                }
                                /5
                              </span>
                            </div>

                            {review.reviewedAt && (
                              <span className="text-[10px] text-stone-400 font-mono">
                                {
                                  review.reviewedAt
                                }
                              </span>
                            )}
                          </div>

                          {review.productComment ? (
                            <p className="text-stone-700 italic bg-white/70 p-2 rounded-lg border border-amber-100 leading-relaxed text-[11px]">
                              &ldquo;
                              {
                                review.productComment
                              }
                              &rdquo;
                            </p>
                          ) : (
                            <p className="text-stone-400 italic text-[10px]">
                              Khách hàng không để lại bình luận món ăn.
                            </p>
                          )}
                        </div>

                        {/* DRIVER REVIEW */}

                        {(review.driverComment ||
                          review.driverRating) && (
                            <div className="pt-2 border-t border-amber-200/50 space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-stone-700 flex items-center gap-1">
                                  🛵 Đánh giá giao hàng:
                                </span>

                                <span className="inline-flex items-center px-1.5 py-0.2 rounded bg-stone-100 text-stone-700 font-bold text-[10px]">
                                  {"⭐".repeat(
                                    review.driverRating ||
                                    5
                                  )}{" "}
                                  {
                                    review.driverRating
                                  }
                                  /5
                                </span>
                              </div>

                              {review.driverComment && (
                                <p className="text-stone-600 italic bg-white/50 p-1.5 rounded border border-stone-100 text-[10px]">
                                  &ldquo;
                                  {
                                    review.driverComment
                                  }
                                  &rdquo;
                                </p>
                              )}
                            </div>
                          )}
                      </div>
                    )}
                  </div>

                  {/* =================================================
                      ACTIONS
                  ================================================== */}

                  <div className="bg-stone-50/80 px-4 py-2.5 border-t border-stone-100 flex flex-wrap justify-between items-center gap-2">
                    <span className="text-[10px] text-stone-400 font-medium">
                      Thao tác xử lý đơn:
                    </span>

                    <div className="flex items-center gap-2">
                      {renderActionButtons(
                        ord
                      )}
                    </div>
                  </div>
                </div>
              );
            }
          )}
        </div>
      )}

      {/* =========================================================
          CANCEL MODAL
      ========================================================== */}

      {cancelModalOrder && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4 animate-in fade-in zoom-in duration-200">
            {/* HEADER */}

            <div className="flex justify-between items-center border-b border-stone-100 pb-3">
              <h3 className="font-extrabold text-stone-800 text-sm flex items-center gap-1.5">
                ❌ Xác Nhận Hủy Đơn Hàng #
                {cancelModalOrder.id
                  .slice(0, 8)
                  .toUpperCase()}
              </h3>

              <button
                onClick={() =>
                  setCancelModalOrder(
                    null
                  )
                }
                className="text-stone-400 hover:text-stone-600 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* DESCRIPTION */}

            <p className="text-xs text-stone-600">
              Vui lòng chọn hoặc nhập lý
              do hủy đơn để thông báo cho
              khách hàng:
            </p>

            {/* REASONS */}

            <div className="space-y-2">
              {CANCEL_REASONS.map(
                (reason) => (
                  <label
                    key={reason}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition ${selectedReason ===
                        reason
                        ? "border-rose-500 bg-rose-50/50 text-rose-900 font-bold"
                        : "border-stone-200 text-stone-700 hover:bg-stone-50"
                      }`}
                  >
                    <input
                      type="radio"
                      name="cancelReason"
                      checked={
                        selectedReason ===
                        reason
                      }
                      onChange={() =>
                        setSelectedReason(
                          reason
                        )
                      }
                      className="accent-rose-600"
                    />

                    <span>
                      {reason}
                    </span>
                  </label>
                )
              )}

              {selectedReason ===
                "Lý do khác" && (
                  <textarea
                    rows={3}
                    placeholder="Nhập lý do hủy chi tiết..."
                    value={customReason}
                    onChange={(e) =>
                      setCustomReason(
                        e.target.value
                      )
                    }
                    className="w-full p-2.5 border border-stone-300 rounded-xl text-xs focus:outline-none focus:border-rose-500 mt-2"
                  />
                )}
            </div>

            {/* ACTIONS */}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() =>
                  setCancelModalOrder(
                    null
                  )
                }
                className="w-1/3 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-xl transition cursor-pointer"
              >
                Bỏ qua
              </button>

              <button
                type="button"
                disabled={
                  updatingId ===
                  cancelModalOrder.id
                }
                onClick={
                  handleConfirmCancel
                }
                className="w-2/3 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-md transition cursor-pointer"
              >
                {updatingId ===
                  cancelModalOrder.id
                  ? "Đang hủy..."
                  : "Xác nhận Hủy Đơn"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}