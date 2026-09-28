"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useCartStore } from "../store/useCartStore";

/* ============================================================
   ICONS
============================================================ */

function ShopIcon({
  active = false,
}: {
  active?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-[21px] h-[21px]"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="3"
        width="7"
        height="7"
        rx="2"
      />
      <rect
        x="14"
        y="3"
        width="7"
        height="7"
        rx="2"
      />
      <rect
        x="3"
        y="14"
        width="7"
        height="7"
        rx="2"
      />
      <rect
        x="14"
        y="14"
        width="7"
        height="7"
        rx="2"
      />
    </svg>
  );
}

function OrdersIcon({
  active = false,
}: {
  active?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-[21px] h-[21px]"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect
        x="5"
        y="3"
        width="14"
        height="18"
        rx="2"
      />

      {!active && (
        <>
          <path d="M8 8h8" />
          <path d="M8 12h8" />
          <path d="M8 16h5" />
        </>
      )}
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-[24px] h-[24px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v10h5v-5h4v5h5V10" />
    </svg>
  );
}

function CartIcon({
  active = false,
}: {
  active?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-[21px] h-[21px]"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 8h12l1.2 12H4.8L6 8Z" />

      {!active && (
        <path d="M9 9V6a3 3 0 0 1 6 0v3" />
      )}
    </svg>
  );
}

function ProfileIcon({
  active = false,
}: {
  active?: boolean;
}) {
  return active ? (
    <svg
      viewBox="0 0 24 24"
      className="w-[21px] h-[21px]"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 11.5a4.25 4.25 0 1 0 0-8.5 4.25 4.25 0 0 0 0 8.5Zm0 2c-4.42 0-8 2.42-8 5.4 0 .61.49 1.1 1.1 1.1h13.8a1.1 1.1 0 0 0 1.1-1.1c0-2.98-3.58-5.4-8-5.4Z" />
    </svg>
  ) : (
    <svg
      viewBox="0 0 24 24"
      className="w-[21px] h-[21px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="8"
        r="4"
      />

      <path d="M4.5 21c.65-4.1 3.35-6.5 7.5-6.5s6.85 2.4 7.5 6.5" />
    </svg>
  );
}

/* ============================================================
   COMPONENT
============================================================ */

export function BottomNav() {
  const pathname =
    usePathname();

  const cartItems =
    useCartStore(
      (state) => state.items
    );

  const openCart =
    useCartStore(
      (state) => state.openCart
    );

  const [
    isMounted,
    setIsMounted,
  ] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const totalItems =
    useMemo(() => {
      if (!isMounted) {
        return 0;
      }

      return cartItems.reduce(
        (sum, item) =>
          sum +
          Number(
            item.quantity || 0
          ),
        0
      );
    }, [
      cartItems,
      isMounted,
    ]);

  const isActive = (
    href: string
  ) => {
    if (href === "/") {
      return pathname === "/";
    }

    return (
      pathname === href ||
      pathname.startsWith(
        `${href}/`
      )
    );
  };

  return (
    <>
      {/* Không để nội dung bị nav che */}

      <div
        aria-hidden="true"
        className="h-[78px]"
      />

      <nav
        className="
          fixed
          bottom-0
          left-0
          right-0
          z-50

          bg-white/95

          border-t
          border-stone-200/80

          supports-[backdrop-filter]:backdrop-blur-xl

          pb-[max(6px,env(safe-area-inset-bottom))]
        "
      >
        <div
          className="
            max-w-lg
            mx-auto

            grid
            grid-cols-5
            items-center

            h-[64px]

            px-2
          "
        >
          {/* ==================================================
              MUA SẮM
          ================================================== */}

          <NavLink
            href="/categories"
            label="Mua sắm"
            active={isActive(
              "/categories"
            )}
            icon={
              <ShopIcon
                active={isActive(
                  "/categories"
                )}
              />
            }
          />

          {/* ==================================================
              ĐƠN HÀNG
          ================================================== */}

          <NavLink
            href="/orders"
            label="Đơn hàng"
            active={isActive(
              "/orders"
            )}
            icon={
              <OrdersIcon
                active={isActive(
                  "/orders"
                )}
              />
            }
          />

          {/* ==================================================
              TRANG CHỦ / KHÁM PHÁ
          ================================================== */}

          <Link
            href="/"
            aria-label="Khám phá Anvami"
            aria-current={
              pathname === "/"
                ? "page"
                : undefined
            }
            className="
              relative

              h-full

              flex
              flex-col
              items-center
              justify-center

              select-none

              active:scale-[0.95]

              transition-transform
              duration-150
            "
          >
            <div
              className={`
                relative

                -mt-5

                w-[52px]
                h-[52px]

                rounded-[18px]

                flex
                items-center
                justify-center

                border-[5px]
                border-white

                shadow-lg
                shadow-orange-500/20

                transition-all
                duration-150

                ${
                  pathname === "/"
                    ? "bg-[#ee4d2d] text-white"
                    : "bg-orange-50 text-[#ee4d2d]"
                }
              `}
            >
              <HomeIcon />
            </div>

            <span
              className={`
                -mt-0.5

                text-[10px]
                leading-none

                ${
                  pathname === "/"
                    ? "text-[#ee4d2d] font-bold"
                    : "text-stone-500 font-semibold"
                }
              `}
            >
              Khám phá
            </span>
          </Link>

          {/* ==================================================
              GIỎ HÀNG
          ================================================== */}

          <button
            type="button"
            onClick={openCart}
            aria-label={
              totalItems > 0
                ? `Giỏ hàng có ${totalItems} sản phẩm`
                : "Mở giỏ hàng"
            }
            className="
              relative

              h-full

              flex
              flex-col
              items-center
              justify-center

              text-stone-400

              select-none

              active:scale-[0.95]

              transition-transform
              duration-150
            "
          >
            <div
              className="
                relative

                min-w-[42px]
                h-[32px]

                px-2

                flex
                items-center
                justify-center
              "
            >
              <CartIcon />

              {totalItems >
                0 && (
                <span
                  className="
                    absolute

                    top-0
                    right-0

                    min-w-[18px]
                    h-[18px]

                    px-1

                    rounded-full

                    bg-[#ee4d2d]

                    text-white

                    border-2
                    border-white

                    text-[9px]
                    leading-none
                    font-black

                    flex
                    items-center
                    justify-center

                    tabular-nums
                  "
                >
                  {totalItems >
                  99
                    ? "99+"
                    : totalItems}
                </span>
              )}
            </div>

            <span
              className="
                mt-0.5
                text-[10px]
                leading-none
                font-medium
              "
            >
              Giỏ hàng
            </span>
          </button>

          {/* ==================================================
              TÀI KHOẢN
          ================================================== */}

          <NavLink
            href="/profile"
            label="Tài khoản"
            active={isActive(
              "/profile"
            )}
            icon={
              <ProfileIcon
                active={isActive(
                  "/profile"
                )}
              />
            }
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
      aria-current={
        active
          ? "page"
          : undefined
      }
      className="
        h-full

        flex
        flex-col
        items-center
        justify-center

        select-none

        active:scale-[0.95]

        transition-transform
        duration-150
      "
    >
      <div
        className={`
          min-w-[42px]
          h-[32px]

          px-2

          rounded-xl

          flex
          items-center
          justify-center

          transition-colors
          duration-150

          ${
            active
              ? "bg-orange-50 text-[#ee4d2d]"
              : "text-stone-400"
          }
        `}
      >
        {icon}
      </div>

      <span
        className={`
          mt-0.5

          text-[10px]
          leading-none
          tracking-tight

          ${
            active
              ? "font-bold text-[#ee4d2d]"
              : "font-medium text-stone-400"
          }
        `}
      >
        {label}
      </span>
    </Link>
  );
}