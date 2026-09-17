"use client";

import { useState, useEffect } from "react";
import { db } from "@cho-online/firebase";
import {
    collection,
    onSnapshot,
    addDoc,
    deleteDoc,
    doc,
    query,
    where,
    serverTimestamp,
} from "firebase/firestore";

interface Voucher {
    id: string;
    code: string;
    title?: string;
    applyType: "ORDER" | "SHIPPING";
    discountType: "PERCENTAGE" | "FIXED";
    discountValue: number;
    minOrder?: number;
    maxDiscount?: number;
    isActive: boolean;
    createdAt?: any;
}

interface VoucherManagerProps {
    merchantId: string;
    formatCurrency?: (amount: number) => string;
}

export default function VoucherManager({
    merchantId,
    formatCurrency = (amount) =>
        new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount || 0),
}: VoucherManagerProps) {
    const [vouchers, setVouchers] = useState<Voucher[]>([]);
    const [isOpenModal, setIsOpenModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form State
    const [code, setCode] = useState("");
    const [title, setTitle] = useState("");
    const [discountType, setDiscountType] = useState<"PERCENTAGE" | "FIXED">("PERCENTAGE");
    const [discountValue, setDiscountValue] = useState("");
    const [minOrder, setMinOrder] = useState("");
    const [maxDiscount, setMaxDiscount] = useState("");

    // Lắng nghe danh sách Voucher của Quán từ Firestore
    useEffect(() => {
        if (!merchantId) return;

        const q = query(collection(db, "vouchers"), where("merchantId", "==", merchantId));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list: Voucher[] = snapshot.docs.map((d) => {
                const data = d.data();
                return {
                    id: d.id,
                    code: data.code || "",
                    title: data.title || "",
                    applyType: data.applyType || "ORDER",
                    discountType: data.discountType === "percent" || data.discountType === "PERCENTAGE" ? "PERCENTAGE" : "FIXED",
                    discountValue: Number(data.discountValue) || 0,
                    minOrder: Number(data.minOrder || data.minOrderValue) || 0,
                    maxDiscount: data.maxDiscount ? Number(data.maxDiscount) : undefined,
                    isActive: data.isActive !== false,
                    createdAt: data.createdAt,
                };
            });
            setVouchers(list);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [merchantId]);

    // Tạo Voucher mới (Lưu dữ liệu chuẩn cho Checkout)
    const handleCreateVoucher = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!merchantId || !code.trim()) return;

        const valueNum = Number(discountValue) || 0;
        const maxDiscNum = discountType === "PERCENTAGE" && maxDiscount ? Number(maxDiscount) : null;

        // Tự động tạo tiêu đề nếu bỏ trống
        const defaultTitle = title.trim()
            ? title.trim()
            : discountType === "PERCENTAGE"
                ? `Giảm ${valueNum}%${maxDiscNum ? ` (Tối đa ${formatCurrency(maxDiscNum)})` : ""}`
                : `Giảm ${formatCurrency(valueNum)}`;

        try {
            setIsSubmitting(true);
            await addDoc(collection(db, "vouchers"), {
                merchantId,
                code: code.trim().toUpperCase(),
                title: defaultTitle,
                applyType: "ORDER", // Mặc định Voucher quán tạo là Voucher Đơn Hàng/Shop
                discountType: discountType, // "PERCENTAGE" hoặc "FIXED"
                discountValue: valueNum,
                minOrder: Number(minOrder) || 0,
                minOrderValue: Number(minOrder) || 0, // Lưu song song để không ngắt code cũ nếu có
                maxDiscount: maxDiscNum,
                isActive: true,
                createdAt: serverTimestamp(),
            });

            // Reset form & Close modal
            setCode("");
            setTitle("");
            setDiscountValue("");
            setMinOrder("");
            setMaxDiscount("");
            setIsOpenModal(false);
            alert("🎉 Tạo mã giảm giá thành công!");
        } catch (error) {
            console.error("Lỗi khi tạo voucher:", error);
            alert("Không thể tạo voucher. Vui lòng thử lại!");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Xóa Voucher
    const handleDeleteVoucher = async (voucherId: string) => {
        if (!confirm("Bạn có chắc chắn muốn xóa mã giảm giá này?")) return;
        try {
            await deleteDoc(doc(db, "vouchers", voucherId));
        } catch (error) {
            console.error("Lỗi khi xóa voucher:", error);
        }
    };

    return (
        <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-xs space-y-3 font-sans text-xs">
            {/* Header */}
            <div className="flex justify-between items-center border-b border-stone-100 pb-2.5">
                <div>
                    <h3 className="font-extrabold text-stone-800 uppercase tracking-wide flex items-center gap-1.5">
                        <span>🎟️</span> Mã Giảm Giá Của Quán
                    </h3>
                    <p className="text-[10px] text-stone-400">
                        Tạo voucher khuyến mãi thu hút khách hàng đặt món
                    </p>
                </div>
                <button
                    onClick={() => setIsOpenModal(true)}
                    className="bg-[#ee4d2d] hover:bg-[#d73f20] text-white font-bold px-3 py-1.5 rounded-xl transition cursor-pointer active:scale-95 flex items-center gap-1 shadow-xs"
                >
                    <span>＋</span> Tạo Mã Mới
                </button>
            </div>

            {/* Danh sách Voucher */}
            {loading ? (
                <p className="text-center text-stone-400 py-3">Đang tải voucher...</p>
            ) : vouchers.length === 0 ? (
                <div className="p-4 text-center bg-stone-50 rounded-xl border border-dashed border-stone-200 text-stone-400">
                    Chưa có mã giảm giá nào. Hãy bấm <strong>Tạo Mã Mới</strong> để bắt đầu!
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                    {vouchers.map((v) => (
                        <div
                            key={v.id}
                            className="bg-orange-50/50 border border-orange-200/80 rounded-xl p-2.5 flex justify-between items-center relative overflow-hidden"
                        >
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                    <span className="font-mono font-black text-xs text-[#ee4d2d] bg-white px-2 py-0.5 rounded border border-orange-200 tracking-wider">
                                        {v.code}
                                    </span>
                                    <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.2 rounded">
                                        Đang chạy
                                    </span>
                                </div>
                                <p className="text-[11px] font-bold text-stone-700 mt-1">
                                    Giảm:{" "}
                                    {v.discountType === "PERCENTAGE"
                                        ? `${v.discountValue}%`
                                        : formatCurrency(v.discountValue)}
                                    {v.maxDiscount ? ` (Tối đa ${formatCurrency(v.maxDiscount)})` : ""}
                                </p>
                                <p className="text-[9px] text-stone-400">
                                    Đơn tối thiểu: {formatCurrency(v.minOrder || 0)}
                                </p>
                            </div>

                            <button
                                onClick={() => handleDeleteVoucher(v.id)}
                                className="text-stone-400 hover:text-rose-500 p-1 font-bold text-xs cursor-pointer transition"
                                title="Xóa mã"
                            >
                                🗑️
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal Tạo Voucher */}
            {isOpenModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
                    <div className="bg-white rounded-2xl max-w-sm w-full p-4 space-y-3 shadow-2xl border border-stone-200">
                        <div className="flex justify-between items-center border-b border-stone-100 pb-2">
                            <h3 className="font-extrabold text-stone-800 uppercase tracking-wide flex items-center gap-1.5">
                                <span>🎟️</span> Tạo Voucher Mới
                            </h3>
                            <button
                                onClick={() => setIsOpenModal(false)}
                                className="text-stone-400 hover:text-stone-700 text-base font-bold cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleCreateVoucher} className="space-y-2.5">
                            <div>
                                <label className="block text-[10px] font-bold text-stone-500 uppercase mb-0.5">
                                    Mã Voucher (Ví dụ: BANMOI, SALE20)
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="NHẬP MÃ GIẢM GIÁ..."
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                                    className="w-full px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl font-mono font-bold text-stone-800 uppercase focus:outline-hidden focus:border-[#ee4d2d]"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-stone-500 uppercase mb-0.5">
                                    Tên hiển thị (Tùy chọn)
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ví dụ: Giảm 10% cho đơn từ 50k"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl font-bold text-stone-800 focus:outline-hidden focus:border-[#ee4d2d]"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[10px] font-bold text-stone-500 uppercase mb-0.5">
                                        Loại giảm giá
                                    </label>
                                    <select
                                        value={discountType}
                                        onChange={(e) => setDiscountType(e.target.value as any)}
                                        className="w-full px-2 py-1.5 bg-stone-50 border border-stone-200 rounded-xl font-bold text-stone-800"
                                    >
                                        <option value="PERCENTAGE">Theo %</option>
                                        <option value="FIXED">Tiền cố định (VNĐ)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-stone-500 uppercase mb-0.5">
                                        Mức giảm {discountType === "PERCENTAGE" ? "(%)" : "(VNĐ)"}
                                    </label>
                                    <input
                                        type="number"
                                        required
                                        min={1}
                                        placeholder={discountType === "PERCENTAGE" ? "VD: 10" : "VD: 20000"}
                                        value={discountValue}
                                        onChange={(e) => setDiscountValue(e.target.value)}
                                        className="w-full px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl font-bold text-stone-800 focus:outline-hidden focus:border-[#ee4d2d]"
                                    />
                                </div>
                            </div>

                            {discountType === "PERCENTAGE" && (
                                <div>
                                    <label className="block text-[10px] font-bold text-stone-500 uppercase mb-0.5">
                                        Giảm tối đa (VNĐ) - Không bắt buộc
                                    </label>
                                    <input
                                        type="number"
                                        placeholder="VD: 30000"
                                        value={maxDiscount}
                                        onChange={(e) => setMaxDiscount(e.target.value)}
                                        className="w-full px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl font-bold text-stone-800 focus:outline-hidden focus:border-[#ee4d2d]"
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-[10px] font-bold text-stone-500 uppercase mb-0.5">
                                    Đơn hàng tối thiểu (VNĐ)
                                </label>
                                <input
                                    type="number"
                                    required
                                    min={0}
                                    placeholder="VD: 50000"
                                    value={minOrder}
                                    onChange={(e) => setMinOrder(e.target.value)}
                                    className="w-full px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl font-bold text-stone-800 focus:outline-hidden focus:border-[#ee4d2d]"
                                />
                            </div>

                            <div className="pt-2 flex gap-2 justify-end border-t border-stone-100">
                                <button
                                    type="button"
                                    onClick={() => setIsOpenModal(false)}
                                    className="px-3 py-1.5 rounded-xl text-stone-600 font-bold bg-stone-100 hover:bg-stone-200 transition cursor-pointer"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-3 py-1.5 rounded-xl text-white font-bold bg-[#ee4d2d] hover:bg-[#d73f20] transition cursor-pointer shadow-md disabled:opacity-50"
                                >
                                    {isSubmitting ? "Đang lưu..." : "Tạo Mã"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}