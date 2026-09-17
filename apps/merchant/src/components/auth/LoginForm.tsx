"use client";

import { useState } from "react";
import { signInWithPopup, signInWithEmailAndPassword } from "firebase/auth";
import { auth, googleProvider } from "@/services/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginForm() {
  const router = useRouter();
  const [authMethod, setAuthMethod] = useState<"phone" | "google">("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);

  // 1. Đăng nhập bằng Google
  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError("");
      await signInWithPopup(auth, googleProvider);
      router.push("/");
    } catch (err: any) {
      setError("Đăng nhập Google không thành công. Vui lòng thử lại!");
    } finally {
      setLoading(false);
    }
  };

  // 2. Đăng nhập bằng SĐT (Chặn triệt để màn hình báo lỗi Next.js Overlay)
  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim() || !password) {
      setError("Vui lòng nhập đầy đủ Số điện thoại và Mật khẩu!");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const cleanPhone = phoneNumber.trim().replace(/\s+/g, "").replace(/-/g, "");
      const formattedEmail = `${cleanPhone}@shopmerchant.com`;

      await signInWithEmailAndPassword(auth, formattedEmail, password);
      router.push("/");
    } catch (err: any) {
      // LẤY MÃ LỖI ĐỂ XỬ LÝ (Không dùng console.error để tránh bật Overlay đỏ)
      const errorCode = err?.code || "";

      switch (errorCode) {
        case "auth/invalid-credential":
        case "auth/user-not-found":
        case "auth/wrong-password":
        case "auth/invalid-email":
          setError("Số điện thoại hoặc mật khẩu không chính xác!");
          break;
        case "auth/too-many-requests":
          setError("Tài khoản tạm khóa do thử sai quá nhiều lần. Vui lòng thử lại sau!");
          break;
        default:
          setError("Tài khoản chưa tồn tại hoặc sai thông tin đăng nhập!");
          break;
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-stone-200/80 overflow-hidden">
        
        {/* Header */}
        <div className="bg-gradient-to-br from-[#ee4d2d] via-[#f05d3e] to-[#e03c1b] px-6 py-7 text-white text-center relative overflow-hidden">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 mb-3 shadow-inner">
            <span className="text-2xl">🏪</span>
          </div>
          <h1 className="font-extrabold text-xl tracking-tight">Kênh Quản Lý Cửa Hàng</h1>
          <p className="text-xs text-orange-100 font-medium mt-1">
            Đăng nhập để điều hành & xử lý đơn hàng
          </p>
        </div>

        {/* Thân Form */}
        <div className="p-6 sm:p-8 space-y-5">
          
          {/* Thông báo lỗi UI/UX Chuyên nghiệp */}
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3.5 rounded-2xl flex items-center gap-3 shadow-xs animate-shake">
              <span className="text-lg shrink-0">⚠️</span>
              <span className="font-semibold leading-relaxed">{error}</span>
            </div>
          )}

          {/* Tab Chuyển Đổi */}
          <div className="bg-stone-100/80 p-1 rounded-2xl flex text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setAuthMethod("phone");
                setError("");
              }}
              className={`flex-1 py-2.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 ${
                authMethod === "phone"
                  ? "bg-white text-stone-800 shadow-sm font-extrabold"
                  : "text-stone-500 hover:text-stone-800"
              }`}
            >
              <span>📱</span> Số điện thoại
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMethod("google");
                setError("");
              }}
              className={`flex-1 py-2.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 ${
                authMethod === "google"
                  ? "bg-white text-stone-800 shadow-sm font-extrabold"
                  : "text-stone-500 hover:text-stone-800"
              }`}
            >
              <span>📧</span> Google Mail
            </button>
          </div>

          {authMethod === "phone" ? (
            <form onSubmit={handlePhoneLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-700 block">
                  Số điện thoại đăng ký
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-sm">
                    📞
                  </span>
                  <input
                    type="tel"
                    placeholder="0912 345 678"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full bg-stone-50/50 border border-stone-200 rounded-xl pl-10 pr-4 py-3 text-xs text-stone-800 font-medium outline-none focus:bg-white focus:border-[#ee4d2d] focus:ring-2 focus:ring-[#ee4d2d]/20 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-stone-700 block">
                    Mật khẩu
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsSupportModalOpen(true)}
                    className="text-[11px] text-[#ee4d2d] font-bold hover:underline cursor-pointer"
                  >
                    Quên mật khẩu?
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-sm">
                    🔒
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-stone-50/50 border border-stone-200 rounded-xl pl-10 pr-11 py-3 text-xs text-stone-800 font-medium outline-none focus:bg-white focus:border-[#ee4d2d] focus:ring-2 focus:ring-[#ee4d2d]/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-600 cursor-pointer"
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.52 10.52 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12c1.274 4.057 5.065 7 9.542 7 4.477 0 8.268-2.943 9.542-7-1.274-4.057-5.065-7-9.542-7-4.477 0-8.268 2.943-9.542 7z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#ee4d2d] to-[#e03c1b] hover:from-[#e03c1b] hover:to-[#c83214] text-white font-extrabold py-3.5 rounded-xl text-xs transition-all duration-200 active:scale-[0.98] shadow-md shadow-orange-500/20 disabled:opacity-60 flex items-center justify-center gap-2 mt-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Đang đăng nhập...
                  </>
                ) : (
                  "Đăng Nhập Ngay"
                )}
              </button>
            </form>
          ) : (
            <div className="py-3 space-y-4 text-center">
              <p className="text-xs text-stone-500">
                Đăng nhập nhanh bằng tài khoản Google đã liên kết.
              </p>
              <button
                type="button"
                disabled={loading}
                onClick={handleGoogleLogin}
                className="w-full bg-white border border-stone-200 rounded-xl p-3.5 flex items-center justify-center gap-3 text-xs font-bold text-stone-700 hover:bg-stone-50 active:scale-[0.98] transition-all shadow-xs cursor-pointer"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-[#ee4d2d] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <img
                    src="https://www.svgrepo.com/show/475656/google-color.svg"
                    className="w-5 h-5 shrink-0"
                    alt="Google"
                  />
                )}
                <span>{loading ? "Đang xử lý..." : "Tiếp tục với Google"}</span>
              </button>
            </div>
          )}

          <div className="pt-3 border-t border-stone-100 text-center text-xs text-stone-500">
            Chưa có tài khoản cửa hàng?{" "}
            <Link
              href="/register-kyc"
              className="text-[#ee4d2d] font-bold hover:underline ml-0.5"
            >
              Đăng ký ngay
            </Link>
          </div>
        </div>
      </div>

      {/* Modal Hỗ trợ Quên Mật Khẩu */}
      {isSupportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-stone-100 space-y-5 text-center relative">
            <button
              type="button"
              onClick={() => setIsSupportModalOpen(false)}
              className="absolute top-4 right-4 text-stone-400 hover:text-stone-600 w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-sm font-bold cursor-pointer"
            >
              ✕
            </button>
            <div className="w-14 h-14 bg-orange-100 text-[#ee4d2d] rounded-2xl flex items-center justify-center mx-auto text-2xl">
              🛠️
            </div>
            <div className="space-y-2">
              <h3 className="font-extrabold text-stone-800 text-base">Khôi phục Mật khẩu</h3>
              <p className="text-xs text-stone-500 leading-relaxed px-2">
                Liên hệ Bộ phận Kỹ thuật / CSKH để nhận trợ giúp cấp lại mật khẩu cho cửa hàng của bạn.
              </p>
            </div>
            <div className="space-y-2.5 pt-1">
              <a
                href="tel:19001234"
                className="w-full bg-[#ee4d2d] hover:bg-[#e03c1b] text-white text-xs font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm"
              >
                <span>📞</span> Gọi Hotline (1900 1234)
              </a>
              <button
                type="button"
                onClick={() => setIsSupportModalOpen(false)}
                className="w-full bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold py-3 rounded-xl transition-all cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}