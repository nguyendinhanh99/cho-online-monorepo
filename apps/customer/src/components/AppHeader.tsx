"use client";

import { useEffect, useState } from "react";
import { auth } from "@cho-online/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import Link from "next/link";

export function AppHeader() {
  const [user, setUser] = useState<User | null>(null);
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);

  useEffect(() => {
    // Lắng nghe trạng thái đăng nhập từ Firebase
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200/80 shadow-xs transition-all">
      {/* 🚚 BANNER THÔNG BÁO DỊCH VỤ MỚI (CÓ NÚT ĐÓNG & THIẾT KẾ DẠNG MODERN CHIP) */}
      {!isBannerDismissed && (
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white px-3 py-1.5 flex items-center justify-between text-[11px] font-medium shadow-inner">
          <div className="flex items-center gap-2 truncate pr-2">
            <span className="shrink-0 bg-white/20 p-1 rounded-full text-xs animate-bounce">
              🛍️
            </span>
            <span className="truncate">
              <strong className="font-extrabold text-amber-100">
                Quần áo & Tạp hóa giao 5h:
              </strong>{" "}
              Đang thử nghiệm tại Hà Tĩnh
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="bg-white/20 border border-white/30 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide backdrop-blur-xs">
              Sắp ra mắt
            </span>
            <button
              onClick={() => setIsBannerDismissed(true)}
              aria-label="Đóng thông báo"
              className="text-white/80 hover:text-white hover:bg-white/10 p-0.5 rounded-full transition cursor-pointer"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* thanh HEADER CHÍNH */}
      <div className="px-3.5 py-2.5 flex items-center justify-between gap-3">
        {/* Vị trí giao hàng với Hover effect */}
        <button
          type="button"
          className="flex items-center gap-2.5 text-left group rounded-xl p-1 -ml-1 hover:bg-stone-50 transition cursor-pointer"
        >
          <div className="w-8 h-8 rounded-full bg-orange-50 border border-orange-200/60 flex items-center justify-center text-orange-600 text-sm shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
            📍
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block leading-none">
                GIAO ĐẾN
              </span>
              <span className="text-[9px] text-orange-600 font-extrabold leading-none">
                ▼
              </span>
            </div>
            <h1 className="text-xs font-black text-stone-800 leading-tight truncate group-hover:text-orange-600 transition-colors mt-0.5">
              Hà Tĩnh, Việt Nam
            </h1>
          </div>
        </button>

        {/* Hiển thị Tên User hoặc Nút Đăng Nhập */}
        <div>
          {user ? (
            <Link
              href="/profile"
              className="flex items-center gap-2 bg-emerald-50/80 hover:bg-emerald-100/80 text-emerald-900 px-3 py-1.5 rounded-full border border-emerald-200/80 text-xs font-bold transition shadow-2xs active:scale-95"
            >
              <span className="max-w-[100px] sm:max-w-[140px] truncate">
                {user.displayName || user.phoneNumber || "Thành viên"}
              </span>
              <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] shrink-0 font-bold shadow-2xs">
                ✓
              </div>
            </Link>
          ) : (
            <Link
              href="/login?redirectTo=/checkout"
              className="flex items-center gap-2 bg-stone-100 hover:bg-stone-200/80 text-stone-700 px-3 py-1.5 rounded-full text-xs font-bold transition border border-stone-200/80 shadow-2xs active:scale-95"
            >
              <span>Tài khoản</span>
              <div className="w-5 h-5 rounded-full bg-stone-800 text-white flex items-center justify-center text-[10px] shrink-0 font-bold shadow-2xs">
                👤
              </div>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}