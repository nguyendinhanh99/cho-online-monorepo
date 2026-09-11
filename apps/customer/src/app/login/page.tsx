"use client";

import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";
import { useRouter, useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";

// Component con xử lý SearchParams được bọc trong Suspense
function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/";

  const handleLoginSuccess = () => {
    router.push(redirectTo);
  };

  return (
    <div className="bg-stone-50 p-5 rounded-3xl border border-stone-200/60 shadow-sm">
      <LoginForm onSuccess={handleLoginSuccess} />
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="p-4 pt-10 space-y-6">
      <div className="text-center space-y-2">
        <span className="text-4xl block">🥑</span>
        <h2 className="text-xl font-bold text-stone-800 font-serif">
          Đăng nhập Chợ Online
        </h2>
        <p className="text-xs text-stone-400">
          Vui lòng đăng nhập để hoàn tất đơn hàng của bạn
        </p>
      </div>

      <Suspense fallback={<div className="text-center py-4 text-xs text-stone-400">Đang tải...</div>}>
        <LoginContent />
      </Suspense>
    </div>
  );
}