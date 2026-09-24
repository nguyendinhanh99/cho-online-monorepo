"use client";

import Image from "next/image";

interface MerchantHeaderProps {
  isOpenShop: boolean;
  onToggleOpen: () => void;
}

export default function MerchantHeader({
  isOpenShop,
  onToggleOpen,
}: MerchantHeaderProps) {
  return (
    <div className="bg-[#ee4d2d] text-white p-4 shadow-md sticky top-0 z-30">
      <div className="max-w-md mx-auto flex items-center justify-between">

        {/* ====================================================
            LOGO + BRAND
        ==================================================== */}

        <div className="flex items-center gap-2.5 min-w-0">

          {/* LOGO */}

          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center overflow-hidden shadow-sm shrink-0">
            <Image
              src="/logo.png"
              alt="Anvami"
              width={40}
              height={40}
              priority
              className="w-full h-full object-contain p-1"
            />
          </div>

          {/* TEXT */}

          <div className="min-w-0">

            <h1 className="font-bold text-sm leading-tight">
              Anvami
            </h1>

            <span className="text-[11px] opacity-90">
              Kênh Quản Lý Cửa Hàng
            </span>

          </div>

        </div>

        {/* ====================================================
            SHOP STATUS
        ==================================================== */}

        <button
          type="button"
          onClick={onToggleOpen}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
            isOpenShop
              ? "bg-emerald-500 text-white"
              : "bg-stone-300 text-stone-700"
          }`}
        >

          <span
            className={`w-2 h-2 rounded-full ${
              isOpenShop
                ? "bg-white animate-pulse"
                : "bg-stone-500"
            }`}
          />

          {isOpenShop
            ? "Đang Mở Cửa"
            : "Đã Đóng Cửa"}

        </button>

      </div>
    </div>
  );
}