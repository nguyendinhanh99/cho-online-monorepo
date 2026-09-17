"use client";

import { useEffect, useState, useMemo } from "react";
import { MerchantDetailModal } from "@/components/MerchantDetailModal";

interface Merchant {
  id: string;
  userId?: string; // ID tài khoản của chủ shop
  shopName?: string;
  storeName?: string;
  fullName?: string;
  ownerName?: string;
  phone?: string;
  phoneNumber?: string;
  address?: string;
  category?: string;
  totalProducts?: number;
  totalRevenue?: number;
  status: "APPROVED" | "PENDING" | "BLOCKED" | string;
  createdAt?: string;
}

export default function MerchantsPage() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Bộ lọc & Tìm kiếm
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<"REVENUE_DESC" | "NEWEST" | "PRODUCTS_DESC">("REVENUE_DESC");

  // Modal & Phân trang
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  const fetchMerchants = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/merchants");
      const data = await res.json();
      if (data.success) {
        setMerchants(data.data || []);
      }
    } catch (err) {
      console.error("Lỗi tải gian hàng:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMerchants();
  }, []);

  // 🔔 Hàm gửi & lưu thông báo hệ thống
  const sendNotification = async (merchant: Merchant, title: string, message: string) => {
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: merchant.userId || merchant.id,
          merchantId: merchant.id,
          title,
          message,
          type: "MERCHANT_STATUS",
        }),
      });
    } catch (err) {
      console.error("Lỗi gửi thông báo:", err);
    }
  };

  // Xử lý Thay đổi Trạng thái nhanh (Quick Action)
  const handleUpdateStatus = async (merchant: Merchant, newStatus: string) => {
    const statusText = newStatus === "APPROVED" ? "Duyệt" : newStatus === "BLOCKED" ? "Khóa" : newStatus;
    if (!confirm(`Bạn có chắc chắn muốn [${statusText}] gian hàng "${merchant.shopName || merchant.storeName}"?`)) return;

    setActionLoadingId(merchant.id);
    try {
      const res = await fetch(`/api/merchants/${merchant.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(`Máy chủ trả về mã lỗi (${res.status})`);
      }

      const data = await res.json();

      if (res.ok && data.success) {
        setMerchants((prev) =>
          prev.map((m) => (m.id === merchant.id ? { ...m, status: newStatus } : m))
        );

        // 🔔 Lưu thông báo theo từng loại hành động
        const shopName = merchant.shopName || merchant.storeName || "Gian hàng";
        if (newStatus === "APPROVED") {
          await sendNotification(
            merchant,
            "🎉 Gian hàng của bạn đã được duyệt!",
            `Chúc mừng! Gian hàng "${shopName}" của bạn đã được Admin phê duyệt và chính thức đi vào hoạt động.`
          );
        } else if (newStatus === "BLOCKED") {
          await sendNotification(
            merchant,
            "⚠️ Gian hàng bị tạm khóa",
            `Gian hàng "${shopName}" của bạn đã bị tạm khóa do vi phạm quy định hoặc cần kiểm tra lại thông tin.`
          );
        }
      } else {
        alert(data.message || "Thao tác thất bại!");
      }
    } catch (err: any) {
      console.error("Lỗi cập nhật trạng thái:", err);
      alert(err.message || "Đã xảy ra lỗi hệ thống!");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Trích xuất danh sách danh mục độc nhất
  const categories = useMemo(() => {
    const cats = new Set<string>();
    merchants.forEach((m) => {
      if (m.category) cats.add(m.category);
    });
    return Array.from(cats);
  }, [merchants]);

  // Lọc & Sắp xếp Dữ liệu
  const filteredMerchants = useMemo(() => {
    return merchants
      .filter((m) => {
        const keyword = search.toLowerCase();
        const name = (m.shopName || m.storeName || m.fullName || "").toLowerCase();
        const phone = m.phone || m.phoneNumber || "";
        const matchesSearch = name.includes(keyword) || phone.includes(keyword);

        const matchesStatus = statusFilter === "ALL" || m.status === statusFilter;
        const matchesCategory = categoryFilter === "ALL" || m.category === categoryFilter;

        return matchesSearch && matchesStatus && matchesCategory;
      })
      .sort((a, b) => {
        if (sortBy === "REVENUE_DESC") return (b.totalRevenue || 0) - (a.totalRevenue || 0);
        if (sortBy === "PRODUCTS_DESC") return (b.totalProducts || 0) - (a.totalProducts || 0);
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });
  }, [merchants, search, statusFilter, categoryFilter, sortBy]);

  // Phân trang
  const totalPages = Math.ceil(filteredMerchants.length / pageSize) || 1;
  const paginatedMerchants = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredMerchants.slice(start, start + pageSize);
  }, [filteredMerchants, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, categoryFilter, sortBy]);

  const totalShops = merchants.length;
  const pendingShops = merchants.filter((m) => m.status === "PENDING").length;
  const activeShops = merchants.filter((m) => m.status === "APPROVED" || m.status === "ACTIVE").length;
  const totalSystemRevenue = merchants.reduce((sum, m) => sum + (m.totalRevenue || 0), 0);

  const handleExportCSV = () => {
    if (filteredMerchants.length === 0) return alert("Không có dữ liệu để xuất!");

    const headers = ["ID", "Ten Gian Hang", "Chu Shop", "SDT", "Doanh Thu", "San Pham", "Trang Thai"];
    const rows = filteredMerchants.map((m) => [
      m.id,
      `"${m.shopName || m.storeName || ""}"`,
      `"${m.fullName || m.ownerName || ""}"`,
      `"${m.phone || m.phoneNumber || ""}"`,
      m.totalRevenue || 0,
      m.totalProducts || 0,
      m.status,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Danh_sach_gian_hang_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-6 md:p-8 space-y-6 font-sans">
      {/* 📍 Header Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
            <span>🏪</span> Quản Lý Chợ & Gian Hàng
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-1">
            Duyệt yêu cầu mở shop, kiểm soát doanh thu và kiểm duyệt gian hàng hệ thống.
          </p>
        </div>
        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <span>📥</span> Xuất CSV
          </button>
          <button
            onClick={fetchMerchants}
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition shadow-lg shadow-indigo-600/20 flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <span className={loading ? "animate-spin" : ""}>🔄</span> Làm mới
          </button>
        </div>
      </div>

      {/* 📊 KPI Dashboard Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800/80 border border-slate-700/70 p-4 rounded-2xl backdrop-blur-md shadow-sm">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tổng Số Gian Hàng</p>
          <div className="flex items-baseline justify-between mt-2">
            <p className="text-2xl font-black text-white">{totalShops}</p>
            <span className="text-xs font-bold text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded-md">
              {activeShops} Hoạt động
            </span>
          </div>
        </div>

        <div className="bg-amber-950/20 border border-amber-800/40 p-4 rounded-2xl backdrop-blur-md shadow-sm">
          <p className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">⏳ Chờ Duyệt Mới</p>
          <div className="flex items-baseline justify-between mt-2">
            <p className="text-2xl font-black text-amber-300">{pendingShops}</p>
            <span className="text-[10px] font-extrabold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
              Cần xử lý
            </span>
          </div>
        </div>

        <div className="bg-emerald-950/20 border border-emerald-800/40 p-4 rounded-2xl backdrop-blur-md shadow-sm">
          <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">💰 Tổng Doanh Thu Chợ</p>
          <p className="text-2xl font-black text-emerald-300 mt-2">
            {totalSystemRevenue.toLocaleString("vi-VN")} <span className="text-xs">đ</span>
          </p>
        </div>

        <div className="bg-indigo-950/20 border border-indigo-800/40 p-4 rounded-2xl backdrop-blur-md shadow-sm">
          <p className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">📦 Tổng Số Sản Phẩm</p>
          <p className="text-2xl font-black text-indigo-300 mt-2">
            {merchants.reduce((sum, m) => sum + (m.totalProducts || 0), 0).toLocaleString("vi-VN")}{" "}
            <span className="text-xs">món</span>
          </p>
        </div>
      </div>

      {/* 🔍 Control Bar */}
      <div className="bg-slate-800/90 border border-slate-700/80 p-4 rounded-2xl space-y-3 md:space-y-0 md:flex md:items-center md:justify-between md:gap-4 shadow-md">
        <div className="flex gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {[
            { key: "ALL", label: "Tất Cả" },
            { key: "APPROVED", label: "Hoạt Động" },
            { key: "PENDING", label: "Chờ Duyệt" },
            { key: "BLOCKED", label: "Đã Khóa" },
          ].map((st) => (
            <button
              key={st.key}
              onClick={() => setStatusFilter(st.key)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                statusFilter === st.key
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "bg-slate-700/40 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {categories.length > 0 && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-xs text-slate-300 rounded-xl px-3 py-2 outline-none focus:border-indigo-500"
            >
              <option value="ALL">Tất cả ngành hàng</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-slate-900 border border-slate-700 text-xs text-slate-300 rounded-xl px-3 py-2 outline-none focus:border-indigo-500"
          >
            <option value="REVENUE_DESC">Doanh thu cao nhất</option>
            <option value="PRODUCTS_DESC">Nhiều sản phẩm nhất</option>
            <option value="NEWEST">Mới đăng ký</option>
          </select>

          <div className="relative flex-1 min-w-[200px]">
            <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 text-xs">🔍</span>
            <input
              type="text"
              placeholder="Tìm tên shop, chủ shop, SĐT..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none font-medium transition"
            />
          </div>
        </div>
      </div>

      {/* 📋 Merchant Table */}
      <div className="bg-slate-800/60 border border-slate-700/70 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
        {loading ? (
          <div className="p-16 text-center text-slate-400 text-sm font-semibold animate-pulse flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            Đang tải dữ liệu gian hàng...
          </div>
        ) : filteredMerchants.length === 0 ? (
          <div className="p-16 text-center text-slate-400 text-sm font-semibold">
            🚫 Không tìm thấy gian hàng nào phù hợp với bộ lọc.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900/90 text-slate-400 font-bold border-b border-slate-700/80 uppercase tracking-wider text-[11px]">
                  <th className="p-4">Gian Hàng / Chủ Shop</th>
                  <th className="p-4">Liên Hệ & Địa Chỉ</th>
                  <th className="p-4 text-center">Sản Phẩm</th>
                  <th className="p-4">Doanh Thu</th>
                  <th className="p-4">Trạng Thái</th>
                  <th className="p-4 text-right">Thao Tác Quản Lý</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40 text-slate-300 font-medium">
                {paginatedMerchants.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-700/30 transition">
                    <td className="p-4">
                      <div className="font-extrabold text-slate-100 text-sm">
                        {m.shopName || m.storeName || "Chưa đặt tên"}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                        <span>👤 {m.fullName || m.ownerName || "N/A"}</span>
                        {m.category && (
                          <span className="bg-slate-700/60 text-slate-300 text-[9px] px-1.5 py-0.2 rounded font-bold">
                            {m.category}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="p-4">
                      <div className="font-bold text-slate-200">{m.phone || m.phoneNumber || "N/A"}</div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[220px] mt-0.5" title={m.address}>
                        📍 {m.address || "Chưa cập nhật địa chỉ"}
                      </div>
                    </td>

                    <td className="p-4 text-center">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700/80 font-bold text-amber-400 text-xs">
                        {m.totalProducts || 0} món
                      </span>
                    </td>

                    <td className="p-4">
                      <span className="font-extrabold text-emerald-400 text-sm">
                        {(m.totalRevenue || 0).toLocaleString("vi-VN")}đ
                      </span>
                    </td>

                    <td className="p-4">
                      {m.status === "PENDING" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-black text-[10px]">
                          ⏳ Chờ Duyệt
                        </span>
                      ) : m.status === "BLOCKED" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 font-black text-[10px]">
                          🔴 Tạm Khóa
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-black text-[10px]">
                          🟢 Hoạt Động
                        </span>
                      )}
                    </td>

                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Nút Duyệt Nhanh nếu PENDING */}
                        {m.status === "PENDING" && (
                          <button
                            disabled={actionLoadingId === m.id}
                            onClick={() => handleUpdateStatus(m, "APPROVED")}
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-[11px] transition cursor-pointer active:scale-95 shadow-sm"
                          >
                            ✓ Duyệt
                          </button>
                        )}

                        {/* Nút Khóa / Mở Khóa Nhanh */}
                        {m.status === "APPROVED" && (
                          <button
                            disabled={actionLoadingId === m.id}
                            onClick={() => handleUpdateStatus(m, "BLOCKED")}
                            className="px-2.5 py-1.5 bg-rose-600/80 hover:bg-rose-600 text-white font-bold rounded-lg text-[11px] transition cursor-pointer active:scale-95"
                          >
                            🔒 Khóa
                          </button>
                        )}

                        {m.status === "BLOCKED" && (
                          <button
                            disabled={actionLoadingId === m.id}
                            onClick={() => handleUpdateStatus(m, "APPROVED")}
                            className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-emerald-400 font-bold rounded-lg text-[11px] transition cursor-pointer active:scale-95 border border-slate-600"
                          >
                            🔓 Mở
                          </button>
                        )}

                        {/* Nút Chi tiết Modal */}
                        <button
                          onClick={() => setSelectedMerchant(m)}
                          className="px-3 py-1.5 bg-indigo-600/80 hover:bg-indigo-600 text-white font-bold rounded-lg transition text-[11px] cursor-pointer active:scale-95 shadow-sm"
                        >
                          Chi Tiết
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 📄 Phân trang */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-700/60 bg-slate-900/60 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Hiển thị <strong className="text-white">{(currentPage - 1) * pageSize + 1}</strong> -{" "}
              <strong className="text-white">
                {Math.min(currentPage * pageSize, filteredMerchants.length)}
              </strong>{" "}
              trên tổng số <strong className="text-white">{filteredMerchants.length}</strong> shop
            </span>

            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded-lg text-xs font-bold text-slate-300 transition"
              >
                ◀ Trước
              </button>

              <span className="text-xs font-bold px-2 text-slate-300">
                {currentPage} / {totalPages}
              </span>

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded-lg text-xs font-bold text-slate-300 transition"
              >
                Sau ▶
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 📄 Modal Chi Tiết */}
      {selectedMerchant && (
        <MerchantDetailModal
          merchant={selectedMerchant}
          onClose={() => setSelectedMerchant(null)}
          onRefresh={fetchMerchants}
        />
      )}
    </div>
  );
}