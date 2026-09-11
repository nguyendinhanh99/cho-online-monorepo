"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  loginWithGoogle, 
  loginWithPhoneAndPassword, 
  registerWithPhoneAndPassword 
} from "../services/auth.service";

type AuthMode = "LOGIN" | "REGISTER";

interface LoginFormProps {
  onSuccess?: () => void;
  redirectTo?: string;
}

export function LoginForm({ onSuccess, redirectTo = "/" }: LoginFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("LOGIN");

  // Form states
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setErrorMessage("");
  };

  // Xử lý sau khi Đăng nhập / Đăng ký thành công
  const handleSuccess = () => {
    if (onSuccess) {
      onSuccess();
    }
    if (redirectTo) {
      router.push(redirectTo);
      router.refresh();
    }
  };

  // Đăng nhập bằng Google
  const handleGoogleLogin = async () => {
    setErrorMessage("");
    setLoading(true);

    try {
      await loginWithGoogle();
      handleSuccess();
    } catch (error: any) {
      console.error("Google Auth Error:", error);
      // Hiển thị trực tiếp thông báo lỗi do auth.service.ts quăng ra
      setErrorMessage(error.message || "Đăng nhập bằng Gmail thất bại!");
    } finally {
      setLoading(false);
    }
  };

// Xử lý Form SĐT + Mật khẩu
const handleSubmitPhoneAuth = async (e: React.FormEvent) => {
  e.preventDefault();
  setErrorMessage("");

  if (password.length < 6) {
    setErrorMessage("Mật khẩu phải chứa ít nhất 6 ký tự!");
    return;
  }

  setLoading(true);

  try {
    if (mode === "REGISTER") {
      await registerWithPhoneAndPassword(phone, password, fullName);
    } else {
      await loginWithPhoneAndPassword(phone, password);
    }

    handleSuccess();
  } catch (error: any) {
    // auth.service.ts đã chuyển mọi lỗi thành thông báo tiếng Việt dạng Error(message)
    // Bạn chỉ cần lấy trực tiếp error.message để hiển thị lên UI
    setErrorMessage(error.message || "Đã xảy ra lỗi. Vui lòng thử lại!");
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="w-full max-w-md mx-auto bg-brand-surface rounded-3xl shadow-xl border border-stone-200/80 p-8 text-brand-text transition-all">
      {/* Header Branding */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-accent/20 text-brand-primary rounded-2xl mb-3 text-2xl border border-brand-accent/40 shadow-sm">
          🍓
        </div>
        <h2 className="text-2xl font-black text-brand-text tracking-tight font-serif">
          {mode === "LOGIN" ? "Đăng Nhập Chợ Online" : "Tạo Tài Khoản Mới"}
        </h2>
        <p className="text-xs text-brand-muted mt-1 font-medium">
          Hoa quả tươi ngon & Nước ép thiên nhiên mỗi ngày
        </p>
      </div>

      {/* Thông báo lỗi hiển thị an toàn trên UI */}
      {errorMessage && (
        <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2 animate-in fade-in">
          <span>⚠️</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* NÚT ĐĂNG NHẬP GMAIL */}
      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={loading}
        className="w-full bg-white hover:bg-stone-50 text-stone-700 font-bold py-3.5 px-4 rounded-2xl border border-stone-300 shadow-sm transition duration-200 disabled:opacity-50 flex justify-center items-center gap-3 text-sm cursor-pointer"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
        </svg>
        <span>Đăng nhập nhanh bằng Gmail</span>
      </button>

      {/* DÒNG PHÂN CÁCH */}
      <div className="relative my-6 text-center">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-stone-200"></div>
        </div>
        <span className="relative bg-brand-surface px-3 text-[11px] font-bold text-brand-muted uppercase tracking-wider">
          Hoặc dùng SĐT
        </span>
      </div>

      {/* FORM ĐĂNG NHẬP / ĐĂNG KÝ BẰNG SĐT */}
      <form onSubmit={handleSubmitPhoneAuth} className="space-y-4">
        {mode === "REGISTER" && (
          <div>
            <label className="block text-[11px] font-bold text-brand-muted uppercase tracking-wider mb-1.5">
              Họ và tên
            </label>
            <input
              type="text"
              placeholder="Nguyễn Văn A"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-3 border border-stone-200 rounded-2xl text-brand-text bg-brand-bg focus:bg-brand-surface focus:outline-none focus:ring-2 focus:ring-brand-primary transition text-sm font-medium"
              required
            />
          </div>
        )}

        <div>
          <label className="block text-[11px] font-bold text-brand-muted uppercase tracking-wider mb-1.5">
            Số điện thoại
          </label>
          <input
            type="tel"
            placeholder="0865234554"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-4 py-3 border border-stone-200 rounded-2xl text-brand-text bg-brand-bg focus:bg-brand-surface focus:outline-none focus:ring-2 focus:ring-brand-primary transition text-sm font-medium"
            required
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-brand-muted uppercase tracking-wider mb-1.5">
            Mật khẩu
          </label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 border border-stone-200 rounded-2xl text-brand-text bg-brand-bg focus:bg-brand-surface focus:outline-none focus:ring-2 focus:ring-brand-primary transition text-sm font-medium"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-primary hover:bg-brand-primary-hover active:opacity-90 text-brand-surface font-bold py-3.5 rounded-2xl shadow-lg transition duration-200 disabled:opacity-50 flex justify-center items-center gap-2 text-sm mt-2 cursor-pointer"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-brand-surface border-t-transparent rounded-full animate-spin"></span>
              <span>Đang xử lý...</span>
            </>
          ) : (
            <span>{mode === "LOGIN" ? "Đăng Nhập SĐT" : "Tạo Tài Khoản"}</span>
          )}
        </button>
      </form>

      {/* Switcher Chế Độ */}
      <div className="mt-6 pt-5 border-t border-stone-100 text-center text-xs text-brand-muted">
        {mode === "LOGIN" ? (
          <div>
            Bạn chưa có tài khoản?{" "}
            <button
              type="button"
              onClick={() => switchMode("REGISTER")}
              className="text-brand-accent font-bold hover:underline cursor-pointer"
            >
              Đăng ký ngay
            </button>
          </div>
        ) : (
          <div>
            Đã có tài khoản?{" "}
            <button
              type="button"
              onClick={() => switchMode("LOGIN")}
              className="text-brand-accent font-bold hover:underline cursor-pointer"
            >
              Đăng nhập ngay
            </button>
          </div>
        )}
      </div>
    </div>
  );
}