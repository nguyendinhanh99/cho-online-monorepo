"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@cho-online/firebase";
import { collection, onSnapshot, doc, updateDoc, query, where } from "firebase/firestore";

import StatCards from "@/components/StatCards";

type FilterType = "today" | "month" | "year";
type ActiveTab = "overview" | "history";

interface DailyStat {
    dateStr: string;
    displayDate: string;
    totalCod: number;
    netEarnings: number;
    amountToReturn: number;
    isPaid: boolean;
}

interface TopupHistoryItem {
    id: string;
    amount: number;
    createdAt: string;
    status: string;
    bankName?: string;
    bankAccount?: string;
    transactionId?: string;
}

const WARNING_LIMIT = 1500000;  // 1.5tr: Cảnh báo
const MAX_DEBT_LIMIT = 2000000; // 2.0tr: Khóa nhận đơn

export default function OverviewTab() {
    const { profile, loading } = useAuth();
    const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
    const [localOnline, setLocalOnline] = useState<boolean>(false);

    const [showPayModal, setShowPayModal] = useState<boolean>(false);
    const [selectedPayAmount, setSelectedPayAmount] = useState<number>(0);
    const [copiedField, setCopiedField] = useState<string | null>(null);

    // State quản lý Modal thông báo thành công UI/UX mới
    const [showSuccessToast, setShowSuccessToast] = useState<boolean>(false);

    const [filterType, setFilterType] = useState<FilterType>("today");

    const [stats, setStats] = useState({
        todayEarnings: 0,      
        completedOrders: 0,    
        totalCodCollected: 0,  
        totalPlatformFee: 0,   
        totalPaidToPlatform: 0,
        amountToReturn: 0,     
        rating: 5.0,
    });

    const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
    const [topupHistory, setTopupHistory] = useState<TopupHistoryItem[]>([]);
    const [isBlocked, setIsBlocked] = useState<boolean>(false);
    const [blockReason, setBlockReason] = useState<string>("");

    const [paidAmount, setPaidAmount] = useState<number>(0);
    
    const completedTopupIdsRef = useRef<Set<string>>(new Set());
    const isFirstLoadRef = useRef<boolean>(true);

    // =========================================================================
    // ⚡ REALTIME LISTEN: BẮT SỰ KIỆN WEBHOOK & TỰ ĐỘNG ĐỐI SOÁT COD
    // =========================================================================
    useEffect(() => {
        if (!profile?.uid) return;

        const topupRef = collection(db, "topup_requests");
        const q = query(topupRef, where("shipperId", "==", profile.uid));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            let totalPaid = 0;
            let hasNewSuccess = false;
            const historyList: TopupHistoryItem[] = [];

            snapshot.docs.forEach((docSnap) => {
                const data = docSnap.data();
                const status = String(data.status || "").toUpperCase();
                const docId = docSnap.id;
                
                const isSuccessStatus = ["COMPLETED", "SUCCESS", "APPROVED"].includes(status);
                const val = Number(data.amount || data.transferAmount || 0);

                if (isSuccessStatus) {
                    totalPaid += val;

                    if (!completedTopupIdsRef.current.has(docId)) {
                        completedTopupIdsRef.current.add(docId);
                        
                        if (!isFirstLoadRef.current) {
                            hasNewSuccess = true;
                        }
                    }
                }

                historyList.push({
                    id: docId,
                    amount: val,
                    createdAt: data.createdAt || new Date().toISOString(),
                    status: status,
                    bankName: data.bankName || "Chuyển khoản Ngân hàng",
                    bankAccount: data.bankAccount || "",
                    transactionId: data.transactionId || docId,
                });
            });

            historyList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setTopupHistory(historyList);

            if (isFirstLoadRef.current) {
                isFirstLoadRef.current = false;
            } else if (hasNewSuccess) {
                setShowPayModal(false); // Đóng modal VietQR
                setShowSuccessToast(true); // Mở Modal thông báo xịn mịn
            }

            setPaidAmount(totalPaid);
        }, (error) => {
            console.error("❌ Lỗi lắng nghe topup_requests:", error);
        });

        return () => unsubscribe();
    }, [profile?.uid]);

    // Lắng nghe trạng thái khóa/mở khóa từ Database
    useEffect(() => {
        if (!profile?.uid) return;

        const shipperRef = doc(db, "shippers", profile.uid);
        const unsubscribe = onSnapshot(shipperRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.status === "BLOCKED" || data.isLocked === true) {
                    setIsBlocked(true);
                    setBlockReason(data.blockReason || data.lockReason || "Tài khoản bị khóa bởi Quản trị viên.");
                    setLocalOnline(false);
                } else {
                    setIsBlocked(false);
                    setBlockReason("");
                }
            }
        });

        return () => unsubscribe();
    }, [profile?.uid]);

    useEffect(() => {
        if (profile) {
            setLocalOnline(Boolean((profile as any)?.isOnline));
            setStats((prev) => ({
                ...prev,
                rating: Number((profile as any)?.rating) || 5.0,
            }));
        }
    }, [profile]);

    // Tính toán Công nợ & Đơn hàng
    useEffect(() => {
        if (!profile?.uid) return;

        const ordersRef = collection(db, "orders");
        const q = query(ordersRef, where("shipperId", "==", profile.uid));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            let netEarnings = 0;       
            let completedCount = 0;    
            let totalCod = 0;          
            let platformFeeTotal = 0;  

            const now = new Date();
            let startDate = new Date();
            if (filterType === "today") startDate.setHours(0, 0, 0, 0); 
            else if (filterType === "month") startDate = new Date(now.getFullYear(), now.getMonth(), 1); 
            else if (filterType === "year") startDate = new Date(now.getFullYear(), 0, 1); 

            const dailyMap: { [key: string]: { cod: number; net: number; dateObj: Date } } = {};

            snapshot.docs.forEach((docSnap) => {
                const data = docSnap.data();
                const status = String(data.status || "").toLowerCase().trim();

                let completedDate: Date = new Date();
                if (data.completedAt?.toDate) completedDate = data.completedAt.toDate();
                else if (data.completedAt) completedDate = new Date(data.completedAt);

                const isMatchFilter = completedDate >= startDate;

                if (["completed", "done", "success"].includes(status)) {
                    const year = completedDate.getFullYear();
                    const month = String(completedDate.getMonth() + 1).padStart(2, "0");
                    const day = String(completedDate.getDate()).padStart(2, "0");
                    const dateKey = `${year}-${month}-${day}`;

                    if (!dailyMap[dateKey]) {
                        dailyMap[dateKey] = { cod: 0, net: 0, dateObj: completedDate };
                    }

                    const grossShippingFee = Number(data.shippingFee || data.shipFee || 0);
                    const paymentMethod = String(data.paymentMethod || "").toLowerCase();
                    const isCod = paymentMethod === "cod" || paymentMethod === "cash_on_delivery" || paymentMethod === "tien_mat";
                    const goodsAmount = Number(data.totalPrice || data.totalAmount || 0);
                    
                    const orderTotal = isCod ? goodsAmount : grossShippingFee;

                    dailyMap[dateKey].net += 0;
                    dailyMap[dateKey].cod += orderTotal;

                    if (isMatchFilter) {
                        completedCount += 1;
                        platformFeeTotal += grossShippingFee;
                        totalCod += orderTotal;
                    }
                }
            });

            const finalAmountToReturn = Math.max(0, totalCod - paidAmount);

            setStats((prev) => ({
                ...prev,
                todayEarnings: netEarnings,
                completedOrders: completedCount,
                totalCodCollected: totalCod,
                totalPlatformFee: platformFeeTotal,
                totalPaidToPlatform: paidAmount,
                amountToReturn: finalAmountToReturn,
            }));

            // Phân bổ nộp tiền theo ngày
            const sortedDateKeys = Object.keys(dailyMap).sort((a, b) => (a > b ? 1 : -1));
            let remainingPaidPool = paidAmount;
            const dailyStatusMap: { [key: string]: { isPaid: boolean; remainingDebt: number } } = {};

            sortedDateKeys.forEach((key) => {
                const dayData = dailyMap[key];
                const dayToReturn = Math.max(0, dayData.cod);

                if (dayToReturn <= 0 || remainingPaidPool >= dayToReturn) {
                    dailyStatusMap[key] = { isPaid: true, remainingDebt: 0 };
                    if (dayToReturn > 0) remainingPaidPool -= dayToReturn;
                } else {
                    dailyStatusMap[key] = { isPaid: false, remainingDebt: dayToReturn - remainingPaidPool };
                    remainingPaidPool = 0;
                }
            });

            const displayKeys = Object.keys(dailyMap).sort((a, b) => (a < b ? 1 : -1));
            const dailyList: DailyStat[] = displayKeys.map((key) => {
                const dayData = dailyMap[key];
                const d = dayData.dateObj;
                const statusInfo = dailyStatusMap[key] || { isPaid: true, remainingDebt: 0 };

                return {
                    dateStr: key,
                    displayDate: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`,
                    totalCod: dayData.cod,
                    netEarnings: dayData.net,
                    amountToReturn: statusInfo.remainingDebt,
                    isPaid: statusInfo.isPaid,
                };
            });

            setDailyStats(dailyList);

            if (finalAmountToReturn >= MAX_DEBT_LIMIT) {
                setIsBlocked(true);
                setBlockReason(`Giữ số tiền quá ${MAX_DEBT_LIMIT.toLocaleString("vi-VN")}đ (${finalAmountToReturn.toLocaleString("vi-VN")}đ)`);
                setLocalOnline(false);
            }
        });

        return () => unsubscribe();
    }, [profile?.uid, filterType, paidAmount]);

    const handleToggleOnline = async () => {
        if (!profile?.uid) return;

        if (!localOnline && isBlocked) {
            alert(`⛔ Tài khoản tạm bị khóa do: ${blockReason}. Vui lòng nộp tiền để tiếp tục.`);
            if (stats.amountToReturn > 0) handleOpenPayModal(stats.amountToReturn);
            return;
        }

        const nextState = !localOnline;
        setLocalOnline(nextState);

        try {
            await updateDoc(doc(db, "shippers", profile.uid), { isOnline: nextState });
        } catch (e) {
            console.error(e);
        }
    };

    const handleOpenPayModal = (amount: number) => {
        setSelectedPayAmount(amount);
        setShowPayModal(true);
    };

    const copyToClipboard = (text: string, field: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const driverUid = profile?.uid || "DRIVER";
    const memoText = `NOP ${driverUid}`;
    const qrUrl = `https://api.vietqr.io/image/TPB-86666868999-compact2.png?amount=${selectedPayAmount}&addInfo=${encodeURIComponent(memoText)}&accountName=NGUYEN%20DINH%20ANH`;

    const debtRatio = Math.min(100, Math.round((stats.amountToReturn / MAX_DEBT_LIMIT) * 100));

    if (loading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[70vh] bg-slate-50">
                <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-600 rounded-full animate-spin" />
                <p className="mt-3 text-xs font-semibold text-slate-500">Đang tải dữ liệu...</p>
            </div>
        );
    }

    return (
        <div className="flex-1 bg-slate-50 min-h-screen pb-28 max-w-md mx-auto font-sans text-slate-800 shadow-xl relative">
            {/* HEADER */}
            <div className="bg-white/90 backdrop-blur-md px-4 py-3 sticky top-0 z-30 border-b border-slate-100 shadow-xs">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <img
                                src={profile?.avatarUrl || "https://api.dicebear.com/7.x/avataaars/svg?seed=driver"}
                                alt="Avatar"
                                className="w-11 h-11 rounded-full object-cover ring-2 ring-emerald-500/30 shadow-xs"
                            />
                            <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full ring-2 ring-white ${isBlocked ? "bg-rose-500" : localOnline ? "bg-emerald-500" : "bg-slate-400"}`} />
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5">
                                <h1 className="text-sm font-black text-slate-900 leading-tight">
                                    {profile?.fullName || "Tài xế"}
                                </h1>
                                <span className="bg-amber-50 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-amber-200/80">
                                    ★ {stats.rating.toFixed(1)}
                                </span>
                            </div>
                            <p className="text-[11px] font-medium text-slate-500 mt-0.5 flex items-center gap-1">
                                {isBlocked ? "🔴 Tài khoản bị khóa" : localOnline ? "🟢 Đang trực tuyến" : "⚪ Đang ngoại tuyến"}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={handleToggleOnline}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-95 cursor-pointer ${
                            isBlocked 
                                ? "bg-rose-50 text-rose-700 border border-rose-200" 
                                : localOnline 
                                ? "bg-emerald-600 text-white shadow-emerald-200 shadow-md" 
                                : "bg-slate-800 text-white"
                        }`}
                    >
                        <span className={`w-2 h-2 rounded-full ${isBlocked ? "bg-rose-500 animate-ping" : localOnline ? "bg-emerald-300 animate-pulse" : "bg-slate-400"}`} />
                        {isBlocked ? "Bị Khóa" : localOnline ? "Tắt Trực" : "Bật Trực"}
                    </button>
                </div>

                {/* TAB SWITCHER */}
                <div className="mt-3 bg-slate-100 p-1 rounded-xl flex text-xs font-bold">
                    <button
                        onClick={() => setActiveTab("overview")}
                        className={`flex-1 py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                            activeTab === "overview" ? "bg-white text-emerald-700 shadow-xs font-extrabold" : "text-slate-500 hover:text-slate-800"
                        }`}
                    >
                        📊 Tổng Quan
                    </button>
                    <button
                        onClick={() => setActiveTab("history")}
                        className={`flex-1 py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                            activeTab === "history" ? "bg-white text-emerald-700 shadow-xs font-extrabold" : "text-slate-500 hover:text-slate-800"
                        }`}
                    >
                        💳 Lịch Sử Nộp Tiền ({topupHistory.length})
                    </button>
                </div>
            </div>

            <div className="p-4 space-y-4">
                {/* THÔNG BÁO KHÓA TÀI KHOẢN */}
                {isBlocked && (
                    <div className="bg-rose-50 border-l-4 border-rose-500 rounded-r-2xl p-3.5 shadow-xs space-y-1 text-rose-900">
                        <div className="flex items-center gap-2">
                            <span className="text-lg">⛔</span>
                            <h3 className="font-extrabold text-xs uppercase text-rose-700">Tài Khoản Đang Bị Tạm Khóa</h3>
                        </div>
                        <p className="text-xs text-rose-600 leading-relaxed">
                            <strong>Lý do:</strong> {blockReason}
                        </p>
                    </div>
                )}

                {/* CONTENT TAB 1: TỔNG QUAN */}
                {activeTab === "overview" && (
                    <>
                        {/* BỘ LỌC THỜI GIAN */}
                        <div className="bg-white border border-slate-200/60 p-1 rounded-xl flex text-xs font-semibold text-slate-500 shadow-2xs">
                            {(["today", "month", "year"] as FilterType[]).map((type) => (
                                <button
                                    key={type}
                                    onClick={() => setFilterType(type)}
                                    className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                                        filterType === type ? "bg-emerald-50 text-emerald-700 font-extrabold" : ""
                                    }`}
                                >
                                    {type === "today" ? "Hôm nay" : type === "month" ? "Tháng này" : "Năm nay"}
                                </button>
                            ))}
                        </div>

                        <StatCards todayEarnings={stats.todayEarnings} completedOrders={stats.completedOrders} rating={stats.rating} />

                        {/* THẺ CÔNG NỢ VÀ HẠN MỨC */}
                        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg font-bold">
                                        🏦
                                    </div>
                                    <div>
                                        <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">Công Nợ Thu Hộ COD</h3>
                                        <p className="text-[10px] text-slate-400">Hạn mức nợ tối đa: 2.000.000đ</p>
                                    </div>
                                </div>
                            </div>

                            {/* CARD HIỂN THỊ SỐ TIỀN */}
                            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4.5 rounded-2xl space-y-3 shadow-md relative overflow-hidden">
                                <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
                                
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Tiền đang giữ (COD):</p>
                                        <p className={`text-2xl font-black mt-1 ${
                                            stats.amountToReturn >= MAX_DEBT_LIMIT 
                                                ? "text-rose-400 animate-pulse" 
                                                : stats.amountToReturn >= WARNING_LIMIT 
                                                ? "text-amber-400" 
                                                : "text-emerald-400"
                                        }`}>
                                            {stats.amountToReturn.toLocaleString("vi-VN")} <span className="text-xs font-semibold text-slate-300">đ</span>
                                        </p>
                                    </div>
                                    <span className="text-3xl">💰</span>
                                </div>

                                {/* BAR TIẾN TRÌNH HẠN MỨC */}
                                <div className="space-y-1 pt-1">
                                    <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                                        <span>Đã dùng {debtRatio}% hạn mức</span>
                                        <span>2.000.000đ</span>
                                    </div>
                                    <div className="w-full h-2 bg-slate-700/80 rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full transition-all duration-500 rounded-full ${
                                                debtRatio >= 100 ? "bg-rose-500" : debtRatio >= 75 ? "bg-amber-400" : "bg-emerald-400"
                                            }`}
                                            style={{ width: `${debtRatio}%` }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {stats.amountToReturn > 0 && (
                                <button
                                    onClick={() => handleOpenPayModal(stats.amountToReturn)}
                                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-extrabold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                                >
                                    <span>📱</span> Nộp Tiền Tự Động Qua VietQR
                                </button>
                            )}
                        </div>

                        {/* DANH SÁCH DOANH THU THEO NGÀY */}
                        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
                            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide border-b border-slate-100 pb-2">
                                Chi Tiết Tiền Giữ Theo Ngày
                            </h3>
                            
                            {dailyStats.length === 0 ? (
                                <p className="text-xs text-slate-400 text-center py-4">Chưa có dữ liệu đơn hàng</p>
                            ) : (
                                <div className="space-y-2">
                                    {dailyStats.map((item) => (
                                        <div key={item.dateStr} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                                            <div>
                                                <p className="font-extrabold text-slate-700">{item.displayDate}</p>
                                                <p className="text-[10px] text-slate-400 mt-0.5">Tổng COD: {item.totalCod.toLocaleString("vi-VN")}đ</p>
                                            </div>
                                            <div className="text-right">
                                                <p className={`font-bold ${item.isPaid ? "text-emerald-600" : "text-rose-600"}`}>
                                                    {item.isPaid ? "Đã đối soát" : `Còn nợ: ${item.amountToReturn.toLocaleString("vi-VN")}đ`}
                                                </p>
                                                <span className={`inline-block text-[9px] font-extrabold px-1.5 py-0.2 rounded mt-0.5 ${
                                                    item.isPaid ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                                                }`}>
                                                    {item.isPaid ? "HOÀN TẤT" : "CHƯA NỘP"}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* CONTENT TAB 2: LỊCH SỬ NỘP TIỀN */}
                {activeTab === "history" && (
                    <div className="space-y-3">
                        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                                    Lịch Sử Chuyển Tiền ({topupHistory.length})
                                </h3>
                                <span className="text-[10px] text-slate-400">Cập nhật realtime</span>
                            </div>

                            {topupHistory.length === 0 ? (
                                <div className="text-center py-8 space-y-2">
                                    <span className="text-3xl">📥</span>
                                    <p className="text-xs font-semibold text-slate-500">Chưa có giao dịch chuyển tiền nào</p>
                                    <p className="text-[10px] text-slate-400">Các giao dịch VietQR thành công sẽ hiển thị tại đây.</p>
                                </div>
                            ) : (
                                <div className="space-y-2.5">
                                    {topupHistory.map((item) => {
                                        const isSuccess = ["COMPLETED", "SUCCESS", "APPROVED"].includes(item.status);
                                        const formattedDate = new Date(item.createdAt).toLocaleString("vi-VN", {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                            day: "2-digit",
                                            month: "2-digit",
                                            year: "numeric"
                                        });

                                        return (
                                            <div key={item.id} className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/60 space-y-2">
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <span className={`inline-block text-[9px] font-black px-2 py-0.5 rounded-full ${
                                                            isSuccess ? "bg-emerald-100 text-emerald-800 border border-emerald-200" : "bg-amber-100 text-amber-800 border border-amber-200"
                                                        }`}>
                                                            {isSuccess ? "✓ THÀNH CÔNG" : "⏳ ĐANG XỬ LÝ"}
                                                        </span>
                                                        <p className="text-[10px] font-mono text-slate-400 mt-1">Mã GD: {item.transactionId}</p>
                                                    </div>
                                                    <p className="text-sm font-black text-emerald-600">
                                                        +{item.amount.toLocaleString("vi-VN")} đ
                                                    </p>
                                                </div>

                                                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/40">
                                                    <span className="font-medium">{item.bankName}</span>
                                                    <span>{formattedDate}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* MODAL VIETQR TỰ ĐỘNG - CẢI TIẾN THÔNG BÁO VÀ UI/UX */}
                {showPayModal && (
                    <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
                        <div className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl text-center border border-slate-100 relative animate-in slide-in-from-bottom duration-200">
                            
                            {/* Header */}
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">Quét Mã VietQR Chuyển Tiền</h3>
                                </div>
                                <button onClick={() => setShowPayModal(false)} className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold text-xs cursor-pointer">✕</button>
                            </div>

                            {/* Khung số tiền */}
                            <div className="bg-emerald-50/70 p-3 rounded-2xl border border-emerald-100/80">
                                <p className="text-[11px] text-slate-500 font-medium">Số tiền nộp công nợ:</p>
                                <div className="flex items-center justify-center gap-2 mt-0.5">
                                    <p className="text-2xl font-black text-emerald-700">
                                        {selectedPayAmount.toLocaleString("vi-VN")} <span className="text-xs font-bold text-slate-500">đ</span>
                                    </p>
                                    <button 
                                        onClick={() => copyToClipboard(selectedPayAmount.toString(), "amount")} 
                                        className="text-[10px] font-bold bg-white border border-slate-200 text-slate-700 px-2 py-1 rounded-lg active:scale-95 transition-all cursor-pointer shadow-2xs"
                                    >
                                        {copiedField === "amount" ? "✓ Đã chép" : "Sao chép"}
                                    </button>
                                </div>
                            </div>

                            {/* Hình ảnh QR Code */}
                            <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-inner inline-block relative">
                                <img src={qrUrl} alt="VietQR" className="w-full max-w-[190px] mx-auto rounded-xl" />
                            </div>

                            {/* Cú pháp nội dung */}
                            <div className="text-[11px] bg-slate-900 text-white p-3 rounded-2xl text-left space-y-1.5 shadow-md">
                                <p className="font-semibold text-slate-300 text-[10px] uppercase tracking-wider">Cú pháp chuyển khoản (Tự động điền khi quét QR):</p>
                                <div className="flex items-center justify-between bg-slate-800 p-2 rounded-xl border border-slate-700">
                                    <span className="font-mono text-sm font-black text-emerald-400">{memoText}</span>
                                    <button 
                                        onClick={() => copyToClipboard(memoText, "memo")} 
                                        className="text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded-lg active:scale-95 transition-all cursor-pointer"
                                    >
                                        {copiedField === "memo" ? "✓ Đã chép" : "Sao chép"}
                                    </button>
                                </div>
                            </div>

                            {/* 🔔 THÔNG BÁO HƯỚNG DẪN MỚI */}
                            <div className="bg-amber-50 border border-amber-200/90 rounded-2xl p-3 text-left flex items-start gap-2.5">
                                <span className="text-base leading-none mt-0.5">⏳</span>
                                <p className="text-[11px] text-amber-900 leading-snug font-medium">
                                    Sau khi chuyển khoản, vui lòng <strong>đợi khoảng 5 giây</strong> để hệ thống tự động đối soát tiền COD của bạn.
                                </p>
                            </div>

                            {/* Trạng thái lắng nghe Realtime */}
                            <div className="flex items-center justify-center gap-2 pt-1">
                                <div className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                                <span className="text-[11px] font-semibold text-slate-500">Đang chờ giao dịch từ ngân hàng...</span>
                            </div>

                            <button onClick={() => setShowPayModal(false)} className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs active:scale-98 cursor-pointer">
                                Đóng Cửa Sổ
                            </button>
                        </div>
                    </div>
                )}

                {/* 🎉 MODAL THÔNG BÁO XÁC NHẬN THÀNH CÔNG (THAY THẾ ALERT BẰNG CUSTOM UI) */}
                {showSuccessToast && (
                    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                        <div className="bg-white w-full max-w-xs rounded-3xl p-6 text-center space-y-4 shadow-2xl border border-emerald-100 transform animate-in zoom-in-95 duration-200">
                            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-3xl mx-auto shadow-inner">
                                🎉
                            </div>
                            <div className="space-y-1.5">
                                <h3 className="text-base font-black text-slate-900">Thanh Toán Thành Công!</h3>
                                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                                    Hệ thống đã xác nhận giao dịch đối soát tiền COD của bạn thành công. Công nợ đã được cập nhật.
                                </p>
                            </div>
                            <button
                                onClick={() => setShowSuccessToast(false)}
                                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                            >
                                Đã Hiểu & Tiếp Tục
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}