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

    </header>
  );
}