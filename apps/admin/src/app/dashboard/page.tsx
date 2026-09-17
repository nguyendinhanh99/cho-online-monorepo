"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
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

interface RevenueData {
  [key: string]: any;
}

interface AccountingSummary {
  unpaidCount: number;
  totalUnpaidAmount: number;
  totalPartners: number;
}

// ============================================================
// HELPERS
// ============================================================

const formatMoney = (value: any) => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0đ";
  }

  return `${number.toLocaleString("vi-VN")}đ`;
};

const toNumber = (value: any, fallback = 0) => {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
};

const normalizeStatus = (status: any) => {
  return String(status || "")
    .toLowerCase()
    .trim();
};

const getOrderTimestamp = (value: any) => {
  if (!value) return 0;

  if (typeof value?.toDate === "function") {
    return value.toDate().getTime();
  }

  if (
    typeof value === "string" ||
    typeof value === "number"
  ) {
    const timestamp = new Date(value).getTime();

    return Number.isFinite(timestamp)
      ? timestamp
      : 0;
  }

  if (typeof value?.seconds === "number") {
    return value.seconds * 1000;
  }

  return 0;
};

// ============================================================
// ORDER FINANCIAL NORMALIZER
// ============================================================
//
// QUY ƯỚC:
//
// subtotalPrice / subTotalPrice
// = tiền món thực tế
//
// shippingFee
// = phí giao hàng khách trả
//
// totalPrice
// = tổng khách phải thanh toán
//
// platformProfit / platformFee
// = phần sàn thực nhận nếu backend đã tính
//
// KHÔNG coi shippingFee là lợi nhuận sàn.
// ============================================================

const getOrderFinancials = (order: any) => {
  const subtotalPrice = toNumber(
    order?.subTotalPrice ??
      order?.subtotalPrice ??
      order?.itemsTotal ??
      0
  );

  const shippingFee = toNumber(
    order?.shippingFee ??
      0
  );

  const totalPrice = toNumber(
    order?.totalPrice ??
      order?.grandTotal ??
      order?.total ??
      order?.amount ??
      subtotalPrice + shippingFee
  );

  const discountAmount = toNumber(
    order?.discountAmount ??
      0
  );

  return {
    subtotalPrice,
    shippingFee,
    totalPrice,
    discountAmount,
  };
};

// ============================================================
// DASHBOARD
// ============================================================

export default function DashboardPage() {
  const router = useRouter();

  const [data, setData] =
    useState<DashboardData | null>(null);

  const [revenueData, setRevenueData] =
    useState<RevenueData | null>(null);

  const [accountingSummary, setAccountingSummary] =
    useState<AccountingSummary | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [isLoggingOut, setIsLoggingOut] =
    useState(false);

  const [isVoucherModalOpen, setIsVoucherModalOpen] =
    useState(false);

  // ==========================================================
  // FETCH ALL DATA
  // ==========================================================

  const fetchAllData = useCallback(
    async () => {
      setLoading(true);

      try {
        const [
          dashRes,
          revRes,
          accRes,
        ] = await Promise.all([
          fetch("/api/dashboard", {
            cache: "no-store",
          }),

          fetch(
            "/api/revenue?timeFrame=DAY",
            {
              cache: "no-store",
            }
          ),

          fetch(
            "/api/accounting?role=ALL",
            {
              cache: "no-store",
            }
          ),
        ]);

        const [
          dashJson,
          revJson,
          accJson,
        ] = await Promise.all([
          dashRes.json(),
          revRes.json(),
          accRes.json(),
        ]);

        // ======================================================
        // DASHBOARD
        // ======================================================

        if (dashJson?.success) {
          setData(
            dashJson.data || null
          );
        }

        // ======================================================
        // REVENUE
        // ======================================================

        if (revJson?.success) {
          setRevenueData(
            revJson.data || null
          );
        }

        // ======================================================
        // ACCOUNTING
        // ======================================================

        if (
          accJson?.success &&
          Array.isArray(accJson.data)
        ) {
          const partners =
            accJson.data;

          const unpaidPartners =
            partners.filter(
              (partner: any) =>
                !partner?.isPaid
            );

          const unpaidCount =
            unpaidPartners.length;

          const totalUnpaidAmount =
            unpaidPartners.reduce(
              (
                sum: number,
                partner: any
              ) =>
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
            unpaidCount,
            totalUnpaidAmount,
            totalPartners:
              partners.length,
          });
        } else {
          setAccountingSummary({
            unpaidCount: 0,
            totalUnpaidAmount: 0,
            totalPartners: 0,
          });
        }
      } catch (error) {
        console.error(
          "❌ Lỗi tải dữ liệu Dashboard:",
          error
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // ==========================================================
  // INITIAL LOAD
  // ==========================================================

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // ==========================================================
  // LOGOUT
  // ==========================================================

  const handleLogout = async () => {
    if (
      !confirm(
        "Bạn có chắc chắn muốn đăng xuất khỏi hệ thống?"
      )
    ) {
      return;
    }

    setIsLoggingOut(true);

    try {
      await fetch(
        "/api/auth/logout",
        {
          method: "POST",
        }
      ).catch(() => {});

      localStorage.removeItem(
        "token"
      );

      localStorage.removeItem(
        "user"
      );

      sessionStorage.clear();

      window.location.href =
        "/login";
    } catch (error) {
      console.error(
        "❌ Lỗi đăng xuất:",
        error
      );

      router.push("/login");
    } finally {
      setIsLoggingOut(false);
    }
  };

  // ==========================================================
  // RAW DATA
  // ==========================================================

  const stats = data?.stats || {};

  const recentOrders =
    Array.isArray(
      data?.recentOrders
    )
      ? data.recentOrders
      : [];

  // ==========================================================
  // DERIVED FINANCIAL DATA
  // ==========================================================

  const financialSummary = useMemo(() => {
    // --------------------------------------------------------
    // PLATFORM PROFIT
    // --------------------------------------------------------

    const platformProfit = toNumber(
      stats.platformProfit ??
        stats.netPlatformProfit ??
        stats.platformRevenue ??
        revenueData?.platformProfit ??
        revenueData?.netProfit ??
        0
    );

    // --------------------------------------------------------
    // GMV
    // --------------------------------------------------------

    const totalGMV = toNumber(
      stats.totalGMV ??
        stats.gmv ??
        revenueData?.totalGMV ??
        revenueData?.gmv ??
        0
    );

    // --------------------------------------------------------
    // PRODUCT SALES
    // --------------------------------------------------------

    const totalProductSales =
      toNumber(
        stats.totalProductSales ??
          stats.totalSubtotal ??
          stats.subTotalPrice ??
          stats.productRevenue ??
          revenueData?.totalProductSales ??
          revenueData?.productRevenue ??
          0
      );

    // --------------------------------------------------------
    // SHIPPING COLLECTED
    // --------------------------------------------------------
    //
    // Đây chỉ là tiền phí ship khách trả.
    // KHÔNG gọi đây là lợi nhuận sàn.
    //

    const totalShippingCollected =
      toNumber(
        stats.totalShippingFee ??
          stats.shippingRevenue ??
          stats.totalShippingCollected ??
          revenueData?.totalShippingFee ??
          revenueData?.shippingRevenue ??
          0
      );

    // --------------------------------------------------------
    // ORDERS
    // --------------------------------------------------------

    const totalOrders = toNumber(
      stats.totalOrders ??
        0
    );

    const pendingOrders =
      toNumber(
        stats.pendingOrders ??
          stats.pending ??
          0
      );

    const completedOrders =
      toNumber(
        stats.completedOrders ??
          stats.completed ??
          0
      );

    const cancelledOrders =
      toNumber(
        stats.cancelledOrders ??
          stats.cancelled ??
          0
      );

    // --------------------------------------------------------
    // MERCHANTS
    // --------------------------------------------------------

    const totalMerchants =
      toNumber(
        stats.totalMerchants ??
          0
      );

    const pendingMerchants =
      toNumber(
        stats.pendingMerchants ??
          0
      );

    return {
      platformProfit,
      totalGMV,
      totalProductSales,
      totalShippingCollected,
      totalOrders,
      pendingOrders,
      completedOrders,
      cancelledOrders,
      totalMerchants,
      pendingMerchants,
    };
  }, [
    stats,
    revenueData,
  ]);

  // ==========================================================
  // RECENT ORDER SUMMARY
  // ==========================================================

  const recentOrderSummary =
    useMemo(() => {
      return recentOrders.map(
        (order: any) => {
          const money =
            getOrderFinancials(
              order
            );

          return {
            order,
            ...money,
          };
        }
      );
    }, [recentOrders]);

  // ==========================================================
  // STATUS BADGE
  // ==========================================================

  const getStatusBadge = (
    status: string
  ) => {
    const st =
      normalizeStatus(status);

    switch (st) {
      case "pending":
      case "finding_driver":
        return (
          <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold text-[10px]">
            Chờ xử lý
          </span>
        );

      case "accepted":
        return (
          <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded-full font-bold text-[10px]">
            Shop đã nhận
          </span>
        );

      case "preparing":
      case "processing":
        return (
          <span className="bg-orange-500/10 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full font-bold text-[10px]">
            Đang làm
          </span>
        );

      case "ready":
      case "ready_for_pickup":
        return (
          <span className="bg-teal-500/10 text-teal-400 border border-teal-500/30 px-2 py-0.5 rounded-full font-bold text-[10px]">
            Chờ lấy món
          </span>
        );

      case "assigned":
        return (
          <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded-full font-bold text-[10px]">
            Đã gán Shipper
          </span>
        );

      case "picking_up":
      case "delivering":
      case "shipping":
        return (
          <span className="bg-blue-500/10 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full font-bold text-[10px]">
            Đang giao
          </span>
        );

      case "completed":
      case "delivered":
        return (
          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold text-[10px]">
            Hoàn thành
          </span>
        );

      case "cancelled":
        return (
          <span className="bg-rose-500/10 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded-full font-bold text-[10px]">
            Đã hủy
          </span>
        );

      case "refunded":
        return (
          <span className="bg-purple-500/10 text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded-full font-bold text-[10px]">
            Đã hoàn tiền
          </span>
        );

      default:
        return (
          <span className="bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full font-bold text-[10px]">
            {status || "Không rõ"}
          </span>
        );
    }
  };

  // ==========================================================
  // KPI CARD
  // ==========================================================

  const KpiCard = ({
    href,
    icon,
    title,
    value,
    description,
    valueClassName,
    className,
  }: {
    href?: string;
    icon: string;
    title: string;
    value: string;
    description: string;
    valueClassName?: string;
    className?: string;
  }) => {
    const content = (
      <div
        className={`group h-full bg-slate-800/60 border border-slate-700/60 hover:border-slate-500 p-5 rounded-2xl backdrop-blur-md transition duration-200 ${
          className || ""
        }`}
      >
        <div className="flex justify-between items-center text-slate-400 mb-2">
          <span className="text-xs font-semibold group-hover:text-white transition">
            {title}
          </span>

          <span className="text-lg">
            {icon}
          </span>
        </div>

        <div
          className={`text-xl font-black ${
            valueClassName ||
            "text-white"
          }`}
        >
          {loading
            ? "..."
            : value}
        </div>

        <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
          {description}
        </p>
      </div>
    );

    if (href) {
      return (
        <Link
          href={href}
          className="block h-full"
        >
          {content}
        </Link>
      );
    }

    return content;
  };

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 md:p-8 space-y-8 font-sans">
      {/* ======================================================
          HEADER
      ======================================================= */}

      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-2">
            🚀 Trung Tâm Điều Hành Anvami
          </h1>

          <p className="text-xs md:text-sm text-slate-400 mt-1">
            Theo dõi hoạt động, dòng tiền,
            đối soát và vận hành toàn hệ thống.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start xl:self-auto flex-wrap">
          <button
            onClick={() =>
              setIsVoucherModalOpen(true)
            }
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-purple-600/30 transition flex items-center gap-2 cursor-pointer"
          >
            🎫 Tạo Voucher
          </button>

          <button
            onClick={fetchAllData}
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition flex items-center gap-2 cursor-pointer"
          >
            🔄{" "}
            {loading
              ? "Đang tải..."
              : "Cập nhật dữ liệu"}
          </button>

          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="px-4 py-2 bg-rose-600/20 hover:bg-rose-600 disabled:opacity-50 text-rose-300 hover:text-white border border-rose-500/40 hover:border-rose-600 font-bold text-xs rounded-xl shadow-lg transition flex items-center gap-1.5 cursor-pointer"
          >
            🚪{" "}
            {isLoggingOut
              ? "Đang thoát..."
              : "Đăng xuất"}
          </button>
        </div>
      </div>

      {/* ======================================================
          FINANCIAL OVERVIEW
      ======================================================= */}

      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
              Tài chính & Giao dịch
            </h2>

            <p className="text-[10px] text-slate-500 mt-1">
              Phân biệt rõ tiền khách trả và phần
              sàn thực nhận.
            </p>
          </div>

          <span className="text-[10px] text-slate-500 font-bold">
            {loading
              ? "Đang đồng bộ..."
              : "Dữ liệu hiện tại"}
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {/* ==================================================
              PLATFORM PROFIT
          =================================================== */}

          <KpiCard
            href="/revenue"
            icon="💰"
            title="Lợi nhuận Sàn"
            value={formatMoney(
              financialSummary.platformProfit
            )}
            valueClassName="text-emerald-400"
            description="Phần sàn thực nhận theo dữ liệu doanh thu/kế toán."
            className="bg-gradient-to-br from-slate-800/80 to-emerald-950/40 border-emerald-500/30 hover:border-emerald-400"
          />

          {/* ==================================================
              GMV
          =================================================== */}

          <KpiCard
            href="/revenue"
            icon="📈"
            title="GMV Tổng giao dịch"
            value={formatMoney(
              financialSummary.totalGMV
            )}
            valueClassName="text-amber-400"
            description="Tổng giá trị các giao dịch, không đồng nghĩa lợi nhuận."
          />

          {/* ==================================================
              PRODUCT SALES
          =================================================== */}

          <KpiCard
            icon="🍜"
            title="Tiền món"
            value={formatMoney(
              financialSummary.totalProductSales
            )}
            valueClassName="text-cyan-400"
            description="Giá trị phần hàng/món của các đơn."
          />

          {/* ==================================================
              SHIPPING
          =================================================== */}

          <KpiCard
            icon="🛵"
            title="Phí ship khách trả"
            value={formatMoney(
              financialSummary.totalShippingCollected
            )}
            valueClassName="text-indigo-400"
            description="Phí vận chuyển khách thanh toán; không mặc định là lợi nhuận Sàn."
          />

          {/* ==================================================
              ACCOUNTING
          =================================================== */}

          <KpiCard
            href="/accounting"
            icon="🧾"
            title="Cần giải ngân"
            value={formatMoney(
              accountingSummary?.totalUnpaidAmount ||
                0
            )}
            valueClassName="text-rose-400"
            description={`${
              accountingSummary?.unpaidCount ||
              0
            } đối tác đang chờ đối soát/thanh toán.`}
            className="bg-gradient-to-br from-amber-950/40 to-slate-800/80 border-amber-500/30 hover:border-amber-400"
          />
        </div>
      </section>

      {/* ======================================================
          OPERATION KPI
      ======================================================= */}

      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
              Vận hành hệ thống
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* MERCHANT */}

          <KpiCard
            href="/merchants"
            icon="🏪"
            title="Tổng gian hàng"
            value={String(
              financialSummary.totalMerchants
            )}
            valueClassName="text-white"
            description={
              financialSummary.pendingMerchants >
              0
                ? `⚠️ ${financialSummary.pendingMerchants} shop đang chờ duyệt.`
                : "Không có shop chờ duyệt."
            }
          />

          {/* ORDERS */}

          <KpiCard
            href="/orders"
            icon="📦"
            title="Tổng đơn hàng"
            value={String(
              financialSummary.totalOrders
            )}
            valueClassName="text-indigo-400"
            description={`Đã hoàn tất: ${financialSummary.completedOrders}.`}
          />

          {/* PENDING */}

          <KpiCard
            href="/orders"
            icon="⏳"
            title="Đơn cần xử lý"
            value={String(
              financialSummary.pendingOrders
            )}
            valueClassName="text-amber-400"
            description="Theo trạng thái pending đang được API Dashboard trả về."
          />

          {/* CANCELLED */}

          <KpiCard
            href="/orders"
            icon="🚫"
            title="Đơn đã hủy"
            value={String(
              financialSummary.cancelledOrders
            )}
            valueClassName="text-rose-400"
            description="Theo dõi riêng để kiểm soát chất lượng vận hành."
          />
        </div>
      </section>

      {/* ======================================================
          QUICK MANAGEMENT
      ======================================================= */}

      <section>
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">
          Trung tâm quản lý
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* ACCOUNTING */}

          <Link
            href="/accounting"
            className="group p-5 bg-amber-950/30 hover:bg-amber-900/40 border border-amber-500/40 hover:border-amber-400 rounded-2xl transition duration-200"
          >
            <div className="flex items-center justify-between">
              <span className="text-2xl p-3 bg-amber-500/20 text-amber-300 rounded-xl group-hover:scale-110 transition">
                🧾
              </span>

              <span className="text-xs text-amber-300 font-bold opacity-0 group-hover:opacity-100 transition">
                Mở →
              </span>
            </div>

            <h3 className="font-bold text-white text-base mt-4">
              Kế Toán & Đối Soát
            </h3>

            <p className="text-xs text-slate-300 mt-1">
              Theo dõi công nợ Merchant và Shipper,
              xác nhận thanh toán và đối soát.
            </p>
          </Link>

          {/* REVENUE */}

          <Link
            href="/revenue"
            className="group p-5 bg-indigo-950/40 hover:bg-indigo-900/50 border border-indigo-500/40 hover:border-indigo-400 rounded-2xl transition duration-200"
          >
            <div className="flex items-center justify-between">
              <span className="text-2xl p-3 bg-indigo-500/20 text-indigo-300 rounded-xl group-hover:scale-110 transition">
                💎
              </span>

              <span className="text-xs text-indigo-300 font-bold opacity-0 group-hover:opacity-100 transition">
                Chi tiết →
              </span>
            </div>

            <h3 className="font-bold text-white text-base mt-4">
              Báo Cáo Doanh Thu
            </h3>

            <p className="text-xs text-slate-300 mt-1">
              Phân tích GMV, doanh thu món, phí ship
              và lợi nhuận Sàn.
            </p>
          </Link>

          {/* VOUCHER */}

          <button
            onClick={() =>
              setIsVoucherModalOpen(true)
            }
            className="group p-5 bg-purple-950/30 hover:bg-purple-900/40 border border-purple-500/40 hover:border-purple-400 rounded-2xl transition duration-200 text-left cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-2xl p-3 bg-purple-500/20 text-purple-300 rounded-xl group-hover:scale-110 transition">
                🎫
              </span>

              <span className="text-xs text-purple-300 font-bold opacity-0 group-hover:opacity-100 transition">
                Tạo mới +
              </span>
            </div>

            <h3 className="font-bold text-white text-base mt-4">
              Khuyến Mãi & Voucher
            </h3>

            <p className="text-xs text-slate-300 mt-1">
              Quản lý mã giảm giá và chiến dịch
              marketing.
            </p>
          </button>

          {/* USERS */}

          <Link
            href="/users"
            className="group p-5 bg-slate-800/40 hover:bg-slate-800 border border-slate-700/60 hover:border-indigo-500/50 rounded-2xl transition duration-200"
          >
            <div className="flex items-center justify-between">
              <span className="text-2xl p-3 bg-indigo-500/10 text-indigo-400 rounded-xl group-hover:scale-110 transition">
                👥
              </span>

              <span className="text-xs text-indigo-400 font-bold opacity-0 group-hover:opacity-100 transition">
                Truy cập →
              </span>
            </div>

            <h3 className="font-bold text-slate-100 text-base mt-4">
              Người Dùng & Phân Quyền
            </h3>

            <p className="text-xs text-slate-400 mt-1">
              Quản lý Customer, Merchant, Shipper
              và Admin.
            </p>
          </Link>

          {/* MERCHANTS */}

          <Link
            href="/merchants"
            className="group p-5 bg-slate-800/40 hover:bg-slate-800 border border-slate-700/60 hover:border-emerald-500/50 rounded-2xl transition duration-200"
          >
            <div className="flex items-center justify-between">
              <span className="text-2xl p-3 bg-emerald-500/10 text-emerald-400 rounded-xl group-hover:scale-110 transition">
                🏪
              </span>

              <span className="text-xs text-emerald-400 font-bold opacity-0 group-hover:opacity-100 transition">
                Truy cập →
              </span>
            </div>

            <h3 className="font-bold text-slate-100 text-base mt-4">
              Cửa Hàng & Gian Hàng
            </h3>

            <p className="text-xs text-slate-400 mt-1">
              Duyệt shop, quản lý gian hàng và
              sản phẩm.
            </p>
          </Link>

          {/* ORDERS */}

          <Link
            href="/orders"
            className="group p-5 bg-slate-800/40 hover:bg-slate-800 border border-slate-700/60 hover:border-amber-500/50 rounded-2xl transition duration-200"
          >
            <div className="flex items-center justify-between">
              <span className="text-2xl p-3 bg-amber-500/10 text-amber-400 rounded-xl group-hover:scale-110 transition">
                📦
              </span>

              <span className="text-xs text-amber-400 font-bold opacity-0 group-hover:opacity-100 transition">
                Truy cập →
              </span>
            </div>

            <h3 className="font-bold text-slate-100 text-base mt-4">
              Đơn Hàng & Vận Chuyển
            </h3>

            <p className="text-xs text-slate-400 mt-1">
              Theo dõi vận đơn và xử lý các trường
              hợp bất thường.
            </p>
          </Link>
        </div>
      </section>

      {/* ======================================================
          LATEST ORDERS
      ======================================================= */}

      <section className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <span>⚡</span>
              Đơn Hàng Mới Nhất
            </h2>

            <p className="text-[10px] text-slate-500 mt-0.5">
              Tổng quan tiền món, phí giao hàng và
              tổng thanh toán của từng đơn.
            </p>
          </div>

          <Link
            href="/orders"
            className="text-xs font-semibold text-indigo-400 hover:underline"
          >
            Xem tất cả →
          </Link>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">
            Đang tải dữ liệu...
          </div>
        ) : recentOrderSummary.length ===
          0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            Chưa có đơn hàng nào
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[900px]">
              <thead>
                <tr className="text-slate-400 font-bold border-b border-slate-700/80 uppercase text-[10px]">
                  <th className="pb-3 pr-3">
                    Mã Đơn
                  </th>

                  <th className="pb-3 pr-3">
                    Khách Hàng
                  </th>

                  <th className="pb-3 pr-3">
                    Gian Hàng
                  </th>

                  <th className="pb-3 pr-3 text-right">
                    Tiền Món
                  </th>

                  <th className="pb-3 pr-3 text-right">
                    Phí Ship
                  </th>

                  <th className="pb-3 pr-3 text-right">
                    Tổng Đơn
                  </th>

                  <th className="pb-3">
                    Trạng Thái
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-700/40 text-slate-300">
                {recentOrderSummary.map(
                  ({
                    order,
                    subtotalPrice,
                    shippingFee,
                    totalPrice,
                  }: any) => (
                    <tr
                      key={order.id}
                      className="hover:bg-slate-700/20 transition"
                    >
                      {/* ORDER ID */}

                      <td className="py-3 pr-3 font-mono text-indigo-300 font-bold">
                        #
                        {order.id
                          ? order.id
                              .slice(
                                0,
                                8
                              )
                          : "N/A"}
                      </td>

                      {/* CUSTOMER */}

                      <td className="py-3 pr-3 font-medium">
                        {order.customerName ||
                          order.shippingAddress
                            ?.fullName ||
                          "Khách Vãng Lai"}
                      </td>

                      {/* MERCHANT */}

                      <td className="py-3 pr-3 text-slate-400">
                        {order.storeName ||
                          order.merchantName ||
                          order.shopName ||
                          "Gian hàng"}
                      </td>

                      {/* PRODUCT MONEY */}

                      <td className="py-3 pr-3 text-right font-bold text-cyan-400">
                        {formatMoney(
                          subtotalPrice
                        )}
                      </td>

                      {/* SHIPPING */}

                      <td className="py-3 pr-3 text-right font-bold text-indigo-400">
                        {formatMoney(
                          shippingFee
                        )}
                      </td>

                      {/* TOTAL */}

                      <td className="py-3 pr-3 text-right font-black text-emerald-400">
                        {formatMoney(
                          totalPrice
                        )}
                      </td>

                      {/* STATUS */}

                      <td className="py-3">
                        {getStatusBadge(
                          order.status
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ======================================================
          OPERATION SUMMARY
      ======================================================= */}

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* PLATFORM */}

        <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-400">
                Phần Sàn
              </p>

              <p className="text-2xl font-black text-emerald-300 mt-1">
                {loading
                  ? "..."
                  : formatMoney(
                      financialSummary.platformProfit
                    )}
              </p>
            </div>

            <span className="text-3xl">
              💎
            </span>
          </div>

          <p className="text-[10px] text-slate-500 mt-2">
            Đây mới là chỉ số cần theo dõi để
            đánh giá hiệu quả kinh doanh của Sàn,
            thay vì lấy tổng tiền đơn hàng.
          </p>
        </div>

        {/* ORDERS */}

        <div className="bg-blue-950/20 border border-blue-500/20 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-blue-400">
                Đơn hoàn tất
              </p>

              <p className="text-2xl font-black text-blue-300 mt-1">
                {loading
                  ? "..."
                  : financialSummary.completedOrders}
              </p>
            </div>

            <span className="text-3xl">
              ✅
            </span>
          </div>

          <p className="text-[10px] text-slate-500 mt-2">
            So sánh với tổng đơn để theo dõi tỷ lệ
            hoàn thành và tình trạng vận hành.
          </p>
        </div>

        {/* PAYABLE */}

        <div className="bg-rose-950/20 border border-rose-500/20 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-rose-400">
                Công nợ phải trả
              </p>

              <p className="text-2xl font-black text-rose-300 mt-1">
                {loading
                  ? "..."
                  : formatMoney(
                      accountingSummary?.totalUnpaidAmount ||
                        0
                    )}
              </p>
            </div>

            <span className="text-3xl">
              🧾
            </span>
          </div>

          <p className="text-[10px] text-slate-500 mt-2">
            {accountingSummary?.unpaidCount ||
              0}{" "}
            đối tác chưa được giải ngân/đối soát.
          </p>
        </div>
      </section>

      {/* ======================================================
          VOUCHER MODAL
      ======================================================= */}

      <VoucherManagerModal
        isOpen={
          isVoucherModalOpen
        }
        onClose={() =>
          setIsVoucherModalOpen(
            false
          )
        }
      />
    </div>
  );
}