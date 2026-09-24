"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@cho-online/firebase";

/* =========================================================
   TYPES
========================================================= */

type SettlementRole = "MERCHANT" | "SHIPPER";
type SettlementStatus = "PENDING_T" | "READY_T1" | "PAID_T1" | "ERROR";
type ActiveTab = "T1_SETTLEMENT" | "SHIPPER_PAYMENTS";
type ViewPeriod = "1D" | "3D" | "7D" | "1M" | "ALL";

interface SettlementPartner {
  id: string;
  settlementId: string;
  partnerId: string;
  role: SettlementRole;
  settlementDate: string;
  name: string;
  phone: string;
  bankAccount?: {
    bankName?: string;
    accountNumber?: string;
    accountHolder?: string;
  };
  orderCount: number;
  basisAmount: number;
  platformRetention: number;
  extraEarning: number;
  unpaidAmount: number;
  totalGMV?: number;
  platformFee?: number;
  merchant?: {
    saleGross?: number;
    originalGross?: number;
    commissionAmount?: number;
    netAmount?: number;
  };
  shipper?: {
    shippingBaseFee?: number;
    shippingPaidByCustomer?: number;
    shippingRetained?: number;
    shippingBaseEarning?: number;
    shippingBonus?: number;
    orderCommission?: number;
    totalEarning?: number;
  };
  isPaid: boolean;
  t1Status: SettlementStatus;
  paidAt?: any;
  accountantNote?: string;
  isLockedSnapshot?: boolean;
}

interface AccountingSummary {
  totalPartners: number;
  totalOrders: number;
  totalPayable: number;
  merchantPayable: number;
  shipperPayable: number;
  totalPlatformRetention: number;
  paidAmount: number;
  unpaidAmount: number;
  merchantCount: number;
  shipperCount: number;
  paidCount: number;
  unpaidCount: number;
  readyCount: number;
  errorCount: number;
}

interface PaymentHistory {
  id: string;
  transactionId: string;
  shipperId: string;
  driverName: string;
  phone: string;
  amount: number;
  bankDescription: string;
  createdAt: string;
  status: string;
  type: string;
}

/* =========================================================
   HELPERS
========================================================= */

const money = (value: unknown): string => {
  const n = Number(value);
  return `${(Number.isFinite(n) ? Math.round(n) : 0).toLocaleString("vi-VN")}đ`;
};

const getTodayVN = (): string => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
};

const parseDateKey = (value: string): Date => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, Math.max(0, (month || 1) - 1), day || 1, 12, 0, 0, 0);
};

const toDateKey = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const shiftDateKey = (value: string, amount: number): string => {
  const date = parseDateKey(value);
  date.setDate(date.getDate() + amount);
  return toDateKey(date);
};

const getPeriodRange = (
  period: ViewPeriod,
  endDate: string
): {
  fromDate: string | null;
  toDate: string;
} => {
  switch (period) {
    case "1D":
      return {
        fromDate: endDate,
        toDate: endDate,
      };

    case "3D":
      return {
        fromDate: shiftDateKey(endDate, -2),
        toDate: endDate,
      };

    case "7D":
      return {
        fromDate: shiftDateKey(endDate, -6),
        toDate: endDate,
      };

    case "1M":
      return {
        // 30 ngày, tính cả ngày kết thúc.
        fromDate: shiftDateKey(endDate, -29),
        toDate: endDate,
      };

    case "ALL":
      return {
        fromDate: null,
        toDate: endDate,
      };

    default:
      return {
        fromDate: endDate,
        toDate: endDate,
      };
  }
};

const formatDateLong = (value: string): string =>
  new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parseDateKey(value));

const formatDateCompact = (value: string): string =>
  new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parseDateKey(value));

const timestampToIso = (value: any): string => {
  try {
    if (!value) return "";
    if (typeof value?.toDate === "function") return value.toDate().toISOString();
    if (value?.seconds !== undefined) return new Date(Number(value.seconds) * 1000).toISOString();
    if (value?._seconds !== undefined) return new Date(Number(value._seconds) * 1000).toISOString();

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
  } catch {
    return "";
  }
};

const normalizePaymentStatus = (value: unknown): string =>
  String(value ?? "PENDING").toUpperCase().trim();

const isSuccessfulPayment = (value: unknown): boolean =>
  ["COMPLETED", "SUCCESS", "PAID", "APPROVED"].includes(
    normalizePaymentStatus(value)
  );

const EMPTY_SUMMARY: AccountingSummary = {
  totalPartners: 0,
  totalOrders: 0,
  totalPayable: 0,
  merchantPayable: 0,
  shipperPayable: 0,
  totalPlatformRetention: 0,
  paidAmount: 0,
  unpaidAmount: 0,
  merchantCount: 0,
  shipperCount: 0,
  paidCount: 0,
  unpaidCount: 0,
  readyCount: 0,
  errorCount: 0,
};

/* =========================================================
   PAGE
========================================================= */

export default function AccountingPage() {
  const [partners, setPartners] = useState<SettlementPartner[]>([]);
  const [summary, setSummary] = useState<AccountingSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<ActiveTab>("T1_SETTLEMENT");

  const [shipperPayments, setShipperPayments] = useState<PaymentHistory[]>([]);
  const [paymentLoading, setPaymentLoading] = useState(true);

  const [selectedDate, setSelectedDate] = useState<string>(getTodayVN());
  const [viewPeriod, setViewPeriod] = useState<ViewPeriod>("1D");
  const [roleFilter, setRoleFilter] = useState<"ALL" | SettlementRole>("ALL");
  const [t1StatusFilter, setT1StatusFilter] = useState<"ALL" | SettlementStatus>("ALL");
  const [search, setSearch] = useState("");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [tempNote, setTempNote] = useState("");
  const [processing, setProcessing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const todayKey = getTodayVN();
  const yesterdayKey = shiftDateKey(todayKey, -1);

  const selectedDateLabel = useMemo(
    () => formatDateLong(selectedDate),
    [selectedDate]
  );

  const periodRange = useMemo(
    () => getPeriodRange(viewPeriod, selectedDate),
    [viewPeriod, selectedDate]
  );

  const periodLabel = useMemo(() => {
    if (viewPeriod === "ALL") {
      return "Tất cả thời gian";
    }

    if (!periodRange.fromDate || periodRange.fromDate === periodRange.toDate) {
      return formatDateCompact(periodRange.toDate);
    }

    return `${formatDateCompact(periodRange.fromDate)} → ${formatDateCompact(
      periodRange.toDate
    )}`;
  }, [viewPeriod, periodRange]);

  const payoutRangeLabel = useMemo(() => {
    if (viewPeriod === "ALL") {
      return "Theo từng kỳ T+1";
    }

    if (!periodRange.fromDate) {
      return "—";
    }

    const payoutFrom = shiftDateKey(periodRange.fromDate, 1);
    const payoutTo = shiftDateKey(periodRange.toDate, 1);

    if (payoutFrom === payoutTo) {
      return formatDateCompact(payoutFrom);
    }

    return `${formatDateCompact(payoutFrom)} → ${formatDateCompact(payoutTo)}`;
  }, [viewPeriod, periodRange]);

  const canGoNextDay = selectedDate < todayKey;

  const handleDateChange = (value: string) => {
    if (!value) return;
    setSelectedDate(value > todayKey ? todayKey : value);
  };

  const moveSettlementDate = (amount: number) => {
    const nextDate = shiftDateKey(selectedDate, amount);
    setSelectedDate(nextDate > todayKey ? todayKey : nextDate);
  };

  /* =======================================================
     REALTIME SHIPPER PAYMENTS
  ======================================================= */

  useEffect(() => {
    setPaymentLoading(true);

    const topupRef = collection(db, "topup_requests");

    const unsubscribe = onSnapshot(
      topupRef,
      (snapshot) => {
        const list: PaymentHistory[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();

          return {
            id: docSnap.id,
            transactionId:
              data.transactionId ??
              data.referenceCode ??
              data.code ??
              docSnap.id,
            shipperId:
              data.shipperUid ??
              data.shipperId ??
              data.userId ??
              "N/A",
            driverName:
              data.driverName ??
              data.fullName ??
              data.shipperName ??
              "Tài xế",
            phone: data.phone ?? data.phoneNumber ?? "N/A",
            amount: Number(
              data.amount ?? data.money ?? data.transferAmount ?? 0
            ),
            bankDescription:
              data.bankDescription ??
              data.transferContent ??
              data.content ??
              data.note ??
              "",
            createdAt: timestampToIso(
              data.createdAt ?? data.created_at ?? data.time
            ),
            status: normalizePaymentStatus(data.status),
            type: String(data.type ?? "DEBT_CLEARANCE"),
          };
        });

        list.sort(
          (a, b) =>
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime()
        );

        setShipperPayments(list);
        setPaymentLoading(false);
      },
      (error) => {
        console.error("Lỗi lắng nghe topup_requests:", error);
        setPaymentLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  /* =======================================================
     SETTLEMENT API
  ======================================================= */

  const fetchAllData = useCallback(async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams({
        role: roleFilter,
      });

      if (viewPeriod === "1D") {
        params.set("date", selectedDate);
      } else if (viewPeriod === "ALL") {
        params.set("all", "true");
      } else if (periodRange.fromDate) {
        params.set("fromDate", periodRange.fromDate);
        params.set("toDate", periodRange.toDate);
      }

      const res = await fetch(`/api/accounting?${params.toString()}`, {
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok || !json?.success) {
        throw new Error(json?.message || "Không tải được dữ liệu đối soát");
      }

      setPartners(Array.isArray(json.data) ? json.data : []);
      setSummary(json.summary ?? EMPTY_SUMMARY);
      setSelectedIds([]);
    } catch (error) {
      console.error("Lỗi tải dữ liệu đối soát:", error);
      setPartners([]);
      setSummary(EMPTY_SUMMARY);
      setSelectedIds([]);
    } finally {
      setLoading(false);
    }
  }, [
    roleFilter,
    selectedDate,
    viewPeriod,
    periodRange.fromDate,
    periodRange.toDate,
  ]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  /* =======================================================
     FILTERS
  ======================================================= */

  const filteredPartners = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return partners.filter((partner) => {
      const matchSearch =
        !keyword ||
        partner.name.toLowerCase().includes(keyword) ||
        String(partner.phone ?? "").toLowerCase().includes(keyword) ||
        String(partner.partnerId ?? "").toLowerCase().includes(keyword) ||
        String(partner.bankAccount?.accountNumber ?? "")
          .toLowerCase()
          .includes(keyword);

      const matchStatus =
        t1StatusFilter === "ALL" || partner.t1Status === t1StatusFilter;

      return matchSearch && matchStatus;
    });
  }, [partners, search, t1StatusFilter]);

  const filteredShipperPayments = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return shipperPayments.filter((payment) => {
      if (!keyword) return true;

      return [
        payment.driverName,
        payment.phone,
        payment.shipperId,
        payment.bankDescription,
        payment.transactionId,
      ].some((value) => String(value ?? "").toLowerCase().includes(keyword));
    });
  }, [shipperPayments, search]);

  const successfulPayments = useMemo(
    () => shipperPayments.filter((item) => isSuccessfulPayment(item.status)),
    [shipperPayments]
  );

  const totalShipperPaid = useMemo(
    () => successfulPayments.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [successfulPayments]
  );

  const pendingPaymentCount = useMemo(
    () =>
      shipperPayments.filter((item) => !isSuccessfulPayment(item.status)).length,
    [shipperPayments]
  );

  /* =======================================================
     SELECTION
  ======================================================= */

  const handleSelectAll = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedIds(filteredPartners.map((partner) => partner.settlementId));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (settlementId: string) => {
    setSelectedIds((previous) =>
      previous.includes(settlementId)
        ? previous.filter((id) => id !== settlementId)
        : [...previous, settlementId]
    );
  };

  const getSelectedRows = () =>
    partners.filter((partner) => selectedIds.includes(partner.settlementId));

  /* =======================================================
     PATCH STATUS
  ======================================================= */

  const patchSettlements = async ({
    rows,
    status,
    note,
  }: {
    rows: SettlementPartner[];
    status?: SettlementStatus;
    note?: string;
  }) => {
    if (rows.length === 0) return;

    const response = await fetch("/api/accounting", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        settlements: rows.map((row) => ({
          settlementId: row.settlementId,
          settlementDate: row.settlementDate,
          partnerId: row.partnerId,
          role: row.role,
        })),
        // Fallback cho client cũ / trường hợp row thiếu settlementDate.
        date: selectedDate,
        ...(status ? { t1Status: status } : {}),
        ...(note !== undefined ? { accountantNote: note } : {}),
      }),
    });

    const json = await response.json();

    if (!response.ok || !json?.success) {
      throw new Error(json?.message || "Không thể cập nhật đối soát");
    }
  };

  const handleBatchUpdateT1 = async (status: SettlementStatus) => {
    const rows = getSelectedRows();

    if (rows.length === 0) {
      alert("Vui lòng chọn ít nhất 1 bản ghi.");
      return;
    }

    const labels: Record<SettlementStatus, string> = {
      PENDING_T: "Chờ chốt ngày T",
      READY_T1: "Đã duyệt chi T+1",
      PAID_T1: "Đã chi trả T+1",
      ERROR: "Lỗi thông tin",
    };

    if (!confirm(`Xác nhận chuyển ${rows.length} bản ghi sang “${labels[status]}”?`)) {
      return;
    }

    setProcessing(true);

    try {
      await patchSettlements({ rows, status });
      await fetchAllData();
    } catch (error: any) {
      alert(error?.message || "Lỗi cập nhật trạng thái");
    } finally {
      setProcessing(false);
    }
  };

  const handleSaveNote = async (partner: SettlementPartner) => {
    setProcessing(true);

    try {
      await patchSettlements({ rows: [partner], note: tempNote.trim() });
      setEditingNoteId(null);
      setTempNote("");
      await fetchAllData();
    } catch (error: any) {
      alert(error?.message || "Không lưu được ghi chú");
    } finally {
      setProcessing(false);
    }
  };

  /* =======================================================
     BANK COPY
  ======================================================= */

  const handleCopyBank = async (partner: SettlementPartner) => {
    const bankName = partner.bankAccount?.bankName || "N/A";
    const accountNumber = partner.bankAccount?.accountNumber || "N/A";
    const accountHolder = partner.bankAccount?.accountHolder || "N/A";

    const text = [
      `Ngân hàng: ${bankName}`,
      `STK: ${accountNumber}`,
      `Chủ TK: ${accountHolder}`,
      `Số tiền T+1: ${money(partner.unpaidAmount)}`,
      `Nội dung: ANVAMI ${partner.role} ${partner.partnerId} ${partner.settlementDate}`,
    ].join("\n");

    await navigator.clipboard.writeText(text);
    setCopiedId(partner.settlementId);
    setTimeout(() => setCopiedId(null), 1800);
  };

  /* =======================================================
     STATUS UI
  ======================================================= */

  const renderStatusBadge = (status: SettlementStatus) => {
    const styles: Record<SettlementStatus, string> = {
      PENDING_T: "bg-amber-500/10 border-amber-500/30 text-amber-300",
      READY_T1: "bg-blue-500/10 border-blue-500/30 text-blue-300",
      PAID_T1: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
      ERROR: "bg-rose-500/10 border-rose-500/30 text-rose-300",
    };

    const labels: Record<SettlementStatus, string> = {
      PENDING_T: "Chờ chốt T",
      READY_T1: "Đã duyệt T+1",
      PAID_T1: "Đã chi T+1",
      ERROR: "Lỗi thông tin",
    };

    return (
      <span
        className={`inline-flex px-2.5 py-1 rounded-full border text-[10px] font-bold ${styles[status]}`}
      >
        {labels[status]}
      </span>
    );
  };

  const renderPaymentStatus = (status: string) => {
    const success = isSuccessfulPayment(status);

    return (
      <span
        className={`inline-flex px-2.5 py-1 rounded-full border text-[10px] font-bold ${
          success
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
            : "bg-amber-500/10 border-amber-500/30 text-amber-300"
        }`}
      >
        {success ? "Đã ghi nhận" : status || "PENDING"}
      </span>
    );
  };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 font-sans">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-5 md:px-6 md:py-7 xl:px-8 space-y-5">
        {/* HEADER */}
        <header className="rounded-3xl border border-slate-800/80 bg-slate-900/70 px-4 py-4 md:px-5 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-300">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 7.5h16M6 4.5h12a2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2v-11a2 2 0 012-2zM8 12h3m-3 3h5m3-3h.01M16 15h.01" />
                </svg>
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-black tracking-tight text-white md:text-2xl">
                    Đối soát & Thanh toán
                  </h1>
                  <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-indigo-300">
                    Finance Control
                  </span>
                </div>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">
                  Khóa số liệu theo ngày T, duyệt chi T+1 và theo dõi lịch sử dòng tiền đối tác trên một màn hình.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="inline-flex rounded-2xl border border-slate-800 bg-slate-950/80 p-1 text-xs font-bold">
                <button
                  onClick={() => {
                    setActiveTab("T1_SETTLEMENT");
                    setSearch("");
                  }}
                  className={`rounded-xl px-4 py-2.5 transition ${
                    activeTab === "T1_SETTLEMENT"
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-950/40"
                      : "text-slate-400 hover:bg-slate-900 hover:text-white"
                  }`}
                >
                  Đối soát T+1
                </button>
                <button
                  onClick={() => {
                    setActiveTab("SHIPPER_PAYMENTS");
                    setSearch("");
                  }}
                  className={`rounded-xl px-4 py-2.5 transition ${
                    activeTab === "SHIPPER_PAYMENTS"
                      ? "bg-emerald-600 text-white shadow-lg shadow-emerald-950/40"
                      : "text-slate-400 hover:bg-slate-900 hover:text-white"
                  }`}
                >
                  Shipper nộp tiền
                </button>
              </div>

              <button
                onClick={activeTab === "T1_SETTLEMENT" ? fetchAllData : undefined}
                disabled={activeTab !== "T1_SETTLEMENT" || loading}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/80 px-3.5 py-2.5 text-xs font-bold text-slate-300 transition hover:border-slate-700 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <svg viewBox="0 0 24 24" className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 11a8 8 0 10-2.34 5.66M20 11V5m0 6h-6" />
                </svg>
                Đồng bộ
              </button>
            </div>
          </div>
        </header>

        {activeTab === "T1_SETTLEMENT" ? (
          <>
            {/* DATE CONTROL */}
            <section className="grid gap-3 xl:grid-cols-[1.4fr_0.9fr]">
              <div className="overflow-hidden rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/30 shadow-xl shadow-black/10">
                <div className="border-b border-slate-800/80 px-4 py-3 md:px-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-300">
                        Kỳ đối soát
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Chọn ngày phát sinh để khóa số liệu và chuẩn bị thanh toán T+1.
                      </p>
                    </div>
                    {selectedDate === todayKey ? (
                      <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-300">
                        Hôm nay
                      </span>
                    ) : selectedDate === yesterdayKey ? (
                      <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold text-amber-300">
                        Hôm qua
                      </span>
                    ) : (
                      <span className="rounded-full border border-slate-700 bg-slate-950/60 px-2.5 py-1 text-[10px] font-bold text-slate-400">
                        Ngày lịch sử
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-4 md:p-5">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => moveSettlementDate(-1)}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-700 bg-slate-950/70 text-slate-300 transition hover:border-indigo-500/40 hover:bg-indigo-500/10 hover:text-white"
                      aria-label="Ngày trước"
                    >
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
                      </svg>
                    </button>

                    <div className="min-w-0 flex-1 rounded-2xl border border-slate-800 bg-slate-950/65 px-4 py-3 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-600">
                        {viewPeriod === "1D"
                          ? "Ngày T"
                          : viewPeriod === "ALL"
                            ? "Mốc tham chiếu"
                            : "Mốc cuối"}
                      </p>
                      <p className="mt-1 truncate text-base font-black capitalize text-white md:text-lg">
                        {selectedDateLabel}
                      </p>
                      <p className="mt-1 font-mono text-[10px] text-indigo-300">{selectedDate}</p>
                    </div>

                    <button
                      onClick={() => moveSettlementDate(1)}
                      disabled={!canGoNextDay}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-700 bg-slate-950/70 text-slate-300 transition hover:border-indigo-500/40 hover:bg-indigo-500/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-25"
                      aria-label="Ngày sau"
                    >
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
                      </svg>
                    </button>
                  </div>

                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => handleDateChange(todayKey)}
                        className={`rounded-xl border px-3 py-2 text-[11px] font-bold transition ${
                          selectedDate === todayKey
                            ? "border-indigo-500/40 bg-indigo-500/15 text-indigo-200"
                            : "border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white"
                        }`}
                      >
                        Hôm nay
                      </button>
                      <button
                        onClick={() => handleDateChange(yesterdayKey)}
                        className={`rounded-xl border px-3 py-2 text-[11px] font-bold transition ${
                          selectedDate === yesterdayKey
                            ? "border-indigo-500/40 bg-indigo-500/15 text-indigo-200"
                            : "border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white"
                        }`}
                      >
                        Hôm qua
                      </button>
                    </div>

                    <label className="group relative inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-[11px] font-bold text-slate-300 transition hover:border-indigo-500/30">
                      <svg viewBox="0 0 24 24" className="h-4 w-4 text-indigo-300" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 3v3m12-3v3M4.5 9.5h15M5 5.5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1v-13a1 1 0 011-1z" />
                      </svg>
                      <span>Chọn ngày khác</span>
                      <input
                        type="date"
                        value={selectedDate}
                        max={todayKey}
                        onChange={(event) => handleDateChange(event.target.value)}
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        aria-label="Chọn ngày đối soát"
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4 md:p-5">
                <div className="flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                        Chu kỳ T → T+1
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Chọn khoảng thời gian cần theo dõi và đối soát.
                      </p>
                    </div>

                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-slate-500">
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 6v6l4 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                  </div>

                  <div className="grid grid-cols-5 gap-1 rounded-2xl border border-slate-800 bg-slate-950/80 p-1">
                    {[
                      { value: "1D" as ViewPeriod, label: "1 ngày" },
                      { value: "3D" as ViewPeriod, label: "3 ngày" },
                      { value: "7D" as ViewPeriod, label: "1 tuần" },
                      { value: "1M" as ViewPeriod, label: "1 tháng" },
                      { value: "ALL" as ViewPeriod, label: "Tất cả" },
                    ].map((item) => {
                      const active = viewPeriod === item.value;

                      return (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => {
                            setViewPeriod(item.value);
                            setSelectedIds([]);
                          }}
                          className={`rounded-xl px-2 py-2 text-[10px] font-black transition-all ${
                            active
                              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-950/30"
                              : "text-slate-500 hover:bg-slate-900 hover:text-slate-200"
                          }`}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-stretch gap-3">
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[9px] font-black uppercase tracking-wider text-amber-400">
                        Kỳ phát sinh
                      </p>
                      <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-black text-amber-300">
                        T
                      </span>
                    </div>

                    <p className="mt-2 text-sm font-black text-white">
                      {viewPeriod === "ALL" ? "Toàn bộ lịch sử" : periodLabel}
                    </p>

                    <p className="mt-1 text-[10px] text-slate-500">
                      {viewPeriod === "1D"
                        ? "Giao dịch phát sinh trong ngày"
                        : viewPeriod === "ALL"
                          ? "Tất cả kỳ đối soát đã phát sinh"
                          : "Tổng hợp giao dịch trong khoảng"}
                    </p>
                  </div>

                  <div className="flex items-center justify-center">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-800 bg-slate-950">
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4 text-slate-600"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 12h14m-4-4l4 4-4 4"
                        />
                      </svg>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[9px] font-black uppercase tracking-wider text-emerald-400">
                        Kỳ thanh toán
                      </p>
                      <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-black text-emerald-300">
                        T+1
                      </span>
                    </div>

                    <p className="mt-2 text-sm font-black text-white">
                      {payoutRangeLabel}
                    </p>

                    <p className="mt-1 text-[10px] text-slate-500">
                      {viewPeriod === "1D"
                        ? "Ngày dự kiến chi trả"
                        : "Theo ngày T+1 của từng kỳ"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-indigo-500/15 bg-indigo-500/5 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-600">
                      Đang xem
                    </p>
                    <p className="mt-1 text-[11px] font-bold text-indigo-200">
                      {viewPeriod === "ALL"
                        ? "Tất cả dữ liệu đối soát"
                        : periodLabel}
                    </p>
                  </div>

                  <div className="text-left sm:text-right">
                    <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-600">
                      Quy trình
                    </p>
                    <p className="mt-1 text-[10px] text-slate-400">
                      Chờ chốt T → Duyệt T+1 → Khóa snapshot → Đã chi
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* SUMMARY */}
            <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {[
                {
                  label: "Còn phải chi",
                  value: money(summary.unpaidAmount),
                  meta: `${summary.unpaidCount} ${viewPeriod === "1D" ? "đối tác" : "kỳ"} chưa hoàn tất`,
                  tone: "amber",
                },
                {
                  label: "Quán được nhận",
                  value: money(summary.merchantPayable),
                  meta: `${summary.merchantCount} gian hàng`,
                  tone: "emerald",
                },
                {
                  label: "Shipper được nhận",
                  value: money(summary.shipperPayable),
                  meta: `${summary.shipperCount} shipper`,
                  tone: "cyan",
                },
                {
                  label: "Đã chi T+1",
                  value: money(summary.paidAmount),
                  meta: `${summary.paidCount} kỳ đã thanh toán`,
                  tone: "indigo",
                },
              ].map((item) => {
                const toneMap: Record<string, string> = {
                  amber: "border-amber-500/20 text-amber-300",
                  emerald: "border-emerald-500/20 text-emerald-300",
                  cyan: "border-cyan-500/20 text-cyan-300",
                  indigo: "border-indigo-500/20 text-indigo-300",
                };

                return (
                  <div key={item.label} className={`rounded-2xl border bg-slate-900/70 p-4 ${toneMap[item.tone]}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">{item.label}</p>
                      <span className="h-2 w-2 rounded-full bg-current opacity-80" />
                    </div>
                    <p className="mt-2 text-xl font-black md:text-2xl">{loading ? "..." : item.value}</p>
                    <p className="mt-1 text-[10px] text-slate-500">{item.meta}</p>
                  </div>
                );
              })}
            </section>

            {/* FILTER BAR */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex rounded-xl border border-slate-800 bg-slate-950 p-1 text-xs font-bold">
                    {(["ALL", "MERCHANT", "SHIPPER"] as const).map((role) => (
                      <button
                        key={role}
                        onClick={() => setRoleFilter(role)}
                        className={`rounded-lg px-3 py-1.5 transition ${
                          roleFilter === role
                            ? "bg-indigo-600 text-white"
                            : "text-slate-500 hover:bg-slate-900 hover:text-white"
                        }`}
                      >
                        {role === "ALL" ? "Tất cả" : role === "MERCHANT" ? "Quán" : "Shipper"}
                      </button>
                    ))}
                  </div>

                  <select
                    value={t1StatusFilter}
                    onChange={(event) => setT1StatusFilter(event.target.value as "ALL" | SettlementStatus)}
                    className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-bold text-slate-300 outline-none transition focus:border-indigo-500/50"
                  >
                    <option value="ALL">Tất cả trạng thái</option>
                    <option value="PENDING_T">Chờ chốt T</option>
                    <option value="READY_T1">Đã duyệt T+1</option>
                    <option value="PAID_T1">Đã chi T+1</option>
                    <option value="ERROR">Lỗi thông tin</option>
                  </select>

                  <div className="hidden h-5 w-px bg-slate-800 xl:block" />
                  <span className="text-[10px] font-medium text-slate-600">
                    {filteredPartners.length}/{partners.length} bản ghi
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative w-full xl:w-80">
                    <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <circle cx="11" cy="11" r="7" />
                      <path strokeLinecap="round" d="M20 20l-3.5-3.5" />
                    </svg>
                    <input
                      type="text"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Tìm tên, SĐT, UID, STK..."
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2 pl-9 pr-3 text-xs outline-none transition placeholder:text-slate-700 focus:border-indigo-500/50"
                    />
                  </div>
                  {(search || roleFilter !== "ALL" || t1StatusFilter !== "ALL") && (
                    <button
                      onClick={() => {
                        setSearch("");
                        setRoleFilter("ALL");
                        setT1StatusFilter("ALL");
                      }}
                      className="whitespace-nowrap rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-[11px] font-bold text-slate-500 transition hover:text-white"
                    >
                      Xóa lọc
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* BATCH ACTION */}
            {selectedIds.length > 0 && (
              <section className="sticky top-3 z-30 rounded-2xl border border-indigo-500/30 bg-slate-900/95 p-3 shadow-2xl shadow-black/30 backdrop-blur-xl">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-300">
                      {selectedIds.length}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">Bản ghi đã chọn</p>
                      <p className="text-[10px] text-slate-500">Duyệt T+1 sẽ khóa snapshot số tiền của kỳ này.</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleBatchUpdateT1("READY_T1")}
                      disabled={processing}
                      className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-500 disabled:opacity-50"
                    >
                      Duyệt chi T+1
                    </button>
                    <button
                      onClick={() => handleBatchUpdateT1("PAID_T1")}
                      disabled={processing}
                      className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                    >
                      Xác nhận đã chi
                    </button>
                    <button
                      onClick={() => handleBatchUpdateT1("ERROR")}
                      disabled={processing}
                      className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-300 disabled:opacity-50"
                    >
                      Báo lỗi
                    </button>
                    <button
                      onClick={() => setSelectedIds([])}
                      className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-bold text-slate-400"
                    >
                      Bỏ chọn
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* TABLE */}
            <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/60 shadow-xl shadow-black/10">
              <div className="flex items-center justify-between border-b border-slate-800/80 px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-white">Danh sách đối soát</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    {viewPeriod === "ALL"
                      ? "Tất cả thời gian"
                      : `Kỳ ${periodLabel}`}{" "}
                    · {summary.totalOrders} đơn hoàn thành
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  {summary.readyCount > 0 && <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-1 text-blue-300">{summary.readyCount} chờ chi</span>}
                  {summary.errorCount > 0 && <span className="rounded-full border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-rose-300">{summary.errorCount} lỗi</span>}
                </div>
              </div>

              {loading ? (
                <div className="flex min-h-56 items-center justify-center">
                  <div className="flex flex-col items-center gap-3 text-sm text-slate-500">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500/20 border-t-indigo-400" />
                    Đang tính dữ liệu đối soát...
                  </div>
                </div>
              ) : filteredPartners.length === 0 ? (
                <div className="flex min-h-56 items-center justify-center p-6 text-center">
                  <div>
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-800 bg-slate-950 text-slate-600">∅</div>
                    <p className="mt-3 text-sm font-bold text-slate-400">Không có dữ liệu phù hợp</p>
                    <p className="mt-1 text-xs text-slate-600">Thử đổi ngày đối soát hoặc xóa bộ lọc hiện tại.</p>
                  </div>
                </div>
              ) : (
                <div className="max-h-[62vh] overflow-auto">
                  <table className="w-full min-w-[1430px] border-collapse text-left text-xs">
                    <thead className="sticky top-0 z-20">
                      <tr className="border-b border-slate-800 bg-slate-950/95 text-[10px] uppercase tracking-wider text-slate-500 backdrop-blur">
                        <th className="w-10 p-3 text-center">
                          <input
                            type="checkbox"
                            checked={
                              filteredPartners.length > 0 &&
                              filteredPartners.every((partner) => selectedIds.includes(partner.settlementId))
                            }
                            onChange={handleSelectAll}
                          />
                        </th>
                        <th className="p-3">Kỳ T</th>
                        <th className="p-3">Đối tác</th>
                        <th className="p-3 text-center">Đơn</th>
                        <th className="p-3">Cơ sở đối soát</th>
                        <th className="p-3">Sàn giữ / CK</th>
                        <th className="p-3">HH thêm</th>
                        <th className="p-3 text-emerald-400">Số tiền đối soát</th>
                        <th className="p-3">Ngân hàng</th>
                        <th className="p-3">Trạng thái</th>
                        <th className="p-3">Ghi chú</th>
                        <th className="p-3 text-center">Thao tác</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-800/70">
                      {filteredPartners.map((partner) => {
                        const checked = selectedIds.includes(partner.settlementId);
                        const isMerchant = partner.role === "MERCHANT";
                        const hasBank = Boolean(
                          partner.bankAccount?.bankName &&
                            partner.bankAccount?.accountNumber &&
                            partner.bankAccount?.accountHolder
                        );

                        return (
                          <tr
                            key={partner.settlementId}
                            className={`transition hover:bg-slate-800/40 ${checked ? "bg-indigo-950/20" : ""}`}
                          >
                            <td className="p-3 text-center">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => handleToggleSelect(partner.settlementId)}
                              />
                            </td>

                            <td className="p-3">
                              <div className="whitespace-nowrap font-mono text-[11px] font-bold text-indigo-300">
                                {formatDateCompact(partner.settlementDate)}
                              </div>
                              <div className="mt-1 whitespace-nowrap text-[9px] text-slate-600">
                                T+1 {formatDateCompact(shiftDateKey(partner.settlementDate, 1))}
                              </div>
                            </td>

                            <td className="p-3">
                              <div className="font-bold text-white text-sm">{partner.name}</div>
                              <div className="mt-1 flex items-center gap-2">
                                <span
                                  className={`rounded border px-2 py-0.5 text-[9px] font-black ${
                                    isMerchant
                                      ? "border-amber-500/20 bg-amber-500/10 text-amber-300"
                                      : "border-cyan-500/20 bg-cyan-500/10 text-cyan-300"
                                  }`}
                                >
                                  {isMerchant ? "QUÁN" : "SHIPPER"}
                                </span>
                                <span className="font-mono text-[10px] text-slate-500">{partner.phone}</span>
                              </div>
                            </td>

                            <td className="p-3 text-center font-bold text-slate-300">{partner.orderCount}</td>

                            <td className="p-3">
                              <div className="font-bold text-amber-300">{money(partner.basisAmount)}</div>
                              <div className="mt-1 text-[10px] text-slate-500">
                                {isMerchant
                                  ? "Tiền món sau KM"
                                  : `Phí ship gốc · khách trả ${money(partner.shipper?.shippingPaidByCustomer)}`}
                              </div>
                            </td>

                            <td className="p-3">
                              <div className="font-bold text-indigo-300">{money(partner.platformRetention)}</div>
                              <div className="mt-1 text-[10px] text-slate-500">
                                {isMerchant ? "Chiết khấu quán" : "Phần phí ship Sàn giữ"}
                              </div>
                            </td>

                            <td className="p-3">
                              {isMerchant ? (
                                <span className="text-slate-700">—</span>
                              ) : (
                                <>
                                  <div className="font-bold text-violet-300">{money(partner.extraEarning)}</div>
                                  <div className="mt-1 text-[10px] text-slate-500">
                                    HH đơn {money(partner.shipper?.orderCommission)} · HH ship {money(partner.shipper?.shippingBonus)}
                                  </div>
                                </>
                              )}
                            </td>

                            <td className="p-3">
                              <div className="text-sm font-black text-emerald-300">{money(partner.unpaidAmount)}</div>
                              {partner.isLockedSnapshot && (
                                <div className="mt-1 inline-flex rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-bold text-blue-400">
                                  Snapshot đã khóa
                                </div>
                              )}
                            </td>

                            <td className="p-3">
                              {hasBank ? (
                                <>
                                  <div className="font-bold text-slate-200">{partner.bankAccount?.bankName}</div>
                                  <div className="mt-0.5 font-mono text-indigo-300">{partner.bankAccount?.accountNumber}</div>
                                  <div className="mt-0.5 text-[9px] uppercase text-slate-500">{partner.bankAccount?.accountHolder}</div>
                                </>
                              ) : (
                                <div className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/20 bg-rose-500/5 px-2 py-1.5 text-[10px] font-bold text-rose-300">
                                  <span>!</span> Thiếu tài khoản
                                </div>
                              )}
                            </td>

                            <td className="p-3">{renderStatusBadge(partner.t1Status)}</td>

                            <td className="min-w-[180px] p-3">
                              {editingNoteId === partner.settlementId ? (
                                <div className="flex items-center gap-1.5">
                                  <input
                                    autoFocus
                                    value={tempNote}
                                    onChange={(event) => setTempNote(event.target.value)}
                                    placeholder="Mã GD / ghi chú..."
                                    className="w-32 rounded-lg border border-indigo-500 bg-slate-950 px-2 py-1.5 text-xs outline-none"
                                  />
                                  <button
                                    onClick={() => handleSaveNote(partner)}
                                    disabled={processing}
                                    className="rounded-lg bg-indigo-600 px-2 py-1.5 font-bold text-white disabled:opacity-50"
                                  >
                                    Lưu
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingNoteId(null);
                                      setTempNote("");
                                    }}
                                    className="rounded-lg bg-slate-800 px-2 py-1.5 text-slate-400"
                                  >
                                    ×
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    setEditingNoteId(partner.settlementId);
                                    setTempNote(partner.accountantNote || "");
                                  }}
                                  className="text-left text-slate-400 transition hover:text-indigo-300"
                                >
                                  {partner.accountantNote || "+ Thêm ghi chú / mã GD"}
                                </button>
                              )}
                            </td>

                            <td className="p-3 text-center">
                              <button
                                onClick={() => handleCopyBank(partner)}
                                disabled={!hasBank}
                                className="rounded-lg bg-slate-800 px-2.5 py-1.5 text-[10px] font-bold transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-30"
                              >
                                {copiedId === partner.settlementId ? "Đã copy" : "Copy bank"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        ) : (
          <>
            {/* PAYMENT SUMMARY */}
            <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-emerald-500/20 bg-slate-900/70 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">Tiền đã ghi nhận</p>
                <p className="mt-2 text-2xl font-black text-emerald-300">{paymentLoading ? "..." : money(totalShipperPaid)}</p>
                <p className="mt-1 text-[10px] text-slate-500">Chỉ cộng giao dịch thành công</p>
              </div>
              <div className="rounded-2xl border border-cyan-500/20 bg-slate-900/70 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">Giao dịch thành công</p>
                <p className="mt-2 text-2xl font-black text-cyan-300">{paymentLoading ? "..." : successfulPayments.length}</p>
                <p className="mt-1 text-[10px] text-slate-500">Đã được hệ thống ghi nhận</p>
              </div>
              <div className="rounded-2xl border border-amber-500/20 bg-slate-900/70 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">Chưa hoàn tất</p>
                <p className="mt-2 text-2xl font-black text-amber-300">{paymentLoading ? "..." : pendingPaymentCount}</p>
                <p className="mt-1 text-[10px] text-slate-500">Không cộng vào tổng tiền đã nộp</p>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-bold text-white">Lịch sử Shipper nộp tiền</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">Realtime từ topup_requests · {shipperPayments.length} giao dịch</p>
                </div>
                <div className="relative w-full md:w-96">
                  <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="11" cy="11" r="7" />
                    <path strokeLinecap="round" d="M20 20l-3.5-3.5" />
                  </svg>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Tìm shipper, UID, mã GD, nội dung bank..."
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2 pl-9 pr-3 text-xs outline-none transition placeholder:text-slate-700 focus:border-emerald-500/50"
                  />
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/60 shadow-xl shadow-black/10">
              {paymentLoading ? (
                <div className="flex min-h-56 items-center justify-center text-sm text-slate-500">Đang tải lịch sử giao dịch...</div>
              ) : filteredShipperPayments.length === 0 ? (
                <div className="flex min-h-56 items-center justify-center text-sm text-slate-500">Chưa có giao dịch phù hợp.</div>
              ) : (
                <div className="max-h-[68vh] overflow-auto">
                  <table className="w-full min-w-[1000px] border-collapse text-left text-xs">
                    <thead className="sticky top-0 z-20">
                      <tr className="border-b border-slate-800 bg-slate-950/95 text-[10px] uppercase tracking-wider text-slate-500 backdrop-blur">
                        <th className="p-3">Thời gian</th>
                        <th className="p-3">Shipper</th>
                        <th className="p-3 text-emerald-400">Số tiền</th>
                        <th className="p-3">Nội dung chuyển khoản</th>
                        <th className="p-3">Mã giao dịch</th>
                        <th className="p-3">Loại</th>
                        <th className="p-3 text-center">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70">
                      {filteredShipperPayments.map((payment) => (
                        <tr key={payment.id} className="transition hover:bg-slate-800/40">
                          <td className="p-3 font-mono text-slate-500">
                            {payment.createdAt ? new Date(payment.createdAt).toLocaleString("vi-VN") : "—"}
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-white">{payment.driverName}</div>
                            <div className="mt-1 font-mono text-[10px] text-slate-500">{payment.phone} · {payment.shipperId}</div>
                          </td>
                          <td className="p-3 text-sm font-black text-emerald-300">{money(payment.amount)}</td>
                          <td className="max-w-xs p-3">
                            <div className="truncate rounded-lg border border-slate-800 bg-slate-950 px-2 py-1.5 font-mono text-amber-300">{payment.bankDescription || "—"}</div>
                          </td>
                          <td className="p-3 font-mono text-slate-300">{payment.transactionId}</td>
                          <td className="p-3 text-slate-400">{payment.type}</td>
                          <td className="p-3 text-center">{renderPaymentStatus(payment.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
