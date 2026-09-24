"use client";

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import VoucherManager from "../merchant/VoucherManager";

import {
  onAuthStateChanged,
  User as FirebaseUser,
} from "firebase/auth";

import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  getDoc,
  setDoc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

import { auth, db } from "@cho-online/firebase";

// ============================================================
// TYPES
// ============================================================

type CommissionPercent = 15 | 20;

type MerchantInfo = {
  merchantCode?: string;
  shopName?: string;
  storeName?: string;
  name?: string;
  commissionPercent?: number;
  isOpen?: boolean;
};

type CommissionPlan = {
  percent: CommissionPercent;
  name: string;
  shortName: string;
  tier: "STANDARD" | "PREMIUM";
  icon: string;
  description: string;
  benefits: string[];
};

type PlatformVoucher = {
  id: string;

  code?: string;
  title?: string;
  description?: string;

  applyType?: string;
  campaignType?: string;

  discountType?: string;
  discountValue?: number;
  maxDiscount?: number;
  minOrder?: number;

  fundingType?: string;
  platformFundingPercent?: number;
  merchantFundingPercent?: number;

  targetType?: string;

  merchantCode?: string | null;
  merchantId?: string | null;
  merchantName?: string | null;

  eligibleCommissionTier?: string;

  isActive?: boolean;

  startDate?: string;
  endDate?: string;

  usageLimit?: number | null;
  usedCount?: number;

  limitPerUser?: number;
};

type VoucherUsageItem = {
  id: string;

  orderId: string;

  code: string;
  title: string;

  discountType:
    | "PERCENTAGE"
    | "FIXED"
    | "UNKNOWN";

  discountValue: number;

  discountAmount: number;

  shippingDiscount: number;

  totalDiscount: number;

  usedAt: any;

  orderStatus: string;

  minOrder: number;

  maxDiscount: number;

  targetType: string;

  fundingType: string;

  merchantFundingPercent: number;

  platformFundingPercent: number;
};

// ============================================================
// COMMISSION PLANS
// ============================================================

const COMMISSION_PLANS: Record<
  CommissionPercent,
  CommissionPlan
> = {
  15: {
    percent: 15,
    name: "Tăng Trưởng",
    shortName: "15% • Tăng trưởng",
    tier: "STANDARD",
    icon: "🚀",
    description:
      "Gói hợp tác tiêu chuẩn với quyền lợi tăng trưởng và tham gia các chương trình của Sàn.",
    benefits: [
      "Gian hàng trên Anvami",
      "Quản lý đơn hàng & sản phẩm",
      "Báo cáo doanh thu",
      "Ưu tiên hiển thị theo chính sách Sàn",
      "Có thể tham gia các chương trình ưu đãi do Sàn triển khai",
      "Hỗ trợ tiêu chuẩn",
    ],
  },

  20: {
    percent: 20,
    name: "Nổi Bật",
    shortName: "20% • Nổi bật",
    tier: "PREMIUM",
    icon: "⭐",
    description:
      "Gói hợp tác nâng cao với mức ưu tiên hiển thị và hỗ trợ chương trình của Sàn.",
    benefits: [
      "Tất cả quyền lợi của gói Tăng Trưởng",
      "Ưu tiên vị trí hiển thị cao hơn",
      "Ưu tiên tham gia chiến dịch của Sàn",
      "Ưu tiên các chương trình ưu đãi do Sàn triển khai",
      "Hỗ trợ ưu tiên cao",
      "Cơ hội hỗ trợ truyền thông/Livestream",
    ],
  },
};

// ============================================================
// HELPERS
// ============================================================

const getOrderDate = (
  createdAt: any
): Date | null => {
  try {
    if (!createdAt) {
      return null;
    }

    if (
      typeof createdAt?.toDate ===
      "function"
    ) {
      const date =
        createdAt.toDate();

      return isNaN(
        date.getTime()
      )
        ? null
        : date;
    }

    const date =
      new Date(createdAt);

    return isNaN(
      date.getTime()
    )
      ? null
      : date;
  } catch {
    return null;
  }
};

function safeNumber(
  value: any
) {
  const num =
    Number(value);

  return Number.isFinite(num)
    ? num
    : 0;
}

function getString(
  value: any
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value).trim();
}

function formatDateTime(
  value: any
) {
  const date =
    getOrderDate(value);

  if (!date) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "vi-VN",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(date);
}

function formatDateOnly(
  value: any
) {
  const date =
    getOrderDate(value);

  if (!date) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "vi-VN",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }
  ).format(date);
}

// ============================================================
// EXTRACT VOUCHER FROM ORDER
// ============================================================

function normalizeVoucherObject(
  voucher: any
): any | null {
  if (!voucher) {
    return null;
  }

  if (
    typeof voucher ===
    "string"
  ) {
    const code =
      voucher.trim();

    if (!code) {
      return null;
    }

    return {
      code,
    };
  }

  if (
    typeof voucher ===
    "object"
  ) {
    return voucher;
  }

  return null;
}

function extractVoucherCandidates(
  order: any
) {
  const candidates: any[] =
    [];

  // ----------------------------------------------------------
  // 1. voucher
  // ----------------------------------------------------------

  if (order?.voucher) {
    if (
      Array.isArray(
        order.voucher
      )
    ) {
      candidates.push(
        ...order.voucher
      );
    } else {
      candidates.push(
        order.voucher
      );
    }
  }

  // ----------------------------------------------------------
  // 2. vouchers
  // ----------------------------------------------------------

  if (
    Array.isArray(
      order?.vouchers
    )
  ) {
    candidates.push(
      ...order.vouchers
    );
  }

  // ----------------------------------------------------------
  // 3. appliedVoucher
  // ----------------------------------------------------------

  if (
    order?.appliedVoucher
  ) {
    if (
      Array.isArray(
        order.appliedVoucher
      )
    ) {
      candidates.push(
        ...order.appliedVoucher
      );
    } else {
      candidates.push(
        order.appliedVoucher
      );
    }
  }

  // ----------------------------------------------------------
  // 4. appliedVouchers
  // ----------------------------------------------------------

  if (
    Array.isArray(
      order?.appliedVouchers
    )
  ) {
    candidates.push(
      ...order.appliedVouchers
    );
  }

  // ----------------------------------------------------------
  // 5. voucherUsage
  // ----------------------------------------------------------

  if (
    order?.voucherUsage
  ) {
    if (
      Array.isArray(
        order.voucherUsage
      )
    ) {
      candidates.push(
        ...order.voucherUsage
      );
    } else {
      candidates.push(
        order.voucherUsage
      );
    }
  }

  // ----------------------------------------------------------
  // 6. DIRECT VOUCHER FIELDS
  // ----------------------------------------------------------

  const directCode =
    getString(
      order?.voucherCode ||
        order?.couponCode ||
        order?.promoCode
    );

  if (directCode) {
    candidates.push({
      code:
        directCode,

      id:
        order?.voucherId,

      title:
        order?.voucherTitle ||
        order?.couponTitle ||
        order?.promoTitle,

      discountType:
        order?.voucherDiscountType,

      discountValue:
        order?.voucherDiscountValue,

      discountAmount:
        order?.voucherDiscount ||
        order?.voucherDiscountAmount ||
        order?.discountAmount,

      shippingDiscount:
        order?.shippingDiscount ||
        order?.voucherShippingDiscount,

      minOrder:
        order?.voucherMinOrder,

      maxDiscount:
        order?.voucherMaxDiscount,

      targetType:
        order?.voucherTargetType,

      fundingType:
        order?.voucherFundingType,

      merchantFundingPercent:
        order?.merchantFundingPercent,

      platformFundingPercent:
        order?.platformFundingPercent,
    });
  }

  return candidates
    .map(
      normalizeVoucherObject
    )
    .filter(Boolean);
}

// ============================================================
// CREATE VOUCHER HISTORY
// ============================================================

function buildVoucherUsageHistory(
  orders: any[]
): VoucherUsageItem[] {
  const history: VoucherUsageItem[] =
    [];

  const seen =
    new Set<string>();

  orders.forEach(
    (order) => {
      const candidates =
        extractVoucherCandidates(
          order
        );

      if (
        candidates.length ===
        0
      ) {
        return;
      }

      candidates.forEach(
        (voucher) => {
          const code =
            getString(
              voucher?.code ||
                voucher?.voucherCode ||
                voucher?.couponCode
            );

          if (!code) {
            return;
          }

          const orderId =
            getString(
              order?.id
            );

          const uniqueKey =
            `${orderId}__${code}`;

          if (
            seen.has(
              uniqueKey
            )
          ) {
            return;
          }

          seen.add(
            uniqueKey
          );

          const discountTypeRaw =
            getString(
              voucher?.discountType ||
                voucher?.type
            ).toUpperCase();

          const discountType =
            discountTypeRaw ===
            "PERCENTAGE"
              ? "PERCENTAGE"
              : discountTypeRaw ===
                "FIXED"
              ? "FIXED"
              : "UNKNOWN";

          const discountValue =
            safeNumber(
              voucher?.discountValue ??
                voucher?.discount ??
                voucher?.value
            );

          const discountAmount =
            safeNumber(
              voucher?.discountAmount ??
                voucher?.voucherDiscount ??
                voucher?.discountApplied ??
                order?.voucherDiscount ??
                order?.discountAmount
            );

          const shippingDiscount =
            safeNumber(
              voucher?.shippingDiscount ??
                voucher?.shippingDiscountAmount ??
                order?.shippingDiscount ??
                order?.voucherShippingDiscount
            );

          const totalDiscount =
            discountAmount +
            shippingDiscount;

          const fundingType =
            getString(
              voucher?.fundingType ||
                order?.voucherFundingType
            ).toUpperCase();

          const targetType =
            getString(
              voucher?.targetType ||
                order?.voucherTargetType
            ).toUpperCase();

          history.push({
            id:
              `${orderId}-${code}`,

            orderId,

            code,

            title:
              getString(
                voucher?.title ||
                  voucher?.name ||
                  voucher?.description
              ) ||
              "Voucher",

            discountType,

            discountValue,

            discountAmount,

            shippingDiscount,

            totalDiscount,

            usedAt:
              order?.createdAt,

            orderStatus:
              getString(
                order?.status
              )
                .toLowerCase()
                .trim(),

            minOrder:
              safeNumber(
                voucher?.minOrder
              ),

            maxDiscount:
              safeNumber(
                voucher?.maxDiscount
              ),

            targetType:
              targetType ||
              "ALL",

            fundingType:
              fundingType ||
              "UNKNOWN",

            merchantFundingPercent:
              safeNumber(
                voucher?.merchantFundingPercent
              ),

            platformFundingPercent:
              safeNumber(
                voucher?.platformFundingPercent
              ),
          });
        }
      );
    }
  );

  history.sort(
    (a, b) => {
      const aTime =
        getOrderDate(
          a.usedAt
        )?.getTime() || 0;

      const bTime =
        getOrderDate(
          b.usedAt
        )?.getTime() || 0;

      return (
        bTime - aTime
      );
    }
  );

  return history;
}

// ============================================================
// COMMISSION PLAN CARD
// ============================================================

function CommissionPlanCard({
  plan,
  active,
  onClick,
}: {
  plan: CommissionPlan;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        w-full text-left relative rounded-2xl border overflow-hidden
        transition-all duration-200 active:scale-[.99]
        ${
          active
            ? "border-[#ee4d2d] bg-gradient-to-r from-[#fff8f5] to-white shadow-sm ring-1 ring-[#ee4d2d]/10"
            : "border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm"
        }
      `}
    >
      {active && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#ee4d2d]" />
      )}

      <div className="px-3.5 py-3">

        <div className="flex items-center justify-between gap-3">

          <div className="flex items-center gap-3 min-w-0">

            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${
                active
                  ? "bg-orange-100"
                  : "bg-stone-100"
              }`}
            >
              {plan.icon}
            </div>

            <div className="min-w-0">

              <div className="flex items-center gap-2 flex-wrap">

                <div
                  className={`text-[11px] font-black ${
                    active
                      ? "text-[#ee4d2d]"
                      : "text-stone-800"
                  }`}
                >
                  {plan.name}
                </div>

                <span
                  className={`text-[10px] font-black ${
                    active
                      ? "text-[#ee4d2d]"
                      : "text-stone-600"
                  }`}
                >
                  {plan.percent}%
                </span>

              </div>

              <div className="text-[8px] text-stone-400 mt-0.5">
                Chiết khấu Sàn • Bấm để xem chính sách
              </div>

            </div>
          </div>

          {active ? (
            <span className="shrink-0 bg-[#ee4d2d] text-white text-[7px] font-black px-2 py-1 rounded-full">
              ĐANG DÙNG
            </span>
          ) : (
            <span className="shrink-0 text-stone-300 text-xl leading-none">
              ›
            </span>
          )}

        </div>

        <div className="mt-2.5 pt-2.5 border-t border-stone-100 flex items-center justify-between gap-3">

          <div className="flex items-baseline gap-1.5">

            <span
              className={`text-xl font-black leading-none ${
                active
                  ? "text-[#ee4d2d]"
                  : "text-stone-800"
              }`}
            >
              {plan.percent}%
            </span>

            <span className="text-[8px] text-stone-400">
              chiết khấu Sàn
            </span>

          </div>

          <span
            className={`text-[8px] font-bold px-2.5 py-1 rounded-lg ${
              active
                ? "bg-orange-50 text-orange-700"
                : "bg-stone-100 text-stone-500"
            }`}
          >
            Xem chính sách →
          </span>

        </div>

      </div>
    </button>
  );
}

// ============================================================
// MAIN
// ============================================================

export default function SettingsTab() {
  // ==========================================================
  // STATE
  // ==========================================================

  const [isNotiEnabled, setIsNotiEnabled] =
    useState(false);

  const [
    isVoucherManagerOpen,
    setIsVoucherManagerOpen,
  ] = useState(false);

  const [selectedPlan, setSelectedPlan] =
    useState<CommissionPlan | null>(
      null
    );

  const [currentUser, setCurrentUser] =
    useState<FirebaseUser | null>(
      null
    );

  const [merchantInfo, setMerchantInfo] =
    useState<MerchantInfo | null>(
      null
    );

  const [
    loadingMerchant,
    setLoadingMerchant,
  ] = useState(true);

  const [
    platformVouchers,
    setPlatformVouchers,
  ] = useState<
    PlatformVoucher[]
  >([]);

  const [
    loadingPlatformVouchers,
    setLoadingPlatformVouchers,
  ] = useState(false);

  // ==========================================================
  // 1. NOTIFICATION
  // ==========================================================

  useEffect(() => {
    if (
      typeof window !==
        "undefined" &&
      "Notification" in window &&
      Notification.permission ===
        "granted"
    ) {
      setIsNotiEnabled(true);
    }
  }, []);

  // ==========================================================
  // 2. AUTH + LOAD MERCHANT
  // ==========================================================

  useEffect(() => {
    let unsubscribeMerchant:
      | (() => void)
      | undefined;

    const unsubscribeAuth =
      onAuthStateChanged(
        auth,
        (user) => {
          if (
            unsubscribeMerchant
          ) {
            unsubscribeMerchant();
            unsubscribeMerchant =
              undefined;
          }

          if (!user) {
            setCurrentUser(null);
            setMerchantInfo(null);
            setPlatformVouchers(
              []
            );
            setLoadingMerchant(
              false
            );
            setIsVoucherManagerOpen(
              false
            );
            return;
          }

          setCurrentUser(user);
          setLoadingMerchant(
            true
          );

          const merchantRef =
            doc(
              db,
              "merchants",
              user.uid
            );

          unsubscribeMerchant =
            onSnapshot(
              merchantRef,
              (snapshot) => {
                if (
                  !snapshot.exists()
                ) {
                  setMerchantInfo(
                    null
                  );
                  setLoadingMerchant(
                    false
                  );
                  return;
                }

                const data =
                  snapshot.data() as MerchantInfo;

                const commission =
                  Number(
                    data.commissionPercent
                  ) === 20
                    ? 20
                    : 15;

                setMerchantInfo({
                  merchantCode:
                    data.merchantCode ||
                    "",

                  shopName:
                    data.shopName ||
                    data.storeName ||
                    data.name ||
                    "Quán của tôi",

                  storeName:
                    data.storeName ||
                    "",

                  name:
                    data.name ||
                    "",

                  commissionPercent:
                    commission,

                  isOpen:
                    data.isOpen ??
                    true,
                });

                setLoadingMerchant(
                  false
                );
              },
              (error) => {
                console.error(
                  "❌ Không thể tải thông tin merchant:",
                  error
                );

                setMerchantInfo(
                  null
                );

                setLoadingMerchant(
                  false
                );
              }
            );
        }
      );

    return () => {
      unsubscribeAuth();

      if (
        unsubscribeMerchant
      ) {
        unsubscribeMerchant();
      }
    };
  }, []);

  // ==========================================================
  // 3. CURRENT PLAN
  // ==========================================================

  const currentCommission: CommissionPercent =
    merchantInfo?.commissionPercent ===
    20
      ? 20
      : 15;

  const currentPlan =
    COMMISSION_PLANS[
      currentCommission
    ];

  // ==========================================================
  // 4. LOAD PLATFORM VOUCHERS
  // ==========================================================

  useEffect(() => {
    if (
      !currentUser ||
      !merchantInfo
    ) {
      setPlatformVouchers([]);
      setLoadingPlatformVouchers(
        false
      );
      return;
    }

    setLoadingPlatformVouchers(
      true
    );

    const vouchersRef =
      collection(
        db,
        "vouchers"
      );

    const vouchersQuery =
      query(
        vouchersRef,
        where(
          "isActive",
          "==",
          true
        )
      );

    const unsubscribe =
      onSnapshot(
        vouchersQuery,
        (snapshot) => {
          const now =
            new Date();

          const merchantCode =
            merchantInfo.merchantCode ||
            "";

          const merchantId =
            currentUser.uid;

          const currentTier =
            currentPlan.tier;

          const result: PlatformVoucher[] =
            [];

          snapshot.forEach(
            (voucherDoc) => {
              const data =
                voucherDoc.data() as PlatformVoucher;

              // ------------------------------------------------
              // ACTIVE
              // ------------------------------------------------

              if (
                data.isActive !==
                true
              ) {
                return;
              }

              // ------------------------------------------------
              // PLATFORM FUNDING
              // ------------------------------------------------

              if (
                String(
                  data.fundingType ||
                    ""
                ).toUpperCase() !==
                "PLATFORM"
              ) {
                return;
              }

              // ------------------------------------------------
              // SHIPPING
              // ------------------------------------------------

              if (
                String(
                  data.applyType ||
                    ""
                ).toUpperCase() !==
                "SHIPPING"
              ) {
                return;
              }

              // ------------------------------------------------
              // COMMISSION TIER
              // ------------------------------------------------

              const eligibleTier =
                String(
                  data.eligibleCommissionTier ||
                    ""
                ).toUpperCase();

              if (
                eligibleTier &&
                eligibleTier !==
                  currentTier
              ) {
                return;
              }

              // ------------------------------------------------
              // START DATE
              // ------------------------------------------------

              if (
                data.startDate
              ) {
                const startDate =
                  new Date(
                    data.startDate
                  );

                if (
                  !Number.isNaN(
                    startDate.getTime()
                  ) &&
                  now < startDate
                ) {
                  return;
                }
              }

              // ------------------------------------------------
              // END DATE
              // ------------------------------------------------

              if (
                data.endDate
              ) {
                const endDate =
                  new Date(
                    data.endDate
                  );

                if (
                  !Number.isNaN(
                    endDate.getTime()
                  ) &&
                  now > endDate
                ) {
                  return;
                }
              }

              // ------------------------------------------------
              // TARGET TYPE
              // ------------------------------------------------

              const targetType =
                String(
                  data.targetType ||
                    "ALL"
                ).toUpperCase();

              // ------------------------------------------------
              // ALL
              // ------------------------------------------------

              if (
                targetType ===
                "ALL"
              ) {
                result.push({
                  ...data,
                  id: voucherDoc.id,
                });

                return;
              }

              // ------------------------------------------------
              // MERCHANT
              // ------------------------------------------------

              if (
                targetType ===
                "MERCHANT"
              ) {
                const targetMerchantCode =
                  data.merchantCode ||
                  "";

                const targetMerchantId =
                  data.merchantId ||
                  "";

                const isForCurrentMerchant =
                  Boolean(
                    targetMerchantCode &&
                      targetMerchantCode ===
                        merchantCode
                  ) ||
                  Boolean(
                    targetMerchantId &&
                      targetMerchantId ===
                        merchantId
                  );

                if (
                  isForCurrentMerchant
                ) {
                  result.push({
                    ...data,
                    id: voucherDoc.id,
                  });
                }

                return;
              }
            }
          );

          result.sort(
            (a, b) => {
              const aStart =
                a.startDate
                  ? new Date(
                      a.startDate
                    ).getTime()
                  : 0;

              const bStart =
                b.startDate
                  ? new Date(
                      b.startDate
                    ).getTime()
                  : 0;

              return (
                bStart -
                aStart
              );
            }
          );

          setPlatformVouchers(
            result
          );

          setLoadingPlatformVouchers(
            false
          );
        },
        (error) => {
          console.error(
            "❌ Không thể tải voucher Sàn:",
            error
          );

          setPlatformVouchers(
            []
          );

          setLoadingPlatformVouchers(
            false
          );
        }
      );

    return () => {
      unsubscribe();
    };
  }, [
    currentUser,
    merchantInfo,
    currentPlan.tier,
  ]);

  // ==========================================================
  // 5. LOAD ORDER HISTORY FOR VOUCHER USAGE
  // ==========================================================

  const [
    voucherHistoryOrders,
    setVoucherHistoryOrders,
  ] = useState<any[]>([]);

  useEffect(() => {
    if (!currentUser) {
      setVoucherHistoryOrders(
        []
      );
      return;
    }

    const ordersQuery =
      query(
        collection(
          db,
          "orders"
        ),
        where(
          "merchantId",
          "==",
          currentUser.uid
        )
      );

    const unsubscribe =
      onSnapshot(
        ordersQuery,
        (snapshot) => {
          const result =
            snapshot.docs.map(
              (docSnap) => {
                const data =
                  docSnap.data();

                return {
                  id:
                    docSnap.id,

                  createdAt:
                    data.createdAt,

                  status:
                    data.status,

                  voucher:
                    data.voucher,

                  vouchers:
                    data.vouchers,

                  appliedVoucher:
                    data.appliedVoucher,

                  appliedVouchers:
                    data.appliedVouchers,

                  voucherUsage:
                    data.voucherUsage,

                  voucherCode:
                    data.voucherCode,

                  voucherId:
                    data.voucherId,

                  voucherTitle:
                    data.voucherTitle,

                  voucherDiscount:
                    data.voucherDiscount,

                  voucherDiscountAmount:
                    data.voucherDiscountAmount,

                  voucherDiscountType:
                    data.voucherDiscountType,

                  voucherDiscountValue:
                    data.voucherDiscountValue,

                  voucherShippingDiscount:
                    data.voucherShippingDiscount,

                  voucherMinOrder:
                    data.voucherMinOrder,

                  voucherMaxDiscount:
                    data.voucherMaxDiscount,

                  voucherTargetType:
                    data.voucherTargetType,

                  voucherFundingType:
                    data.voucherFundingType,

                  shippingDiscount:
                    data.shippingDiscount,

                  discountAmount:
                    data.discountAmount,

                  couponCode:
                    data.couponCode,

                  promoCode:
                    data.promoCode,

                  couponTitle:
                    data.couponTitle,

                  promoTitle:
                    data.promoTitle,

                  merchantId:
                    data.merchantId,
                };
              }
            );

          setVoucherHistoryOrders(
            result
          );
        },
        (error) => {
          console.error(
            "❌ Không thể tải lịch sử voucher:",
            error
          );

          setVoucherHistoryOrders(
            []
          );
        }
      );

    return () => {
      unsubscribe();
    };
  }, [currentUser]);

  // ==========================================================
  // 6. VOUCHER USAGE HISTORY
  // ==========================================================

  const voucherUsageHistory =
    useMemo(() => {
      return buildVoucherUsageHistory(
        voucherHistoryOrders
      );
    }, [
      voucherHistoryOrders,
    ]);

  const voucherUsageStats =
    useMemo(() => {
      const totalUsed =
        voucherUsageHistory.length;

      const totalDiscount =
        voucherUsageHistory.reduce(
          (
            sum,
            item
          ) =>
            sum +
            item.discountAmount,
          0
        );

      const totalShippingDiscount =
        voucherUsageHistory.reduce(
          (
            sum,
            item
          ) =>
            sum +
            item.shippingDiscount,
          0
        );

      const totalBenefit =
        voucherUsageHistory.reduce(
          (
            sum,
            item
          ) =>
            sum +
            item.totalDiscount,
          0
        );

      const platformFunded =
        voucherUsageHistory.filter(
          (item) =>
            item.fundingType ===
            "PLATFORM"
        ).length;

      return {
        totalUsed,
        totalDiscount,
        totalShippingDiscount,
        totalBenefit,
        platformFunded,
      };
    }, [
      voucherUsageHistory,
    ]);

  // ==========================================================
  // 7. NOTIFICATION TEST
  // ==========================================================

  const playNotificationTest =
    () => {
      const audio =
        new Audio(
          "/notification.mp3"
        );

      audio
        .play()
        .then(() => {
          alert(
            "Âm thanh thiết bị hoạt động bình thường!"
          );
        })
        .catch((err) => {
          alert(
            "Lỗi phát âm thanh: " +
              err.message
          );
        });
    };

  // ==========================================================
  // 8. OPEN VOUCHER MANAGER
  // ==========================================================

  const handleOpenVoucherManager =
    () => {
      if (!currentUser) {
        alert(
          "Không tìm thấy tài khoản cửa hàng."
        );
        return;
      }

      setIsVoucherManagerOpen(
        true
      );
    };

  // ==========================================================
  // 9. OPEN PLAN
  // ==========================================================

  const handleOpenPlan =
    (
      plan: CommissionPlan
    ) => {
      setSelectedPlan(
        plan
      );
    };

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <>
      <div className="space-y-4 text-xs">

        {/* ====================================================
            1. SHOP + SERVICE PLAN
        ==================================================== */}

        <section className="bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden">

          <div className="p-4 border-b border-stone-100">

            <div className="flex items-start justify-between gap-3">

              <div className="min-w-0">

                <div className="flex items-center gap-2 flex-wrap">

                  <h2 className="font-bold text-stone-800">
                    Gói dịch vụ
                  </h2>

                  <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[8px] font-black text-emerald-600">
                    ĐANG SỬ DỤNG
                  </span>

                </div>

                <p className="mt-1 text-[10px] text-stone-400">
                  Gói hợp tác hiện tại của gian hàng.
                  Bấm vào gói để xem chính sách và quyền lợi.
                </p>

              </div>

              {!loadingMerchant && (
                <div
                  className={`shrink-0 rounded-xl px-3 py-2 text-center border ${
                    currentCommission ===
                    20
                      ? "bg-amber-50 border-amber-200"
                      : "bg-sky-50 border-sky-200"
                  }`}
                >

                  <div className="text-lg leading-none">
                    {currentPlan.icon}
                  </div>

                  <div
                    className={`mt-1 text-sm font-black ${
                      currentCommission ===
                      20
                        ? "text-amber-700"
                        : "text-sky-700"
                    }`}
                  >
                    {
                      currentCommission
                    }%
                  </div>

                  <div className="text-[8px] font-bold text-stone-400">
                    Chiết khấu Sàn
                  </div>

                </div>
              )}

            </div>

          </div>

          {loadingMerchant ? (

            <div className="p-5 text-center text-[10px] text-stone-400">
              Đang tải thông tin gian hàng...
            </div>

          ) : merchantInfo ? (

            <div className="p-4 space-y-2">

              {/* CURRENT PLAN */}

              <button
                type="button"
                onClick={() =>
                  handleOpenPlan(
                    currentPlan
                  )
                }
                className={`w-full text-left rounded-2xl border p-3 transition hover:shadow-sm ${
                  currentCommission ===
                  20
                    ? "border-amber-200 bg-amber-50/50 hover:bg-amber-50"
                    : "border-sky-200 bg-sky-50/50 hover:bg-sky-50"
                }`}
              >

                <div className="flex items-center gap-3">

                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl ${
                      currentCommission ===
                      20
                        ? "bg-amber-100"
                        : "bg-sky-100"
                    }`}
                  >
                    {
                      currentPlan.icon
                    }
                  </div>

                  <div className="min-w-0 flex-1">

                    <div className="flex items-center gap-2 flex-wrap">

                      <p className="text-[9px] uppercase tracking-wide font-bold text-stone-400">
                        Gói hiện tại
                      </p>

                      <span
                        className={`rounded-full px-2 py-0.5 text-[7px] font-black ${
                          currentCommission ===
                          20
                            ? "bg-amber-500 text-white"
                            : "bg-sky-500 text-white"
                        }`}
                      >
                        {
                          currentCommission
                        }%
                      </span>

                    </div>

                    <p className="mt-0.5 text-sm font-black text-stone-800">
                      {
                        currentPlan.name
                      }
                    </p>

                    <p className="mt-0.5 text-[9px] leading-4 text-stone-500">
                      {
                        currentPlan.description
                      }
                    </p>

                  </div>

                  <div className="shrink-0 text-stone-400 text-base">
                    →
                  </div>

                </div>

                <div className="mt-2 pt-2 border-t border-black/5 flex items-center justify-between">

                  <span className="text-[8px] font-bold text-stone-400">
                    Xem chính sách & quyền lợi
                  </span>

                  <span className="text-[8px] font-bold text-stone-500">
                    {
                      currentPlan.benefits.length
                    }{" "}
                    quyền lợi
                  </span>

                </div>

              </button>

              {/* SHOP */}

              <div className="rounded-2xl border border-stone-100 bg-stone-50 p-3">

                <div className="flex items-center justify-between gap-3">

                  <div className="min-w-0">

                    <p className="text-[9px] uppercase tracking-wide font-bold text-stone-400">
                      Gian hàng
                    </p>

                    <p className="mt-1 text-sm font-black text-stone-800 truncate">
                      {
                        merchantInfo.shopName ||
                        "Quán của tôi"
                      }
                    </p>

                    {merchantInfo.merchantCode && (
                      <p className="mt-1 text-[9px] text-stone-400">

                        Mã gian hàng:{" "}

                        <span className="font-bold text-stone-600">
                          {
                            merchantInfo.merchantCode
                          }
                        </span>

                      </p>
                    )}

                  </div>

                  <div className="shrink-0">

                    {merchantInfo.isOpen ? (

                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-1 text-[8px] font-bold text-emerald-600">

                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />

                        Đang hoạt động

                      </span>

                    ) : (

                      <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 border border-stone-200 px-2 py-1 text-[8px] font-bold text-stone-500">

                        <span className="h-1.5 w-1.5 rounded-full bg-stone-400" />

                        Đang đóng cửa

                      </span>

                    )}

                  </div>

                </div>

              </div>

              {/* OTHER PLANS */}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">

                {(
                  Object.values(
                    COMMISSION_PLANS
                  ) as CommissionPlan[]
                )
                  .filter(
                    (plan) =>
                      plan.percent !==
                      currentCommission
                  )
                  .map(
                    (plan) => (
                      <button
                        key={
                          plan.percent
                        }
                        type="button"
                        onClick={() =>
                          handleOpenPlan(
                            plan
                          )
                        }
                        className="rounded-xl border border-stone-100 bg-white p-3 text-left transition hover:border-stone-200 hover:bg-stone-50 hover:shadow-sm"
                      >

                        <div className="flex items-center gap-3">

                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-stone-50 border border-stone-100 text-lg">
                            {
                              plan.icon
                            }
                          </div>

                          <div className="min-w-0 flex-1">

                            <div className="flex items-center justify-between gap-2">

                              <p className="text-[11px] font-black text-stone-800">
                                {
                                  plan.name
                                }
                              </p>

                              <span className="text-[10px] font-black text-stone-600">
                                {
                                  plan.percent
                                }%
                              </span>

                            </div>

                            <p className="mt-0.5 text-[8px] leading-4 text-stone-400 line-clamp-2">
                              {
                                plan.description
                              }
                            </p>

                          </div>

                          <span className="text-stone-300">
                            →
                          </span>

                        </div>

                      </button>
                    )
                  )}

              </div>

            </div>

          ) : (

            <div className="m-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-[10px] text-rose-600">
              Không tìm thấy thông tin gian hàng.
            </div>

          )}

        </section>


        {/* ====================================================
            2. VOUCHER & PROMOTION
        ==================================================== */}

        <section className="bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden">

          {/* HEADER */}

          <div className="p-4 border-b border-stone-100">

            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">

              <div className="min-w-0">

                <div className="flex flex-wrap items-center gap-2">

                  <h2 className="font-bold text-stone-800">
                    Voucher & khuyến mãi
                  </h2>

                  <span
                    className={`rounded-full px-2 py-0.5 text-[8px] font-black border ${
                      currentCommission ===
                      20
                        ? "bg-amber-50 border-amber-200 text-amber-700"
                        : "bg-sky-50 border-sky-200 text-sky-700"
                    }`}
                  >
                    {
                      currentPlan.shortName
                    }
                  </span>

                </div>

                <p className="mt-1 text-[10px] leading-4 text-stone-400">
                  Theo dõi các chương trình voucher của
                  Anvami và voucher riêng của gian hàng.
                </p>

              </div>

              <div className="flex shrink-0 gap-2">

                <button
                  type="button"
                  onClick={
                    handleOpenVoucherManager
                  }
                  disabled={
                    !currentUser
                  }
                  className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-[10px] font-bold text-violet-700 transition hover:bg-violet-100 disabled:opacity-50"
                >
                  🎫 Quản lý Voucher
                </button>

                <button
                  type="button"
                  onClick={
                    handleOpenVoucherManager
                  }
                  disabled={
                    !currentUser
                  }
                  className="rounded-xl bg-violet-600 px-3 py-2 text-[10px] font-bold text-white transition hover:bg-violet-500 disabled:opacity-50"
                >
                  + Tạo Voucher
                </button>

              </div>

            </div>

          </div>

          {/* PLATFORM SUMMARY */}

          <div className="p-4">

            <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-white overflow-hidden">

              <div className="p-3">

                <div className="flex items-start gap-3">

                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white border border-emerald-200 text-lg">
                    🎟️
                  </div>

                  <div className="min-w-0 flex-1">

                    <div className="flex items-center gap-2 flex-wrap">

                      <p className="text-[11px] font-black text-stone-800">
                        Ưu đãi từ Anvami
                      </p>

                      <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[7px] font-black text-white">
                        SÀN TÀI TRỢ
                      </span>

                    </div>

                    <p className="mt-1 text-[9px] leading-4 text-stone-500">
                      Các voucher dưới đây được hệ thống
                      tự động xác định theo gói{" "}
                      <strong>
                        {
                          currentPlan.name
                        }
                      </strong>{" "}
                      của gian hàng.
                    </p>

                  </div>

                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">

                  <QuickStat
                    label="Đang áp dụng"
                    value={String(
                      platformVouchers.length
                    )}
                    icon="🎫"
                  />

                  <QuickStat
                    label="Sàn tài trợ"
                    value="100%"
                    icon="💰"
                  />

                  <QuickStat
                    label="Gói hiện tại"
                    value={`${currentCommission}%`}
                    icon={
                      currentPlan.icon
                    }
                  />

                </div>

              </div>

            </div>

            {/* PLATFORM VOUCHER LIST */}

            <div className="mt-4">

              <div className="flex items-center justify-between gap-2 mb-2">

                <div>

                  <p className="text-[10px] font-black text-stone-800">
                    Voucher Sàn dành cho gian hàng
                  </p>

                  <p className="text-[8px] text-stone-400">
                    Voucher đang hoạt động và phù hợp với
                    gói hợp tác của bạn.
                  </p>

                </div>

                {platformVouchers.length >
                  0 && (
                  <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-1 text-[8px] font-black text-emerald-700">
                    {
                      platformVouchers.length
                    }{" "}
                    voucher
                  </span>
                )}

              </div>

              {loadingPlatformVouchers ? (

                <div className="rounded-xl border border-stone-100 bg-stone-50 p-5 text-center">

                  <div className="text-lg">
                    ⏳
                  </div>

                  <p className="mt-1 text-[10px] font-bold text-stone-500">
                    Đang kiểm tra ưu đãi từ Sàn...
                  </p>

                </div>

              ) : platformVouchers.length ===
                0 ? (

                <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50 p-5 text-center">

                  <div className="text-2xl">
                    🎫
                  </div>

                  <p className="mt-1 text-[10px] font-bold text-stone-600">
                    Chưa có voucher Sàn áp dụng
                  </p>

                  <p className="mt-0.5 text-[8px] leading-4 text-stone-400">
                    Khi có chương trình phù hợp với gói
                    dịch vụ của gian hàng, voucher sẽ tự
                    động xuất hiện tại đây.
                  </p>

                </div>

              ) : (

                <div className="space-y-2">

                  {platformVouchers.map(
                    (
                      voucher
                    ) => (
                      <PlatformVoucherCard
                        key={
                          voucher.id
                        }
                        voucher={
                          voucher
                        }
                      />
                    )
                  )}

                </div>

              )}

            </div>

            {/* VOUCHER INFO */}

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-2">

              <VoucherInfoCard
                icon="🎟️"
                title="Voucher riêng"
                description="Voucher do gian hàng tự tạo và tự cấu hình."
              />

              <VoucherInfoCard
                icon={
                  currentPlan.icon
                }
                title="Quyền lợi gói"
                description={`Gian hàng hiện đang sử dụng gói ${currentCommission}%.`}
              />

              <VoucherInfoCard
                icon="💰"
                title="Tài trợ"
                description="Phân biệt rõ ngân sách Sàn, gian hàng hoặc hai bên cùng tài trợ."
              />

            </div>

          </div>
        </section>


        {/* ====================================================
            3. SYSTEM / NOTIFICATION
        ==================================================== */}

        <section className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-xs">

          <div className="flex items-start justify-between gap-3 border-b border-stone-100 pb-3">

            <div>

              <h2 className="font-bold text-stone-800">
                Thông tin & vận hành
              </h2>

              <p className="mt-0.5 text-[10px] text-stone-400">
                Trạng thái thiết bị và hệ thống nhận đơn.
              </p>

            </div>

            <span className="rounded-full bg-stone-100 px-2 py-1 text-[9px] font-bold text-stone-500">
              Cài đặt
            </span>

          </div>

          <div className="mt-3 flex items-center justify-between gap-3">

            <div className="min-w-0">

              <p className="font-bold text-stone-700">
                Hệ thống nhận thông báo tự động
              </p>

              <p className="text-[10px] text-stone-400">
                Thiết bị luôn sẵn sàng nhận đơn hàng ở mọi
                màn hình.
              </p>

            </div>

            <div className="shrink-0">

              {isNotiEnabled ? (

                <span className="text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1 text-[9px] font-bold">

                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />

                  Đang hoạt động

                </span>

              ) : (

                <span className="text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 text-[9px] font-bold">
                  Chưa cấp quyền
                </span>

              )}

            </div>

          </div>

          <div className="pt-3 mt-3 border-t border-stone-100 flex justify-end">

            <button
              type="button"
              onClick={
                playNotificationTest
              }
              className="text-[11px] text-emerald-600 font-medium hover:underline cursor-pointer"
            >
              🔊 Bấm để nghe thử chuông báo
            </button>

          </div>
        </section>


        {/* ====================================================
            4. VOUCHER USAGE HISTORY
        ==================================================== */}

        <section className="bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden">

          {/* HEADER */}

          <div className="p-4 border-b border-stone-100">

            <div className="flex items-start justify-between gap-3">

              <div>

                <div className="flex items-center gap-2 flex-wrap">

                  <h2 className="font-bold text-stone-800">
                    Lịch sử voucher đã sử dụng
                  </h2>

                  <span className="rounded-full bg-violet-50 border border-violet-200 px-2 py-0.5 text-[8px] font-black text-violet-700">
                    {
                      voucherUsageStats.totalUsed
                    }{" "}
                    LẦN
                  </span>

                </div>

                <p className="mt-1 text-[10px] leading-4 text-stone-400">
                  Theo dõi các voucher đã được áp dụng vào
                  đơn hàng của gian hàng.
                </p>

              </div>

              <button
                type="button"
                onClick={
                  handleOpenVoucherManager
                }
                className="shrink-0 rounded-xl bg-violet-600 px-3 py-2 text-[9px] font-bold text-white hover:bg-violet-500"
              >
                🎫 Quản lý
              </button>

            </div>

          </div>

          {/* SUMMARY */}

          <div className="p-4">

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">

              <VoucherHistoryStat
                label="Lần sử dụng"
                value={String(
                  voucherUsageStats.totalUsed
                )}
                icon="🎟️"
              />

              <VoucherHistoryStat
                label="Giảm voucher"
                value={formatVND(
                  voucherUsageStats.totalDiscount
                )}
                icon="🏷️"
              />

              <VoucherHistoryStat
                label="Giảm vận chuyển"
                value={formatVND(
                  voucherUsageStats.totalShippingDiscount
                )}
                icon="🚚"
              />

              <VoucherHistoryStat
                label="Tổng lợi ích"
                value={formatVND(
                  voucherUsageStats.totalBenefit
                )}
                icon="💰"
              />

            </div>


            {/* LIST HEADER */}

            <div className="mt-4 flex items-center justify-between gap-2">

              <div>

                <p className="text-[10px] font-black text-stone-800">
                  Chi tiết sử dụng
                </p>

                <p className="text-[8px] text-stone-400 mt-0.5">
                  Sắp xếp theo thời gian sử dụng gần nhất.
                </p>

              </div>

              {voucherUsageHistory.length >
                0 && (
                <span className="text-[8px] text-stone-400">
                  {
                    voucherUsageHistory.length
                  }{" "}
                  bản ghi
                </span>
              )}

            </div>


            {/* EMPTY */}

            {voucherUsageHistory.length ===
            0 ? (

              <div className="mt-3 rounded-2xl border border-dashed border-stone-200 bg-stone-50 p-6 text-center">

                <div className="text-3xl">
                  🎟️
                </div>

                <p className="mt-2 text-[10px] font-bold text-stone-600">
                  Chưa có lịch sử sử dụng voucher
                </p>

                <p className="mt-1 text-[8px] leading-4 text-stone-400 max-w-sm mx-auto">
                  Khi khách hàng sử dụng voucher trong đơn
                  hàng của gian hàng, lịch sử sẽ tự động
                  xuất hiện tại đây.
                </p>

              </div>

            ) : (

              <div className="mt-3 rounded-2xl border border-stone-100 overflow-hidden">

                <div className="max-h-[460px] overflow-y-auto">

                  <div className="divide-y divide-stone-100">

                    {voucherUsageHistory.map(
                      (
                        item
                      ) => (
                        <VoucherUsageRow
                          key={
                            item.id
                          }
                          item={
                            item
                          }
                        />
                      )
                    )}

                  </div>

                </div>

              </div>

            )}

          </div>
        </section>

      </div>


      {/* ======================================================
          PLAN DETAIL MODAL
      ====================================================== */}

      {selectedPlan && (
        <div
          className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() =>
            setSelectedPlan(null)
          }
        >

          <div
            className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(
              event
            ) =>
              event.stopPropagation()
            }
          >

            {/* HEADER */}

            <div className="px-4 py-3.5 border-b border-stone-100">

              <div className="flex items-center justify-between gap-3">

                <div className="flex items-center gap-3 min-w-0">

                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl ${
                      selectedPlan.percent ===
                      20
                        ? "bg-amber-50 border border-amber-200"
                        : "bg-sky-50 border border-sky-200"
                    }`}
                  >
                    {
                      selectedPlan.icon
                    }
                  </div>

                  <div className="min-w-0">

                    <div className="flex items-center gap-2 flex-wrap">

                      <h3 className="text-sm font-black text-stone-800">
                        {
                          selectedPlan.name
                        }
                      </h3>

                      {selectedPlan.percent ===
                        currentCommission && (
                        <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[7px] font-black text-emerald-600">
                          GÓI HIỆN TẠI
                        </span>
                      )}

                    </div>

                    <p className="mt-0.5 text-[10px] text-stone-400">
                      Chiết khấu Sàn:{" "}
                      <span className="font-black text-stone-700">
                        {
                          selectedPlan.percent
                        }
                        %
                      </span>
                    </p>

                  </div>

                </div>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedPlan(
                      null
                    )
                  }
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-500 transition hover:bg-stone-200"
                  aria-label="Đóng"
                >
                  ✕
                </button>

              </div>

            </div>

            {/* BODY */}

            <div className="p-4 overflow-y-auto space-y-4">

              <div className="rounded-xl border border-stone-100 bg-stone-50 p-3">

                <p className="text-[9px] uppercase tracking-wide font-black text-stone-400">
                  Mô tả gói
                </p>

                <p className="mt-1.5 text-[10px] leading-5 text-stone-600">
                  {
                    selectedPlan.description
                  }
                </p>

              </div>

              <div>

                <div className="flex items-center justify-between gap-2">

                  <div>
                    <p className="text-[11px] font-black text-stone-800">
                      Chính sách & quyền lợi
                    </p>

                    <p className="mt-0.5 text-[8px] text-stone-400">
                      Những quyền lợi áp dụng theo gói hợp tác.
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-2 py-1 text-[8px] font-black ${
                      selectedPlan.percent ===
                      20
                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                        : "bg-sky-50 text-sky-700 border border-sky-200"
                    }`}
                  >
                    {
                      selectedPlan.tier
                    }
                  </span>

                </div>

                <div className="mt-2 space-y-2">

                  {
                    selectedPlan.benefits.map(
                      (
                        benefit,
                        index
                      ) => (
                        <div
                          key={`${selectedPlan.percent}-${index}`}
                          className="flex items-start gap-2 rounded-xl border border-stone-100 bg-white p-2.5"
                        >

                          <span
                            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-black ${
                              selectedPlan.percent ===
                              20
                                ? "bg-amber-50 text-amber-600"
                                : "bg-sky-50 text-sky-600"
                            }`}
                          >
                            ✓
                          </span>

                          <p className="text-[9px] leading-4 text-stone-600">
                            {
                              benefit
                            }
                          </p>

                        </div>
                      )
                    )
                  }

                </div>

              </div>

              <div className="grid grid-cols-2 gap-2">

                <div className="rounded-xl border border-stone-100 bg-stone-50 p-3">

                  <p className="text-[8px] uppercase tracking-wide font-bold text-stone-400">
                    Chiết khấu Sàn
                  </p>

                  <p
                    className={`mt-1 text-lg font-black ${
                      selectedPlan.percent ===
                      20
                        ? "text-amber-700"
                        : "text-sky-700"
                    }`}
                  >
                    {
                      selectedPlan.percent
                    }
                    %
                  </p>

                </div>

                <div className="rounded-xl border border-stone-100 bg-stone-50 p-3">

                  <p className="text-[8px] uppercase tracking-wide font-bold text-stone-400">
                    Trạng thái
                  </p>

                  <p className="mt-1 text-[10px] font-black text-stone-700">
                    {selectedPlan.percent ===
                    currentCommission
                      ? "Đang sử dụng"
                      : "Gói tham khảo"}
                  </p>

                </div>

              </div>

              <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">

                <div className="flex items-start gap-2">

                  <span className="text-sm">
                    ℹ️
                  </span>

                  <p className="text-[9px] leading-4 text-amber-700">
                    Mức chiết khấu và quyền lợi được áp dụng
                    theo cấu hình hợp tác của gian hàng trên
                    hệ thống Anvami. Các chương trình hỗ trợ
                    có thể được điều chỉnh theo chính sách của Sàn.
                  </p>

                </div>

              </div>

            </div>

            {/* FOOTER */}

            <div className="border-t border-stone-100 p-3">

              <button
                type="button"
                onClick={() =>
                  setSelectedPlan(
                    null
                  )
                }
                className="w-full rounded-xl bg-stone-900 px-4 py-2.5 text-[10px] font-bold text-white transition hover:bg-stone-800"
              >
                Đóng
              </button>

            </div>

          </div>
        </div>
      )}


      {/* ======================================================
          VOUCHER MANAGER
      ====================================================== */}

      {currentUser &&
        isVoucherManagerOpen && (
          <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm p-3 sm:p-5 overflow-y-auto">

            <div className="min-h-full flex items-start justify-center">

              <div className="w-full max-w-5xl relative">

                <button
                  type="button"
                  onClick={() =>
                    setIsVoucherManagerOpen(
                      false
                    )
                  }
                  className="absolute right-2 top-2 z-[90] flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-stone-200 text-stone-500 shadow-lg hover:bg-stone-50"
                  aria-label="Đóng quản lý voucher"
                >
                  ✕
                </button>

                <VoucherManager
                  merchantId={
                    currentUser.uid
                  }
                  formatCurrency={(
                    amount: number
                  ) =>
                    new Intl.NumberFormat(
                      "vi-VN",
                      {
                        style:
                          "currency",
                        currency:
                          "VND",
                      }
                    ).format(
                      amount || 0
                    )
                  }
                />

              </div>

            </div>
          </div>
        )}


    </>
  );
}

// ============================================================
// PLATFORM VOUCHER CARD
// ============================================================

function PlatformVoucherCard({
  voucher,
}: {
  voucher: PlatformVoucher;
}) {
  const discountValue =
    Number(
      voucher.discountValue || 0
    );

  const maxDiscount =
    Number(
      voucher.maxDiscount || 0
    );

  const minOrder =
    Number(
      voucher.minOrder || 0
    );

  const platformFunding =
    Number(
      voucher.platformFundingPercent ||
        0
    );

  const merchantFunding =
    Number(
      voucher.merchantFundingPercent ||
        0
    );

  const isPercentage =
    String(
      voucher.discountType ||
        ""
    ).toUpperCase() ===
    "PERCENTAGE";

  const discountText =
    isPercentage
      ? `${discountValue}%`
      : formatVND(
          discountValue
        );

  return (
    <div className="rounded-2xl border border-emerald-200 bg-white overflow-hidden">

      <div className="p-3">

        <div className="flex items-start gap-3">

          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-100 text-xl">
            🚚
          </div>

          <div className="min-w-0 flex-1">

            <div className="flex items-start justify-between gap-2">

              <div className="min-w-0">

                <div className="flex items-center gap-1.5 flex-wrap">

                  <span className="text-[9px] font-black text-emerald-600 uppercase tracking-wide">
                    {
                      voucher.code ||
                      "VOUCHER"
                    }
                  </span>

                  <span className="rounded-full bg-emerald-500 px-1.5 py-0.5 text-[7px] font-black text-white">
                    SÀN TÀI TRỢ
                  </span>

                </div>

                <p className="mt-0.5 text-[12px] font-black text-stone-800">
                  {
                    voucher.title ||
                    "Ưu đãi vận chuyển"
                  }
                </p>

              </div>

              <div className="shrink-0 text-right">

                <p className="text-base font-black text-emerald-600">
                  {
                    discountText
                  }
                </p>

                <p className="text-[7px] text-stone-400 font-bold">
                  MỨC GIẢM
                </p>

              </div>

            </div>

            {voucher.description && (
              <p className="mt-1.5 text-[9px] leading-4 text-stone-500">
                {
                  voucher.description
                }
              </p>
            )}

          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-1.5">

          <VoucherStat
            label="Tối đa"
            value={
              maxDiscount >
              0
                ? formatVND(
                    maxDiscount
                  )
                : "Không giới hạn"
            }
          />

          <VoucherStat
            label="Đơn tối thiểu"
            value={
              minOrder >
              0
                ? formatVND(
                    minOrder
                  )
                : "Không yêu cầu"
            }
          />

          <VoucherStat
            label="Sàn tài trợ"
            value={`${platformFunding}%`}
            highlight
          />

          <VoucherStat
            label="Quán tài trợ"
            value={`${merchantFunding}%`}
          />

        </div>

      </div>

      <div className="border-t border-stone-100 bg-stone-50 px-3 py-2">

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">

          <div className="flex flex-wrap items-center gap-1.5">

            <span className="rounded-full bg-white border border-stone-200 px-2 py-0.5 text-[7px] font-bold text-stone-500">
              🚚 Vận chuyển
            </span>

            {String(
              voucher.targetType ||
                ""
            ).toUpperCase() ===
              "ALL" && (
              <span className="rounded-full bg-white border border-stone-200 px-2 py-0.5 text-[7px] font-bold text-stone-500">
                🌐 Toàn Sàn
              </span>
            )}

            {voucher.eligibleCommissionTier && (
              <span className="rounded-full bg-white border border-stone-200 px-2 py-0.5 text-[7px] font-bold text-stone-500">
                Gói{" "}
                {
                  voucher.eligibleCommissionTier
                }
              </span>
            )}

          </div>

          <div className="text-[7px] text-stone-400">

            {voucher.endDate ? (
              <>
                Có hiệu lực đến{" "}
                <span className="font-bold text-stone-500">
                  {
                    formatVoucherDate(
                      voucher.endDate
                    )
                  }
                </span>
              </>
            ) : (
              "Không giới hạn thời gian"
            )}

          </div>

        </div>

      </div>

    </div>
  );
}

// ============================================================
// VOUCHER USAGE ROW
// ============================================================

function VoucherUsageRow({
  item,
}: {
  item: VoucherUsageItem;
}) {
  const status =
    item.orderStatus;

  const isCompleted = [
    "paid",
    "completed",
    "delivered",
  ].includes(
    status
  );

  const isCancelled = [
    "cancelled",
    "canceled",
  ].includes(
    status
  );

  const isRefunded = [
    "refunded",
    "refund",
  ].includes(
    status
  );

  const statusLabel =
    isCompleted
      ? "Đã sử dụng"
      : isCancelled
      ? "Đơn đã hủy"
      : isRefunded
      ? "Đơn đã hoàn"
      : "Đã áp dụng";

  const statusClass =
    isCompleted
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : isCancelled ||
        isRefunded
      ? "bg-rose-50 text-rose-700 border-rose-200"
      : "bg-amber-50 text-amber-700 border-amber-200";

  const discountText =
    item.discountType ===
    "PERCENTAGE"
      ? `${item.discountValue}%`
      : item.discountValue >
        0
      ? formatVND(
          item.discountValue
        )
      : "—";

  return (
    <div className="p-3 hover:bg-stone-50 transition">

      <div className="flex items-start gap-3">

        {/* ICON */}

        <div className="w-10 h-10 shrink-0 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center text-lg">
          🎟️
        </div>

        {/* CONTENT */}

        <div className="min-w-0 flex-1">

          <div className="flex items-start justify-between gap-3">

            <div className="min-w-0">

              <div className="flex items-center gap-1.5 flex-wrap">

                <span className="text-[10px] font-black text-violet-700 uppercase tracking-wide">
                  {
                    item.code
                  }
                </span>

                <span
                  className={`rounded-full border px-1.5 py-0.5 text-[6px] font-black ${statusClass}`}
                >
                  {
                    statusLabel
                  }
                </span>

              </div>

              <p className="mt-0.5 text-[11px] font-black text-stone-800 truncate">
                {
                  item.title
                }
              </p>

            </div>

            <div className="shrink-0 text-right">

              <p className="text-[11px] font-black text-emerald-600">
                -{" "}
                {formatVND(
                  item.totalDiscount
                )}
              </p>

              <p className="text-[7px] text-stone-400 font-bold">
                TỔNG GIẢM
              </p>

            </div>

          </div>

          {/* DETAILS */}

          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-1.5">

            <HistoryMiniStat
              label="Đơn hàng"
              value={
                item.orderId
                  ? `#${item.orderId.slice(
                      0,
                      8
                    )}`
                  : "—"
              }
            />

            <HistoryMiniStat
              label="Mức giảm"
              value={
                discountText
              }
            />

            <HistoryMiniStat
              label="Giảm ship"
              value={
                item.shippingDiscount >
                0
                  ? formatVND(
                      item.shippingDiscount
                    )
                  : "0đ"
              }
            />

            <HistoryMiniStat
              label="Thời gian"
              value={formatDateTime(
                item.usedAt
              )}
            />

          </div>

          {/* META */}

          <div className="mt-2 flex flex-wrap items-center gap-1.5">

            {item.fundingType !==
              "UNKNOWN" && (
              <span className="rounded-full bg-stone-50 border border-stone-200 px-2 py-0.5 text-[6px] font-bold text-stone-500">
                💰{" "}
                {item.fundingType ===
                "PLATFORM"
                  ? "Sàn tài trợ"
                  : "Quán tài trợ"}
              </span>
            )}

            {item.targetType && (
              <span className="rounded-full bg-stone-50 border border-stone-200 px-2 py-0.5 text-[6px] font-bold text-stone-500">
                🎯{" "}
                {item.targetType ===
                "ALL"
                  ? "Toàn Sàn"
                  : "Gian hàng"}
              </span>
            )}

            {item.minOrder >
              0 && (
              <span className="rounded-full bg-stone-50 border border-stone-200 px-2 py-0.5 text-[6px] font-bold text-stone-500">
                Đơn từ{" "}
                {
                  formatVND(
                    item.minOrder
                  )
                }
              </span>
            )}

          </div>

        </div>

      </div>

    </div>
  );
}

// ============================================================
// HISTORY MINI STAT
// ============================================================

function HistoryMiniStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg bg-stone-50 border border-stone-100 px-2 py-1.5">

      <p className="text-[6px] uppercase tracking-wide font-bold text-stone-400">
        {
          label
        }
      </p>

      <p className="mt-0.5 text-[8px] font-black text-stone-700 truncate">
        {
          value
        }
      </p>

    </div>
  );
}

// ============================================================
// VOUCHER HISTORY STAT
// ============================================================

function VoucherHistoryStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  return (
    <div className="rounded-xl border border-stone-100 bg-stone-50 p-2.5">

      <div className="flex items-center justify-between gap-2">

        <span className="text-sm">
          {icon}
        </span>

        <span className="text-[7px] font-bold uppercase tracking-wide text-stone-400 text-right">
          {
            label
          }
        </span>

      </div>

      <p className="mt-1 text-[11px] font-black text-stone-800 truncate">
        {
          value
        }
      </p>

    </div>
  );
}

// ============================================================
// VOUCHER STAT
// ============================================================

function VoucherStat({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-2 ${
        highlight
          ? "border-emerald-200 bg-emerald-50"
          : "border-stone-100 bg-stone-50"
      }`}
    >

      <p className="text-[7px] uppercase tracking-wide font-bold text-stone-400">
        {
          label
        }
      </p>

      <p
        className={`mt-0.5 text-[10px] font-black ${
          highlight
            ? "text-emerald-700"
            : "text-stone-700"
        }`}
      >
        {
          value
        }
      </p>

    </div>
  );
}

// ============================================================
// QUICK STAT
// ============================================================

function QuickStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  return (
    <div className="rounded-xl bg-white border border-stone-100 p-2">

      <div className="flex items-center gap-1">

        <span className="text-xs">
          {
            icon
          }
        </span>

        <span className="text-[7px] font-bold uppercase tracking-wide text-stone-400">
          {
            label
          }
        </span>

      </div>

      <p className="mt-1 text-sm font-black text-stone-800">
        {
          value
        }
      </p>

    </div>
  );
}

// ============================================================
// VOUCHER INFO CARD
// ============================================================

function VoucherInfoCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-stone-100 bg-stone-50 p-3">

      <div className="flex items-start gap-2">

        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white border border-stone-100">
          {
            icon
          }
        </div>

        <div className="min-w-0">

          <p className="text-[10px] font-bold text-stone-700">
            {
              title
            }
          </p>

          <p className="mt-0.5 text-[9px] leading-4 text-stone-400">
            {
              description
            }
          </p>

        </div>

      </div>

    </div>
  );
}

// ============================================================
// FORMAT VND
// ============================================================

function formatVND(
  value: number
) {
  return (
    new Intl.NumberFormat(
      "vi-VN"
    ).format(
      Number(
        value || 0
      )
    ) +
    "đ"
  );
}

// ============================================================
// FORMAT VOUCHER DATE
// ============================================================

function formatVoucherDate(
  value: string
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "vi-VN",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }
  ).format(date);
}