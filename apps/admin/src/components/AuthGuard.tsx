"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const ALLOWED_ROLES = ["ADMIN", "OPERATOR", "SUPPORT"];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || loading) return;

    // Cho phép tự do ở trang /login hoặc /register
    if (pathname !== "/login" && pathname !== "/register") {
      if (!user) {
        router.replace("/login");
        return;
      }

      if (profile) {
        if (!ALLOWED_ROLES.includes(profile.role) || profile.status === "BLOCKED") {
          router.replace("/login");
        }
      }
    }
  }, [user, profile, loading, pathname, router, mounted]);

  if (!mounted) return null;

  // Cho phép render ngay lập tức nếu đang ở trang /login hoặc /register
  if (pathname === "/login" || pathname === "/register") {
    return <>{children}</>;
  }

  // Khi đang tải trạng thái đăng nhập từ Firebase Auth / Firestore
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white space-y-3 font-sans">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-bold text-slate-400">
          Đang kiểm tra phiên đăng nhập hệ thống...
        </p>
      </div>
    );
  }

  // Nếu đã qua bước loading mà chưa có user -> hiển thị tạm màn chờ chuyển hướng
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white space-y-3 font-sans">
        <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-bold text-slate-400">
          Đang chuyển hướng về trang đăng nhập...
        </p>
      </div>
    );
  }

  return <>{children}</>;
}