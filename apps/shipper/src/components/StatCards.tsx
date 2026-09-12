interface StatCardsProps {
  todayEarnings: number;
  completedOrders: number;
  rating: number;
}

export default function StatCards({ todayEarnings, completedOrders, rating }: StatCardsProps) {
  return (
    <div className="grid grid-cols-3 gap-2 text-xs">
      <div className="bg-blue-600 text-white p-3 rounded-2xl shadow-xs space-y-1">
        <span className="text-[10px] opacity-80 font-medium block">Thu nhập hôm nay</span>
        <strong className="text-sm font-black block">
          {todayEarnings.toLocaleString("vi-VN")} đ
        </strong>
      </div>

      <div className="bg-white border border-stone-200/80 p-3 rounded-2xl shadow-xs space-y-1">
        <span className="text-[10px] text-stone-400 font-medium block">Đơn thành công</span>
        <strong className="text-sm font-black text-stone-800 block">{completedOrders} đơn</strong>
      </div>

      <div className="bg-white border border-stone-200/80 p-3 rounded-2xl shadow-xs space-y-1">
        <span className="text-[10px] text-stone-400 font-medium block">Đánh giá</span>
        <strong className="text-sm font-black text-amber-500 flex items-center gap-1 block">
          <span>⭐</span> {rating}
        </strong>
      </div>
    </div>
  );
}