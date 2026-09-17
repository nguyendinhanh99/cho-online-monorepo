"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";

interface Voucher {
  id: string;
  code: string;
  title: string;
  description?: string;
  applyType: "ORDER" | "SHIPPING";
  discountType: "FIXED" | "PERCENTAGE";
  discountValue: number;
  maxDiscount?: number | null;
  minOrder?: number | null;
  usageLimit?: number | null;
  usedCount?: number;
  limitPerUser?: number;
  startDate?: string | null;
  endDate?: string | null;
  isActive?: boolean;
}

interface VoucherManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function VoucherManagerModal({
  isOpen,
  onClose,
}: VoucherManagerModalProps) {
  // Tab hiện tại: "list" (Danh sách) hoặc "form" (Tạo/Sửa)
  const [activeTab, setActiveTab] = useState<"list" | "form">("list");

  // State danh sách voucher từ Firebase
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [fetchingList, setFetchingList] = useState(true);

  // State đang chỉnh sửa (null = tạo mới, object = sửa)
  const [editingVoucherId, setEditingVoucherId] = useState<string | null>(null);

  // Form states
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [applyType, setApplyType] = useState<"ORDER" | "SHIPPING">("ORDER");
  const [discountType, setDiscountType] = useState<"FIXED" | "PERCENTAGE">("FIXED");
  const [discountValue, setDiscountValue] = useState("");
  const [maxDiscount, setMaxDiscount] = useState("");
  const [minOrder, setMinOrder] = useState("");
  const [usageLimit, setUsageLimit] = useState("");
  const [limitPerUser, setLimitPerUser] = useState("1");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [loading, setLoading] = useState(false);

  // 🔄 Lắng nghe Realtime danh sách Voucher từ Firestore
  useEffect(() => {
    if (!isOpen) return;

    setFetchingList(true);
    const q = query(collection(db, "vouchers"), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Voucher[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            code: data.code || "",
            title: data.title || "",
            description: data.description || "",
            applyType: data.applyType || "ORDER",
            discountType: data.discountType || "FIXED",
            discountValue: Number(data.discountValue || 0),
            maxDiscount: data.maxDiscount ? Number(data.maxDiscount) : null,
            minOrder: data.minOrder ? Number(data.minOrder) : null,
            usageLimit: data.usageLimit ? Number(data.usageLimit) : null,
            usedCount: Number(data.usedCount || 0),
            limitPerUser: Number(data.limitPerUser || 1),
            startDate: data.startDate || null,
            endDate: data.endDate || null,
            isActive: data.isActive !== false,
          };
        });

        setVouchers(list);
        setFetchingList(false);
      },
      (error) => {
        console.error("Lỗi tải danh sách voucher:", error);
        setFetchingList(false);
      }
    );

    return () => unsubscribe();
  }, [isOpen]);

  if (!isOpen) return null;

  // Chuyển ISO String về format "YYYY-MM-DDThh:mm" cho input datetime-local
  const formatISOToInput = (isoStr?: string | null) => {
    if (!isoStr) return "";
    try {
      const date = new Date(isoStr);
      if (isNaN(date.getTime())) return "";
      return date.toISOString().slice(0, 16);
    } catch {
      return "";
    }
  };

  // Mở form chỉnh sửa Voucher
  const handleEdit = (v: Voucher) => {
    setEditingVoucherId(v.id);
    setCode(v.code);
    setTitle(v.title);
    setDescription(v.description || "");
    setApplyType(v.applyType);
    setDiscountType(v.discountType);
    setDiscountValue(v.discountValue.toString());
    setMaxDiscount(v.maxDiscount ? v.maxDiscount.toString() : "");
    setMinOrder(v.minOrder ? v.minOrder.toString() : "");
    setUsageLimit(v.usageLimit ? v.usageLimit.toString() : "");
    setLimitPerUser(v.limitPerUser ? v.limitPerUser.toString() : "1");
    setStartDate(formatISOToInput(v.startDate));
    setEndDate(formatISOToInput(v.endDate));
    setIsActive(v.isActive !== false);

    setActiveTab("form");
  };

  // Chuẩn bị form tạo mới
  const handleOpenCreateForm = () => {
    resetForm();
    setEditingVoucherId(null);
    setActiveTab("form");
  };

  // Bật / Tắt nhanh trạng thái Voucher
  const handleToggleActive = async (v: Voucher) => {
    try {
      await updateDoc(doc(db, "vouchers", v.id), {
        isActive: !v.isActive,
      });
    } catch (err) {
      console.error("Lỗi cập nhật trạng thái:", err);
      alert("❌ Không thể đổi trạng thái voucher!");
    }
  };

  // Xóa Voucher
  const handleDelete = async (id: string, codeStr: string) => {
    if (!confirm(`⚠️ Bạn có chắc chắn muốn xóa mã "${codeStr}" không?`)) return;

    try {
      await deleteDoc(doc(db, "vouchers", id));
    } catch (err) {
      console.error("Lỗi xóa voucher:", err);
      alert("❌ Không thể xóa voucher!");
    }
  };

  // Xử lý Lưu (Tạo mới HOẶC Cập nhật)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!code || !discountValue || !title) {
      alert("Vui lòng điền đầy đủ thông tin bắt buộc!");
      return;
    }

    setLoading(true);
    try {
      const voucherData = {
        code: code.toUpperCase().trim(),
        title: title.trim(),
        description: description.trim(),
        applyType,
        discountType,
        discountValue: Number(discountValue),
        maxDiscount:
          discountType === "PERCENTAGE" && maxDiscount ? Number(maxDiscount) : null,
        minOrder: Number(minOrder || 0),
        usageLimit: usageLimit ? Number(usageLimit) : null,
        limitPerUser: Number(limitPerUser || 1),
        startDate: startDate ? new Date(startDate).toISOString() : null,
        endDate: endDate ? new Date(endDate).toISOString() : null,
        isActive,
      };

      if (editingVoucherId) {
        // Cập nhật Voucher hiện tại
        await updateDoc(doc(db, "vouchers", editingVoucherId), voucherData);
        alert("🎉 Cập nhật Voucher thành công!");
      } else {
        // Tạo Voucher mới
        await addDoc(collection(db, "vouchers"), {
          ...voucherData,
          usedCount: 0,
          createdAt: serverTimestamp(),
        });
        alert("🎉 Tạo và phát hành Voucher mới thành công!");
      }

      resetForm();
      setActiveTab("list");
    } catch (err: any) {
      console.error("Lỗi lưu Voucher:", err);
      alert("❌ Lỗi: " + (err?.message || "Không thể lưu thông tin"));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingVoucherId(null);
    setCode("");
    setTitle("");
    setDescription("");
    setApplyType("ORDER");
    setDiscountType("FIXED");
    setDiscountValue("");
    setMaxDiscount("");
    setMinOrder("");
    setUsageLimit("");
    setLimitPerUser("1");
    setStartDate("");
    setEndDate("");
    setIsActive(true);
  };

  const setQuickDate = (days: number) => {
    const now = new Date();
    const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    setStartDate(now.toISOString().slice(0, 16));
    setEndDate(future.toISOString().slice(0, 16));
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(val);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-3xl p-6 shadow-2xl relative my-8 text-slate-100 flex flex-col max-h-[90vh]">
        {/* Nút Đóng Modal */}
        <button
          onClick={onClose}
          type="button"
          className="absolute top-4 right-4 text-slate-400 hover:text-white font-bold text-lg cursor-pointer z-10"
        >
          ✕
        </button>

        {/* HEADER & THANH TABS */}
        <div className="border-b border-slate-700 pb-4 mb-4 shrink-0">
          <h3 className="text-xl font-black text-white flex items-center gap-2 mb-1">
            🎫 Quản Lý Voucher Khuyến Mãi
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Quản lý, chỉnh sửa và phát hành mã giảm giá áp dụng toàn hệ thống.
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("list")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === "list"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                  : "bg-slate-700/60 text-slate-300 hover:bg-slate-700"
              }`}
            >
              <span>📋 Danh sách Voucher ({vouchers.length})</span>
            </button>

            <button
              type="button"
              onClick={handleOpenCreateForm}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === "form" && !editingVoucherId
                  ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                  : "bg-slate-700/60 text-slate-300 hover:bg-slate-700"
              }`}
            >
              <span>✨ {editingVoucherId ? "Chỉnh Sửa Voucher" : "Tạo Mã Mới"}</span>
            </button>
          </div>
        </div>

        {/* CONTENT NỘI DUNG */}
        <div className="flex-1 overflow-y-auto pr-1">
          {/* TAB 1: DANH SÁCH VOUCHER */}
          {activeTab === "list" && (
            <div className="space-y-3">
              {fetchingList ? (
                <p className="text-xs text-slate-400 text-center py-10">
                  ⏳ Đang tải danh sách voucher từ Firebase...
                </p>
              ) : vouchers.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <p className="text-slate-400 text-xs">Chưa có mã giảm giá nào được tạo.</p>
                  <button
                    type="button"
                    onClick={handleOpenCreateForm}
                    className="px-4 py-2 bg-purple-600 text-white text-xs font-bold rounded-xl cursor-pointer"
                  >
                    + Tạo Mã Đầu Tiên
                  </button>
                </div>
              ) : (
                vouchers.map((v) => (
                  <div
                    key={v.id}
                    className="bg-slate-900/80 border border-slate-700/80 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-slate-600 transition"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded uppercase">
                          {v.code}
                        </span>
                        <span className="font-bold text-sm text-white">{v.title}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            v.isActive
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          }`}
                        >
                          {v.isActive ? "Đang bật" : "Đã ẩn"}
                        </span>
                      </div>

                      {v.description && (
                        <p className="text-xs text-slate-400">{v.description}</p>
                      )}

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400 pt-1">
                        <span>
                          🏷️ Giảm:{" "}
                          <strong className="text-emerald-400">
                            {v.discountType === "FIXED"
                              ? formatCurrency(v.discountValue)
                              : `${v.discountValue}%`}
                          </strong>
                        </span>
                        <span>
                          📦 Loại:{" "}
                          <strong className="text-amber-400">
                            {v.applyType === "SHIPPING" ? "Freeship" : "Đơn hàng"}
                          </strong>
                        </span>
                        <span>
                          📊 Đã dùng:{" "}
                          <strong className="text-indigo-400">
                            {v.usedCount || 0}
                            {v.usageLimit ? `/${v.usageLimit}` : " lượt (vô hạn)"}
                          </strong>
                        </span>
                      </div>
                    </div>

                    {/* Nút hành động */}
                    <div className="flex items-center gap-2 border-t md:border-t-0 pt-2 md:pt-0 border-slate-800 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(v)}
                        className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition cursor-pointer ${
                          v.isActive
                            ? "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
                            : "bg-emerald-950 text-emerald-400 border-emerald-800 hover:bg-emerald-900"
                        }`}
                      >
                        {v.isActive ? "Tắt" : "Bật"}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleEdit(v)}
                        className="text-[11px] font-bold bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 px-3 py-1.5 rounded-lg transition cursor-pointer"
                      >
                        ✏️ Sửa
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(v.id, v.code)}
                        className="text-[11px] font-bold bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/30 px-3 py-1.5 rounded-lg transition cursor-pointer"
                      >
                        🗑️ Xóa
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: FORM TẠO / SỬA VOUCHER */}
          {activeTab === "form" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="bg-purple-950/30 border border-purple-800/40 p-3 rounded-xl flex items-center justify-between text-xs">
                <span className="text-purple-300 font-medium">
                  {editingVoucherId
                    ? "✏️ Đang ở chế độ Cập Nhật Mã:"
                    : "✨ Đang ở chế độ Tạo Mã Mới"}
                </span>
                {editingVoucherId && (
                  <button
                    type="button"
                    onClick={handleOpenCreateForm}
                    className="text-[10px] text-purple-400 underline hover:text-purple-200 cursor-pointer"
                  >
                    Chuyển sang Tạo Mới
                  </button>
                )}
              </div>

              {/* Thông tin hiển thị */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Mã Voucher (Code) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="VD: FREESHIP50, CHOMOI20K"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono uppercase focus:border-indigo-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Tên Chương Trình <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Giảm 20k cho đơn từ 100k"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Mô Tả Chi Tiết
                </label>
                <input
                  type="text"
                  placeholder="VD: Áp dụng cho toàn bộ các cửa hàng đồ ăn trên ứng dụng"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Phạm vi & Hình thức giảm giá */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-700/60">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Phạm Vi Áp Dụng
                  </label>
                  <select
                    value={applyType}
                    onChange={(e) => setApplyType(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="ORDER">🛒 Giảm Giá Đơn Hàng</option>
                    <option value="SHIPPING">🚚 Miễn Phí Vận Chuyển (Freeship)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Hình Thức Giảm Giá
                  </label>
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="FIXED">💵 Cố Định Theo Số Tiền (VNĐ)</option>
                    <option value="PERCENTAGE">٪ Theo Phần Trăm (%)</option>
                  </select>
                </div>
              </div>

              {/* Giá trị giảm & Giảm tối đa */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Mức Giảm {discountType === "FIXED" ? "(VNĐ)" : "(%)"}{" "}
                    <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    placeholder={discountType === "FIXED" ? "VD: 20000" : "VD: 15"}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-emerald-400 font-bold focus:border-indigo-500 focus:outline-none"
                    required
                  />
                </div>

                {discountType === "PERCENTAGE" && (
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Giảm Tối Đa (VNĐ)
                    </label>
                    <input
                      type="number"
                      placeholder="VD: 50000 (Trống = Không giới hạn)"
                      value={maxDiscount}
                      onChange={(e) => setMaxDiscount(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-amber-400 font-bold focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Điều kiện & Lượt sử dụng */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-700/60">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Đơn Tối Thiểu (VNĐ)
                  </label>
                  <input
                    type="number"
                    placeholder="VD: 100000"
                    value={minOrder}
                    onChange={(e) => setMinOrder(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Tổng Số Lượt Dùng
                  </label>
                  <input
                    type="number"
                    placeholder="VD: 500 (Trống = Vô hạn)"
                    value={usageLimit}
                    onChange={(e) => setUsageLimit(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Lượt / Người Dùng
                  </label>
                  <input
                    type="number"
                    placeholder="Mặc định: 1"
                    value={limitPerUser}
                    onChange={(e) => setLimitPerUser(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Thời gian & Trạng thái */}
              <div className="pt-2 border-t border-slate-700/60 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-300">
                    Thời Gian Hiệu Lực
                  </label>

                  <div className="flex gap-1.5 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setQuickDate(7)}
                      className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md transition cursor-pointer"
                    >
                      ⚡ +7 Ngày
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickDate(30)}
                      className="px-2 py-1 bg-indigo-600/40 hover:bg-indigo-600/60 text-indigo-200 border border-indigo-500/30 rounded-md transition cursor-pointer"
                    >
                      ⚡ +30 Ngày
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStartDate("");
                        setEndDate("");
                      }}
                      className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-md transition cursor-pointer"
                    >
                      Xóa
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="block text-[11px] text-slate-400 mb-1">
                      Thời Gian Bắt Đầu
                    </span>
                    <input
                      type="datetime-local"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white font-medium focus:border-indigo-500 focus:outline-none cursor-pointer [color-scheme:dark]"
                    />
                  </div>

                  <div>
                    <span className="block text-[11px] text-slate-400 mb-1">
                      Thời Gian Hết Hạn
                    </span>
                    <input
                      type="datetime-local"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white font-medium focus:border-indigo-500 focus:outline-none cursor-pointer [color-scheme:dark]"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="isActiveCheck"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 accent-purple-600 cursor-pointer"
                  />
                  <label
                    htmlFor="isActiveCheck"
                    className="text-xs font-bold text-slate-300 cursor-pointer"
                  >
                    Kích hoạt (Cho phép người dùng thấy và áp dụng mã này)
                  </label>
                </div>
              </div>

              {/* Footer thao tác */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-700/80">
                <button
                  type="button"
                  onClick={() => setActiveTab("list")}
                  className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Quay lại Danh Sách
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-600/30 transition flex items-center gap-2 cursor-pointer"
                >
                  {loading
                    ? "🔥 Đang Lưu Firebase..."
                    : editingVoucherId
                    ? "💾 Lưu Cập Nhật"
                    : "✨ Phát Hành Voucher"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}