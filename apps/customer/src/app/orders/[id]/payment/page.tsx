"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@cho-online/firebase";
import { doc, onSnapshot } from "firebase/firestore";

interface OrderData {
  paymentCode?: string;
  totalPrice: number;
  status: string;
  customerName?: string;
  pointsUsed?: number;
  userId?: string;
}

// Danh sách mở rộng các Ngân hàng tại Việt Nam (Chuẩn VietQR Code Scheme)
const POPULAR_BANKS = [
  // Big 4 & Ngân hàng lớn
  { name: "Vietcombank", code: "vcb", short: "VCB" },
  { name: "MBBank", code: "mb", short: "MB" },
  { name: "Techcombank", code: "tcb", short: "TCB" },
  { name: "VietinBank", code: "ctg", short: "CTG" },
  { name: "BIDV", code: "bidv", short: "BIDV" },
  { name: "Agribank", code: "vba", short: "VBA" },
  { name: "VPBank", code: "vpb", short: "VPB" },
  { name: "TPBank", code: "tpb", short: "TPB" },

  // Thương mại cổ phần phổ biến
  { name: "ACB", code: "acb", short: "ACB" },
  { name: "Sacombank", code: "stb", short: "STB" },
  { name: "HDBank", code: "hdb", short: "HDB" },
  { name: "VIB", code: "vib", short: "VIB" },
  { name: "MSB", code: "msb", short: "MSB" },
  { name: "OCB", code: "ocb", short: "OCB" },
  { name: "SHB", code: "shb", short: "SHB" },
  { name: "LPBank", code: "lpb", short: "LPB" },
  { name: "SeABank", code: "ssb", short: "SSB" },
  { name: "Eximbank", code: "eib", short: "EIB" },

  // Ngân hàng số & Khác
  { name: "Cake", code: "cake", short: "CAKE" },
  { name: "Timo", code: "timo", short: "TIMO" },
  { name: "Bac A Bank", code: "bab", short: "BAB" },
  { name: "PVComBank", code: "pvcb", short: "PVCB" },
  { name: "NCB", code: "ncb", short: "NCB" },
  { name: "Oceanbank", code: "oceanbank", short: "OJB" },
  { name: "Shinhan Bank", code: "shinhan", short: "SHN" },
  { name: "Woori Bank", code: "woo", short: "WOO" },
];

export default function OrderPaymentPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params?.id as string;

  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPaidSuccess, setIsPaidSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showAllBanks, setShowAllBanks] = useState(false);

  // STATE ĐIỀU KHIỂN MODAL NHẮC NHỞ
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Cấu hình tài khoản ngân hàng nhận tiền của shop/sàn
  const BANK_CODE = "TPBank";
  const ACCOUNT_NO = "86666868999";
  const ACCOUNT_NAME = "NGUYEN DINH ANH";

  useEffect(() => {
    if (!orderId) return;

    const orderRef = doc(db, "orders", orderId);
    const unsubscribe = onSnapshot(orderRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as OrderData;
        setOrder(data);

        const validPaidStatuses = ["paid", "paid_success", "completed", "processing"];
        if (data.status && data.status !== "pending_payment" && validPaidStatuses.includes(data.status.toLowerCase())) {
          setIsPaidSuccess(true);
          setTimeout(() => {
            router.push("/orders");
          }, 2500);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [orderId, router]);

  // HÀM BẤM NÚT BACK -> HIỆN MODAL HỎI Ý KIẾN
  const handleBackClick = () => {
    setShowConfirmModal(true);
  };

  // HÀM ĐỜI THỜI LỜI CẢM ƠN & CHUYỂN VỀ DANH SÁCH ĐƠN HÀNG (GIỮ NGUYÊN ĐƠN HÀNG)
  const handleGoToOrders = () => {
    setShowConfirmModal(false);
    router.push("/orders");
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  };

  const handleCopyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenBankApp = (bankCode?: string) => {
    if (!order) return;
    const transferContent = order.paymentCode || `DH${orderId.slice(-6).toUpperCase()}`;

    navigator.clipboard.writeText(transferContent);

    if (bankCode) {
      const targetUrl = `https://dl.vietqr.io/pay?app=${bankCode}&ba=${ACCOUNT_NO}@tpb&am=${order.totalPrice}&tn=${encodeURIComponent(transferContent)}`;
      window.location.href = targetUrl;
    } else {
      const defaultUrl = `https://dl.vietqr.io/pay?ba=${ACCOUNT_NO}@tpb&am=${order.totalPrice}&tn=${encodeURIComponent(transferContent)}`;
      window.location.href = defaultUrl;
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-3">
        <div className="w-9 h-9 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold text-slate-400">Đang tải mã thanh toán...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <p className="text-sm font-bold text-slate-700">Không tìm thấy đơn hàng!</p>
        <button
          onClick={() => router.push("/orders")}
          className="text-xs bg-slate-900 text-white px-4 py-2 rounded-xl font-bold cursor-pointer"
        >
          Quay lại danh sách đơn
        </button>
      </div>
    );
  }

  const transferContent = order.paymentCode || `DH${orderId.slice(-6).toUpperCase()}`;
  const qrImageUrl = `https://vietqr.app/img?bank=${BANK_CODE}&acc=${ACCOUNT_NO}&template=compact&amount=${order.totalPrice}&des=${transferContent}&holder=${encodeURIComponent(ACCOUNT_NAME)}`;

  const displayedBanks = showAllBanks ? POPULAR_BANKS : POPULAR_BANKS.slice(0, 8);

  return (
    <div className="bg-slate-50 min-h-screen text-slate-800 pb-20 font-sans relative">
      {/* HEADER */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-100 px-4 py-3 flex items-center gap-3">
        <button
          onClick={handleBackClick}
          className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition cursor-pointer"
          title="Quay lại"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-sm font-black text-slate-900">Thanh toán chuyển khoản</h1>
          <p className="text-[10px] text-slate-400 font-medium">Mở App Ngân hàng hoặc Quét QR</p>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-4">
        {isPaidSuccess ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 text-center space-y-3 animate-fade-in my-8">
            <div className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center text-3xl mx-auto shadow-lg shadow-emerald-500/30 animate-bounce">
              ✓
            </div>
            <h2 className="text-lg font-black text-emerald-900">Thanh toán thành công!</h2>
            <p className="text-xs text-emerald-700 font-medium">
              Hệ thống đã xác nhận tiền về. Đang chuyển bạn đến trang quản lý đơn hàng...
            </p>
          </div>
        ) : (
          <>
            {/* THÔNG BÁO TỪ CHỐI VÍ ĐIỆN TỬ */}
            <div className="bg-rose-50 border border-rose-200/90 rounded-2xl p-3.5 flex items-start gap-3 shadow-xs">
              <span className="text-lg leading-none">⚠️</span>
              <div className="text-xs space-y-1">
                <p className="font-extrabold text-rose-900">Lưu ý quan trọng về thanh toán:</p>
                <p className="text-rose-700 leading-relaxed font-medium text-[11px]">
                  Sàn <strong>KHÔNG hỗ trợ</strong> thanh toán qua các ví điện tử (<em>MoMo, ZaloPay, Viettel Money...</em>). Vui lòng chọn <strong>Ngân hàng bên dưới</strong> để chuyển tiền tự động.
                </p>
              </div>
            </div>

            {/* DANH SÁCH MỞ APP NGÂN HÀNG TRỰC TIẾP */}
            <div className="bg-white rounded-3xl p-4 border border-indigo-100 shadow-sm space-y-3">
              <div className="text-center">
                <span className="text-xs font-black text-indigo-950 uppercase tracking-wider block">
                  ⚡ Chọn App Ngân Hàng Để Thanh Toán
                </span>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Tự động điền số tiền & nội dung chuyển khoản
                </p>
              </div>

              {/* Lưới danh sách ngân hàng */}
              <div className="grid grid-cols-4 gap-2 pt-1">
                {displayedBanks.map((b) => (
                  <button
                    key={b.code}
                    onClick={() => handleOpenBankApp(b.code)}
                    className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-50 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-200 transition cursor-pointer active:scale-95"
                  >
                    <span className="text-xs font-black text-indigo-900 bg-indigo-100/70 px-1.5 py-0.5 rounded">
                      {b.short}
                    </span>
                    <span className="text-[10px] font-bold text-slate-700 mt-1 line-clamp-1">
                      {b.name}
                    </span>
                  </button>
                ))}
              </div>

              {/* Nút Thu gọn / Xem thêm ngân hàng */}
              <button
                onClick={() => setShowAllBanks(!showAllBanks)}
                className="w-full text-[11px] font-bold text-indigo-600 hover:text-indigo-800 py-1 transition cursor-pointer"
              >
                {showAllBanks ? "▲ Thu gọn danh sách" : `▼ Xem thêm các ngân hàng khác (${POPULAR_BANKS.length - 8})`}
              </button>

              <button
                onClick={() => handleOpenBankApp()}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-3 rounded-2xl shadow-md shadow-indigo-600/20 transition cursor-pointer flex items-center justify-center gap-2"
              >
                🚀 Mở App Ngân Hàng Khác Trên Máy
              </button>
            </div>

            {/* KHUNG HIỂN THỊ MÃ QR TÙY CHỌN */}
            <details className="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm text-center group">
              <summary className="text-xs font-bold text-slate-600 cursor-pointer list-none flex justify-between items-center">
                <span>📷 Hoặc quét Mã VietQR (Dành cho máy khác)</span>
                <span className="text-slate-400 group-open:rotate-180 transition">▼</span>
              </summary>
              <div className="pt-4 space-y-3">
                <img
                  src={qrImageUrl}
                  alt="Mã VietQR Thanh Toán"
                  className="w-56 h-auto mx-auto rounded-xl border border-slate-100"
                />
              </div>
            </details>

            {/* THÔNG TIN CHUYỂN KHOẢN TAY */}
            <div className="bg-white rounded-3xl p-4 border border-slate-100 text-xs space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">Ngân hàng nhận:</span>
                <span className="font-bold text-slate-800">{BANK_CODE}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">Chủ tài khoản:</span>
                <span className="font-bold text-slate-800">{ACCOUNT_NAME}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">Số tài khoản:</span>
                <span className="font-mono font-bold text-slate-900">{ACCOUNT_NO}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                <span className="text-slate-400 font-medium">Số tiền:</span>
                <span className="font-black text-orange-600 text-sm">{formatCurrency(order.totalPrice)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                <div>
                  <span className="text-slate-400 font-medium block">Nội dung CK:</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-black text-red-600 bg-red-50 px-2 py-1 rounded-lg border border-red-200">
                    {transferContent}
                  </span>
                  <button
                    onClick={() => handleCopyCode(transferContent)}
                    className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold px-2 py-1 rounded-lg transition cursor-pointer"
                  >
                    {copied ? "Đã chép!" : "Copy"}
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={() => router.push("/orders")}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-3 rounded-xl transition cursor-pointer"
            >
              Tôi sẽ thanh toán sau (Về danh sách đơn)
            </button>
          </>
        )}
      </main>

      {/* 💳 MODAL LƯU ĐƠN HÀNG VÀO MỤC "ĐƠN HÀNG CỦA TÔI" */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl border border-slate-100 animate-scale-up">
            {/* ICON THÔNG BÁO DỄ THƯƠNG & CHUYÊN NGHIỆP */}
            <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center text-2xl mx-auto border border-indigo-100">
              📋
            </div>

            {/* NỘI DUNG RÕ RÀNG */}
            <div className="space-y-1.5">
              <h3 className="text-base font-black text-slate-900">Lưu đơn hàng chờ thanh toán?</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Đơn hàng này sẽ được lưu ở mục <strong className="text-indigo-600">Đơn hàng của tôi</strong> với trạng thái <em>"Chờ thanh toán"</em>. Bạn có thể mở lại để thanh toán bất cứ lúc nào!
              </p>
            </div>

            {/* NÚT THAO TÁC */}
            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs py-3 rounded-xl transition cursor-pointer"
              >
                Thanh toán ngay
              </button>

              <button
                type="button"
                onClick={handleGoToOrders}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs py-3 rounded-xl transition cursor-pointer shadow-md shadow-indigo-600/20"
              >
                Về danh sách đơn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}