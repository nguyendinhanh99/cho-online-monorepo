"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/services/firebase";

// 🌐 Danh sách các đường dẫn công khai (không cần đăng nhập vẫn vào được)
const PUBLIC_ROUTES = ["/login", "/register-kyc", "/signup", "/forgot-password"];

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  // Kiểm tra xem trang hiện tại có nằm trong danh sách công khai hay không
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setAuthenticated(true);
        // Nếu đã đăng nhập mà cố vào trang login/register -> Tự chuyển về trang chủ
        if (isPublicRoute) {
          router.push("/");
        }
      } else {
        setAuthenticated(false);
        // Nếu chưa đăng nhập và cố vào trang bảo mật -> Đá về /login
        if (!isPublicRoute) {
          router.push("/login");
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router, pathname, isPublicRoute]);

  // Cho phép hiển thị ngay các trang Public mà không cần đợi kiểm tra Auth
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // Màn hình loading khi đang kiểm tra quyền truy cập vào các trang bảo mật
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-3 border-[#ee4d2d] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-stone-500 font-medium">
            Đang kiểm tra quyền truy cập...
          </p>
        </div>
      </div>
    );
  }

  return authenticated ? <>{children}</> : null;
}