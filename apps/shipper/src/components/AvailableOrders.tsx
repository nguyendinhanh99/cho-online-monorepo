export interface Order {
  id: string;
  storeName: string;
  storeAddress: string;
  customerAddress: string;
  shippingFee: number;
  distance: string;
}

interface AvailableOrdersProps {
  orders: Order[];
  onAcceptOrder: (orderId: string) => void;
}

export default function AvailableOrders({ orders, onAcceptOrder }: AvailableOrdersProps) {
  if (orders.length === 0) {
    return (
      <div className="bg-white border border-stone-200/80 rounded-3xl p-8 text-center space-y-2">
        <div className="text-3xl">🔍</div>
        <p className="text-xs font-bold text-stone-700">Chưa có đơn hàng nào quanh đây</p>
        <p className="text-[11px] text-stone-400">Hệ thống đang tìm kiếm đơn hàng mới nhất...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="font-black text-stone-800 text-xs uppercase tracking-wider">
        Đơn hàng khả dụng ({orders.length})
      </h3>

      {orders.map((order) => (
        <div key={order.id} className="bg-white border border-stone-200/80 rounded-3xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-stone-100 pb-2">
            <span className="text-[11px] font-bold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg">
              Phí ship: {order.shippingFee.toLocaleString("vi-VN")} đ
            </span>
            <span className="text-[11px] font-extrabold text-stone-400">{order.distance}</span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-start gap-2">
              <span className="text-amber-500">🏪</span>
              <div>
                <p className="font-bold text-stone-800">{order.storeName}</p>
                <p className="text-[11px] text-stone-400">{order.storeAddress}</p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <span className="text-emerald-500">📍</span>
              <div>
                <p className="font-bold text-stone-800">Giao đến</p>
                <p className="text-[11px] text-stone-400">{order.customerAddress}</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => onAcceptOrder(order.id)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-2.5 rounded-xl text-xs transition cursor-pointer active:scale-95 shadow-xs"
          >
            NHẬN ĐƠN NGAY
          </button>
        </div>
      ))}
    </div>
  );
}