"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export default function ShipperLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);

  // State quản lý Modal thông báo UI custom
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: "PENDING" | "REJECTED" | "ERROR";
    title: string;
    message: string;
  }>({
    isOpen: false,
    type: "PENDING",
    title: "",
    message: "",
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const formattedPhone = phone.trim();
      const virtualEmail = `${formattedPhone}@shipper.choonline.vn`;

      // 1. Đăng nhập với Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, virtualEmail, password);
      const uid = userCredential.user.uid;

      // 2. Lấy thông tin hồ sơ trong Firestore
      const shipperDoc = await getDoc(doc(db, "shippers", uid));

      if (!shipperDoc.exists()) {
        setModalState({
          isOpen: true,
          type: "ERROR",
          title: "Không tìm thấy tài khoản",
          message: "Số điện thoại này chưa được đăng ký làm đối tác tài xế.",
        });
        setIsLoading(false);
        return;
      }

      const shipperData = shipperDoc.data();

      // Trường hợp 1: Đang chờ duyệt
      if (shipperData.status === "PENDING_APPROVAL") {
        setModalState({
          isOpen: true,
          type: "PENDING",
          title: "Hồ sơ đang chờ phê duyệt",
          message: "Hồ sơ tài xế của bạn đang được Ban Quản Trị hệ thống kiểm tra và xét duyệt.",
        });
        setIsLoading(false);
        return;
      }

      // Trường hợp 2: Bị từ chối
      if (shipperData.status === "REJECTED") {
        setModalState({
          isOpen: true,
          type: "REJECTED",
          title: "Hồ sơ không được duyệt",
          message: "Hồ sơ của bạn không đủ điều kiện xét duyệt. Vui lòng liên hệ bộ phận hỗ trợ.",
        });
        setIsLoading(false);
        return;
      }

      // Trường hợp 3: Đã duyệt thành công
      if (shipperData.status === "APPROVED") {
        localStorage.setItem("shipper_token", uid);
        router.push("/");
      }
    } catch (error: any) {
      setIsLoading(false);
      console.warn("Lỗi đăng nhập Firebase:", error.code || error.message);

      // Bắt các mã lỗi phổ biến của Firebase Authentication để tránh văng Dev Overlay
      let errorMessage = "Số điện thoại hoặc mật khẩu không chính xác. Vui lòng thử lại!";
      
      if (
        error.code === "auth/invalid-credential" ||
        error.code === "auth/user-not-found" ||
        error.code === "auth/wrong-password"
      ) {
        errorMessage = "Số điện thoại hoặc mật khẩu không đúng!";
      } else if (error.code === "auth/too-many-requests") {
        errorMessage = "Tài khoản tạm thời bị khóa do đăng nhập sai quá nhiều lần. Vui lòng thử lại sau!";
      }

      setModalState({
        isOpen: true,
        type: "ERROR",
        title: "Đăng nhập thất bại",
        message: errorMessage,
      });
    }
  };

  return (
    <main className="min-h-screen bg-stone-100 flex items-center justify-center p-4 font-sans relative overflow-hidden">
      {/* Background Decor Elements */}
      <div className="absolute -top-24 -left-24 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm bg-white/90 backdrop-blur-md rounded-3xl border border-stone-200/80 shadow-xl p-6 sm:p-8 space-y-6 relative z-10">
        
        {/* Header Branding */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-gradient-to-tr from-blue-600 to-indigo-500 text-white font-black text-3xl rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-blue-500/20 transform hover:scale-105 transition duration-300">
            🛵
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-stone-800 tracking-tight">Tài Xế Shipper</h1>
            <p className="text-xs text-stone-400 mt-1 font-medium">Đăng nhập hệ thống đối tác vận chuyển</p>
          </div>
        </div>

        {/* Form Đăng nhập */}
        <form onSubmit={handleLogin} className="space-y-4">
          {/* Số điện thoại */}
          <div>
            <label className="block text-[11px] font-bold text-stone-600 uppercase tracking-wider mb-1.5">
              Số điện thoại
            </label>
            <div className="relative">
              <input
                type="tel"
                required
                placeholder="0865234554"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-stone-50/80 border border-stone-200 rounded-xl px-3.5 py-3 text-xs text-stone-800 font-medium placeholder:text-stone-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10 transition"
              />
            </div>
          </div>

          {/* Mật khẩu & Xem mật khẩu */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold text-stone-600 uppercase tracking-wider">
                Mật khẩu
              </label>
              {/* Nút Quên mật khẩu */}
              <button
                type="button"
                onClick={() => setIsForgotPasswordOpen(true)}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:underline transition cursor-pointer"
              >
                Quên mật khẩu?
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-stone-50/80 border border-stone-200 rounded-xl pl-3.5 pr-10 py-3 text-xs text-stone-800 font-medium placeholder:text-stone-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 focus:outline-none p-1 transition cursor-pointer"
                title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPassword ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a8.98 8.98 0 013.682-.793c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m-0.469 0.469A9.993 9.993 0 0112 19c-1.18 0-2.316-.204-3.373-.581M15 12a3 3 0 11-6 0 3 3 0 016 0zM3 3l18 18" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold py-3 rounded-xl text-xs transition-all duration-200 shadow-md shadow-blue-500/20 active:scale-[0.98] cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Đang xử lý...</span>
              </>
            ) : (
              <span>ĐĂNG NHẬP NGAY</span>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="pt-3 border-t border-stone-100 text-center text-xs text-stone-500">
          Chưa có tài khoản đối tác?{" "}
          <Link href="/register" className="font-extrabold text-blue-600 hover:text-blue-700 hover:underline transition">
            Đăng ký làm Tài xế
          </Link>
        </div>
      </div>

      {/* ================= MODAL QUÊN MẬT KHẨU ================= */}
      {isForgotPasswordOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-xs bg-white rounded-3xl p-6 text-center space-y-4 shadow-2xl border border-stone-100 animate-in zoom-in-95 duration-150">
            <div className="w-14 h-14 bg-indigo-50 text-indigo-600 ring-8 ring-indigo-50/50 rounded-2xl flex items-center justify-center mx-auto text-2xl">
              🔑
            </div>

            <div className="space-y-1.5">
              <h3 className="font-extrabold text-stone-800 text-base">Khôi phục mật khẩu</h3>
              <p className="text-xs text-stone-500 leading-relaxed">
                Để bảo mật thông tin tài khoản đối tác, vui lòng liên hệ Admin để cấp lại mật khẩu mới.
              </p>
            </div>

            <div className="bg-stone-50 border border-stone-200/80 rounded-2xl p-3 text-left space-y-2">
              <p className="text-[11px] font-medium text-stone-600">
                Gửi yêu cầu kèm theo <strong className="text-stone-800">Số điện thoại đăng ký</strong> đến Admin:
              </p>
              <a
                href={`https://zalo.me/0865234554?text=${encodeURIComponent(`Xin chào Admin, tôi muốn cấp lại mật khẩu cho tài khoản Shipper SĐT: ${phone || "..."}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-3 rounded-xl transition shadow-xs active:scale-95 text-xs"
              >
                <span>💬</span> Nhắn Zalo Khôi Phục
              </a>
            </div>

            <button
              onClick={() => setIsForgotPasswordOpen(false)}
              className="w-full bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold py-2.5 rounded-xl text-xs transition cursor-pointer active:scale-95"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* ================= MODAL CUSTOM UI THÔNG BÁO ================= */}
      {modalState.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-xs bg-white rounded-3xl p-6 text-center space-y-4 shadow-2xl border border-stone-100 animate-in zoom-in-95 duration-150">
            {/* Icon theo trạng thái */}
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto text-2xl ring-8 ${
              modalState.type === "PENDING"
                ? "bg-amber-50 text-amber-500 ring-amber-50/50"
                : "bg-rose-50 text-rose-500 ring-rose-50/50"
            }`}>
              {modalState.type === "PENDING" && "⏳"}
              {modalState.type === "REJECTED" && "❌"}
              {modalState.type === "ERROR" && "⚠️"}
            </div>

            {/* Nội dung thông báo */}
            <div className="space-y-1.5">
              <h3 className="font-extrabold text-stone-800 text-base">
                {modalState.title}
              </h3>
              <p className="text-xs text-stone-500 leading-relaxed">
                {modalState.message}
              </p>
            </div>

            {/* Khung Zalo nếu là trạng thái chờ duyệt */}
            {modalState.type === "PENDING" && (
              <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-3 text-[11px] text-blue-900 space-y-2">
                <p className="font-medium text-stone-600">
                  Nếu quá <strong className="text-stone-800">24 giờ</strong> chưa được duyệt, vui lòng liên hệ trực tiếp:
                </p>
                <a
                  href="https://zalo.me/0865234554"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-xl transition shadow-xs active:scale-95"
                >
                  <span>💬</span> Liên hệ Zalo: 0865234554
                </a>
              </div>
            )}

            {/* Nút đóng */}
            <button
              onClick={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
              className="w-full bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold py-2.5 rounded-xl text-xs transition cursor-pointer active:scale-95"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </main>
  );
}