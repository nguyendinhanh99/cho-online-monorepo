import Link from "next/link";
import { RegisterForm } from "@/components/RegisterForm";

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-5">
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-black text-slate-800">ĐĂNG KÝ TÀI KHOẢN</h2>
          <p className="text-xs font-semibold text-slate-400">Tạo tài khoản mới bằng SĐT & CCCD</p>
        </div>

        <RegisterForm />

        <div className="text-center text-xs text-slate-500 font-semibold pt-2 border-t border-slate-100">
          Đã có tài khoản?{" "}
          <Link href="/login" className="text-emerald-600 font-extrabold hover:underline">
            Đăng nhập ngay
          </Link>
        </div>
      </div>
    </div>
  );
}