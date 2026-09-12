"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useCartStore } from "../store/useCartStore";

export function BottomNav() {
  const pathname = usePathname();
  const { getTotalItems, openCart } = useCartStore();
  
  // 🛡️ Thêm cờ kiểm tra mount để tránh lỗi HydrationMismatch
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const totalItems = isMounted ? getTotalItems() : 0;

  const navItems = [
    {
      label: "Trang chủ",
      href: "/",
      activeIcon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
        </svg>
      ),
      inactiveIcon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      label: "Khám phá",
      href: "/categories",
      activeIcon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M4 11h6a1 1 0 001-1V4a1 1 0 00-1-1H4a1 1 0 00-1 1v6a1 1 0 001 1zm10 0h6a1 1 0 001-1V4a1 1 0 00-1-1h-6a1 1 0 00-1 1v6a1 1 0 001 1zM4 21h6a1 1 0 001-1v-6a1 1 0 00-1-1H4a1 1 0 00-1 1v6a1 1 0 001 1zm10 0h6a1 1 0 001-1v-6a1 1 0 00-1-1h-6a1 1 0 00-1 1v6a1 1 0 001 1z" />
        </svg>
      ),
      inactiveIcon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      ),
    },
    {
      label: "Đơn hàng",
      href: "/orders",
      activeIcon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
        </svg>
      ),
      inactiveIcon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
    },
    {
      label: "Cá nhân",
      href: "/profile",
      activeIcon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
        </svg>
      ),
      inactiveIcon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-t border-slate-100 pb-safe pt-1.5 px-3 max-w-md mx-auto sm:max-w-none shadow-lg">
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-col items-center justify-center flex-1 py-1 transition-all duration-200 select-none cursor-pointer ${
                isActive
                  ? "text-orange-600 font-bold"
                  : "text-slate-400 font-medium hover:text-slate-600"
              }`}
            >
              <div className="relative flex items-center justify-center p-1">
                {isActive ? item.activeIcon : item.inactiveIcon}
              </div>
              <span className="text-[10px] tracking-tight leading-tight">
                {item.label}
              </span>
              {isActive && (
                <span className="absolute -bottom-1.5 w-1 h-1 bg-orange-600 rounded-full" />
              )}
            </Link>
          );
        })}

        {/* Nút Giỏ hàng Nhanh */}
        <button
          type="button"
          onClick={openCart}
          className="relative flex flex-col items-center justify-center flex-1 py-1 text-slate-400 hover:text-slate-600 font-medium transition-all duration-200 select-none cursor-pointer"
        >
          <div className="relative p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            {totalItems > 0 && (
              <span className="absolute -top-0.5 -right-1.5 bg-orange-600 text-white text-[9px] font-black min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center border-2 border-white shadow-xs animate-bounce">
                {totalItems > 99 ? "99+" : totalItems}
              </span>
            )}
          </div>
          <span className="text-[10px] tracking-tight leading-tight">
            Giỏ hàng
          </span>
        </button>
      </div>
    </nav>
  );
}