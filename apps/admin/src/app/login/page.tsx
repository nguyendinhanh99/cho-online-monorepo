import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-6">
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-black text-slate-800">ĐĂNG NHẬP ADMIN</h2>
          <p className="text-xs font-semibold text-slate-400">Nhập SĐT, Số CCCD và Mật khẩu</p>
        </div>

        <LoginForm />

        <div className="text-center text-xs text-slate-500 font-semibold pt-2 border-t border-slate-100">
          Chưa có tài khoản?{" "}
          <Link href="/register" className="text-emerald-600 font-extrabold hover:underline">
            Đăng ký tài khoản mới
          </Link>
        </div>
      </div>
    </div>
  );
}