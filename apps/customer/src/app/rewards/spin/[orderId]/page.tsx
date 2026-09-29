"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useParams,
  useRouter,
} from "next/navigation";
import {
  onAuthStateChanged,
  User,
} from "firebase/auth";
import {
  doc,
  getDoc,
} from "firebase/firestore";
import {
  auth,
  db,
} from "@cho-online/firebase";
import {
  Award,
  BadgeDollarSign,
  ChevronRight,
  CircleAlert,
  CircleDollarSign,
  Coins,
  Crown,
  Flame,
  Gift,
  Info,
  LoaderCircle,
  ReceiptText,
  Sparkles,
  Star,
  Store,
  Trophy,
  UtensilsCrossed,
} from "lucide-react";

type RewardTier =
  | "SMALL"
  | "MEDIUM"
  | "LARGE"
  | "VERY_LARGE";

type RewardResult = {
  id: string;
  type: "POINTS";
  value: number;
  label: string;
};

type RewardSpinData = {
  eligible?: boolean;
  used?: boolean;
  tier?: RewardTier;
  quantity?: number;
  orderValue?: number;
  version?: string;
  result?: RewardResult | null;
};

type OrderData = {
  id: string;
  userId?: string;
  status?: string;
  shopName?: string;
  storeName?: string;
  totalPrice?: number;
  subTotalPrice?: number;
  rewardSpin?: RewardSpinData;
};

const REWARDS: RewardResult[] = [
  {
    id: "P50",
    type: "POINTS",
    value: 50,
    label: "+50",
  },
  {
    id: "P100",
    type: "POINTS",
    value: 100,
    label: "+100",
  },
  {
    id: "P200",
    type: "POINTS",
    value: 200,
    label: "+200",
  },
  {
    id: "P500",
    type: "POINTS",
    value: 500,
    label: "+500",
  },
  {
    id: "P750",
    type: "POINTS",
    value: 750,
    label: "+750",
  },
  {
    id: "P1000",
    type: "POINTS",
    value: 1000,
    label: "+1K",
  },
  {
    id: "P2000",
    type: "POINTS",
    value: 2000,
    label: "+2K",
  },
];

const TIER_META: Record<
  RewardTier,
  {
    title: string;
    description: string;
  }
> = {
  SMALL: {
    title: "Cơ hội tiêu chuẩn",
    description:
      "Đơn nhỏ vẫn luôn có phần thưởng.",
  },
  MEDIUM: {
    title: "Cơ hội tăng nhẹ",
    description:
      "Đơn vừa được tăng nhẹ cơ hội nhận giải giá trị cao.",
  },
  LARGE: {
    title: "Cơ hội cao",
    description:
      "Đơn lớn được ưu tiên hơn ở nhóm giải giá trị cao.",
  },
  VERY_LARGE: {
    title: "Cơ hội cao nhất",
    description:
      "Đơn rất lớn đạt mức ưu tiên cao nhất của vòng quay.",
  },
};

const formatCurrency = (
  value: number
) =>
  new Intl.NumberFormat(
    "vi-VN",
    {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }
  ).format(
    Number(value) || 0
  );

const normalizeTier = (
  value: unknown
): RewardTier => {
  const tier = String(
    value || "SMALL"
  ).toUpperCase();

  if (
    tier === "MEDIUM" ||
    tier === "LARGE" ||
    tier === "VERY_LARGE"
  ) {
    return tier;
  }

  return "SMALL";
};


const RewardValueIcon = ({
  value,
  className = "",
}: {
  value: number;
  className?: string;
}) => {
  if (value >= 2000) {
    return <Gift className={className} strokeWidth={2.2} />;
  }

  if (value >= 1000) {
    return <Trophy className={className} strokeWidth={2.15} />;
  }

  if (value >= 500) {
    return <BadgeDollarSign className={className} strokeWidth={2.15} />;
  }

  if (value >= 200) {
    return <Coins className={className} strokeWidth={2.15} />;
  }

  return <CircleDollarSign className={className} strokeWidth={2.15} />;
};

const TierBadgeIcon = ({
  tier,
  className = "",
}: {
  tier: RewardTier;
  className?: string;
}) => {
  if (tier === "VERY_LARGE") {
    return <Crown className={className} strokeWidth={2.2} />;
  }

  if (tier === "LARGE") {
    return <Flame className={className} strokeWidth={2.2} />;
  }

  if (tier === "MEDIUM") {
    return <Star className={className} strokeWidth={2.2} />;
  }

  return <Gift className={className} strokeWidth={2.2} />;
};

export default function RewardSpinPage() {
  const params = useParams();
  const router = useRouter();

  const rawOrderId =
    params?.orderId;

  const orderId =
    Array.isArray(rawOrderId)
      ? rawOrderId[0] || ""
      : String(
          rawOrderId || ""
        );

  const [user, setUser] =
    useState<User | null>(null);

  const [order, setOrder] =
    useState<OrderData | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [isSpinning, setIsSpinning] =
    useState(false);

  const [rotation, setRotation] =
    useState(0);

  const [result, setResult] =
    useState<RewardResult | null>(
      null
    );

  const [showResult, setShowResult] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (currentUser) => {
          if (!currentUser) {
            router.replace(
              `/login?redirectTo=${encodeURIComponent(
                `/rewards/spin/${orderId}`
              )}`
            );

            return;
          }

          setUser(currentUser);

          if (!orderId) {
            setErrorMessage(
              "Không tìm thấy mã đơn hàng."
            );
            setLoading(false);
            return;
          }

          try {
            const orderSnap =
              await getDoc(
                doc(
                  db,
                  "orders",
                  orderId
                )
              );

            if (!orderSnap.exists()) {
              setErrorMessage(
                "Không tìm thấy đơn hàng."
              );
              return;
            }

            const data = {
              id: orderSnap.id,
              ...orderSnap.data(),
            } as OrderData;

            if (
              String(
                data.userId || ""
              ) !== currentUser.uid
            ) {
              setErrorMessage(
                "Bạn không có quyền xem lượt quay của đơn này."
              );
              return;
            }

            setOrder(data);

            if (
              data.rewardSpin?.used &&
              data.rewardSpin?.result
            ) {
              setResult(
                data.rewardSpin.result
              );
              setShowResult(true);
            }
          } catch (error) {
            console.error(
              "Lỗi tải vòng quay:",
              error
            );

            setErrorMessage(
              "Không thể tải thông tin vòng quay."
            );
          } finally {
            setLoading(false);
          }
        }
      );

    return () => unsubscribe();
  }, [
    orderId,
    router,
  ]);

  const status = String(
    order?.status || ""
  )
    .trim()
    .toLowerCase();

  const isCompleted =
    status === "completed" ||
    status === "delivered";

  const isEligible =
    order?.rewardSpin?.eligible ===
    true;

  const tier =
    normalizeTier(
      order?.rewardSpin?.tier
    );

  const tierMeta =
    TIER_META[tier];

  const orderQuantity =
    Math.max(
      0,
      Number(
        order?.rewardSpin
          ?.quantity || 0
      )
    );

  const orderValue =
    Math.max(
      0,
      Number(
        order?.rewardSpin
          ?.orderValue ||
          order?.subTotalPrice ||
          0
      )
    );

  const canSpin =
    Boolean(user) &&
    Boolean(order) &&
    isCompleted &&
    isEligible &&
    !order?.rewardSpin?.used &&
    !isSpinning;

  const segmentAngle =
    360 / REWARDS.length;

  const wheelBackground =
    useMemo(() => {
      const colors = [
        "#FFF8E8",
        "#FFDFAF",
        "#FFF1D2",
        "#FFB35B",
        "#FFE3B2",
        "#FF7A1A",
        "#FFF0CF",
      ];

      const stops =
        REWARDS.map(
          (_, index) => {
            const start =
              index *
              segmentAngle;

            const end =
              (index + 1) *
              segmentAngle;

            return `${colors[index]} ${start}deg ${end}deg`;
          }
        );

      return `conic-gradient(${stops.join(
        ", "
      )})`;
    }, [segmentAngle]);

  const handleSpin = async () => {
    if (
      !user ||
      !order ||
      !canSpin
    ) {
      return;
    }

    setIsSpinning(true);
    setErrorMessage("");
    setShowResult(false);

    try {
      const idToken =
        await user.getIdToken(
          true
        );

      const response =
        await fetch(
          "/api/rewards/spin",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              Authorization:
                `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              orderId:
                order.id,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message ||
            "Không thể quay thưởng."
        );
      }

      const reward =
        data.reward as RewardResult;

      if (
        !reward?.id ||
        !Number.isFinite(
          Number(reward.value)
        )
      ) {
        throw new Error(
          "Kết quả phần thưởng không hợp lệ."
        );
      }

      setResult(reward);

      /**
       * Request retry / user đã quay trước đó:
       * server trả lại đúng kết quả cũ,
       * không phát thưởng lần hai.
       */
      if (data.alreadyUsed) {
        setOrder((prev) =>
          prev
            ? {
                ...prev,
                rewardSpin: {
                  ...prev.rewardSpin,
                  used: true,
                  result: reward,
                },
              }
            : prev
        );

        setShowResult(true);
        setIsSpinning(false);
        return;
      }

      const rewardIndex =
        REWARDS.findIndex(
          (item) =>
            item.id === reward.id
        );

      const safeIndex =
        rewardIndex >= 0
          ? rewardIndex
          : 0;

      const currentMod =
        ((rotation % 360) +
          360) %
        360;

      const targetCenter =
        safeIndex *
          segmentAngle +
        segmentAngle / 2;

      const targetRotation =
        (360 -
          targetCenter) %
        360;

      const delta =
        (targetRotation -
          currentMod +
          360) %
        360;

      const reducedMotion =
        typeof window !==
          "undefined" &&
        window.matchMedia?.(
          "(prefers-reduced-motion: reduce)"
        ).matches;

      const nextRotation =
        rotation +
        (reducedMotion
          ? 0
          : 360 * 6) +
        delta;

      setRotation(
        nextRotation
      );

      window.setTimeout(
        () => {
          setOrder((prev) =>
            prev
              ? {
                  ...prev,
                  rewardSpin: {
                    ...prev.rewardSpin,
                    used: true,
                    result: reward,
                  },
                }
              : prev
          );

          setShowResult(true);
          setIsSpinning(false);
        },
        reducedMotion
          ? 300
          : 4200
      );
    } catch (error) {
      console.error(
        "Lỗi quay thưởng:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Không thể quay thưởng. Vui lòng thử lại."
      );

      setIsSpinning(false);
    }
  };

  if (loading) {
    return (
      <main
        className="relative min-h-[72vh] overflow-hidden bg-[#fff7e9] px-4 py-8"
        style={{
          backgroundImage: "url('/reward-wheel-bg.svg')",
          backgroundSize: "cover",
          backgroundPosition: "top center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="relative flex min-h-[58vh] items-center justify-center">
          <div className="text-center">
            <div className="relative mx-auto h-[76px] w-[76px]">
              <div className="absolute inset-0 rounded-[24px] bg-orange-500/25 blur-xl" />
              <div className="relative flex h-[76px] w-[76px] items-center justify-center rounded-[24px] border border-white/90 bg-gradient-to-br from-[#ff9b17] via-[#ff6327] to-[#ed3e35] text-white shadow-[0_14px_34px_rgba(238,77,45,0.25)]">
                <Gift className="h-9 w-9" strokeWidth={2.15} />
              </div>
            </div>

            <div className="mx-auto mt-5 h-1.5 w-32 overflow-hidden rounded-full bg-white/80 shadow-inner">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-[#ee4d2d]" />
            </div>

            <p className="mt-3 text-xs font-bold text-stone-600">
              Đang chuẩn bị vòng quay...
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (errorMessage && !order) {
    return (
      <main
        className="relative min-h-[72vh] overflow-hidden bg-[#fff7e9] px-4 py-8"
        style={{
          backgroundImage: "url('/reward-wheel-bg.svg')",
          backgroundSize: "cover",
          backgroundPosition: "top center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="relative flex min-h-[58vh] items-center justify-center">
          <div className="w-full max-w-sm rounded-[30px] border border-orange-100 bg-white/95 p-6 text-center shadow-[0_22px_55px_rgba(120,53,15,0.10)] backdrop-blur">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-gradient-to-br from-orange-50 to-rose-50 text-[#ee4d2d] ring-1 ring-orange-100">
              <CircleAlert className="h-8 w-8" strokeWidth={2} />
            </div>

            <h1 className="mt-4 text-lg font-black tracking-tight text-stone-900">
              Chưa thể mở vòng quay
            </h1>

            <p className="mt-2 text-xs leading-relaxed text-stone-500">
              {errorMessage}
            </p>

            <button
              type="button"
              onClick={() => router.push("/orders")}
              className="mt-5 w-full rounded-[18px] bg-gradient-to-r from-[#ff6a00] to-[#ee4133] py-3.5 text-xs font-black text-white shadow-[0_10px_24px_rgba(238,77,45,0.24)] transition active:scale-[0.98]"
            >
              Quay lại đơn hàng
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[#fff7e9] pb-28 text-stone-900"
      style={{
        backgroundImage: "url('/reward-wheel-bg.svg')",
        backgroundSize: "cover",
        backgroundPosition: "top center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="relative mx-auto w-full max-w-[470px] px-4 pb-5 pt-5 sm:pt-6">
        {/* ======================================================
            HERO
        ====================================================== */}
        <header className="relative min-h-[245px] px-1 pt-4 text-center">
          <p
            className="absolute left-2 top-[76px] hidden max-w-[118px] -rotate-6 text-left text-[16px] font-bold leading-[1.15] text-[#f15b2a] min-[390px]:block"
            style={{
              fontFamily:
                '"Brush Script MT","Segoe Print","Comic Sans MS",cursive',
            }}
          >
            Mỗi đơn hàng
            <br />
            là một niềm vui!
          </p>

          <p
            className="absolute right-0 top-[76px] hidden max-w-[118px] rotate-3 text-right text-[16px] font-bold leading-[1.15] text-[#f15b2a] min-[390px]:block"
            style={{
              fontFamily:
                '"Brush Script MT","Segoe Print","Comic Sans MS",cursive',
            }}
          >
            Quay ngay
            <br />
            Nhận quà liền tay!
          </p>

          <Sparkles className="pointer-events-none absolute left-[17%] top-10 h-6 w-6 text-amber-400" strokeWidth={1.8} />
          <Sparkles className="pointer-events-none absolute right-[17%] top-12 h-5 w-5 text-orange-400" strokeWidth={1.8} />
          <Coins className="pointer-events-none absolute left-[8%] top-[132px] h-5 w-5 -rotate-12 text-amber-500/75" strokeWidth={1.8} />
          <Coins className="pointer-events-none absolute right-[7%] top-[128px] h-5 w-5 rotate-12 text-amber-500/75" strokeWidth={1.8} />

          <div className="relative mx-auto flex h-[84px] w-[84px] items-center justify-center rounded-[26px] border border-white/80 bg-gradient-to-br from-[#ff9a17] via-[#ff5b26] to-[#ef3e35] text-white shadow-[0_18px_35px_rgba(238,77,45,0.25)]">
            <Award className="h-10 w-10" strokeWidth={2} />
          </div>

          <h1 className="mt-4 text-[30px] font-black tracking-[-0.045em] text-[#512014] sm:text-[32px]">
            Vòng quay Anvami
          </h1>

          <p className="mt-1.5 text-[14px] font-medium text-stone-500">
            1 đơn hoàn thành = 1 lượt quay
          </p>
        </header>

        {/* ======================================================
            ORDER SUMMARY
        ====================================================== */}
        <section className="relative -mt-1 overflow-hidden rounded-[31px] border border-[#ffd9a9] bg-white/95 p-4 shadow-[0_8px_20px_rgba(120,53,15,0.10)]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-[#fff6ec] text-[#ee4d2d] shadow-sm ring-1 ring-orange-100">
                <Store className="h-6 w-6" strokeWidth={2} />
              </div>

              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-stone-400">
                  Đơn #{orderId.slice(-8).toUpperCase()}
                </p>

                <p className="mt-1 truncate text-[18px] font-black tracking-tight text-stone-900">
                  {order?.shopName || order?.storeName || "Anvami"}
                </p>
              </div>
            </div>

            <span className="shrink-0 rounded-full border border-[#ffd7a1] bg-[#fff8ee] px-3 py-2 text-[10px] font-black text-[#ef4d2d] shadow-sm">
              <span className="inline-flex items-center gap-1.5">
                <TierBadgeIcon tier={tier} className="h-3.5 w-3.5" />
                {tierMeta.title}
              </span>
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <div className="rounded-[24px] bg-[#faf9f8] p-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-white text-[#ee4d2d] shadow-sm ring-1 ring-stone-100">
                  <UtensilsCrossed className="h-5 w-5" strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-[0.12em] text-stone-400">
                    Số lượng
                  </p>
                  <p className="mt-0.5 text-[17px] font-black text-stone-800">
                    {orderQuantity} món
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] bg-[#faf9f8] p-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-white text-[#ee4d2d] shadow-sm ring-1 ring-stone-100">
                  <ReceiptText className="h-5 w-5" strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-[0.12em] text-stone-400">
                    Giá trị đơn
                  </p>
                  <p className="mt-0.5 truncate text-[17px] font-black text-stone-800">
                    {formatCurrency(orderValue)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-[18px] bg-[#fff6eb] px-3.5 py-2.5">
            <Gift className="h-5 w-5 shrink-0 text-[#ee4d2d]" strokeWidth={2} />
            <p className="min-w-0 text-[11px] font-medium text-stone-600">
              {tierMeta.description}
            </p>
          </div>
        </section>

        {/* ======================================================
            WHEEL
        ====================================================== */}
        <section className="relative mt-4 overflow-hidden rounded-[34px] border border-[#ffdcad] bg-[rgba(255,255,255,0.90)] px-3 pb-5 pt-3 shadow-[0_8px_22px_rgba(120,53,15,0.10)] backdrop-blur-[1px]">
          <Coins className="pointer-events-none absolute left-3 top-10 h-8 w-8 -rotate-12 text-amber-500/75" strokeWidth={1.7} />
          <Coins className="pointer-events-none absolute right-3 top-16 h-7 w-7 rotate-12 text-amber-500/75" strokeWidth={1.7} />
          <Sparkles className="pointer-events-none absolute left-5 top-[290px] h-5 w-5 text-amber-400" strokeWidth={1.8} />
          <Sparkles className="pointer-events-none absolute right-5 top-[318px] h-5 w-5 text-orange-400" strokeWidth={1.8} />

          <div className="relative mx-auto h-[366px] w-[366px] max-w-full">
            {/* pointer */}
            <div className="absolute left-1/2 top-[2px] z-40 -translate-x-1/2">
              <div className="relative">
                <div className="absolute left-1/2 top-1 h-7 w-7 -translate-x-1/2 rounded-full bg-orange-500/25 blur-md" />
                <div className="relative h-0 w-0 border-l-[17px] border-r-[17px] border-t-[31px] border-l-transparent border-r-transparent border-t-[#f24a2d] drop-shadow-[0_4px_4px_rgba(180,65,25,0.28)]" />
                <span className="absolute -top-[1px] left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-[#ffd65c] ring-2 ring-white" />
              </div>
            </div>

            {/* glow */}
            <div className="absolute inset-[20px] rounded-full bg-[#ff9d22]/25 blur-xl" />

            {/* static gold ring */}
            <div className="absolute inset-[18px] rounded-full bg-gradient-to-br from-[#ffd86a] via-[#ffad23] to-[#f36b1e] p-[6px] shadow-[0_16px_34px_rgba(234,88,12,0.24)]">
              <div className="relative h-full w-full rounded-full bg-[#fff8ea] p-[9px]">
                {Array.from({ length: 24 }).map((_, index) => {
                  const angle = index * (360 / 24);

                  return (
                    <span
                      key={`bulb-${index}`}
                      className="absolute left-1/2 top-1/2 z-30 h-[9px] w-[9px] rounded-full border border-[#ffd98b] bg-white shadow-[0_0_8px_rgba(255,184,53,0.95)]"
                      style={{
                        transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-155px)`,
                      }}
                    />
                  );
                })}

                <div
                  className="absolute inset-[12px] overflow-hidden rounded-full border border-orange-100 transition-transform duration-[4000ms] ease-[cubic-bezier(0.12,0.7,0.08,1)]"
                  style={{
                    background: wheelBackground,
                    transform: `rotate(${rotation}deg)`,
                  }}
                >
                  <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_45%,rgba(255,255,255,0.28),transparent_58%)]" />

                  {REWARDS.map((reward, index) => {
                    const angle =
                      index * segmentAngle +
                      segmentAngle / 2;

                    return (
                      <div
                        key={reward.id}
                        className="absolute left-1/2 top-1/2 z-10 flex w-[76px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center text-center text-[#612114]"
                        style={{
                          transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-116px) rotate(${-angle}deg)`,
                        }}
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/55 text-[#a84d16] shadow-sm ring-1 ring-white/70">
                          <RewardValueIcon value={reward.value} className="h-4 w-4" />
                        </span>

                        <span className="mt-1 text-[12px] font-black tracking-tight">
                          {reward.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* center cap */}
            <div className="absolute left-1/2 top-1/2 z-30 flex h-[102px] w-[102px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[7px] border-white bg-gradient-to-br from-[#ff6125] via-[#f54a27] to-[#eb382f] shadow-[0_12px_28px_rgba(194,65,12,0.28)]">
              <div className="text-center text-white">
                <p className="text-[13px] font-black uppercase tracking-[0.12em]">
                  ANVAMI
                </p>
                <img
                  src="/logo.png"
                  alt="Anvami"
                  draggable={false}
                  className="mx-auto mt-1 h-7 w-7 object-contain brightness-0 invert"
                />
              </div>
            </div>
          </div>

          {!isCompleted && (
            <div className="mx-auto -mt-1 max-w-sm rounded-[18px] border border-amber-200 bg-amber-50 px-3.5 py-3 text-center text-[11px] font-semibold leading-relaxed text-amber-800">
              <span className="inline-flex items-center justify-center gap-1.5">
                <LoaderCircle className="h-3.5 w-3.5" strokeWidth={2} />
                Đơn hàng chưa hoàn thành. Bạn có thể quay sau khi giao hàng thành công.
              </span>
            </div>
          )}

          {isCompleted && !isEligible && (
            <div className="mx-auto -mt-1 max-w-sm rounded-[18px] border border-stone-200 bg-stone-50 px-3.5 py-3 text-center text-[11px] font-semibold text-stone-600">
              Đơn này không thuộc chương trình vòng quay.
            </div>
          )}

          {!showResult && (
            <button
              type="button"
              disabled={!canSpin}
              onClick={handleSpin}
              className="group relative mx-auto mt-2 block w-[82%] min-w-[250px] max-w-[360px] overflow-hidden rounded-[22px] border-2 border-[#ff8b17] bg-gradient-to-r from-[#ff7700] via-[#ff5b20] to-[#ef422f] px-5 py-[15px] text-[17px] font-black text-white shadow-[0_0_0_4px_rgba(255,197,74,0.26),0_14px_28px_rgba(238,77,45,0.28)] transition active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span className="pointer-events-none absolute inset-y-0 -left-16 w-16 skew-x-[-20deg] bg-white/20 transition-all duration-700 group-hover:left-[115%]" />

              <span className="relative flex items-center justify-center gap-2">
                {isSpinning ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-white" />
                    ĐANG QUAY...
                  </>
                ) : (
                  <>
                    QUAY NGAY
                    <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
                  </>
                )}
              </span>
            </button>
          )}

          <div className="mx-auto mt-5 flex max-w-[360px] items-start gap-2 px-1">
            <Info className="mt-[1px] h-3.5 w-3.5 shrink-0 text-stone-500" strokeWidth={2} />

            <p className="text-[9px] italic leading-[1.65] text-stone-500">
              Kích thước các ô chỉ dùng để hiển thị. Tỷ lệ trúng được hệ thống tính theo độ lớn đơn hàng và có giới hạn để đảm bảo chương trình vận hành ổn định.
            </p>
          </div>
        </section>

        {/* ======================================================
            RESULT
        ====================================================== */}
        {showResult && result && (
          <section className="relative mt-4 overflow-hidden rounded-[30px] border border-[#ffd99e] bg-[linear-gradient(135deg,#fff7dd,#ffffff_48%,#fff0e6)] p-5 text-center shadow-[0_16px_35px_rgba(120,53,15,0.12)]">
            <Sparkles className="pointer-events-none absolute left-6 top-5 h-5 w-5 text-amber-400" strokeWidth={1.8} />
            <Star className="pointer-events-none absolute right-6 top-7 h-5 w-5 text-orange-400" strokeWidth={1.8} />
            <Coins className="pointer-events-none absolute bottom-7 left-7 h-5 w-5 text-amber-500/75" strokeWidth={1.8} />
            <Sparkles className="pointer-events-none absolute bottom-8 right-8 h-5 w-5 text-orange-400" strokeWidth={1.8} />

            <div className="mx-auto flex h-[70px] w-[70px] items-center justify-center rounded-[24px] bg-gradient-to-br from-[#ff8b16] via-[#ff5a27] to-[#ed3e34] text-white shadow-[0_12px_28px_rgba(238,77,45,0.25)]">
              <Trophy className="h-8 w-8" strokeWidth={2.1} />
            </div>

            <p className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-[#ef4d2d]">
              Phần thưởng của bạn
            </p>

            <h2 className="mt-1 text-xl font-black tracking-tight text-stone-950">
              Chúc mừng bạn!
            </h2>

            <div className="mx-auto mt-3 inline-flex items-end gap-1 rounded-[22px] border border-[#ffd4a1] bg-white/90 px-5 py-3 shadow-sm">
              <span className="text-3xl font-black leading-none text-[#ee4d2d]">
                +{Number(result.value || 0).toLocaleString("vi-VN")}
              </span>

              <span className="pb-0.5 text-xs font-black text-orange-600">
                điểm
              </span>
            </div>

            <p className="mx-auto mt-3 max-w-xs text-[10px] leading-relaxed text-stone-600">
              Điểm đã được cộng trực tiếp vào tài khoản Anvami của bạn.
            </p>

            <button
              type="button"
              onClick={() => router.push("/orders")}
              className="mt-4 w-full rounded-[18px] bg-stone-900 py-3.5 text-xs font-black text-white shadow-lg shadow-stone-900/10 transition active:scale-[0.985]"
            >
              Xem đơn hàng của tôi
            </button>
          </section>
        )}

        {errorMessage && order && (
          <div className="mt-4 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-center text-[11px] font-semibold text-rose-700 shadow-sm">
            {errorMessage}
          </div>
        )}
      </div>
    </main>
  );
}
