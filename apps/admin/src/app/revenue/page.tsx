"use client";

import { useEffect, useState, useCallback } from "react";
import { calculatePlatformShippingShare } from "@/lib/shippingCalculator";

// ==========================================
// BỘ ICON SVG TỰ ĐỊNH NGHĨA
// ==========================================
const Building2 = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0v-5a2 2 0 012-2h2a2 2 0 012 2v5m-4 0h4" />
  </svg>
);

const Store = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h18v18H3V3zm3 6h12M6 15h12" />
  </svg>
);

const Bike = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="5.5" cy="17.5" r="3.5" strokeWidth={2} />
    <circle cx="18.5" cy="17.5" r="3.5" strokeWidth={2} />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 6a1 1 0 100-2 1 1 0 000 2zm-3 5.5l3-3.5h3.5M12 11.5l-3-7H4.5" />
  </svg>
);

const TrendingUp = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);

const Percent = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 15L15 9m-6 0a1 1 0 110-2 1 1 0 010 2zm6 6a1 1 0 110-2 1 1 0 010 2z" />
  </svg>
);

const Calendar = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const X = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const Loader2 = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v2m0 12v2m8-8h-2M6 12H4m15.364-6.364l-1.414 1.414M6.343 17.657l-1.414 1.414m12.728 0l-1.414-1.414M6.343 6.343L4.929 4.929" />
  </svg>
);

const Receipt = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l2 2 4-4m-6 8a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v13a2 2 0 01-2 2H9z" />
  </svg>
);

const ArrowUpRight = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M17 7H7m10 0v10" />
  </svg>
);

const Save = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
  </svg>
);

const DollarSign = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 1v22m5-18H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
  </svg>
);

const ChevronRight = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const Filter = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
  </svg>
);

const BarChart3 = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 20V10M12 20V4M6 20v-6" />
  </svg>
);

const isCodMethod = (method?: string) => {
  if (!method) return false;
  const normalizedMethod = method.toLowerCase().trim();
  return normalizedMethod === "cod" || normalizedMethod === "cash";
};

// ==========================================
// COMPONENT BIỂU ĐỒ SVG THUẦN
// ==========================================
function ComparisonChart({ data, viewType }: { data: any[]; viewType: string }) {
  if (!data || data.length === 0) return null;

  const maxVal = Math.max(
    ...data.map((d) =>
      viewType === "PLATFORM"
        ? Math.max(d.platformNet || 0, d.shippingNet || 0, d.gmv || 0)
        : Math.max(d.gross || 0, d.net || 0)
    ),
    1
  );

  const isPlatform = viewType === "PLATFORM";

  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5 backdrop-blur-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-indigo-400" />
          <h3 className="font-bold text-xs sm:text-sm text-slate-200">Biểu Đồ So Sánh Doanh Thu</h3>
        </div>

        <div className="flex items-center gap-4 text-xs">
          {isPlatform ? (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-emerald-500 inline-block" />
                <span className="text-slate-400">Chiết khấu sàn</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-indigo-500 inline-block" />
                <span className="text-slate-400">Phí ship sàn</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-slate-600 inline-block" />
                <span className="text-slate-400">Tổng thu</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-emerald-500 inline-block" />
                <span className="text-slate-400">Thực nhận</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="h-48 w-full flex items-end gap-3 sm:gap-6 pt-6 pb-2 px-2 overflow-x-auto">
        {data.map((item, idx) => {
          const val1 = isPlatform ? item.platformNet || 0 : item.gross || 0;
          const val2 = isPlatform ? item.shippingNet || 0 : item.net || 0;

          const h1 = Math.max((val1 / maxVal) * 100, 4);
          const h2 = Math.max((val2 / maxVal) * 100, 4);

          return (
            <div key={idx} className="flex-1 min-w-[50px] flex flex-col items-center h-full justify-end group relative">
              <div className="absolute -top-12 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950 border border-slate-700 text-[10px] p-2 rounded-xl pointer-events-none z-10 whitespace-nowrap shadow-2xl">
                <p className="font-bold text-white mb-0.5">{item.time}</p>
                {isPlatform ? (
                  <>
                    <p className="text-emerald-400">CK: {val1.toLocaleString("vi-VN")}đ</p>
                    <p className="text-indigo-400">Ship: {val2.toLocaleString("vi-VN")}đ</p>
                  </>
                ) : (
                  <>
                    <p className="text-slate-300">Tổng: {val1.toLocaleString("vi-VN")}đ</p>
                    <p className="text-emerald-400">Thực nhận: {val2.toLocaleString("vi-VN")}đ</p>
                  </>
                )}
              </div>

              <div className="w-full flex items-end justify-center gap-1.5 h-full">
                <div
                  style={{ height: `${h1}%` }}
                  className={`w-1/2 max-w-[18px] rounded-t-lg transition-all duration-300 ${
                    isPlatform ? "bg-emerald-500 hover:bg-emerald-400" : "bg-slate-600 hover:bg-slate-500"
                  }`}
                />
                <div
                  style={{ height: `${h2}%` }}
                  className={`w-1/2 max-w-[18px] rounded-t-lg transition-all duration-300 ${
                    isPlatform ? "bg-indigo-500 hover:bg-indigo-400" : "bg-emerald-500 hover:bg-emerald-400"
                  }`}
                />
              </div>

              <span className="text-[10px] text-slate-400 mt-2 font-medium truncate w-full text-center">
                {item.time}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface OrderData {
  id?: string;
  paymentCode?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  customerName?: string;
  recipientName?: string;
  shopName?: string;
  storeName?: string;
  shipperName?: string;
  status: string;
  subTotalCostPrice?: number; // Giá gốc chưa khuyến mãi
  subTotalPrice?: number;     // Giá món sau khuyến mãi
  basePrice?: number;
  platformCut?: number;
  platformFeePercent?: number;
  shippingFee: number;
  shippingCut?: number;
  distanceKm?: number;
  totalPrice: number;
  createdAt?: string;
}

export default function RevenuePage() {
  const [viewType, setViewType] = useState<"PLATFORM" | "MERCHANT" | "SHIPPER">("PLATFORM");
  const [timeFrame, setTimeFrame] = useState<"HOUR" | "DAY" | "MONTH" | "YEAR">("DAY");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  const [partners, setPartners] = useState<any[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>("");

  const [platformFee, setPlatformFee] = useState<number>(10);
  const [savingConfig, setSavingConfig] = useState(false);

  const [selectedTimeRow, setSelectedTimeRow] = useState<string | null>(null);
  const [ordersDetail, setOrdersDetail] = useState<OrderData[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  useEffect(() => {
    if (viewType === "PLATFORM") return;
    const fetchPartners = async () => {
      try {
        const res = await fetch(`/api/users?role=${viewType}`, { cache: "no-store" });
        const json = await res.json();
        if (json.success) {
          const partnerList = json.data || [];
          setPartners(partnerList);
          setSelectedPartnerId(partnerList.length > 0 ? partnerList[0].id : "");
        }
      } catch (err) {
        console.error("Lỗi lấy danh sách đối tác:", err);
      }
    };
    fetchPartners();
  }, [viewType]);

  const fetchRevenue = useCallback(async () => {
    if (viewType !== "PLATFORM" && !selectedPartnerId) return;

    setLoading(true);
    try {
      let url =
        viewType === "PLATFORM"
          ? `/api/revenue?timeFrame=${timeFrame}`
          : `/api/partner-revenue?type=${viewType}&id=${selectedPartnerId}&timeFrame=${timeFrame}`;

      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json();

      if (json.success) {
        setData(json.data);
        if (viewType === "PLATFORM") {
          setPlatformFee(json.data.config?.platformFeePercent ?? 10);
        }
      }
    } catch (err) {
      console.error("Lỗi tải báo cáo:", err);
    } finally {
      setLoading(false);
    }
  }, [viewType, selectedPartnerId, timeFrame]);

  useEffect(() => {
    fetchRevenue();
  }, [fetchRevenue]);

  const handleRowClick = async (timeLabel: string) => {
    setSelectedTimeRow(timeLabel);
    setLoadingOrders(true);
    setOrdersDetail([]);

    try {
      let url = `/api/revenue/orders?timeFrame=${timeFrame}&time=${encodeURIComponent(timeLabel)}&viewType=${viewType}`;
      if (viewType !== "PLATFORM" && selectedPartnerId) {
        url += `&partnerId=${encodeURIComponent(selectedPartnerId)}`;
      }

      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json();
      setOrdersDetail(json.success ? json.data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const res = await fetch("/api/revenue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platformFeePercent: platformFee }),
      });
      const json = await res.json();
      if (json.success) {
        alert("⚙️ Đã cập nhật tỷ lệ chiết khấu sàn!");
        fetchRevenue();
      }
    } finally {
      setSavingConfig(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6 font-sans">
      {/* 1. Header & Bộ Lọc Thời Gian */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-3xl border border-slate-800/80 backdrop-blur-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/20">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                Báo Cáo Doanh Thu Hệ Thống
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                {viewType === "PLATFORM" && "Phân tích doanh thu tổng hợp sàn, hoa hồng món ăn và phí vận hành ship."}
                {viewType === "MERCHANT" && "Doanh thu món ăn tính theo giá gốc chưa KM & phí sàn chiết khấu theo %."}
                {viewType === "SHIPPER" && "Thu nhập từ phí vận chuyển & khoản điều tiết phí ship về sàn."}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center bg-slate-950/80 p-1.5 rounded-2xl border border-slate-800 self-start lg:self-auto">
          {[
            { id: "HOUR", label: "Theo Giờ" },
            { id: "DAY", label: "Theo Ngày" },
            { id: "MONTH", label: "Theo Tháng" },
            { id: "YEAR", label: "Theo Năm" },
          ].map((tf) => (
            <button
              key={tf.id}
              onClick={() => setTimeFrame(tf.id as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                timeFrame === tf.id
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 font-bold"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Control Bar */}
      <div className="bg-slate-900/40 p-4 rounded-3xl border border-slate-800/60 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
        <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800/80 gap-1 overflow-x-auto">
          {[
            { id: "PLATFORM", label: "Doanh Thu Sàn", icon: Building2 },
            { id: "MERCHANT", label: "Gian Hàng", icon: Store },
            { id: "SHIPPER", label: "Shipper", icon: Bike },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = viewType === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setViewType(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                  active
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {viewType !== "PLATFORM" && (
          <div className="flex items-center gap-3 bg-slate-950 px-3.5 py-2 rounded-2xl border border-slate-800">
            <Filter className="w-4 h-4 text-indigo-400" />
            <span className="text-xs text-slate-400 font-medium whitespace-nowrap">
              {viewType === "MERCHANT" ? "Gian hàng:" : "Shipper:"}
            </span>
            <select
              value={selectedPartnerId}
              onChange={(e) => setSelectedPartnerId(e.target.value)}
              className="bg-transparent text-xs font-semibold text-white outline-none cursor-pointer max-w-[200px] truncate"
            >
              {partners.length === 0 && <option value="">Chưa có dữ liệu</option>}
              {partners.map((p) => (
                <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                  {p.shopName || p.fullName || p.name || p.id}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 3. Cấu hình Chiết khấu (Tab Sàn) */}
      {viewType === "PLATFORM" && (
        <div className="bg-gradient-to-r from-indigo-950/30 via-slate-900/50 to-slate-900/50 p-5 rounded-3xl border border-indigo-500/20 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/20">
              <Percent className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Tỷ lệ Chiết Khấu Sàn Mặc Định</h4>
              <p className="text-xs text-slate-400">Chiết khấu được tính dựa trên giá món gốc chưa qua khuyến mãi (subTotalCostPrice).</p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-36">
              <input
                type="number"
                value={platformFee}
                onChange={(e) => setPlatformFee(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700/80 text-emerald-400 font-extrabold rounded-2xl px-3.5 py-2 text-sm outline-none focus:border-indigo-500 transition pr-8"
              />
              <span className="absolute right-3.5 top-2.5 font-bold text-slate-500 text-xs">%</span>
            </div>
            <button
              disabled={savingConfig}
              onClick={handleSaveConfig}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-2xl transition text-xs shadow-lg shadow-indigo-600/20 whitespace-nowrap"
            >
              {savingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {savingConfig ? "Đang lưu..." : "Lưu Thay Đổi"}
            </button>
          </div>
        </div>
      )}

      {/* 4. Stat Cards Header */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-slate-900/50 rounded-3xl animate-pulse border border-slate-800" />
          ))}
        </div>
      ) : data?.summary ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {viewType === "PLATFORM" ? (
            <>
              <div className="bg-slate-900/60 p-5 rounded-3xl border border-slate-800/80 backdrop-blur-xl relative overflow-hidden flex flex-col justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-400 block mb-1">Tổng Giao Dịch (GMV)</span>
                  <span className="text-2xl font-black text-white tracking-tight">
                    {(data.summary.totalGMV || 0).toLocaleString("vi-VN")}đ
                  </span>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                  <span className="text-amber-400 font-semibold">
                    COD: {(data.summary.totalCodGMV || 0).toLocaleString("vi-VN")}đ
                  </span>
                  <span className="text-emerald-400 font-semibold">
                    Banking: {(data.summary.totalBankGMV || 0).toLocaleString("vi-VN")}đ
                  </span>
                </div>
              </div>

              <div className="bg-slate-900/60 p-5 rounded-3xl border border-slate-800/80 backdrop-blur-xl relative overflow-hidden flex flex-col justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-400 block mb-1">Doanh Thu Chiết Khấu</span>
                  <span className="text-2xl font-black text-emerald-400 tracking-tight">
                    {(data.summary.totalPlatformRevenue || 0).toLocaleString("vi-VN")}đ
                  </span>
                </div>
                <div className="absolute right-4 top-4 p-2 bg-emerald-500/10 rounded-xl text-emerald-400">
                  <Percent className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-slate-900/60 p-5 rounded-3xl border border-slate-800/80 backdrop-blur-xl relative overflow-hidden flex flex-col justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-400 block mb-1">Phí Ship Sàn Thu</span>
                  <span className="text-2xl font-black text-indigo-400 tracking-tight">
                    {(data.summary.totalShippingRevenue || 0).toLocaleString("vi-VN")}đ
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 block mt-1">Trích cố định theo khoảng cách/giờ</span>
              </div>

              <div className="bg-gradient-to-br from-indigo-950/60 via-slate-900/80 to-slate-900/80 p-5 rounded-3xl border border-indigo-500/30 backdrop-blur-xl relative overflow-hidden flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-indigo-300 block mb-1">Tổng Thực Nhận Sàn</span>
                  <span className="text-2xl font-black text-amber-400 tracking-tight">
                    {(data.summary.netTotalRevenue || 0).toLocaleString("vi-VN")}đ
                  </span>
                </div>
                <div className="absolute right-4 top-4 p-2 bg-amber-500/10 rounded-xl text-amber-400">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="bg-slate-900/60 p-5 rounded-3xl border border-slate-800/80 backdrop-blur-xl flex flex-col justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-400 block mb-1">
                    Tổng Thu ({viewType === "MERCHANT" ? "Giá Món Gốc chưa KM" : "Tổng Ship"})
                  </span>
                  <span className="text-2xl font-black text-white tracking-tight">
                    {(data.summary.totalGrossRevenue || 0).toLocaleString("vi-VN")}đ
                  </span>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                  <span className="text-amber-400 font-semibold">
                    COD: {(data.summary.totalCodGMV || 0).toLocaleString("vi-VN")}đ
                  </span>
                  <span className="text-emerald-400 font-semibold">
                    Banking: {(data.summary.totalBankGMV || 0).toLocaleString("vi-VN")}đ
                  </span>
                </div>
              </div>

              <div className="bg-slate-900/60 p-5 rounded-3xl border border-slate-800/80 backdrop-blur-xl">
                <span className="text-xs font-semibold text-slate-400 block mb-1">
                  {viewType === "MERCHANT"
                    ? `Chiết Khấu Sàn (${data.summary.appliedCommissionPercent || 0}%)`
                    : "Phí Vận Hành Sàn Giữ"}
                </span>
                <span className="text-2xl font-black text-rose-400 tracking-tight">
                  -{(data.summary.totalPlatformCut || 0).toLocaleString("vi-VN")}đ
                </span>
              </div>

              <div className="bg-gradient-to-br from-emerald-950/40 to-slate-900/80 p-5 rounded-3xl border border-emerald-500/30 col-span-1 sm:col-span-2 backdrop-blur-xl flex justify-between items-center">
                <div>
                  <span className="text-xs font-bold text-emerald-300 block mb-1">
                    {viewType === "MERCHANT" ? "Thực Nhận Gian Hàng" : "Thực Nhận Shipper"}
                  </span>
                  <span className="text-3xl font-black text-emerald-400 tracking-tight">
                    {(data.summary.totalNetRevenue || 0).toLocaleString("vi-VN")}đ
                  </span>
                </div>
                <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20">
                  <ArrowUpRight className="w-6 h-6" />
                </div>
              </div>
            </>
          )}
        </div>
      ) : null}

      {/* 5. Biểu Đồ So Sánh */}
      {!loading && data?.chartData?.length > 0 && (
        <ComparisonChart data={data.chartData} viewType={viewType} />
      )}

      {/* 6. Bảng Chi Tiết Theo Mốc Thời Gian */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl overflow-hidden backdrop-blur-xl shadow-xl">
        <div className="p-4 sm:p-5 border-b border-slate-800/80 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-400" />
            <h3 className="font-bold text-xs sm:text-sm text-slate-200">
              Chi Tiết Theo Mốc Thời Gian
            </h3>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">Nhấp vào dòng để xem danh sách đơn</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 font-semibold bg-slate-950/60 border-b border-slate-800/80 uppercase text-[10px] tracking-wider">
                <th className="p-4">Thời Gian</th>
                <th className="p-4">Số Đơn</th>
                <th className="p-4">Tiền Mặt (COD)</th>
                <th className="p-4">Chuyển Khoản</th>
                {viewType === "PLATFORM" ? (
                  <>
                    <th className="p-4">Tổng GMV</th>
                    <th className="p-4">Doanh Thu Chiết Khấu</th>
                    <th className="p-4">Phí Vận Hành Ship</th>
                    <th className="p-4 text-right">Thực Nhận Sàn</th>
                  </>
                ) : (
                  <>
                    <th className="p-4">{viewType === "MERCHANT" ? "Tổng Giá Món Gốc chưa KM" : "Tổng Phí Ship Thu"}</th>
                    <th className="p-4">Phí Trích Cho Sàn</th>
                    <th className="p-4 text-right">
                      {viewType === "MERCHANT" ? "Thực Nhận Gian Hàng" : "Thực Nhận Shipper"}
                    </th>
                  </>
                )}
                <th className="p-4 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                    Đang tính toán dữ liệu doanh thu...
                  </td>
                </tr>
              ) : data?.chartData?.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500">
                    Không tìm thấy dữ liệu phát sinh trong khoảng thời gian này.
                  </td>
                </tr>
              ) : (
                data?.chartData?.map((row: any, idx: number) => (
                  <tr
                    key={idx}
                    onClick={() => handleRowClick(row.time)}
                    className="hover:bg-indigo-900/10 transition-colors duration-150 cursor-pointer group"
                  >
                    <td className="p-4 font-bold text-white flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                      {row.time}
                    </td>
                    <td className="p-4 font-medium text-slate-400">
                      <span className="bg-slate-800 text-slate-300 px-2.5 py-1 rounded-full text-[11px]">
                        {row.count} đơn
                      </span>
                    </td>
                    <td className="p-4 font-semibold text-amber-400">
                      {(row.codAmount || 0).toLocaleString("vi-VN")}đ
                    </td>
                    <td className="p-4 font-semibold text-emerald-400">
                      {(row.bankAmount || 0).toLocaleString("vi-VN")}đ
                    </td>
                    {viewType === "PLATFORM" ? (
                      <>
                        <td className="p-4 font-semibold">{(row.gmv || 0).toLocaleString("vi-VN")}đ</td>
                        <td className="p-4 font-semibold text-emerald-400">
                          +{(row.platformNet || 0).toLocaleString("vi-VN")}đ
                        </td>
                        <td className="p-4 font-semibold text-indigo-400">
                          +{(row.shippingNet || 0).toLocaleString("vi-VN")}đ
                        </td>
                        <td className="p-4 text-right font-black text-amber-400 text-sm">
                          {((row.platformNet || 0) + (row.shippingNet || 0)).toLocaleString("vi-VN")}đ
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="p-4 font-semibold">{(row.gross || 0).toLocaleString("vi-VN")}đ</td>
                        <td className="p-4 font-semibold text-rose-400">
                          -{(row.platformCut || 0).toLocaleString("vi-VN")}đ
                        </td>
                        <td className="p-4 text-right font-black text-emerald-400 text-sm">
                          {(row.net || 0).toLocaleString("vi-VN")}đ
                        </td>
                      </>
                    )}
                    <td className="p-4 text-right text-slate-500 group-hover:text-indigo-400 transition-colors">
                      <ChevronRight className="w-4 h-4 ml-auto" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 7. Modal Xem Danh Sách Đơn Hàng Chi Tiết */}
      {selectedTimeRow && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 transition-all duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-6xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-slate-800 bg-slate-950/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm sm:text-base">
                    Chi Tiết Đơn Hàng - {selectedTimeRow}
                  </h3>
                  <p className="text-xs text-slate-400">Chiết khấu sàn được tính dựa trên subTotalCostPrice (Giá món chưa KM)</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTimeRow(null)}
                className="p-2 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-5 space-y-3">
              {loadingOrders ? (
                <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                  Đang tải danh sách đơn hàng...
                </div>
              ) : ordersDetail.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  Không tìm thấy chi tiết đơn hàng trong mốc này.
                </div>
              ) : (
                <div className="border border-slate-800 rounded-2xl overflow-hidden overflow-x-auto">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead>
                      <tr className="text-slate-400 bg-slate-950 border-b border-slate-800 text-[10px] uppercase font-semibold">
                        <th className="p-3">Mã Đơn</th>
                        <th className="p-3">Thanh Toán</th>
                        <th className="p-3 text-right">Giá Gốc Chưa KM<br/><span className="text-[9px] text-slate-500 font-normal">(subTotalCostPrice)</span></th>
                        <th className="p-3 text-right">Giá Món Sau KM<br/><span className="text-[9px] text-slate-500 font-normal">(subTotalPrice)</span></th>
                        <th className="p-3 text-right">Chiết Khấu Sàn<br/><span className="text-[9px] text-slate-500 font-normal">(Tính từ Giá Gốc)</span></th>
                        <th className="p-3 text-right">Quán Thực Nhận<br/><span className="text-[9px] text-slate-500 font-normal">(Sau CK Sàn)</span></th>
                        <th className="p-3 text-right">Phí Ship</th>
                        <th className="p-3 text-right">Tổng Đơn Khách Trả</th>
                        <th className="p-3 text-right">Phí Ship Sàn Giữ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                      {ordersDetail.map((order, i) => {
                        const isCod = isCodMethod(order.paymentMethod);

                        // 1. Phí ship sàn giữ
                        const shippingCut = order.shippingCut ?? calculatePlatformShippingShare(order.distanceKm || 0, order.createdAt);

                        // 2. Giá món gốc chưa khuyến mãi (subTotalCostPrice)
                        const costPrice = order.subTotalCostPrice ?? order.basePrice ?? Math.max(0, (order.totalPrice || 0) - (order.shippingFee || 0));

                        // 3. Giá món sau khuyến mãi (subTotalPrice)
                        const promoPrice = order.subTotalPrice ?? Math.max(0, (order.totalPrice || 0) - (order.shippingFee || 0));

                        // 4. Chiết khấu sàn tính TỪ GIÁ GỐC CHƯA KHUYẾN MÃI (subTotalCostPrice)
                        const discountRate = order.platformFeePercent ?? 10;
                        const discountCut = order.platformCut ?? Math.round((costPrice * discountRate) / 100);

                        // 5. Thực nhận của gian hàng = Giá sau KM - Chiết khấu sàn từ giá gốc
                        const merchantNet = Math.max(0, promoPrice - discountCut);

                        return (
                          <tr key={i} className="hover:bg-slate-800/30 transition">
                            <td className="p-3 font-mono font-semibold text-indigo-400">
                              #{order.paymentCode || order.id?.slice(0, 8)}
                            </td>
                            <td className="p-3">
                              {isCod ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 inline-flex items-center gap-1">
                                  💵 COD
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1">
                                  💳 Chuyển khoản
                                </span>
                              )}
                            </td>

                            {/* 1. Giá món gốc chưa KM */}
                            <td className="p-3 text-right font-medium text-slate-300">
                              {costPrice.toLocaleString("vi-VN")}đ
                            </td>

                            {/* 2. Giá món sau KM */}
                            <td className="p-3 text-right font-medium text-slate-200">
                              {promoPrice.toLocaleString("vi-VN")}đ
                            </td>

                            {/* 3. Chiết khấu sàn (Tính từ Giá Gốc chưa KM) */}
                            <td className="p-3 text-right font-semibold text-rose-400">
                              -{discountCut.toLocaleString("vi-VN")}đ
                              <span className="text-[10px] text-slate-500 block font-normal">({discountRate}% / giá gốc)</span>
                            </td>

                            {/* 4. Quán thực nhận */}
                            <td className="p-3 text-right font-bold text-emerald-400">
                              {merchantNet.toLocaleString("vi-VN")}đ
                            </td>

                            {/* 5. Phí ship */}
                            <td className="p-3 text-right font-semibold text-slate-400">
                              {(order.shippingFee || 0).toLocaleString("vi-VN")}đ
                            </td>

                            {/* 6. Tổng đơn */}
                            <td className="p-3 text-right font-extrabold text-white">
                              {(order.totalPrice || 0).toLocaleString("vi-VN")}đ
                            </td>

                            {/* 7. Phí ship sàn giữ */}
                            <td className="p-3 text-right font-bold text-indigo-400">
                              +{shippingCut.toLocaleString("vi-VN")}đ
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}