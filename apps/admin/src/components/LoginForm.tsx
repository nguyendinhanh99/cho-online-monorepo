"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { LoginFormData } from "@/types/user";

export function LoginForm() {
  const router = useRouter();
  const [formData, setFormData] = useState<LoginFormData>({
    phone: "",
    idCardNumber: "",
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setError(null);

    const cleanPhone = formData.phone.trim().replace(/\s+/g, "");
    const cleanIdCard = formData.idCardNumber.trim().replace(/\s+/g, "");

    // Validations cơ bản
    if (cleanPhone.length < 9 || cleanPhone.length > 11) {
      setError("Số điện thoại không hợp lệ (cần từ 9 - 11 chữ số)!");
      return;
    }

    if (cleanIdCard.length !== 12) {
      setError(`Số CCCD phải đủ 12 chữ số (Hiện tại: ${cleanIdCard.length} số)!`);
      return;
    }

    setLoading(true);

    try {
      const virtualEmail = `${cleanPhone}.${cleanIdCard}@system.local`;

      // 1. Đăng nhập Firebase
      const userCredential = await signInWithEmailAndPassword(
        auth,
        virtualEmail,
        formData.password
      );

      // 2. Kiểm tra thông tin & quyền hạn trong Firestore
      const userDocRef = doc(db, "users", userCredential.user.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        setError("Không tìm thấy dữ liệu người dùng trên hệ thống!");
        setLoading(false);
        return;
      }

      const userData = userDoc.data();
      const allowedRoles = ["ADMIN", "OPERATOR", "SUPPORT"];

      if (!allowedRoles.includes(userData.role)) {
        setError("Tài khoản không có quyền truy cập trang Quản trị!");
        setLoading(false);
        return;
      }

      if (userData.status === "BLOCKED") {
        setError("Tài khoản của bạn hiện đang bị KHÓA!");
        setLoading(false);
        return;
      }
      
      // 3. Đăng nhập thành công -> Chuyển hướng sang Dashboard
      window.location.href = "/dashboard";
      
    } catch (err: any) {
      const errorCode = err?.code || "";

      if (
        errorCode === "auth/invalid-credential" ||
        errorCode === "auth/wrong-password" ||
        errorCode === "auth/user-not-found"
      ) {
        setError("Sai Số Điện Thoại, CCCD hoặc Mật Khẩu. Vui lòng kiểm tra lại!");
      } else if (errorCode === "auth/invalid-email") {
        setError("Định dạng Virtual Email không hợp lệ!");
      } else if (errorCode === "auth/too-many-requests") {
        setError("Bạn đã nhập sai quá nhiều lần. Hãy thử lại sau vài phút!");
      } else {
        setError(`Lỗi xác thực: ${err.message || "Vui lòng thử lại sau!"}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 font-sans text-xs">
      {error && (
        <div className="animate-in fade-in zoom-in-95 duration-200 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl p-3.5 flex items-start gap-3 shadow-sm">
          <div className="bg-rose-100 p-1.5 rounded-xl text-rose-600 shrink-0 mt-0.5 font-bold">
            ⚠️
          </div>
          <div className="flex-1">
            <h4 className="font-extrabold text-rose-800 text-xs tracking-tight">
              Xác thực không thành công
            </h4>
            <p className="text-rose-600 font-medium text-[11px] leading-relaxed mt-0.5">
              {error}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-rose-400 hover:text-rose-700 transition font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* SỐ ĐIỆN THOẠI */}
      <div>
        <label className="font-bold text-slate-700 block mb-1.5 text-xs">
          Số Điện Thoại
        </label>
        <input
          type="tel"
          required
          maxLength={11}
          placeholder="0987654321"
          value={formData.phone}
          onChange={(e) =>
            setFormData({
              ...formData,
              phone: e.target.value.replace(/\D/g, ""),
            })
          }
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 focus:outline-none focus:border-indigo-600 focus:bg-white font-semibold text-slate-900 transition placeholder:text-slate-400 shadow-sm"
        />
      </div>

      {/* SỐ CĂN CƯỚC CÔNG DÂN */}
      <div>
        <div className="flex justify-between items-center mb-1.5">
          <label className="font-bold text-slate-700 block text-xs">
            Số Căn Cước Công Dân (12 số)
          </label>
          <span
            className={`text-[11px] font-bold ${
              formData.idCardNumber.trim().length === 12
                ? "text-emerald-600"
                : "text-amber-600"
            }`}
          >
            {formData.idCardNumber.trim().length}/12 số
          </span>
        </div>
        <input
          type="text"
          required
          maxLength={12}
          placeholder="012345678901"
          value={formData.idCardNumber}
          onChange={(e) =>
            setFormData({
              ...formData,
              idCardNumber: e.target.value.replace(/\D/g, ""),
            })
          }
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 focus:outline-none focus:border-indigo-600 focus:bg-white font-mono font-semibold text-slate-900 transition placeholder:text-slate-400 shadow-sm"
        />
      </div>

      {/* MẬT KHẨU CÓ AN/HIỆN PASS */}
      <div>
        <label className="font-bold text-slate-700 block mb-1.5 text-xs">
          Mật khẩu
        </label>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            required
            placeholder="••••••••"
            value={formData.password}
            onChange={(e) =>
              setFormData({ ...formData, password: e.target.value })
            }
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-3.5 pr-10 py-3 focus:outline-none focus:border-indigo-600 focus:bg-white font-semibold text-slate-900 transition placeholder:text-slate-400 shadow-sm"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition p-1 cursor-pointer"
            title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          >
            {showPassword ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a10.025 10.025 0 0110.123 3.937C20.268 11.057 16.478 14 12 14c-.818 0-1.613-.102-2.372-.293M3 3l18 18" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943-9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* NÚT SUBMIT */}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3.5 rounded-2xl transition active:scale-[0.98] cursor-pointer mt-3 shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed text-xs"
      >
        {loading ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>ĐANG XÁC THỰC...</span>
          </>
        ) : (
          "ĐĂNG NHẬP HỆ THỐNG"
        )}
      </button>
    </form>
  );
}