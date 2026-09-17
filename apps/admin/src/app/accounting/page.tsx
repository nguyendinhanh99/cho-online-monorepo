"use client";

import { useEffect, useState, useMemo } from "react";
import { db } from "@cho-online/firebase";
import { collection, onSnapshot } from "firebase/firestore";

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
}

export default function AccountingPage() {
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // TAB ĐIỀU HƯỚNG: ĐỐI SOÁT T+1 KHÓA SỔ VÀ LỊCH SỬ SHIPPER NỘP TIỀN VÍ
  const [activeTab, setActiveTab] = useState<"T1_SETTLEMENT" | "SHIPPER_PAYMENTS">("T1_SETTLEMENT");

  // STATE LỊCH SỬ THANH TOÁN TỪ WEBHOOK SHIPPER (Collection 'topup_requests')
  const [shipperPayments, setShipperPayments] = useState<PaymentHistory[]>([]);
  const [paymentLoading, setPaymentLoading] = useState(true);

  // Bộ lọc quy trình T+1
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0] // Mặc định ngày hôm nay
  );
  const [roleFilter, setRoleFilter] = useState<"ALL" | "MERCHANT" | "SHIPPER">("ALL");
  const [t1StatusFilter, setT1StatusFilter] = useState<"ALL" | "PENDING_T" | "READY_T1" | "PAID_T1" | "ERROR">("ALL");
  const [search, setSearch] = useState("");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [tempNote, setTempNote] = useState("");
  const [processing, setProcessing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 1. FETCH LỊCH SỬ THANH TOÁN SHIPPER TỪ FIRESTORE (Realtime từ Collection 'topup_requests')
  useEffect(() => {
    setPaymentLoading(true);
    // Đổi tên collection thành topup_requests
    const topupRef = collection(db, "topup_requests");

    const unsubscribe = onSnapshot(
      topupRef,
      (snapshot) => {
        const list: PaymentHistory[] = [];
        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            transactionId: data.transactionId || data.referenceCode || data.code || docSnap.id,
            shipperId: data.shipperId || data.userId || "N/A",
            driverName: data.driverName || data.fullName || data.shipperName || "Tài xế",
            phone: data.phone || data.phoneNumber || "N/A",
            amount: Number(data.amount || data.money || data.transferAmount || 0),
            bankDescription: data.bankDescription || data.content || data.note || "",
            createdAt: data.createdAt || data.created_at || data.time || "",
            status: data.status || "COMPLETED",
          });
        });

        // Tự sắp xếp mới nhất lên đầu ở Client Side (Tránh lỗi Firestore Index)
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        setShipperPayments(list);
        setPaymentLoading(false);
      },
      (error) => {
        console.error("Lỗi lắng nghe collection topup_requests:", error);
        setPaymentLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // 2. FETCH DỮ LIỆU TÀI KHOẢN KẾ TOÁN TỪ API (Lọc T+1)
  const fetchAllData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/accounting?role=${roleFilter}&date=${selectedDate}`);
      const json = await res.json();

      if (json.success) {
        setPartners(json.data || []);
        setSelectedIds([]);
      }
    } catch (err) {
      console.error("Lỗi tải dữ liệu hệ thống:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [roleFilter, selectedDate]);

  // TÍNH TOÁN TỔNG QUAN THEO KỲ T+1
  const revenueSummary = useMemo(() => {
    return partners.reduce(
      (acc, p) => {
        acc.totalGMV += p.totalGMV || 0;
        acc.netTotalRevenue += p.platformFee || 0;
        if (p.role === "MERCHANT") acc.totalPlatformRevenue += p.platformFee || 0;
        if (p.role === "SHIPPER") acc.totalShippingRevenue += p.platformFee || 0;
        return acc;
      },
      { totalGMV: 0, netTotalRevenue: 0, totalPlatformRevenue: 0, totalShippingRevenue: 0 }
    );
  }, [partners]);

  // TỔNG TIỀN SHIPPER ĐÃ NỘP VÀO SÀN
  const totalShipperPaid = useMemo(() => {
    return shipperPayments.reduce((sum, item) => sum + (item.amount || 0), 0);
  }, [shipperPayments]);

  // Lọc danh sách theo luồng T+1
  const filteredPartners = partners.filter((p) => {
    const keyword = search.toLowerCase();

    const partnerName = String(p.fullName || p.name || "").toLowerCase();
    const partnerPhone = String(p.phone || "").toLowerCase();
    const bankAccount = String(p.bankAccount?.accountNumber || p.bankAccount || "").toLowerCase();

    const matchSearch = partnerName.includes(keyword) || partnerPhone.includes(keyword) || bankAccount.includes(keyword);

    let matchStatus = true;
    const status = p.t1Status || (p.isPaid ? "PAID_T1" : "PENDING_T");
    if (t1StatusFilter !== "ALL") matchStatus = status === t1StatusFilter;

    return matchSearch && matchStatus;
  });

  // Lọc danh sách Lịch sử thanh toán Shipper
  const filteredShipperPayments = shipperPayments.filter((p) => {
    const keyword = search.toLowerCase();
    return (
      p.driverName.toLowerCase().includes(keyword) ||
      p.phone.toLowerCase().includes(keyword) ||
      p.shipperId.toLowerCase().includes(keyword) ||
      p.bankDescription.toLowerCase().includes(keyword) ||
      p.transactionId.toLowerCase().includes(keyword)
    );
  });

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedIds(e.target.checked ? filteredPartners.map((p) => p.id) : []);
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  // Cập nhật trạng thái luồng T+1
  const handleBatchUpdateT1 = async (newStatus: "READY_T1" | "PAID_T1" | "ERROR") => {
    if (selectedIds.length === 0) return alert("Vui lòng chọn ít nhất 1 dòng!");
    if (!confirm(`Xác nhận chuyển ${selectedIds.length} bản ghi sang trạng thái mới?`)) return;

    setProcessing(true);
    try {
      const res = await fetch("/api/accounting", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partnerIds: selectedIds,
          t1Status: newStatus,
          isPaid: newStatus === "PAID_T1",
          date: selectedDate,
        }),
      });

      const json = await res.json();
      if (json.success) {
        alert("Cập nhật trạng thái T+1 thành công!");
        fetchAllData();
      } else {
        alert("Lỗi: " + json.message);
      }
    } catch (err) {
      alert("Lỗi kết nối máy chủ");
    } finally {
      setProcessing(false);
    }
  };

  const handleCopyBank = (partner: any) => {
    const bankName = partner.bankAccount?.bankName || partner.bankName || "N/A";
    const bankAccount = partner.bankAccount?.accountNumber || partner.bankAccount || "N/A";
    const bankOwner = partner.bankAccount?.accountHolder || partner.bankOwner || "N/A";

    const text = `Ngan hang: ${bankName}\nSTK: ${bankAccount}\nChu TK: ${bankOwner}\nSo tien T+1: ${(partner.unpaidAmount || 0).toLocaleString("vi-VN")}d`;
    navigator.clipboard.writeText(text);
    setCopiedId(partner.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const renderStatusBadge = (partner: any) => {
    const status = partner.t1Status || (partner.isPaid ? "PAID_T1" : "PENDING_T");
    switch (status) {
      case "PENDING_T":
        return <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold text-[10px]">🟡 1. Chờ chốt sổ ngày T</span>;
      case "READY_T1":
        return <span className="px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 font-bold text-[10px]">🔵 2. Đã duyệt (Chờ chi T+1)</span>;
      case "PAID_T1":
        return <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-[10px]">🟢 3. Đã chi trả T+1</span>;
      case "ERROR":
        return <span className="px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold text-[10px]">🔴 Lỗi/Sai Bank</span>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 md:p-8 space-y-6 font-sans relative">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-2">
            🧾 Quản Lý Tài Chính & Đối Soát Sàn
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-1">
            Quy trình khóa sổ T+1 & Theo dõi nguồn tiền Shipper nộp qua VietQR/SePay.
          </p>
        </div>

        {/* Chuyển Tab */}
        <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800 text-xs font-bold">
          <button
            onClick={() => setActiveTab("T1_SETTLEMENT")}
            className={`px-4 py-2 rounded-xl transition cursor-pointer flex items-center gap-2 ${
              activeTab === "T1_SETTLEMENT" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-white"
            }`}
          >
            <span>🏦 Đối Soát Chi T+1</span>
          </button>
          <button
            onClick={() => setActiveTab("SHIPPER_PAYMENTS")}
            className={`px-4 py-2 rounded-xl transition cursor-pointer flex items-center gap-2 ${
              activeTab === "SHIPPER_PAYMENTS" ? "bg-emerald-600 text-white shadow-lg" : "text-slate-400 hover:text-white"
            }`}
          >
            <span>⚡ Lịch Sử Shipper Nộp Tiền ({shipperPayments.length})</span>
          </button>
        </div>
      </div>

      {/* 1. KHU VỰC THỐNG KÊ TỔNG QUAN */}
      {activeTab === "T1_SETTLEMENT" ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-800/60 border border-amber-500/30 p-4 rounded-2xl">
            <span className="text-xs text-slate-400 font-semibold">Doanh Số Phát Sinh (Ngày T)</span>
            <div className="text-2xl font-black text-amber-400 mt-1">
              {loading ? "..." : `${revenueSummary.totalGMV.toLocaleString("vi-VN")}đ`}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Giao dịch trong kỳ chọn</p>
          </div>

          <div className="bg-slate-800/60 border border-indigo-500/30 p-4 rounded-2xl">
            <span className="text-xs text-slate-400 font-semibold">Phí Sàn Thu Về</span>
            <div className="text-2xl font-black text-indigo-400 mt-1">
              {loading ? "..." : `${revenueSummary.netTotalRevenue.toLocaleString("vi-VN")}đ`}
            </div>
            <p className="text-[11px] text-indigo-300 mt-1">Tự động trừ chiết khấu</p>
          </div>

          <div className="bg-slate-800/60 border border-rose-500/30 p-4 rounded-2xl">
            <span className="text-xs text-slate-400 font-semibold">Chiết Khấu Gian Hàng</span>
            <div className="text-2xl font-black text-rose-400 mt-1">
              {loading ? "..." : `${revenueSummary.totalPlatformRevenue.toLocaleString("vi-VN")}đ`}
            </div>
            <p className="text-[11px] text-rose-300 mt-1">Thu từ Merchant</p>
          </div>

          <div className="bg-slate-800/60 border border-emerald-500/30 p-4 rounded-2xl">
            <span className="text-xs text-slate-400 font-semibold">Chiết Khấu Shipper</span>
            <div className="text-2xl font-black text-emerald-400 mt-1">
              {loading ? "..." : `${revenueSummary.totalShippingRevenue.toLocaleString("vi-VN")}đ`}
            </div>
            <p className="text-[11px] text-emerald-300 mt-1">Thu từ Tài xế</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-800/60 border border-emerald-500/30 p-4 rounded-2xl">
            <span className="text-xs text-slate-400 font-semibold">Tổng Tiền Shipper Đã Nộp Tự Động</span>
            <div className="text-2xl font-black text-emerald-400 mt-1">
              {paymentLoading ? "..." : `${totalShipperPaid.toLocaleString("vi-VN")}đ`}
            </div>
            <p className="text-[11px] text-emerald-300 mt-1">Gạch nợ qua VietQR / SePay</p>
          </div>

          <div className="bg-slate-800/60 border border-cyan-500/30 p-4 rounded-2xl">
            <span className="text-xs text-slate-400 font-semibold">Tổng Lượt Giao Dịch Banking</span>
            <div className="text-2xl font-black text-cyan-400 mt-1">
              {paymentLoading ? "..." : shipperPayments.length} <span className="text-xs font-bold text-slate-400">giao dịch</span>
            </div>
            <p className="text-[11px] text-cyan-300 mt-1">Cập nhật realtime 24/7</p>
          </div>

          <div className="bg-slate-800/60 border border-indigo-500/30 p-4 rounded-2xl">
            <span className="text-xs text-slate-400 font-semibold">Trạng Thái Hệ Thống API</span>
            <div className="text-lg font-black text-indigo-400 mt-1 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span> Webhook SePay Active
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Tự động mở khóa sau 1 giây</p>
          </div>
        </div>
      )}

      {/* 2. THANH LỌC VÀ TÌM KIẾM */}
      <div className="bg-slate-800/80 border border-slate-700/80 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        {activeTab === "T1_SETTLEMENT" ? (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-200">
              <span>📅 Ngày T:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-amber-400 outline-none cursor-pointer"
              />
            </div>

            <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-700 text-xs font-bold">
              <button
                onClick={() => setRoleFilter("ALL")}
                className={`px-3 py-1.5 rounded-lg transition ${roleFilter === "ALL" ? "bg-indigo-600 text-white" : "text-slate-400"}`}
              >
                Tất Cả
              </button>
              <button
                onClick={() => setRoleFilter("MERCHANT")}
                className={`px-3 py-1.5 rounded-lg transition ${roleFilter === "MERCHANT" ? "bg-indigo-600 text-white" : "text-slate-400"}`}
              >
                🏪 Store
              </button>
              <button
                onClick={() => setRoleFilter("SHIPPER")}
                className={`px-3 py-1.5 rounded-lg transition ${roleFilter === "SHIPPER" ? "bg-indigo-600 text-white" : "text-slate-400"}`}
              >
                🛵 Shipper
              </button>
            </div>

            <select
              value={t1StatusFilter}
              onChange={(e) => setT1StatusFilter(e.target.value as any)}
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 outline-none"
            >
              <option value="ALL">🔍 Tất cả trạng thái T+1</option>
              <option value="PENDING_T">🟡 1. Chờ chốt (Ngày T)</option>
              <option value="READY_T1">🔵 2. Đã duyệt chi (Sáng T+1)</option>
              <option value="PAID_T1">🟢 3. Đã chi trả (Trưa T+1)</option>
              <option value="ERROR">🔴 Lỗi thông tin</option>
            </select>
          </div>
        ) : (
          <div className="text-xs font-bold text-slate-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Lịch sử chuyển khoản nộp ví sàn realtime của Shipper (Collection: <code className="text-emerald-400 font-mono">topup_requests</code>)
          </div>
        )}

        <input
          type="text"
          placeholder={activeTab === "T1_SETTLEMENT" ? "Tìm Tên, SĐT, Ngân Hàng, STK..." : "Tìm Tên tài xế, UID, Mã GD, Nội dung bank..."}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-slate-900/90 border border-slate-700 focus:border-indigo-500 rounded-xl px-4 py-2 text-xs text-slate-200 outline-none w-full md:w-80"
        />
      </div>

      {/* 3. BẢNG DỮ LIỆU CHÍNH */}
      {activeTab === "T1_SETTLEMENT" ? (
        /* TAB 1: BẢNG ĐỐI SOÁT T+1 */
        <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
          {loading ? (
            <div className="p-16 text-center text-slate-400 text-sm font-semibold animate-pulse">
              ⚡ Đang truy xuất dữ liệu đối soát T+1...
            </div>
          ) : filteredPartners.length === 0 ? (
            <div className="p-16 text-center text-slate-400 text-sm font-semibold">
              🚫 Không có dữ liệu đối soát trong ngày đã chọn
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900/80 text-slate-400 font-bold border-b border-slate-700/80 uppercase tracking-wider text-[11px]">
                    <th className="p-4 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={filteredPartners.length > 0 && selectedIds.length === filteredPartners.length}
                        onChange={handleSelectAll}
                        className="rounded border-slate-700 text-indigo-600 cursor-pointer w-4 h-4"
                      />
                    </th>
                    <th className="p-4">Đối Tác</th>
                    <th className="p-4">Phát Sinh Ngày T</th>
                    <th className="p-4 text-indigo-400">Chiết Khấu Sàn</th>
                    <th className="p-4 text-emerald-400">Thực Nhận (Cần Chi T+1)</th>
                    <th className="p-4">Thông Tin Ngân Hàng</th>
                    <th className="p-4">Trạng Thái Quy Trình T+1</th>
                    <th className="p-4">Mã GD / Bill T+1</th>
                    <th className="p-4 text-center">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/40 text-slate-300 font-medium">
                  {filteredPartners.map((p) => {
                    const isChecked = selectedIds.includes(p.id);
                    const bankName = p.bankAccount?.bankName || p.bankName || "—";
                    const bankAccount = p.bankAccount?.accountNumber || p.bankAccount || "—";
                    const bankOwner = p.bankAccount?.accountHolder || p.bankOwner || "—";

                    return (
                      <tr key={p.id} className={`hover:bg-slate-700/30 transition ${isChecked ? "bg-indigo-950/20" : ""}`}>
                        <td className="p-4 text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleSelect(p.id)}
                            className="rounded border-slate-700 text-indigo-600 cursor-pointer w-4 h-4"
                          />
                        </td>

                        <td className="p-4">
                          <div className="font-bold text-white text-sm">{p.fullName || p.name}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                p.role === "MERCHANT"
                                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                                  : "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
                              }`}
                            >
                              {p.role === "MERCHANT" ? "STORE" : "SHIPPER"}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">{p.phone}</span>
                          </div>
                        </td>

                        <td className="p-4 font-bold text-amber-300">{(p.totalGMV || 0).toLocaleString("vi-VN")}đ</td>
                        <td className="p-4 font-bold text-indigo-400">-{(p.platformFee || 0).toLocaleString("vi-VN")}đ</td>
                        <td className="p-4 font-black text-emerald-400 text-sm">{(p.unpaidAmount || 0).toLocaleString("vi-VN")}đ</td>

                        <td className="p-4">
                          <div className="font-bold text-slate-200">{bankName}</div>
                          <div className="font-mono text-indigo-300 text-xs mt-0.5">{bankAccount}</div>
                          <div className="text-[10px] text-slate-400 uppercase tracking-wide">{bankOwner}</div>
                        </td>

                        <td className="p-4">{renderStatusBadge(p)}</td>

                        <td className="p-4">
                          {editingNoteId === p.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={tempNote}
                                onChange={(e) => setTempNote(e.target.value)}
                                placeholder="Nhập Ref / Mã GD..."
                                className="bg-slate-900 border border-indigo-500 text-xs px-2 py-1 rounded text-white outline-none w-28"
                              />
                              <button onClick={() => setEditingNoteId(null)} className="bg-indigo-600 text-white px-2 py-1 rounded text-xs font-bold">
                                OK
                              </button>
                            </div>
                          ) : (
                            <div
                              onClick={() => {
                                setEditingNoteId(p.id);
                                setTempNote(p.accountantNote || "");
                              }}
                              className="text-xs text-slate-400 hover:text-indigo-300 italic cursor-pointer"
                            >
                              {p.accountantNote ? `📌 ${p.accountantNote}` : "+ Nhập mã GD/Bill"}
                            </div>
                          )}
                        </td>

                        <td className="p-4 text-center">
                          <button
                            onClick={() => handleCopyBank(p)}
                            className="px-2.5 py-1 bg-slate-700 hover:bg-indigo-600 text-white rounded-lg text-[10px] font-bold transition cursor-pointer"
                          >
                            {copiedId === p.id ? "✅ Đã Copy" : "📋 Copy Bank"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* TAB 2: BẢNG LỊCH SỬ SHIPPER NỘP TIỀN THỰC TẾ VÀO VÍ SÀN TỪ WEBHOOK */
        <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
          {paymentLoading ? (
            <div className="p-16 text-center text-slate-400 text-sm font-semibold animate-pulse">
              ⚡ Đang tải lịch sử giao dịch nộp tiền Shipper...
            </div>
          ) : filteredShipperPayments.length === 0 ? (
            <div className="p-16 text-center text-slate-400 text-sm font-semibold">
              🚫 Chưa có giao dịch nộp tiền nào từ Shipper
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900/80 text-slate-400 font-bold border-b border-slate-700/80 uppercase tracking-wider text-[11px]">
                    <th className="p-4">Thời Gian</th>
                    <th className="p-4">Shipper / Tài Xế</th>
                    <th className="p-4 text-emerald-400">Số Tiền Nộp</th>
                    <th className="p-4">Lời Nhắn Chuyển Khoản (Bank Memo)</th>
                    <th className="p-4">Mã Giao Dịch (Ref Code)</th>
                    <th className="p-4 text-center">Trạng Thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/40 text-slate-300 font-medium">
                  {filteredShipperPayments.map((pay) => (
                    <tr key={pay.id} className="hover:bg-slate-700/30 transition">
                      <td className="p-4 font-mono text-slate-400">
                        {pay.createdAt ? new Date(pay.createdAt).toLocaleString("vi-VN") : "—"}
                      </td>

                      <td className="p-4">
                        <div className="font-bold text-white text-sm">{pay.driverName}</div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          SĐT: {pay.phone} • UID: <span className="text-indigo-300 font-semibold">{pay.shipperId}</span>
                        </div>
                      </td>

                      <td className="p-4 font-black text-emerald-400 text-base">
                        +{pay.amount.toLocaleString("vi-VN")} <span className="text-xs font-semibold">đ</span>
                      </td>

                      <td className="p-4">
                        <div className="bg-slate-900/90 border border-slate-700/80 px-2.5 py-1.5 rounded-lg text-amber-300 font-mono text-xs max-w-xs overflow-hidden text-ellipsis whitespace-nowrap">
                          {pay.bankDescription || "—"}
                        </div>
                      </td>

                      <td className="p-4 font-mono text-slate-300 font-bold text-xs">
                        {pay.transactionId}
                      </td>

                      <td className="p-4 text-center">
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-[10px]">
                          🟢 Đã Gạch Nợ & Mở Khóa
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}