"use client";

import { useState, useEffect, useMemo } from "react";
import { db, auth } from "@cho-online/firebase";
import {
  onAuthStateChanged,
  User as FirebaseUser,
} from "firebase/auth";

import {
  collection,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
  addDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";

import VoucherManager from "@/components/merchant/VoucherManager";

// ============================================================
// TYPES
// ============================================================

interface OverviewTabProps {
  formatCurrency?: (amount: number) => string;
  onNavigateToTab?: (tabName: string) => void;
}

type TimeRange = "today" | "month" | "year" | "all";

interface OrderData {
  id: string;
  totalPrice: number;
  subTotalPrice: number;
  subTotalCostPrice: number;
  shippingFee: number;
  status: string;
  createdAt?: any;
  platformFee?: number;
}

interface PayoutRequest {
  id: string;
  amount: number;
  status: "pending" | "approved" | "rejected";
  bankName: string;
  accountNumber: string;
  accountName: string;
  createdAt?: any;
  note?: string;
}

// ============================================================
// PLATFORM COMMISSION PLANS
// ============================================================

const PLATFORM_COMMISSION_PLANS = [
  {
    percent: 10,
    name: "Cơ Bản",
    shortName: "Cơ bản",
    icon: "🌱",
    description: "Khởi đầu cùng Anvami",
    benefits: [
      "Gian hàng trên Anvami",
      "Quản lý đơn & sản phẩm",
      "Báo cáo doanh thu",
      "Hỗ trợ tiêu chuẩn",
    ],
  },
  {
    percent: 15,
    name: "Tăng Trưởng",
    shortName: "Tăng trưởng",
    icon: "🚀",
    description: "Mở rộng khả năng tiếp cận",
    benefits: [
      "Tất cả quyền lợi cơ bản",
      "Ưu tiên hiển thị",
      "Tham gia chương trình quảng bá",
      "Hỗ trợ ưu tiên",
    ],
  },
  {
    percent: 20,
    name: "Nổi Bật",
    shortName: "Nổi bật",
    icon: "⭐",
    description: "Tăng cường hiện diện",
    benefits: [
      "Tất cả quyền lợi tăng trưởng",
      "Ưu tiên vị trí hiển thị cao hơn",
      "Ưu tiên chiến dịch của Sàn",
      "Hỗ trợ ưu tiên cao",
      "Cơ hội hỗ trợ truyền thông/Livestream",
    ],
  },
];

// ============================================================
// FORMAT DATE
// ============================================================

const getOrderDate = (createdAt: any): Date | null => {
  try {
    if (!createdAt) return null;

    if (typeof createdAt?.toDate === "function") {
      const date = createdAt.toDate();
      return isNaN(date.getTime()) ? null : date;
    }

    const date = new Date(createdAt);

    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
};

// ============================================================
// PLAN CARD
// ============================================================

function CommissionPlanCard({
  plan,
  active,
}: {
  plan: (typeof PLATFORM_COMMISSION_PLANS)[number];
  active: boolean;
}) {
  return (
    <div
      className={`
        relative rounded-2xl border transition-all duration-200
        ${
          active
            ? "border-[#ee4d2d] bg-[#fff8f5] shadow-sm"
            : "border-stone-200 bg-white hover:border-stone-300"
        }
      `}
    >
      {/* Active indicator */}
      {active && (
        <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-[#ee4d2d]" />
      )}

      <div className="p-3.5">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div
              className={`
                w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0
                ${
                  active
                    ? "bg-orange-100"
                    : "bg-stone-100"
                }
              `}
            >
              {plan.icon}
            </div>

            <div>
              <div
                className={`text-[11px] font-extrabold ${
                  active
                    ? "text-[#ee4d2d]"
                    : "text-stone-800"
                }`}
              >
                {plan.name}
              </div>

              <div className="text-[9px] text-stone-400 mt-0.5">
                {plan.description}
              </div>
            </div>
          </div>

          {active && (
            <span className="shrink-0 bg-[#ee4d2d] text-white text-[8px] font-black px-2 py-1 rounded-full">
              ĐANG DÙNG
            </span>
          )}
        </div>

        {/* Commission */}
        <div className="mt-3 flex items-end justify-between">
          <div>
            <div
              className={`text-2xl font-black leading-none ${
                active
                  ? "text-[#ee4d2d]"
                  : "text-stone-800"
              }`}
            >
              {plan.percent}%
            </div>

            <div className="text-[8px] uppercase tracking-wide text-stone-400 font-bold mt-1">
              Chiết khấu Sàn
            </div>
          </div>

          <div
            className={`text-[9px] font-semibold px-2 py-1 rounded-lg ${
              active
                ? "bg-orange-100 text-orange-700"
                : "bg-stone-100 text-stone-500"
            }`}
          >
            {plan.shortName}
          </div>
        </div>

        {/* Benefits */}
        <div className="mt-3 pt-3 border-t border-stone-100 space-y-1.5">
          {plan.benefits.map(
            (benefit, index) => (
              <div
                key={`${plan.percent}-${index}`}
                className="flex items-start gap-1.5"
              >
                <span
                  className={`text-[9px] mt-[1px] ${
                    active
                      ? "text-[#ee4d2d]"
                      : "text-emerald-500"
                  }`}
                >
                  ✓
                </span>

                <span className="text-[9px] text-stone-600 leading-[1.35]">
                  {benefit}
                </span>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MAIN
// ============================================================

export default function OverviewTab({
  formatCurrency = (amount: number) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount || 0),

  onNavigateToTab,
}: OverviewTabProps) {
  const [isStoreActive, setIsStoreActive] =
    useState(true);

  const [isUpdatingStore, setIsUpdatingStore] =
    useState(false);

  const [currentUser, setCurrentUser] =
    useState<FirebaseUser | null>(null);

  const [merchantInfo, setMerchantInfo] =
    useState<{
      merchantCode?: string;
      shopName?: string;
      commissionPercent?: number;
      balance?: number;
      totalWithdrawn?: number;
      bankName?: string;
      accountNumber?: string;
      accountName?: string;
    }>({});

  const [loading, setLoading] =
    useState(true);

  const [timeRange, setTimeRange] =
    useState<TimeRange>("today");

  const [orders, setOrders] =
    useState<OrderData[]>([]);

  const [outOfStockCount, setOutOfStockCount] =
    useState(0);

  const [payoutRequests, setPayoutRequests] =
    useState<PayoutRequest[]>([]);

  const [
    isPayoutModalOpen,
    setIsPayoutModalOpen,
  ] = useState(false);

  const [payoutAmount, setPayoutAmount] =
    useState("");

  const [bankName, setBankName] =
    useState("");

  const [accountNumber, setAccountNumber] =
    useState("");

  const [accountName, setAccountName] =
    useState("");

  const [
    isSubmittingPayout,
    setIsSubmittingPayout,
  ] = useState(false);

  // ============================================================
  // 1. AUTH + MERCHANT
  // ============================================================

  useEffect(() => {
    let unsubMerchant:
      | (() => void)
      | undefined;

    const unsubscribeAuth =
      onAuthStateChanged(
        auth,
        async (user) => {
          if (!user) {
            if (unsubMerchant) {
              unsubMerchant();
              unsubMerchant = undefined;
            }

            setCurrentUser(null);
            setLoading(false);
            return;
          }

          setCurrentUser(user);

          try {
            let defaultPlatformRate = 10;

            // ----------------------------------------------
            // Settings mặc định
            // ----------------------------------------------

            try {
              const commissionDoc =
                await getDoc(
                  doc(
                    db,
                    "settings",
                    "commission"
                  )
                );

              if (
                commissionDoc.exists()
              ) {
                const data =
                  commissionDoc.data();

                const rate = Number(
                  data.platformFeePercent
                );

                if (
                  Number.isFinite(rate) &&
                  rate >= 0 &&
                  rate <= 100
                ) {
                  defaultPlatformRate =
                    rate;
                }
              }
            } catch (error) {
              console.warn(
                "⚠️ Không thể lấy settings/commission",
                error
              );
            }

            // ----------------------------------------------
            // Merchant realtime
            // ----------------------------------------------

            if (unsubMerchant) {
              unsubMerchant();
            }

            unsubMerchant =
              onSnapshot(
                doc(
                  db,
                  "merchants",
                  user.uid
                ),
                (merchantSnap) => {
                  if (
                    !merchantSnap.exists()
                  ) {
                    setMerchantInfo({
                      commissionPercent:
                        defaultPlatformRate,
                      totalWithdrawn: 0,
                    });

                    return;
                  }

                  const data =
                    merchantSnap.data();

                  const parsedCommission =
                    Number(
                      data.commissionPercent ??
                        defaultPlatformRate
                    );

                  const commissionPercent =
                    Number.isFinite(
                      parsedCommission
                    ) &&
                    parsedCommission >= 0 &&
                    parsedCommission <= 100
                      ? parsedCommission
                      : defaultPlatformRate;

                  setMerchantInfo({
                    merchantCode:
                      data.merchantCode ||
                      "",

                    shopName:
                      data.shopName ||
                      data.storeName ||
                      data.name ||
                      "Quán của tôi",

                    // ✅ SOURCE OF TRUTH
                    commissionPercent,

                    balance:
                      data.balance !==
                      undefined
                        ? Number(
                            data.balance
                          )
                        : undefined,

                    totalWithdrawn:
                      Number(
                        data.totalWithdrawn
                      ) || 0,

                    bankName:
                      data.bankName ||
                      "",

                    accountNumber:
                      data.accountNumber ||
                      "",

                    accountName:
                      data.accountName ||
                      "",
                  });

                  setBankName(
                    (prev) =>
                      prev ||
                      data.bankName ||
                      ""
                  );

                  setAccountNumber(
                    (prev) =>
                      prev ||
                      data.accountNumber ||
                      ""
                  );

                  setAccountName(
                    (prev) =>
                      prev ||
                      data.accountName ||
                      ""
                  );
                },
                (error) => {
                  console.error(
                    "❌ Lỗi realtime Merchant:",
                    error
                  );
                }
              );
          } catch (error) {
            console.error(
              "❌ Lỗi lấy thông tin Merchant:",
              error
            );
          }
        }
      );

    return () => {
      unsubscribeAuth();

      if (unsubMerchant) {
        unsubMerchant();
      }
    };
  }, []);

  // ============================================================
  // 2. FIRESTORE REALTIME
  // ============================================================

  useEffect(() => {
    if (!currentUser) return;

    // ----------------------------------------------------------
    // STORE STATUS
    // ----------------------------------------------------------

    const fetchStoreStatus =
      async () => {
        try {
          const storeSnap =
            await getDoc(
              doc(
                db,
                "store_settings",
                currentUser.uid
              )
            );

          if (
            storeSnap.exists()
          ) {
            setIsStoreActive(
              storeSnap.data().isOpen ??
                true
            );

            return;
          }

          const merchantSnap =
            await getDoc(
              doc(
                db,
                "merchants",
                currentUser.uid
              )
            );

          if (
            merchantSnap.exists()
          ) {
            setIsStoreActive(
              merchantSnap.data()
                .isOpen ?? true
            );
          }
        } catch (error) {
          console.error(
            "❌ Lỗi trạng thái cửa hàng:",
            error
          );
        }
      };

    fetchStoreStatus();

    // ----------------------------------------------------------
    // ORDERS
    // ----------------------------------------------------------

    const ordersQuery = query(
      collection(db, "orders"),
      where(
        "merchantId",
        "==",
        currentUser.uid
      )
    );

    const unsubscribeOrders =
      onSnapshot(
        ordersQuery,
        (snapshot) => {
          const fetchedOrders =
            snapshot.docs.map(
              (docSnap) => {
                const data =
                  docSnap.data();

                const totalPrice =
                  Number(
                    data.totalPrice
                  ) || 0;

                const subTotalPrice =
                  Number(
                    data.subTotalPrice
                  ) || totalPrice;

                const subTotalCostPrice =
                  Number(
                    data.subTotalCostPrice
                  ) || subTotalPrice;

                return {
                  id: docSnap.id,
                  totalPrice,
                  subTotalPrice,
                  subTotalCostPrice,

                  shippingFee:
                    Number(
                      data.shippingFee
                    ) || 0,

                  status:
                    String(
                      data.status || ""
                    )
                      .toLowerCase()
                      .trim(),

                  createdAt:
                    data.createdAt,

                  platformFee:
                    data.platformFee !==
                    undefined
                      ? Number(
                          data.platformFee
                        )
                      : undefined,
                };
              }
            );

          setOrders(
            fetchedOrders
          );

          setLoading(false);
        },
        (error) => {
          console.error(
            "❌ Lỗi lấy đơn hàng Merchant:",
            error
          );

          setLoading(false);
        }
      );

    // ----------------------------------------------------------
    // PRODUCTS
    // ----------------------------------------------------------

    const productsQuery = query(
      collection(db, "products"),
      where(
        "merchantId",
        "==",
        currentUser.uid
      )
    );

    const unsubscribeProducts =
      onSnapshot(
        productsQuery,
        (snapshot) => {
          let count = 0;

          snapshot.docs.forEach(
            (docSnap) => {
              const data =
                docSnap.data();

              const stock =
                Number(
                  data.stock
                );

              if (
                data.isAvailable ===
                  false ||
                (data.stock !==
                  undefined &&
                  stock <= 0)
              ) {
                count += 1;
              }
            }
          );

          setOutOfStockCount(
            count
          );
        },
        (error) => {
          console.error(
            "❌ Lỗi lấy sản phẩm:",
            error
          );
        }
      );

    // ----------------------------------------------------------
    // PAYOUTS
    // ----------------------------------------------------------

    const payoutQuery = query(
      collection(
        db,
        "payout_requests"
      ),
      where(
        "merchantId",
        "==",
        currentUser.uid
      )
    );

    const unsubscribePayouts =
      onSnapshot(
        payoutQuery,
        (snapshot) => {
          const requests =
            snapshot.docs.map(
              (docSnap) => {
                const data =
                  docSnap.data();

                return {
                  id: docSnap.id,

                  amount:
                    Number(
                      data.amount
                    ) || 0,

                  status:
                    data.status ||
                    "pending",

                  bankName:
                    data.bankName ||
                    "",

                  accountNumber:
                    data.accountNumber ||
                    "",

                  accountName:
                    data.accountName ||
                    "",

                  createdAt:
                    data.createdAt,

                  note:
                    data.note || "",
                };
              }
            );

          requests.sort(
            (a, b) => {
              const aTime =
                a.createdAt?.toDate
                  ? a.createdAt
                      .toDate()
                      .getTime()
                  : 0;

              const bTime =
                b.createdAt?.toDate
                  ? b.createdAt
                      .toDate()
                      .getTime()
                  : 0;

              return (
                bTime - aTime
              );
            }
          );

          setPayoutRequests(
            requests
          );
        },
        (error) => {
          console.error(
            "❌ Lỗi payout:",
            error
          );
        }
      );

    return () => {
      unsubscribeOrders();
      unsubscribeProducts();
      unsubscribePayouts();
    };
  }, [currentUser]);

  // ============================================================
  // 3. METRICS
  // ============================================================

  const {
    filteredMetrics,
    calculatedBalance,
  } = useMemo(() => {
    const now = new Date();

    const commissionRate =
      (merchantInfo.commissionPercent ??
        10) / 100;

    let pendingCount = 0;
    let completedCount = 0;
    let cancelledCount = 0;
    let refundedCount = 0;

    let grossRevenue = 0;
    let totalPlatformFee = 0;
    let totalRefundedAmount = 0;

    let totalOrdersCount = 0;
    let allTimeNetRevenue = 0;

    const chartMap: Record<
      string,
      {
        gross: number;
        net: number;
        count: number;
      }
    > = {};

    orders.forEach(
      (order) => {
        const orderDate =
          getOrderDate(
            order.createdAt
          );

        const status =
          order.status;

        const isCompleted = [
          "paid",
          "completed",
          "delivered",
        ].includes(status);

        const foodRevenue =
          order.subTotalPrice;

        const costRevenue =
          order.subTotalCostPrice;

        const platformFee =
          order.platformFee ??
          Math.round(
            costRevenue *
              commissionRate
          );

        const netRevenue =
          foodRevenue -
          platformFee;

        if (isCompleted) {
          allTimeNetRevenue +=
            netRevenue;
        }

        // ----------------------------------------------
        // Time filter
        // ----------------------------------------------

        let matchesTime = true;

        if (orderDate) {
          if (
            timeRange === "today"
          ) {
            matchesTime =
              orderDate.getDate() ===
                now.getDate() &&
              orderDate.getMonth() ===
                now.getMonth() &&
              orderDate.getFullYear() ===
                now.getFullYear();
          }

          if (
            timeRange === "month"
          ) {
            matchesTime =
              orderDate.getMonth() ===
                now.getMonth() &&
              orderDate.getFullYear() ===
                now.getFullYear();
          }

          if (
            timeRange === "year"
          ) {
            matchesTime =
              orderDate.getFullYear() ===
              now.getFullYear();
          }
        }

        if (!matchesTime) {
          return;
        }

        totalOrdersCount += 1;

        const isPending = [
          "pending",
          "processing",
        ].includes(status);

        const isCancelled = [
          "cancelled",
          "canceled",
        ].includes(status);

        const isRefunded = [
          "refunded",
          "refund",
        ].includes(status);

        // ----------------------------------------------
        // Pending
        // ----------------------------------------------

        if (isPending) {
          pendingCount += 1;
          return;
        }

        // ----------------------------------------------
        // Completed
        // ----------------------------------------------

        if (isCompleted) {
          completedCount += 1;

          grossRevenue +=
            foodRevenue;

          totalPlatformFee +=
            platformFee;

          if (orderDate) {
            let label = "";

            if (
              timeRange ===
              "today"
            ) {
              label = `${orderDate.getHours()}h`;
            } else if (
              timeRange ===
              "month"
            ) {
              label = `${orderDate.getDate()}/${
                orderDate.getMonth() +
                1
              }`;
            } else {
              label = `T${
                orderDate.getMonth() +
                1
              }`;
            }

            if (
              !chartMap[label]
            ) {
              chartMap[label] = {
                gross: 0,
                net: 0,
                count: 0,
              };
            }

            chartMap[label].gross +=
              foodRevenue;

            chartMap[label].net +=
              netRevenue;

            chartMap[label].count +=
              1;
          }

          return;
        }

        // ----------------------------------------------
        // Cancelled
        // ----------------------------------------------

        if (isCancelled) {
          cancelledCount += 1;

          totalRefundedAmount +=
            foodRevenue;

          return;
        }

        // ----------------------------------------------
        // Refunded
        // ----------------------------------------------

        if (isRefunded) {
          refundedCount += 1;

          totalRefundedAmount +=
            foodRevenue;
        }
      }
    );

    const chartData =
      Object.entries(
        chartMap
      ).map(
        ([time, value]) => ({
          time,
          gross: value.gross,
          net: value.net,
          count: value.count,
        })
      );

    const netRevenue =
      grossRevenue -
      totalPlatformFee;

    const totalEndedOrders =
      completedCount +
      cancelledCount +
      refundedCount;

    const cancelRate =
      totalEndedOrders > 0
        ? (
            (
              (cancelledCount +
                refundedCount) /
              totalEndedOrders
            ) *
            100
          ).toFixed(1)
        : "0.0";

    const calculated =
      merchantInfo.balance !==
      undefined
        ? merchantInfo.balance
        : Math.max(
            0,
            allTimeNetRevenue -
              (merchantInfo.totalWithdrawn ||
                0)
          );

    return {
      filteredMetrics: {
        pendingCount,
        completedCount,
        cancelledCount,
        refundedCount,
        totalOrdersCount,
        grossRevenue,
        totalPlatformFee,
        netRevenue,
        totalRefundedAmount,
        cancelRate,
        chartData,
      },

      calculatedBalance:
        calculated,
    };
  }, [
    orders,
    timeRange,
    merchantInfo,
  ]);

  // ============================================================
  // 4. CURRENT PLAN
  // ============================================================

  const currentCommission =
    Number(
      merchantInfo.commissionPercent ??
        10
    );

  const currentPlan =
    PLATFORM_COMMISSION_PLANS.find(
      (plan) =>
        plan.percent ===
        currentCommission
    );

  // ============================================================
  // 5. TOGGLE STORE
  // ============================================================

  const handleToggleStoreStatus =
    async () => {
      if (!currentUser) return;

      try {
        setIsUpdatingStore(
          true
        );

        const nextStatus =
          !isStoreActive;

        await setDoc(
          doc(
            db,
            "store_settings",
            currentUser.uid
          ),
          {
            isOpen: nextStatus,
            updatedAt:
              new Date().toISOString(),
          },
          {
            merge: true,
          }
        );

        await setDoc(
          doc(
            db,
            "merchants",
            currentUser.uid
          ),
          {
            isOpen: nextStatus,
          },
          {
            merge: true,
          }
        );

        setIsStoreActive(
          nextStatus
        );
      } catch (error) {
        console.error(
          "❌ Lỗi cập nhật trạng thái:",
          error
        );

        alert(
          "Không thể cập nhật trạng thái cửa hàng!"
        );
      } finally {
        setIsUpdatingStore(
          false
        );
      }
    };

  // ============================================================
  // 6. PAYOUT REQUEST
  // ============================================================

  const handleCreatePayoutRequest =
    async (
      e: React.FormEvent
    ) => {
      e.preventDefault();

      if (!currentUser) return;

      const amount =
        Number(payoutAmount);

      if (
        !amount ||
        amount < 50000
      ) {
        alert(
          "Số tiền rút tối thiểu là 50.000 VNĐ!"
        );
        return;
      }

      if (
        amount >
        calculatedBalance
      ) {
        alert(
          `Số tiền yêu cầu (${formatCurrency(
            amount
          )}) vượt quá số dư khả dụng (${formatCurrency(
            calculatedBalance
          )})!`
        );
        return;
      }

      if (
        !bankName.trim() ||
        !accountNumber.trim() ||
        !accountName.trim()
      ) {
        alert(
          "Vui lòng điền đầy đủ thông tin tài khoản ngân hàng!"
        );
        return;
      }

      try {
        setIsSubmittingPayout(
          true
        );

        await addDoc(
          collection(
            db,
            "payout_requests"
          ),
          {
            merchantId:
              currentUser.uid,

            merchantName:
              merchantInfo.shopName ||
              "Quán",

            merchantCode:
              merchantInfo.merchantCode ||
              "",

            amount,

            bankName:
              bankName.trim(),

            accountNumber:
              accountNumber.trim(),

            accountName:
              accountName
                .trim()
                .toUpperCase(),

            status:
              "pending",

            createdAt:
              serverTimestamp(),
          }
        );

        await setDoc(
          doc(
            db,
            "merchants",
            currentUser.uid
          ),
          {
            bankName:
              bankName.trim(),

            accountNumber:
              accountNumber.trim(),

            accountName:
              accountName
                .trim()
                .toUpperCase(),
          },
          {
            merge: true,
          }
        );

        alert(
          "Gửi yêu cầu thanh toán thành công! Sàn sẽ kiểm tra và giải ngân sớm."
        );

        setIsPayoutModalOpen(
          false
        );

        setPayoutAmount("");
      } catch (error) {
        console.error(
          "❌ Lỗi tạo payout:",
          error
        );

        alert(
          "Không thể tạo yêu cầu thanh toán. Vui lòng thử lại!"
        );
      } finally {
        setIsSubmittingPayout(
          false
        );
      }
    };

  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-2">
          <div className="w-7 h-7 border-2 border-[#ee4d2d] border-t-transparent rounded-full animate-spin" />

          <p className="text-[10px] text-stone-400 font-bold">
            Đang tải dữ liệu quán...
          </p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="p-8 bg-white rounded-2xl border border-stone-200 text-center">
        <p className="text-xs text-rose-500 font-bold">
          Vui lòng đăng nhập tài khoản Cửa hàng.
        </p>
      </div>
    );
  }

  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="space-y-3.5 text-xs font-sans">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <section className="bg-white rounded-2xl border border-stone-200/80 shadow-xs px-4 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-lg">
                🏪
              </div>

              <span
                className={`absolute -right-0.5 -bottom-0.5 w-3 h-3 rounded-full border-2 border-white ${
                  isStoreActive
                    ? "bg-emerald-500"
                    : "bg-stone-400"
                }`}
              />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <h2 className="text-[12px] font-extrabold text-stone-800 truncate">
                  {merchantInfo.shopName ||
                    "Quán của tôi"}
                </h2>

                {merchantInfo.merchantCode && (
                  <span className="text-[9px] text-stone-400">
                    #{merchantInfo.merchantCode}
                  </span>
                )}

                <span
                  className={`px-1.5 py-0.5 rounded-md text-[8px] font-extrabold uppercase ${
                    isStoreActive
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-stone-100 text-stone-500"
                  }`}
                >
                  {isStoreActive
                    ? "Đang mở"
                    : "Tạm đóng"}
                </span>
              </div>

              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[9px] text-stone-400">
                  Chiết khấu Sàn
                </span>

                <strong className="text-[10px] text-[#ee4d2d]">
                  {currentCommission}%
                </strong>

                {currentPlan && (
                  <>
                    <span className="text-stone-300">
                      •
                    </span>

                    <span className="text-[9px] text-stone-500">
                      {currentPlan.name}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={isUpdatingStore}
            onClick={
              handleToggleStoreStatus
            }
            className={`px-3 py-2 rounded-xl text-[10px] font-bold border transition active:scale-[.98] ${
              isUpdatingStore
                ? "opacity-50 cursor-wait"
                : "cursor-pointer"
            } ${
              isStoreActive
                ? "bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100"
                : "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {isUpdatingStore
              ? "Đang lưu..."
              : isStoreActive
              ? "⏸ Tạm đóng quán"
              : "▶ Mở nhận đơn"}
          </button>
        </div>
      </section>

      {/* ======================================================
          COMMISSION PLAN
      ====================================================== */}

      <section className="bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-[11px] font-extrabold uppercase tracking-wide text-stone-800">
                Chính sách chiết khấu Sàn
              </h3>

              <p className="text-[9px] text-stone-400 mt-1">
                Mức phí và quyền lợi đang áp dụng cho gian hàng.
              </p>
            </div>

            <span className="shrink-0 px-2 py-1 rounded-lg bg-stone-100 text-stone-500 text-[8px] font-bold">
              Quản lý bởi Sàn
            </span>
          </div>
        </div>

        <div className="px-4 pb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {PLATFORM_COMMISSION_PLANS.map(
              (plan) => (
                <CommissionPlanCard
                  key={plan.percent}
                  plan={plan}
                  active={
                    plan.percent ===
                    currentCommission
                  }
                />
              )
            )}
          </div>

          {/* Current summary */}
          <div className="mt-3 rounded-xl bg-stone-50 border border-stone-200 px-3 py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm shrink-0">
                {currentPlan?.icon ||
                  "🏢"}
              </span>

              <div className="min-w-0">
                <p className="text-[9px] font-bold text-stone-700">
                  Gói hiện tại
                </p>

                <p className="text-[10px] text-stone-500 truncate">
                  {currentPlan?.name ||
                    "Theo chính sách Sàn"}
                </p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-lg font-black text-[#ee4d2d] leading-none">
                {currentCommission}%
              </div>

              <div className="text-[8px] text-stone-400 mt-1">
                đang áp dụng
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================
          WALLET
      ====================================================== */}

      <section className="bg-stone-900 rounded-2xl text-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[9px] text-stone-400 uppercase font-bold tracking-wide">
              Số dư chờ giải ngân
            </div>

            <div className="text-2xl font-black text-amber-400 mt-1">
              {formatCurrency(
                calculatedBalance
              )}
            </div>

            <div className="text-[9px] text-stone-400 mt-1">
              Đã thanh toán:{" "}
              <strong className="text-stone-200">
                {formatCurrency(
                  merchantInfo.totalWithdrawn ||
                    0
                )}
              </strong>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              setIsPayoutModalOpen(
                true
              )
            }
            className="px-3.5 py-2 rounded-xl bg-[#ee4d2d] hover:bg-[#d73f20] text-white text-[10px] font-bold shadow-sm transition active:scale-[.98]"
          >
            💸 Yêu cầu chuyển tiền
          </button>
        </div>

        {payoutRequests.length >
          0 && (
          <div className="mt-3 pt-3 border-t border-stone-700">
            <div className="text-[8px] uppercase font-bold text-stone-500 mb-2">
              Giao dịch gần đây
            </div>

            <div className="space-y-1.5">
              {payoutRequests
                .slice(0, 3)
                .map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between gap-3 bg-stone-800 rounded-xl px-2.5 py-2"
                  >
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold text-white">
                        {formatCurrency(
                          req.amount
                        )}
                      </div>

                      <div className="text-[8px] text-stone-500 truncate">
                        {req.bankName} •{" "}
                        {
                          req.accountNumber
                        }
                      </div>
                    </div>

                    {req.status ===
                      "pending" && (
                      <span className="shrink-0 px-1.5 py-1 rounded-md bg-amber-500/10 text-amber-300 text-[8px] font-bold">
                        Chờ duyệt
                      </span>
                    )}

                    {req.status ===
                      "approved" && (
                      <span className="shrink-0 px-1.5 py-1 rounded-md bg-emerald-500/10 text-emerald-300 text-[8px] font-bold">
                        Đã chuyển
                      </span>
                    )}

                    {req.status ===
                      "rejected" && (
                      <span className="shrink-0 px-1.5 py-1 rounded-md bg-rose-500/10 text-rose-300 text-[8px] font-bold">
                        Từ chối
                      </span>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}
      </section>

      {/* ======================================================
          VOUCHER
      ====================================================== */}

      <VoucherManager
        merchantId={
          currentUser.uid
        }
        formatCurrency={
          formatCurrency
        }
      />

      {/* ======================================================
          TIME FILTER
      ====================================================== */}

      <section className="bg-stone-100 p-1 rounded-xl border border-stone-200">
        <div className="grid grid-cols-4 gap-1">
          {[
            {
              key: "today",
              label: "Hôm nay",
            },
            {
              key: "month",
              label: "Tháng này",
            },
            {
              key: "year",
              label: "Năm nay",
            },
            {
              key: "all",
              label: "Tất cả",
            },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() =>
                setTimeRange(
                  tab.key as TimeRange
                )
              }
              className={`py-2 rounded-lg text-[9px] sm:text-[10px] font-bold transition ${
                timeRange ===
                tab.key
                  ? "bg-white text-[#ee4d2d] shadow-xs"
                  : "text-stone-500 hover:text-stone-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {/* ======================================================
          KPI
      ====================================================== */}

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {/* Net */}
        <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-wide opacity-80">
              Thực nhận
            </span>

            <span className="text-sm">
              💵
            </span>
          </div>

          <div className="text-xl font-black mt-2">
            {formatCurrency(
              filteredMetrics.netRevenue
            )}
          </div>

          <div className="text-[8px] opacity-70 mt-1">
            Tiền món - Phí Sàn
          </div>
        </div>

        {/* Gross */}
        <div className="rounded-2xl bg-white border border-stone-200 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-wide text-stone-500">
              Doanh thu món
            </span>

            <span className="text-sm">
              💰
            </span>
          </div>

          <div className="text-xl font-black text-[#ee4d2d] mt-2">
            {formatCurrency(
              filteredMetrics.grossRevenue
            )}
          </div>

          <div className="text-[8px] text-stone-400 mt-1">
            Tổng tiền món khách trả
          </div>
        </div>

        {/* Platform fee */}
        <div className="rounded-2xl bg-white border border-stone-200 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-wide text-stone-500">
              Phí Sàn
            </span>

            <span className="text-sm">
              🏢
            </span>
          </div>

          <div className="text-xl font-black text-rose-500 mt-2">
            -{" "}
            {formatCurrency(
              filteredMetrics.totalPlatformFee
            )}
          </div>

          <div className="text-[8px] text-stone-400 mt-1">
            Theo mức {currentCommission}%
          </div>
        </div>
      </section>

      {/* ======================================================
          CHART
      ====================================================== */}

      <section className="bg-white rounded-2xl border border-stone-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="text-[11px] font-extrabold text-stone-800">
              📈 Doanh thu
            </h3>

            <p className="text-[8px] text-stone-400 mt-0.5">
              Theo khoảng thời gian đã chọn
            </p>
          </div>

          <div className="flex items-center gap-3 text-[8px]">
            <span className="flex items-center gap-1 text-stone-500">
              <i className="w-2 h-2 rounded-sm bg-orange-400" />
              Bán
            </span>

            <span className="flex items-center gap-1 text-stone-500">
              <i className="w-2 h-2 rounded-sm bg-emerald-500" />
              Thực nhận
            </span>
          </div>
        </div>

        {filteredMetrics.chartData
          .length > 0 ? (
          <div className="h-44 flex items-end gap-1.5 border-b border-l border-stone-200 px-2 pb-1">
            {(() => {
              const maxVal =
                Math.max(
                  ...filteredMetrics.chartData.map(
                    (item) =>
                      Math.max(
                        item.gross,
                        item.net
                      )
                  ),
                  1
                );

              return filteredMetrics.chartData.map(
                (item, index) => {
                  const grossHeight =
                    (item.gross /
                      maxVal) *
                    100;

                  const netHeight =
                    (item.net /
                      maxVal) *
                    100;

                  return (
                    <div
                      key={`${item.time}-${index}`}
                      className="flex-1 h-full flex flex-col items-center justify-end group relative min-w-0"
                    >
                      <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col bg-stone-900 text-white text-[8px] px-2 py-1.5 rounded-lg whitespace-nowrap z-10">
                        <strong className="text-amber-300">
                          {item.time}
                        </strong>

                        <span>
                          Bán:{" "}
                          {formatCurrency(
                            item.gross
                          )}
                        </span>

                        <span className="text-emerald-300">
                          Thực:{" "}
                          {formatCurrency(
                            item.net
                          )}
                        </span>
                      </div>

                      <div className="w-full h-full flex items-end justify-center gap-0.5">
                        <div
                          style={{
                            height: `${Math.max(
                              grossHeight,
                              4
                            )}%`,
                          }}
                          className="w-[42%] bg-orange-400 rounded-t"
                        />

                        <div
                          style={{
                            height: `${Math.max(
                              netHeight,
                              4
                            )}%`,
                          }}
                          className="w-[42%] bg-emerald-500 rounded-t"
                        />
                      </div>

                      <span className="text-[7px] text-stone-400 font-bold mt-1 truncate max-w-full">
                        {item.time}
                      </span>
                    </div>
                  );
                }
              );
            })()}
          </div>
        ) : (
          <div className="h-36 rounded-xl bg-stone-50 border border-dashed border-stone-200 flex flex-col items-center justify-center text-stone-400">
            <span className="text-lg">
              📊
            </span>

            <span className="text-[9px] font-bold mt-1">
              Chưa có dữ liệu
            </span>
          </div>
        )}
      </section>

      {/* ======================================================
          STATISTICS
      ====================================================== */}

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-white rounded-2xl border border-stone-200 p-3">
          <div className="flex justify-between text-[8px] uppercase font-bold text-stone-400">
            <span>Thành công</span>
            <span>✅</span>
          </div>

          <div className="text-lg font-black text-emerald-600 mt-1">
            {
              filteredMetrics.completedCount
            }
          </div>

          <div className="text-[8px] text-stone-400">
            đơn
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 p-3">
          <div className="flex justify-between text-[8px] uppercase font-bold text-stone-400">
            <span>Hủy / hoàn</span>
            <span>🚫</span>
          </div>

          <div className="text-lg font-black text-rose-500 mt-1">
            {filteredMetrics.cancelledCount +
              filteredMetrics.refundedCount}
          </div>

          <div className="text-[8px] text-stone-400">
            đơn
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 p-3">
          <div className="flex justify-between text-[8px] uppercase font-bold text-stone-400">
            <span>Giá trị hoàn</span>
            <span>💸</span>
          </div>

          <div className="text-sm font-black text-stone-700 mt-2">
            {formatCurrency(
              filteredMetrics.totalRefundedAmount
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 p-3">
          <div className="flex justify-between text-[8px] uppercase font-bold text-stone-400">
            <span>Tỷ lệ hủy</span>
            <span>📊</span>
          </div>

          <div
            className={`text-lg font-black mt-1 ${
              Number(
                filteredMetrics.cancelRate
              ) > 5
                ? "text-rose-600"
                : "text-stone-800"
            }`}
          >
            {
              filteredMetrics.cancelRate
            }%
          </div>
        </div>
      </section>

      {/* ======================================================
          ACTIONS
      ====================================================== */}

      <section className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />

            <h3 className="text-[10px] font-extrabold text-amber-900">
              Việc cần xử lý
            </h3>
          </div>

          <span className="text-[8px] bg-amber-200 text-amber-800 px-2 py-1 rounded-full font-bold">
            {filteredMetrics.pendingCount +
              outOfStockCount}{" "}
            việc
          </span>
        </div>

        <div className="grid sm:grid-cols-2 gap-2">
          {/* Orders */}
          <div className="bg-white rounded-xl border border-amber-100 px-3 py-2.5 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-stone-800">
                🛒{" "}
                {filteredMetrics.pendingCount}{" "}
                đơn chờ xử lý
              </div>

              <p className="text-[8px] text-stone-400 mt-0.5">
                Kiểm tra và xác nhận đơn mới.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                onNavigateToTab?.(
                  "orders"
                )
              }
              className="shrink-0 bg-[#ee4d2d] text-white px-2.5 py-1.5 rounded-lg text-[8px] font-bold"
            >
              Xử lý
            </button>
          </div>

          {/* Products */}
          <div className="bg-white rounded-xl border border-amber-100 px-3 py-2.5 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-stone-800">
                🚫 {outOfStockCount}{" "}
                món hết hàng
              </div>

              <p className="text-[8px] text-stone-400 mt-0.5">
                Cập nhật trạng thái sản phẩm.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                onNavigateToTab?.(
                  "products"
                )
              }
              className="shrink-0 bg-stone-800 text-white px-2.5 py-1.5 rounded-lg text-[8px] font-bold"
            >
              Cập nhật
            </button>
          </div>
        </div>
      </section>

      {/* ======================================================
          PAYOUT MODAL
      ====================================================== */}

      {isPayoutModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            {/* Modal header */}
            <div className="px-4 py-3.5 border-b border-stone-100 flex items-center justify-between">
              <div>
                <h3 className="text-[12px] font-extrabold text-stone-800">
                  Yêu cầu chuyển tiền
                </h3>

                <p className="text-[9px] text-stone-400 mt-0.5">
                  Chuyển số dư về tài khoản ngân hàng của quán.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setIsPayoutModalOpen(
                    false
                  )
                }
                className="w-7 h-7 rounded-lg bg-stone-100 text-stone-500 hover:bg-stone-200"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={
                handleCreatePayoutRequest
              }
              className="p-4 space-y-3"
            >
              {/* Amount */}
              <div>
                <label className="block text-[9px] font-bold text-stone-500 uppercase mb-1">
                  Số tiền muốn rút
                </label>

                <input
                  type="number"
                  min={50000}
                  max={
                    calculatedBalance
                  }
                  required
                  value={payoutAmount}
                  onChange={(e) =>
                    setPayoutAmount(
                      e.target.value
                    )
                  }
                  placeholder="Nhập số tiền..."
                  className="w-full px-3 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-sm font-bold outline-none focus:border-[#ee4d2d]"
                />

                <div className="text-[8px] text-stone-400 mt-1">
                  Khả dụng:{" "}
                  <strong className="text-emerald-600">
                    {formatCurrency(
                      calculatedBalance
                    )}
                  </strong>
                </div>
              </div>

              {/* Bank */}
              <div className="border-t border-stone-100 pt-3 space-y-2.5">
                <div className="text-[10px] font-bold text-stone-700">
                  Tài khoản nhận tiền
                </div>

                <div>
                  <label className="block text-[8px] text-stone-500 mb-1">
                    Ngân hàng
                  </label>

                  <input
                    required
                    value={bankName}
                    onChange={(e) =>
                      setBankName(
                        e.target.value
                      )
                    }
                    placeholder="VD: Vietcombank"
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 border border-stone-200 text-[10px]"
                  />
                </div>

                <div>
                  <label className="block text-[8px] text-stone-500 mb-1">
                    Số tài khoản
                  </label>

                  <input
                    required
                    value={
                      accountNumber
                    }
                    onChange={(e) =>
                      setAccountNumber(
                        e.target.value
                      )
                    }
                    placeholder="Nhập số tài khoản"
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 border border-stone-200 text-[10px] font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[8px] text-stone-500 mb-1">
                    Tên chủ tài khoản
                  </label>

                  <input
                    required
                    value={
                      accountName
                    }
                    onChange={(e) =>
                      setAccountName(
                        e.target.value
                      )
                    }
                    placeholder="NGUYEN VAN A"
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 border border-stone-200 text-[10px] font-bold uppercase"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-stone-100 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() =>
                    setIsPayoutModalOpen(
                      false
                    )
                  }
                  className="px-3 py-2 rounded-xl bg-stone-100 text-stone-600 text-[10px] font-bold"
                >
                  Hủy
                </button>

                <button
                  type="submit"
                  disabled={
                    isSubmittingPayout
                  }
                  className="px-3.5 py-2 rounded-xl bg-[#ee4d2d] text-white text-[10px] font-bold disabled:opacity-50"
                >
                  {isSubmittingPayout
                    ? "Đang gửi..."
                    : "Gửi yêu cầu"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}