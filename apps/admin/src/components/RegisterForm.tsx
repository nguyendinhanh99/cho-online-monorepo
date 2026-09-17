"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserRole } from "@/types/user";

export function RegisterForm() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    idCardNumber: "",
    password: "",
    confirmPassword: "",
    role: "ADMIN" as UserRole,
    adminSecretKey: "",
  });
  
  // State ẩn/hiện mật khẩu
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // 1. Validate CCCD
    if (formData.idCardNumber.trim().length !== 12) {
      setError("Số CCCD phải bao gồm đúng 12 chữ số!");
      return;
    }

    // 2. Validate mật khẩu khớp nhau
    if (formData.password !== formData.confirmPassword) {
      setError("Mật khẩu xác nhận không trùng khớp!");
      return;
    }

    // 3. Validate độ mạnh mật khẩu (Tối thiểu 6 ký tự, có chữ, số, ký tự đặc biệt)
    if (formData.password.length < 6) {
      setError("Mật khẩu tối thiểu phải từ 6 ký tự!");
      return;
    }

    const hasLetter = /[a-zA-Z]/.test(formData.password);
    const hasNumber = /[0-9]/.test(formData.password);
    const hasSpecialChar = /[^a-zA-Z0-9]/.test(formData.password);

    if (!hasLetter || !hasNumber || !hasSpecialChar) {
      setError("Mật khẩu phải bao gồm chữ cái, số và ký tự đặc biệt!");
      return;
    }

    setLoading(true);

    try {
      // 4. Gửi request sang Server-side API Route để xác thực Secret Key & Tạo User
      const res = await fetch("/api/auth/register-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: formData.fullName,
          phone: formData.phone,
          idCardNumber: formData.idCardNumber,
          password: formData.password,
          role: formData.role,
          adminSecretKey: formData.adminSecretKey,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Tạo tài khoản thất bại!");
      }

      alert("Tạo tài khoản Quản trị thành công! Vui lòng đăng nhập.");
      router.push("/login");
    } catch (err: any) {
      setError(err.message || "Lỗi tạo tài khoản. Vui lòng kiểm tra lại!");
    } finally {
      setLoading(false);
    }
  };

  const isAdminRoleSelected = ["ADMIN", "OPERATOR", "SUPPORT"].includes(formData.role);

  return (
    <form onSubmit={handleSubmit} className="space-y-3 text-xs font-sans">
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-600 p-3 rounded-xl font-bold">
          {error}
        </div>
      )}

      <div>
        <label className="font-bold text-slate-600 block mb-1">Họ và Tên Quản Trị Viên</label>
        <input
          type="text"
          required
          placeholder="Nguyễn Văn Admin"
          value={formData.fullName}
          onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-emerald-500 font-semibold text-slate-800"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="font-bold text-slate-600 block mb-1">Số Điện Thoại</label>
          <input
            type="tel"
            required
            placeholder="0987654321"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-emerald-500 font-semibold text-slate-800"
          />
        </div>

        <div>
          <label className="font-bold text-slate-600 block mb-1">Số CCCD (12 số)</label>
          <input
            type="text"
            required
            maxLength={12}
            placeholder="012345678901"
            value={formData.idCardNumber}
            onChange={(e) => setFormData({ ...formData, idCardNumber: e.target.value })}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-emerald-500 font-semibold text-slate-800"
          />
        </div>
      </div>

      <div>
        <label className="font-bold text-slate-600 block mb-1">Quyền Hạn / Vai Trò</label>
        <select
          value={formData.role}
          onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-emerald-500 font-bold text-slate-800"
        >
          <option value="ADMIN">Admin Tổng (Quản lý toàn bộ hệ thống)</option>
          <option value="OPERATOR">NV Vận Hành (Điều phối đơn & Shipper)</option>
          <option value="SUPPORT">NV CSKH / Hỗ Trợ</option>
        </select>
      </div>

      {isAdminRoleSelected && (
        <div className="bg-amber-50 p-3 rounded-xl border border-amber-200/80">
          <label className="font-extrabold text-amber-900 block mb-1">
            🔑 Mã Bí Mật Xác Nhận Quản Trị
          </label>
          <input
            type="password"
            required
            placeholder="Nhập mã Secret"
            value={formData.adminSecretKey}
            onChange={(e) => setFormData({ ...formData, adminSecretKey: e.target.value })}
            className="w-full bg-white border border-amber-300 rounded-xl px-3.5 py-2 focus:outline-none focus:border-amber-500 font-bold text-amber-900"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {/* Mật khẩu */}
        <div>
          <label className="font-bold text-slate-600 block mb-1">Mật khẩu</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-3.5 pr-9 py-2.5 focus:outline-none focus:border-emerald-500 font-semibold text-slate-800"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
            >
              {showPassword ? "👁️" : "👁️‍🗨️"}
            </button>
          </div>
        </div>

        {/* Xác nhận mật khẩu */}
        <div>
          <label className="font-bold text-slate-600 block mb-1">Xác nhận Mật khẩu</label>
          <div className="relative">
            <input
              type={showConfirmPassword ? "text" : "password"}
              required
              placeholder="••••••••"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-3.5 pr-9 py-2.5 focus:outline-none focus:border-emerald-500 font-semibold text-slate-800"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
            >
              {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
            </button>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-slate-400 italic">
        * Mật khẩu phải có từ 6 ký tự trở lên, bao gồm chữ cái, số và ký tự đặc biệt (VD: Abc@123).
      </p>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-emerald-600 text-white font-extrabold py-3.5 rounded-2xl transition hover:bg-emerald-700 active:scale-95 cursor-pointer mt-2 shadow-md"
      >
        {loading ? "ĐANG TẠO TÀI KHOẢN ADMIN..." : "ĐĂNG KÝ TÀI KHOẢN QUẢN TRỊ"}
      </button>
    </form>
  );
}