"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useCartStore } from "../store/useCartStore";

type IconProps = {
  active?: boolean;
};

/* ============================================================
   ICONS
============================================================ */

function ShopIcon({ active = false }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[22px] w-[22px]"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.15 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 10v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9" />
      <path d="M3 10 5 4h14l2 6" />
      <path d="M3 10a3 3 0 0 0 5 2 3 3 0 0 0 4 0 3 3 0 0 0 4 0 3 3 0 0 0 5-2" />
      <path d="M9 21v-5h6v5" />
    </svg>
  );
}

function OrdersIcon({ active = false }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[22px] w-[22px]"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.15 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
      <path d="m4.5 7.8 7.5 4.3 7.5-4.3" />
      <path d="M12 12.1V21" />
      <path d="m8 5.2 8 4.6" />
    </svg>
  );
}

function CartIcon({ active = false }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[22px] w-[22px]"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.15 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 4h2l2.1 9.1a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 1.9-1.4L20 8H6" />
      <circle cx="9" cy="19" r="1.35" />
      <circle cx="17" cy="19" r="1.35" />
    </svg>
  );
}

function ProfileIcon({ active = false }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[22px] w-[22px]"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.15 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="9" r="3" />
      <path d="M6.8 19c.8-3 2.6-4.5 5.2-4.5s4.4 1.5 5.2 4.5" />
    </svg>
  );
}

/* ============================================================
   BOTTOM NAV
============================================================ */

export function BottomNav() {
  const pathname = usePathname();

  const cartItems = useCartStore((state) => state.items);
  const openCart = useCartStore((state) => state.openCart);

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const totalItems = useMemo(() => {
    if (!isMounted) return 0;

    return cartItems.reduce(
      (sum, item) => sum + Number(item.quantity || 0),
      0
    );
  }, [cartItems, isMounted]);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const homeActive = pathname === "/";

  return (
    <>
      {/* Giữ khoảng trống để nội dung cuối trang không bị nav che */}
      <div aria-hidden="true" className="h-[74px]" />

      <nav
        aria-label="Điều hướng chính"
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-stone-200/80 bg-white/95 supports-[backdrop-filter]:backdrop-blur-xl pb-[max(5px,env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto grid h-[62px] max-w-lg grid-cols-5 items-center px-2">
          <NavLink
            href="/categories"
            label="Mua sắm"
            active={isActive("/categories")}
            icon={<ShopIcon active={isActive("/categories")} />}
          />

          <NavLink
            href="/orders"
            label="Đơn hàng"
            active={isActive("/orders")}
            icon={<OrdersIcon active={isActive("/orders")} />}
          />

          {/* ==================================================
              ANVAMI FOOD - NÚT TRUNG TÂM

              - Dùng logo thật: /public/logo.png -> /logo.png
              - Kích thước nhỏ hơn bản cũ
              - Chỉ nhô lên nhẹ để không đè chữ
          ================================================== */}
          <Link
            href="/"
            aria-label="Anvami Food"
            aria-current={homeActive ? "page" : undefined}
            className="relative flex h-full flex-col items-center justify-center select-none transition-transform duration-150 active:scale-[0.96]"
          >
            <div
              className={`relative -mt-2.5 flex h-[46px] w-[46px] items-center justify-center rounded-2xl border-[4px] border-white shadow-md transition-all duration-150 ${
                homeActive
                  ? "bg-orange-50 shadow-orange-500/20 ring-1 ring-orange-100"
                  : "bg-white shadow-stone-200/70 ring-1 ring-stone-100"
              }`}
            >
              <img
                src="/logo.png"
                alt="Anvami"
                draggable={false}
                className="h-[31px] w-[31px] select-none object-contain"
              />
            </div>

            <span
              className={`mt-1 whitespace-nowrap text-[10px] leading-none tracking-tight ${
                homeActive
                  ? "font-extrabold text-[#ee4d2d]"
                  : "font-semibold text-stone-500"
              }`}
            >
              Anvami Food
            </span>
          </Link>

          <button
            type="button"
            onClick={openCart}
            aria-label={
              totalItems > 0
                ? `Giỏ hàng có ${totalItems} sản phẩm`
                : "Mở giỏ hàng"
            }
            className="relative flex h-full flex-col items-center justify-center text-stone-400 select-none transition-transform duration-150 active:scale-[0.95]"
          >
            <div className="relative flex h-[32px] min-w-[42px] items-center justify-center px-2">
              <CartIcon />

              {totalItems > 0 && (
                <span className="absolute right-0 top-0 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-[#ee4d2d] px-1 text-[9px] font-black leading-none text-white tabular-nums">
                  {totalItems > 99 ? "99+" : totalItems}
                </span>
              )}
            </div>

            <span className="mt-0.5 text-[10px] font-medium leading-none tracking-tight text-stone-400">
              Giỏ hàng
            </span>
          </button>

          <NavLink
            href="/profile"
            label="Tài khoản"
            active={isActive("/profile")}
            icon={<ProfileIcon active={isActive("/profile")} />}
          />
        </div>
      </nav>
    </>
  );
}

/* ============================================================
   NORMAL NAV ITEM
============================================================ */

function NavLink({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className="flex h-full flex-col items-center justify-center select-none transition-transform duration-150 active:scale-[0.95]"
    >
      <div
        className={`flex h-[32px] min-w-[42px] items-center justify-center rounded-xl px-2 transition-colors duration-150 ${
          active ? "bg-orange-50 text-[#ee4d2d]" : "text-stone-400"
        }`}
      >
        {icon}
      </div>

      <span
        className={`mt-0.5 text-[10px] leading-none tracking-tight ${
          active
            ? "font-bold text-[#ee4d2d]"
            : "font-medium text-stone-400"
        }`}
      >
        {label}
      </span>
    </Link>
  );
}
