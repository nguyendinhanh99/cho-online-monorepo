"use client";

interface MerchantHeaderProps {
  isOpenShop: boolean;
  onToggleOpen: () => void;
}

export default function MerchantHeader({ isOpenShop, onToggleOpen }: MerchantHeaderProps) {
  return (
    <div className="bg-[#ee4d2d] text-white p-4 shadow-md sticky top-0 z-30">
      <div className="max-w-md mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-lg">
            🏪
          </div>
          <div>
            <h1 className="font-bold text-sm leading-tight">Juice Fruit Hà Tĩnh</h1>
            <span className="text-[11px] opacity-90">Kênh Quản Lý Cửa Hàng</span>
          </div>
        </div>

        <button
          onClick={onToggleOpen}
          className={`px-3 py-1 rounded-full text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
            isOpenShop ? "bg-emerald-500 text-white" : "bg-stone-300 text-stone-700"
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
          {isOpenShop ? "Đang Mở Cửa" : "Đã Đóng Cửa"}
        </button>
      </div>
    </div>
  );
}