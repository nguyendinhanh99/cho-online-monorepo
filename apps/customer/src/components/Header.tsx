"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { auth } from "@cho-online/firebase";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { logoutUser } from "../services/auth.service";
import { useCartStore } from "../store/useCartStore";

export function Header() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const { getTotalItems, openCart } = useCartStore();
  const totalItems = getTotalItems();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-stone-200/80 px-4 sm:px-8 py-3.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* LOGO */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 bg-brand-accent/20 text-brand-primary rounded-xl flex items-center justify-center text-xl border border-brand-accent/40 shadow-sm group-hover:scale-105 transition-transform">
            🍓
          </div>
          <div>
            <span className="font-black text-lg text-stone-800 tracking-tight font-serif block leading-none">
              Chợ Online
            </span>
            <span className="text-[10px] text-brand-muted font-medium">
              Hoa quả & Nước ép
            </span>
          </div>
        </Link>

        {/* ACTIONS: GIỎ HÀNG & TÀI KHOẢN */}
        <div className="flex items-center gap-3">
          {/* NÚT MỞ GIỎ HÀNG */}
          <button
            type="button"
            onClick={openCart}
            className="relative p-2.5 rounded-2xl bg-stone-100 hover:bg-stone-200/70 text-stone-700 transition active:scale-95 flex items-center justify-center"
          >
            <span className="text-lg">🛒</span>
            {totalItems > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                {totalItems}
              </span>
            )}
          </button>

          {/* TRẠNG THÁI TÀI KHOẢN */}
          {user ? (
            <div className="flex items-center gap-3 pl-2 border-l border-stone-200">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-stone-800 line-clamp-1">
                  {user.displayName || user.email?.split("@")[0] || "Khách hàng"}
                </p>
                <p className="text-[10px] text-emerald-600 font-semibold">
                  ● Đã đăng nhập
                </p>
              </div>
              <button
                type="button"
                onClick={() => logoutUser()}
                className="text-xs font-bold text-rose-600 hover:bg-rose-50 px-3 py-2 rounded-xl transition"
              >
                Thoát
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-sm active:scale-95"
            >
              Đăng nhập
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}