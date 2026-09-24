"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import VoucherManagerModal from "@/components/VoucherManagerModal";

// ============================================================
// TYPES
// ============================================================

interface DashboardData {
  stats?: Record<string, any>;
  recentOrders?: any[];
  [key: string]: any;
}

interface RevenueSummary {
  totalCustomerPaid?: number;
  totalCustomerPaidBeforeVoucher?: number;
  totalGMV?: number;
  totalOriginalGMV?: number;
  totalMerchantSaleGross?: number;
  totalMerchantNet?: number;
  totalShippingBaseFee?: number;
  totalShippingPaidByCustomer?: number;
  totalShippingVoucherDiscount?: number;
  totalShipperTotalEarning?: number;
  totalPlatformNetRevenue?: number;
  netTotalRevenue?: number;
  totalNetRevenue?: number;
  totalOrders?: number;
  [key: string]: any;
}

interface RevenueData {
  summary?: RevenueSummary;
  config?: Record<string, any>;
  chartData?: any[];
  [key: string]: any;
}

interface AccountingSummary {
  unpaidCount: number;
  totalUnpaidAmount: number;
  totalPartners: number;
}

type Tone =
  | "emerald"
  | "amber"
  | "indigo"
  | "cyan"
  | "rose"
  | "violet"
  | "slate";

// ============================================================
// HELPERS
// ============================================================

const formatMoney = (value: unknown) => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0đ";
  }

  return `${Math.round(number).toLocaleString("vi-VN")}đ`;
};

const toNumber = (value: unknown, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const normalizeStatus = (status: unknown) =>
  String(status || "")
    .toLowerCase()
    .trim();

const getOrderTimestamp = (value: any) => {
  if (!value) return 0;

  if (typeof value?.toDate === "function") {
    return value.toDate().getTime();
  }

  if (typeof value === "string" || typeof value === "number") {
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  if (typeof value?.seconds === "number") {
    return value.seconds * 1000;
  }

  if (typeof value?._seconds === "number") {
    return value._seconds * 1000;
  }

  return 0;
};

const formatOrderTime = (value: any) => {
  const timestamp = getOrderTimestamp(value);

  if (!timestamp) return "—";

  return new Date(timestamp).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getOrderFinancials = (order: any) => {
  const shippingFee = Math.max(
    0,
    toNumber(
      order?.shippingFee ??
        order?.shipFee ??
        order?.deliveryFee ??
        0
    )
  );

  const totalPrice = Math.max(
    0,
    toNumber(
      order?.finalTotal ??
        order?.finalPrice ??
        order?.paidTotal ??
        order?.totalPrice ??
        order?.grandTotal ??
        order?.total ??
        order?.amount ??
        0
    )
  );

  let subtotalPrice = Math.max(
    0,
    toNumber(
      order?.subTotalPrice ??
        order?.subtotalPrice ??
        order?.itemsTotal ??
        0
    )
  );

  if (subtotalPrice <= 0 && Array.isArray(order?.items)) {
    subtotalPrice = order.items.reduce(
      (sum: number, item: any) =>
        sum +
        Math.max(0, toNumber(item?.price ?? item?.salePrice ?? 0)) *
          Math.max(1, toNumber(item?.quantity ?? 1)),
      0
    );
  }

  if (subtotalPrice <= 0 && totalPrice > 0) {
    subtotalPrice = Math.max(0, totalPrice - shippingFee);
  }

  return {
    subtotalPrice,
    shippingFee,
    totalPrice,
  };
};

const toneMap: Record<Tone, string> = {
  emerald:
    "border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-300",
  amber: "border-amber-500/25 bg-amber-500/[0.06] text-amber-300",
  indigo:
    "border-indigo-500/25 bg-indigo-500/[0.06] text-indigo-300",
  cyan: "border-cyan-500/25 bg-cyan-500/[0.06] text-cyan-300",
  rose: "border-rose-500/25 bg-rose-500/[0.06] text-rose-300",
  violet:
    "border-violet-500/25 bg-violet-500/[0.06] text-violet-300",
  slate: "border-slate-700/70 bg-slate-800/40 text-slate-200",
};

// ============================================================
// UI COMPONENTS
// ============================================================

function MetricCard({
  title,
  value,
  icon,
  helper,
  tone = "slate",
  href,
  prominent = false,
}: {
  title: string;
  value: string;
  icon: string;
  helper?: string;
  tone?: Tone;
  href?: string;
  prominent?: boolean;
}) {
  const body = (
    <div
      className={`group h-full rounded-2xl border p-4 transition duration-200 hover:-translate-y-0.5 hover:border-slate-500/70 ${toneMap[tone]} ${
        prominent ? "sm:p-5" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
            {title}
          </p>

          <p
            className={`mt-2 font-black tracking-tight ${
              prominent ? "text-2xl md:text-3xl" : "text-xl"
            }`}
          >
            {value}
          </p>
        </div>

        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-950/35 text-lg">
          {icon}
        </span>
      </div>

      {helper ? (
        <p className="mt-2 line-clamp-2 text-[10px] leading-4 text-slate-500">
          {helper}
        </p>
      ) : null}
    </div>
  );

  if (!href) return body;

  return (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  );
}

function MiniStat({
  label,
  value,
  helper,
  tone = "slate",
}: {
  label: string;
  value: string;
  helper?: string;
  tone?: Tone;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
          {label}
        </span>
        <span
          className={`text-sm font-black ${
            tone === "emerald"
              ? "text-emerald-400"
              : tone === "amber"
                ? "text-amber-400"
                : tone === "rose"
                  ? "text-rose-400"
                  : tone === "cyan"
                    ? "text-cyan-400"
                    : tone === "indigo"
                      ? "text-indigo-400"
                      : tone === "violet"
                        ? "text-violet-400"
                        : "text-slate-200"
          }`}
        >
          {value}
        </span>
      </div>

      {helper ? (
        <p className="mt-1 text-[10px] text-slate-600">{helper}</p>
      ) : null}
    </div>
  );
}

function QuickLink({
  href,
  icon,
  title,
  helper,
}: {
  href: string;
  icon: string;
  title: string;
  helper: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/30 p-3 transition hover:border-indigo-500/40 hover:bg-slate-800/70"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-800 text-base transition group-hover:scale-105">
        {icon}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-xs font-bold text-slate-200">
          {title}
        </span>
        <span className="mt-0.5 block truncate text-[10px] text-slate-500">
          {helper}
        </span>
      </span>

      <span className="text-xs text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-indigo-400">
        →
      </span>
    </Link>
  );
}

// ============================================================
// DASHBOARD
// ============================================================

export default function DashboardPage() {
  const router = useRouter();

  const [data, setData] = useState<DashboardData | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueData | null>(null);
  const [accountingSummary, setAccountingSummary] =
    useState<AccountingSummary | null>(null);

  const [loading, setLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);

  // ==========================================================
  // FETCH ALL DATA
  // ==========================================================

  const fetchAllData = useCallback(async () => {
    setLoading(true);

    try {
      const [dashRes, revRes, accRes] = await Promise.all([
        fetch("/api/dashboard", { cache: "no-store" }),
        fetch("/api/revenue?timeFrame=ALL", { cache: "no-store" }),
        fetch("/api/accounting?role=ALL", { cache: "no-store" }),
      ]);

      const [dashJson, revJson, accJson] = await Promise.all([
        dashRes.json(),
        revRes.json(),
        accRes.json(),
      ]);

      setData(dashJson?.success ? dashJson.data || null : null);
      setRevenueData(revJson?.success ? revJson.data || null : null);

      if (accJson?.success && Array.isArray(accJson.data)) {
        const partners = accJson.data;
        const unpaidPartners = partners.filter(
          (partner: any) => !partner?.isPaid
        );

        const totalUnpaidAmount = unpaidPartners.reduce(
          (sum: number, partner: any) =>
            sum +
            toNumber(
              partner?.unpaidAmount ??
                partner?.amountDue ??
                partner?.pendingAmount ??
                0
            ),
          0
        );

        setAccountingSummary({
          unpaidCount: unpaidPartners.length,
          totalUnpaidAmount,
          totalPartners: partners.length,
        });
      } else {
        setAccountingSummary({
          unpaidCount: 0,
          totalUnpaidAmount: 0,
          totalPartners: 0,
        });
      }
    } catch (error) {
      console.error("❌ Lỗi tải dữ liệu Dashboard:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // ==========================================================
  // LOGOUT
  // ==========================================================

  const handleLogout = async () => {
    if (!confirm("Bạn có chắc chắn muốn đăng xuất khỏi hệ thống?")) {
      return;
    }

    setIsLoggingOut(true);

    try {
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});

      localStorage.removeItem("token");
      localStorage.removeItem("user");
      sessionStorage.clear();

      window.location.href = "/login";
    } catch (error) {
      console.error("❌ Lỗi đăng xuất:", error);
      router.push("/login");
    } finally {
      setIsLoggingOut(false);
    }
  };

  // ==========================================================
  // DATA
  // ==========================================================

  const stats = data?.stats || {};

  const recentOrders = useMemo(() => {
    if (!Array.isArray(data?.recentOrders)) return [];

    return [...data.recentOrders]
      .sort(
        (a, b) =>
          getOrderTimestamp(b?.createdAt) - getOrderTimestamp(a?.createdAt)
      )
      .slice(0, 5);
  }, [data?.recentOrders]);

  const summary = useMemo(() => {
    const revenueSummary = revenueData?.summary ?? {};

    return {
      platformNetRevenue: Math.max(
        0,
        toNumber(
          revenueSummary.totalPlatformNetRevenue ??
            revenueSummary.netTotalRevenue ??
            revenueSummary.totalNetRevenue ??
            0
        )
      ),

      totalCustomerPaid: Math.max(
        0,
        toNumber(revenueSummary.totalCustomerPaid ?? 0)
      ),

      totalProductSales: Math.max(
        0,
        toNumber(
          revenueSummary.totalMerchantSaleGross ??
            revenueSummary.totalGMV ??
            revenueSummary.totalSubTotalPrice ??
            0
        )
      ),

      totalShippingPaidByCustomer: Math.max(
        0,
        toNumber(revenueSummary.totalShippingPaidByCustomer ?? 0)
      ),

      totalShipperEarning: Math.max(
        0,
        toNumber(revenueSummary.totalShipperTotalEarning ?? 0)
      ),

      totalOrders: toNumber(stats.totalOrders ?? 0),
      pendingOrders: toNumber(stats.pendingOrders ?? stats.pending ?? 0),
      completedOrders: toNumber(stats.completedOrders ?? stats.completed ?? 0),
      cancelledOrders: toNumber(stats.cancelledOrders ?? stats.cancelled ?? 0),

      totalMerchants: toNumber(stats.totalMerchants ?? 0),
      pendingMerchants: toNumber(stats.pendingMerchants ?? 0),
      totalUsers: toNumber(stats.totalUsers ?? 0),
      totalProducts: toNumber(stats.totalProducts ?? 0),
    };
  }, [revenueData, stats]);

  const recentOrderSummary = useMemo(
    () =>
      recentOrders.map((order: any) => ({
        order,
        ...getOrderFinancials(order),
      })),
    [recentOrders]
  );

  const completionRate =
    summary.totalOrders > 0
      ? Math.round((summary.completedOrders / summary.totalOrders) * 100)
      : 0;

  // ==========================================================
  // STATUS BADGE
  // ==========================================================

  const getStatusBadge = (status: string) => {
    const st = normalizeStatus(status);

    const styles: Record<string, { label: string; className: string }> = {
      pending: {
        label: "Chờ xử lý",
        className:
          "border-amber-500/30 bg-amber-500/10 text-amber-400",
      },
      finding_driver: {
        label: "Tìm shipper",
        className:
          "border-amber-500/30 bg-amber-500/10 text-amber-400",
      },
      accepted: {
        label: "Shop đã nhận",
        className: "border-cyan-500/30 bg-cyan-500/10 text-cyan-400",
      },
      preparing: {
        label: "Đang làm",
        className:
          "border-orange-500/30 bg-orange-500/10 text-orange-400",
      },
      processing: {
        label: "Đang làm",
        className:
          "border-orange-500/30 bg-orange-500/10 text-orange-400",
      },
      ready: {
        label: "Chờ lấy món",
        className: "border-teal-500/30 bg-teal-500/10 text-teal-400",
      },
      ready_for_pickup: {
        label: "Chờ lấy món",
        className: "border-teal-500/30 bg-teal-500/10 text-teal-400",
      },
      assigned: {
        label: "Đã gán Shipper",
        className:
          "border-indigo-500/30 bg-indigo-500/10 text-indigo-400",
      },
      picking_up: {
        label: "Đang lấy món",
        className: "border-blue-500/30 bg-blue-500/10 text-blue-400",
      },
      delivering: {
        label: "Đang giao",
        className: "border-blue-500/30 bg-blue-500/10 text-blue-400",
      },
      shipping: {
        label: "Đang giao",
        className: "border-blue-500/30 bg-blue-500/10 text-blue-400",
      },
      completed: {
        label: "Hoàn thành",
        className:
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
      },
      delivered: {
        label: "Hoàn thành",
        className:
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
      },
      cancelled: {
        label: "Đã hủy",
        className: "border-rose-500/30 bg-rose-500/10 text-rose-400",
      },
      refunded: {
        label: "Đã hoàn tiền",
        className:
          "border-purple-500/30 bg-purple-500/10 text-purple-400",
      },
    };

    const item = styles[st];

    if (!item) {
      return (
        <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] font-bold text-slate-300">
          {status || "Không rõ"}
        </span>
      );
    }

    return (
      <span
        className={`rounded-full border px-2 py-1 text-[10px] font-bold ${item.className}`}
      >
        {item.label}
      </span>
    );
  };

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100">
      <div className="mx-auto max-w-[1600px] space-y-6 px-4 py-5 sm:px-6 lg:px-8">
        {/* =====================================================
            HEADER
        ====================================================== */}

        <header className="flex flex-col gap-4 border-b border-slate-800/80 pb-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-indigo-500/25 bg-indigo-500/10 text-xl">
                ◈
              </div>

              <div className="min-w-0">
                <h1 className="truncate text-xl font-black tracking-tight text-white sm:text-2xl">
                  Trung tâm điều hành Anvami
                </h1>
                <p className="mt-0.5 text-xs text-slate-500">
                  Một màn hình cho tài chính, vận hành và việc cần xử lý.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsVoucherModalOpen(true)}
              className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-3.5 py-2 text-xs font-bold text-violet-300 transition hover:bg-violet-500/20"
            >
              🎫 Voucher
            </button>

            <button
              onClick={fetchAllData}
              disabled={loading}
              className="rounded-xl border border-slate-700 bg-slate-800/70 px-3.5 py-2 text-xs font-bold text-slate-200 transition hover:border-indigo-500/40 hover:text-white disabled:opacity-50"
            >
              {loading ? "Đang tải..." : "↻ Cập nhật"}
            </button>

            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="rounded-xl border border-rose-500/20 bg-rose-500/[0.06] px-3.5 py-2 text-xs font-bold text-rose-300 transition hover:bg-rose-500/15 disabled:opacity-50"
            >
              {isLoggingOut ? "Đang thoát..." : "Đăng xuất"}
            </button>
          </div>
        </header>

        {/* =====================================================
            PRIORITY KPIs
        ====================================================== */}

        <section>
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-sm font-black text-slate-200">
                Tổng quan cần chú ý
              </h2>
              <p className="mt-1 text-[10px] text-slate-600">
                Chỉ giữ các chỉ số ảnh hưởng trực tiếp đến quyết định vận hành.
              </p>
            </div>

            <span className="text-[10px] font-semibold text-slate-600">
              {loading ? "Đang đồng bộ" : "Toàn thời gian"}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              href="/revenue"
              title="Sàn nhận thực"
              value={loading ? "..." : formatMoney(summary.platformNetRevenue)}
              icon="💎"
              tone="emerald"
              prominent
              helper="Dòng tiền còn lại sau khi trả Quán và Shipper."
            />

            <MetricCard
              href="/revenue"
              title="Khách đã thanh toán"
              value={loading ? "..." : formatMoney(summary.totalCustomerPaid)}
              icon="💳"
              tone="amber"
              prominent
              helper="Tổng tiền thực thu từ các đơn hoàn thành."
            />

            <MetricCard
              href="/accounting"
              title="Cần giải ngân"
              value={
                loading
                  ? "..."
                  : formatMoney(accountingSummary?.totalUnpaidAmount || 0)
              }
              icon="🧾"
              tone="rose"
              prominent
              helper={`${accountingSummary?.unpaidCount || 0} đối tác đang chờ thanh toán.`}
            />

            <MetricCard
              href="/orders"
              title="Đơn cần xử lý"
              value={loading ? "..." : String(summary.pendingOrders)}
              icon="⏳"
              tone="indigo"
              prominent
              helper={`${summary.completedOrders}/${summary.totalOrders} đơn đã hoàn tất.`}
            />
          </div>
        </section>

        {/* =====================================================
            MONEY FLOW STRIP
        ====================================================== */}

        <section className="rounded-2xl border border-slate-800 bg-slate-900/55 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xs font-black text-slate-300">
                Dòng tiền hệ thống
              </h2>
              <p className="mt-0.5 text-[10px] text-slate-600">
                Các thành phần tiền chính, không lặp lại KPI phía trên.
              </p>
            </div>

            <Link
              href="/revenue"
              className="text-[10px] font-bold text-indigo-400 transition hover:text-indigo-300"
            >
              Mở báo cáo →
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <MiniStat
              label="Tiền món"
              value={loading ? "..." : formatMoney(summary.totalProductSales)}
              tone="cyan"
            />

            <MiniStat
              label="Phí ship khách trả"
              value={
                loading
                  ? "..."
                  : formatMoney(summary.totalShippingPaidByCustomer)
              }
              tone="indigo"
            />

            <MiniStat
              label="Shipper nhận"
              value={loading ? "..." : formatMoney(summary.totalShipperEarning)}
              tone="violet"
            />
          </div>
        </section>

        {/* =====================================================
            MAIN CONTENT
        ====================================================== */}

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(340px,0.8fr)]">
          {/* RECENT ORDERS */}

          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/55">
            <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3.5">
              <div>
                <h2 className="text-xs font-black text-slate-200">
                  Đơn hàng mới nhất
                </h2>
                <p className="mt-0.5 text-[10px] text-slate-600">
                  Theo dõi nhanh 5 đơn gần nhất, không biến Dashboard thành trang Orders.
                </p>
              </div>

              <Link
                href="/orders"
                className="shrink-0 text-[10px] font-bold text-indigo-400 hover:text-indigo-300"
              >
                Xem tất cả →
              </Link>
            </div>

            {loading ? (
              <div className="p-10 text-center text-xs text-slate-500">
                Đang tải dữ liệu...
              </div>
            ) : recentOrderSummary.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-500">
                Chưa có đơn hàng nào
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/35 text-[9px] font-bold uppercase tracking-wide text-slate-600">
                      <th className="px-4 py-2.5">Đơn hàng</th>
                      <th className="px-3 py-2.5">Gian hàng</th>
                      <th className="px-3 py-2.5 text-right">Tiền món</th>
                      <th className="px-3 py-2.5 text-right">Phí ship</th>
                      <th className="px-3 py-2.5 text-right">Khách trả</th>
                      <th className="px-4 py-2.5 text-right">Trạng thái</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-800/70">
                    {recentOrderSummary.map(
                      ({ order, subtotalPrice, shippingFee, totalPrice }: any) => (
                        <tr
                          key={order.id}
                          className="transition hover:bg-slate-800/35"
                        >
                          <td className="px-4 py-3">
                            <div className="font-mono text-[11px] font-bold text-indigo-300">
                              #{String(order.paymentCode || order.id || "N/A").slice(0, 12)}
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-600">
                              <span>{formatOrderTime(order.createdAt)}</span>
                              <span>•</span>
                              <span className="max-w-[130px] truncate text-slate-500">
                                {order.customerName ||
                                  order.shippingAddress?.fullName ||
                                  "Khách vãng lai"}
                              </span>
                            </div>
                          </td>

                          <td className="px-3 py-3 text-[11px] font-semibold text-slate-300">
                            {order.storeName ||
                              order.merchantName ||
                              order.shopName ||
                              "Gian hàng"}
                          </td>

                          <td className="px-3 py-3 text-right font-bold text-cyan-400">
                            {formatMoney(subtotalPrice)}
                          </td>

                          <td className="px-3 py-3 text-right font-bold text-indigo-400">
                            {formatMoney(shippingFee)}
                          </td>

                          <td className="px-3 py-3 text-right font-black text-white">
                            {formatMoney(totalPrice)}
                          </td>

                          <td className="px-4 py-3 text-right">
                            {getStatusBadge(order.status)}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* OPERATIONS / QUICK ACCESS */}

          <aside className="space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/55 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-black text-slate-200">
                    Vận hành
                  </h2>
                  <p className="mt-0.5 text-[10px] text-slate-600">
                    Tình trạng hệ thống hiện tại.
                  </p>
                </div>

                <span
                  className={`rounded-full px-2 py-1 text-[10px] font-black ${
                    summary.pendingOrders > 0 || summary.pendingMerchants > 0
                      ? "bg-amber-500/10 text-amber-400"
                      : "bg-emerald-500/10 text-emerald-400"
                  }`}
                >
                  {summary.pendingOrders > 0 || summary.pendingMerchants > 0
                    ? "Cần chú ý"
                    : "Ổn định"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <MiniStat
                  label="Tổng đơn"
                  value={loading ? "..." : String(summary.totalOrders)}
                  helper={`${completionRate}% hoàn thành`}
                  tone="indigo"
                />

                <MiniStat
                  label="Đơn hủy"
                  value={loading ? "..." : String(summary.cancelledOrders)}
                  tone={summary.cancelledOrders > 0 ? "rose" : "slate"}
                />

                <MiniStat
                  label="Gian hàng"
                  value={loading ? "..." : String(summary.totalMerchants)}
                  helper={
                    summary.pendingMerchants > 0
                      ? `${summary.pendingMerchants} chờ duyệt`
                      : "Không có chờ duyệt"
                  }
                  tone={summary.pendingMerchants > 0 ? "amber" : "emerald"}
                />

                <MiniStat
                  label="Sản phẩm"
                  value={loading ? "..." : String(summary.totalProducts)}
                  helper={`${summary.totalUsers} người dùng`}
                  tone="cyan"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/55 p-4">
              <div className="mb-3">
                <h2 className="text-xs font-black text-slate-200">
                  Truy cập nhanh
                </h2>
                <p className="mt-0.5 text-[10px] text-slate-600">
                  Điều hướng gọn, không lặp lại thành một khu vực KPI thứ hai.
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <QuickLink
                  href="/revenue"
                  icon="📊"
                  title="Doanh thu"
                  helper="Dòng tiền & chiết khấu"
                />

                <QuickLink
                  href="/accounting"
                  icon="🧾"
                  title="Đối soát"
                  helper="Công nợ & giải ngân"
                />

                <QuickLink
                  href="/orders"
                  icon="📦"
                  title="Đơn hàng"
                  helper="Theo dõi vận đơn"
                />

                <QuickLink
                  href="/merchants"
                  icon="🏪"
                  title="Gian hàng"
                  helper="Duyệt & quản lý shop"
                />

                <QuickLink
                  href="/users"
                  icon="👥"
                  title="Người dùng"
                  helper="Customer, Shipper, Admin"
                />

                <button
                  onClick={() => setIsVoucherModalOpen(true)}
                  className="group flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/30 p-3 text-left transition hover:border-violet-500/40 hover:bg-slate-800/70"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-800 text-base transition group-hover:scale-105">
                    🎫
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-bold text-slate-200">
                      Voucher
                    </span>
                    <span className="mt-0.5 block truncate text-[10px] text-slate-500">
                      Tạo & quản lý ưu đãi
                    </span>
                  </span>

                  <span className="text-xs text-slate-600 transition group-hover:text-violet-400">
                    +
                  </span>
                </button>
              </div>
            </div>
          </aside>
        </section>
      </div>

      <VoucherManagerModal
        isOpen={isVoucherModalOpen}
        onClose={() => setIsVoucherModalOpen(false)}
      />
    </div>
  );
}
