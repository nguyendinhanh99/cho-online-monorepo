"use client";

import { useEffect, useState } from "react";

// Bảng ánh xạ Tên Ngân Hàng / Mã Ngân Hàng -> Mã VietQR (BIN / ShortName chuẩn VietQR)
const VIETQR_BANK_MAP: { [key: string]: string } = {
  // Ngân hàng lớn (Big 4 & Thương mại cổ phần phổ biến)
  VCB: "VCB",
  Vietcombank: "VCB",
  CTG: "CTG",
  VietinBank: "CTG",
  BIDV: "BIDV",
  VBA: "VBA",
  Agribank: "VBA",
  MB: "MB",
  MBBank: "MB",
  TCB: "TCB",
  Techcombank: "TCB",
  VPB: "VPB",
  VPBank: "VPB",
  ACB: "ACB",
  TPB: "TPB",
  TPBank: "TPB",
  STB: "STB",
  Sacombank: "STB",
  HDB: "HDB",
  HDBank: "HDB",
  VIB: "VIB",
  MSB: "MSB",
  OCB: "OCB",
  SHB: "SHB",
  LPB: "LPB",
  LPBank: "LPB",
  SSB: "SSB",
  SeABank: "SSB",
  EIB: "EIB",
  Eximbank: "EIB",

  // Ngân hàng số & Ngân hàng thương mại khác
  CAKE: "CAKE",
  Cake: "CAKE",
  TIMO: "TIMO",
  Timo: "TIMO",
  BAB: "BAB",
  BacABank: "BAB",
  VAB: "VAB",
  VietABank: "VAB",
  NCB: "NCB",
  OCEANBANK: "OCEANBANK",
  Oceanbank: "OCEANBANK",
  GPB: "GPB",
  GPBank: "GPB",
  PVCB: "PVCB",
  PVComBank: "PVCB",
  KLB: "KLB",
  Kienlongbank: "KLB",
  SGB: "SGB",
  Saigonbank: "SGB",
  BVB: "BVB",
  BaoVietBank: "BVB",
  DAB: "DAB",
  DongABank: "DAB",
  SCB: "SCB",
  VBB: "VBB",
  VietBank: "VBB",
  NAMABANK: "NAMABANK",
  NamABank: "NAMABANK",
  SHINHAN: "SHINHAN",
  ShinhanBank: "SHINHAN",
  WOO: "WOO",
  Woori: "WOO",
  UOB: "UOB",
  SCVN: "SCVN",
  StandardChartered: "SCVN",
  PBVN: "PBVN",
  PublicBank: "PBVN",
};

// Chuỗi trạng thái chuẩn từ hệ thống Người bán (Shop/Seller)
const ORDER_STEPS = [
  { key: "pending", label: "Chờ xác nhận" },
  { key: "accepted", label: "Shop đã nhận" },
  { key: "preparing", label: "Đang làm" },
  { key: "delivering", label: "Đang giao" },
  { key: "completed", label: "Hoàn thành" },
];

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [shippers, setShippers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedOrder, setSelectedOrder] = useState<any>(null); // State Modal Chi Tiết / Điều Phối
  const [selectedShipperId, setSelectedShipperId] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // 💰 State dành riêng cho Modal Hoàn Tiền
  const [refundModalOrder, setRefundModalOrder] = useState<any>(null);
  const [refundReason, setRefundReason] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // 🗺️ Hàm hỗ trợ mở ứng dụng Bản đồ (Google Maps) chỉ đường
  const openGoogleMaps = (address: string, lat?: number, lng?: number) => {
    let mapsUrl = "";

    if (lat && lng) {
      mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    } else if (address && address !== "Đang cập nhật địa chỉ") {
      const encodedAddress = encodeURIComponent(address);
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
    } else {
      alert("Chưa có thông tin địa chỉ cụ thể!");
      return;
    }

    window.open(mapsUrl, "_blank", "noopener,noreferrer");
  };

  // 📋 Hàm copy nhanh thông tin chuyển khoản
  const handleCopy = (text: string, fieldName: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/orders");
      const json = await res.json();
      if (json.success) {
        setOrders(json.data.orders || []);
        setShippers(json.data.shippers || []);
      }
    } catch (err) {
      console.error("Lỗi lấy danh sách đơn hàng:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // Lọc đơn hàng theo Tab Trạng Thái
  const filteredOrders = orders.filter((o) => {
    const status = (o.status || "").toLowerCase();
    if (statusFilter === "ALL") return true;

    if (statusFilter === "delivering") {
      return ["delivering", "picking_up", "shipping", "assigned"].includes(status);
    }
    if (statusFilter === "completed") {
      return ["completed", "delivered"].includes(status);
    }
    if (statusFilter === "cancelled") {
      return ["cancelled", "refunded"].includes(status);
    }
    return status === statusFilter.toLowerCase();
  });

  // Gán Shipper cho Đơn
  const handleAssignShipper = async () => {
    if (!selectedShipperId) return alert("Vui lòng chọn Shipper!");
    const shipperObj = shippers.find((s) => s.id === selectedShipperId);

    setActionLoading(true);
    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: selectedOrder.id,
          shipperId: selectedShipperId,
          shipperName: shipperObj?.fullName || shipperObj?.name || "Shipper",
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert("🚚 Đã điều phối Shipper thành công!");
        setSelectedOrder(null);
        fetchOrders();
      } else {
        alert(data.message || "Không thể phân công Shipper");
      }
    } catch (err) {
      alert("Lỗi điều phối Shipper");
    } finally {
      setActionLoading(false);
    }
  };

  // Cập nhật trạng thái đơn (Hủy / Hoàn tiền / Hoàn tất / Tiến trình shop)
  const handleUpdateOrderStatus = async (status: string, overrideReason?: string) => {
    const finalReason = overrideReason || cancelReason;

    if ((status === "cancelled" || status === "refunded") && !finalReason.trim()) {
      return alert("Vui lòng nhập lý do hủy đơn/hoàn tiền!");
    }

    if (!confirm(`Xác nhận chuyển trạng thái đơn hàng sang: ${status.toUpperCase()}?`)) return;

    setActionLoading(true);
    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: refundModalOrder?.id || selectedOrder?.id,
          status,
          cancelReason: status === "cancelled" || status === "refunded" ? finalReason : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert("✅ Cập nhật trạng thái đơn thành công!");
        setSelectedOrder(null);
        setRefundModalOrder(null);
        setCancelReason("");
        setRefundReason("");
        fetchOrders();
      } else {
        alert(data.message || "Cập nhật thất bại");
      }
    } catch (err) {
      alert("Lỗi cập nhật trạng thái");
    } finally {
      setActionLoading(false);
    }
  };

  // Badge hiển thị trạng thái chuẩn hóa
  const getStatusBadge = (status: string) => {
    const st = (status || "").toLowerCase();
    switch (st) {
      case "pending":
      case "finding_driver":
        return <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-bold">Chờ xác nhận</span>;
      case "accepted":
        return <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-2.5 py-0.5 rounded-full font-bold">Shop đã nhận</span>;
      case "preparing":
      case "processing":
        return <span className="bg-orange-500/10 text-orange-400 border border-orange-500/30 px-2.5 py-0.5 rounded-full font-bold">Đang làm</span>;
      case "assigned":
        return <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 px-2.5 py-0.5 rounded-full font-bold">Đã gán Shipper</span>;
      case "delivering":
      case "picking_up":
      case "shipping":
        return <span className="bg-blue-500/10 text-blue-400 border border-blue-500/30 px-2.5 py-0.5 rounded-full font-bold">Đang giao</span>;
      case "completed":
      case "delivered":
        return <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-bold">Hoàn thành</span>;
      case "cancelled":
        return <span className="bg-rose-500/10 text-rose-400 border border-rose-500/30 px-2.5 py-0.5 rounded-full font-bold">Đã Hủy</span>;
      case "refunded":
        return <span className="bg-purple-500/10 text-purple-400 border border-purple-500/30 px-2.5 py-0.5 rounded-full font-bold">Đã Hoàn Tiền</span>;
      default:
        return <span className="bg-slate-700 text-slate-300 px-2.5 py-0.5 rounded-full font-bold">{status}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 md:p-8 space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-2">
            📦 Điều Phối & Quản Lý Đơn Hàng Realtime
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-1">
            Đồng bộ theo luồng trạng thái Người bán: Chờ xác nhận ➔ Shop đã nhận ➔ Đang làm ➔ Đang giao ➔ Hoàn thành.
          </p>
        </div>
        <button
          onClick={fetchOrders}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition flex items-center gap-2 cursor-pointer"
        >
          🔄 Làm Mới Dữ Liệu
        </button>
      </div>

      {/* Filter Tabs được chuẩn hóa theo ORDER_STEPS */}
      <div className="flex flex-wrap gap-2 bg-slate-800/40 p-1.5 rounded-2xl border border-slate-700/60 text-xs font-bold">
        <button
          onClick={() => setStatusFilter("ALL")}
          className={`px-4 py-2 rounded-xl transition cursor-pointer ${
            statusFilter === "ALL"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
        >
          Tất Cả
        </button>

        {ORDER_STEPS.map((step) => (
          <button
            key={step.key}
            onClick={() => setStatusFilter(step.key)}
            className={`px-4 py-2 rounded-xl transition cursor-pointer ${
              statusFilter === step.key
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            {step.label}
          </button>
        ))}

        <button
          onClick={() => setStatusFilter("cancelled")}
          className={`px-4 py-2 rounded-xl transition cursor-pointer ${
            statusFilter === "cancelled"
              ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
        >
          Đã Hủy / Hoàn Tiền
        </button>
      </div>

      {/* Order Table */}
      <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl shadow-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Đang tải dữ liệu đơn hàng...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">Không tìm thấy đơn hàng phù hợp.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="text-slate-400 font-bold bg-slate-800/80 border-b border-slate-700/80 uppercase text-[10px]">
                  <th className="p-4">Mã Đơn</th>
                  <th className="p-4">Gian Hàng & Địa Chỉ Quán</th>
                  <th className="p-4">Khách Hàng & Địa Chỉ Giao</th>
                  <th className="p-4">Giá Trị & Thanh Toán</th>
                  <th className="p-4">Shipper Phụ Trách</th>
                  <th className="p-4">Trạng Thái (Shop)</th>
                  <th className="p-4 text-center">Hành Động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40 text-slate-300">
                {filteredOrders.map((order) => {
                  const storeAddress =
                    order.storeAddress ||
                    order.shopAddress ||
                    order.merchantAddress ||
                    order.storeInfo?.address ||
                    "Đang cập nhật địa chỉ quán";

                  const customerAddress =
                    order.shippingAddress?.address ||
                    order.customerAddress ||
                    order.address ||
                    "Địa chỉ giao hàng";

                  const isPaid = order.paymentStatus === "paid" || order.status === "paid" || order.isPaid;

                  return (
                    <tr key={order.id} className="hover:bg-slate-700/20 transition">
                      <td className="p-4 font-mono font-bold text-indigo-400">
                        #{order.id.slice(0, 8)}
                      </td>

                      <td className="p-4">
                        <div className="font-bold text-slate-100 flex items-center gap-1">
                          🏪 {order.storeName || order.merchantName || order.shopName || "Gian hàng"}
                        </div>
                        <div className="text-[11px] text-slate-400 line-clamp-1 max-w-xs mt-0.5">
                          {storeAddress}
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="font-bold text-slate-100 flex items-center gap-1">
                          📍 {order.customerName || order.shippingAddress?.fullName || order.userName || "Khách Vãng Lai"}
                        </div>
                        <div className="text-[11px] text-slate-400 line-clamp-1 max-w-xs mt-0.5">
                          {customerAddress}
                        </div>
                      </td>

                      <td className="p-4 whitespace-nowrap">
                        <div className="font-bold text-emerald-400 text-sm">
                          {(Number(order.totalPrice || order.total) || 0).toLocaleString("vi-VN")}đ
                        </div>
                        <div className="text-[10px] mt-0.5 flex items-center gap-1">
                          <span className="text-slate-400">{order.paymentMethod || "SePay QR"}</span>
                          {isPaid ? (
                            <span className="bg-emerald-500/20 text-emerald-400 font-bold px-1.5 py-0.2 rounded text-[9px]">Đã TT</span>
                          ) : (
                            <span className="bg-amber-500/20 text-amber-400 font-bold px-1.5 py-0.2 rounded text-[9px]">Chưa TT</span>
                          )}
                        </div>
                      </td>

                      <td className="p-4 whitespace-nowrap">
                        {order.shipperName ? (
                          <span className="font-bold text-indigo-300 flex items-center gap-1">
                            🛵 {order.shipperName}
                          </span>
                        ) : (
                          <span className="text-slate-500 italic">Chưa điều phối</span>
                        )}
                      </td>

                      <td className="p-4 whitespace-nowrap">{getStatusBadge(order.status)}</td>

                      <td className="p-4 text-center whitespace-nowrap space-x-2">
                        <button
                          onClick={() => {
                            setSelectedOrder(order);
                            setSelectedShipperId(order.shipperId || "");
                          }}
                          className="px-3 py-1.5 bg-indigo-600/80 hover:bg-indigo-600 text-white font-bold rounded-xl shadow-sm text-[11px] transition cursor-pointer"
                        >
                          ⚡ Chi Tiết
                        </button>

                        {/* Nút Hoàn tiền nhanh nếu đơn đã hủy hoặc đang muốn hoàn tiền */}
                        {(order.status === "cancelled" || isPaid) && order.status !== "refunded" && (
                          <button
                            onClick={() => {
                              setRefundModalOrder(order);
                              setRefundReason(order.cancelReason || "Hoàn tiền hủy đơn cho khách");
                            }}
                            className="px-3 py-1.5 bg-purple-600/80 hover:bg-purple-600 text-white font-bold rounded-xl shadow-sm text-[11px] transition cursor-pointer"
                          >
                            💰 Hoàn Tiền
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL CHI TIẾT & ĐIỀU PHỐI ĐƠN HÀNG */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden text-slate-200">
            {/* Modal Header */}
            <div className="bg-slate-800/80 px-6 py-4 border-b border-slate-700/60 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-white">📦 Chi Tiết Đơn Hàng #{selectedOrder.id}</h3>
                <p className="text-xs text-slate-400">
                  Thời gian tạo: {selectedOrder.createdAt?.seconds ? new Date(selectedOrder.createdAt.seconds * 1000).toLocaleString("vi-VN") : "Vừa xong"}
                </p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="text-slate-400 hover:text-white font-bold text-lg cursor-pointer">✕</button>
            </div>

            <div className="p-6 text-xs max-h-[75vh] overflow-y-auto space-y-5">
              {/* Tiến trình 5 bước ORDER_STEPS */}
              <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/60 space-y-2">
                <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider block">
                  Tiến Trình Đơn Hàng (Chuyển nhanh trạng thái)
                </span>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {ORDER_STEPS.map((step) => {
                    const isCurrent = (selectedOrder.status || "").toLowerCase() === step.key;
                    return (
                      <button
                        key={step.key}
                        disabled={actionLoading}
                        onClick={() => handleUpdateOrderStatus(step.key)}
                        className={`p-2 rounded-xl text-center text-[10px] font-bold border transition cursor-pointer ${
                          isCurrent
                            ? "bg-indigo-600 text-white border-indigo-400 shadow-md"
                            : "bg-slate-900/60 border-slate-700 text-slate-300 hover:border-indigo-500"
                        }`}
                      >
                        {step.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Thông tin Gian hàng & Khách hàng */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-800/40 p-4 rounded-2xl border border-slate-700/60">
                {/* 🏪 GIAN HÀNG */}
                <div className="space-y-1">
                  <span className="text-indigo-400 font-extrabold uppercase text-[10px] tracking-wider block">🏪 Thông Tin Quán</span>
                  <div className="font-bold text-white text-sm">
                    {selectedOrder.storeName || selectedOrder.merchantName || selectedOrder.shopName || "Gian hàng"}
                  </div>
                  <div className="text-slate-300">
                    SĐT: {selectedOrder.storePhone || selectedOrder.shopPhone || "Chưa có"}
                  </div>
                  <div className="text-slate-400 text-[11px]">
                    Địa chỉ: {selectedOrder.storeAddress || selectedOrder.shopAddress || selectedOrder.merchantAddress || "Chưa có địa chỉ quán"}
                  </div>
                  <button
                    onClick={() =>
                      openGoogleMaps(
                        selectedOrder.storeAddress || selectedOrder.shopAddress || selectedOrder.merchantAddress,
                        selectedOrder.storeLat,
                        selectedOrder.storeLng
                      )
                    }
                    className="mt-2 text-[10px] bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 font-bold px-2.5 py-1 rounded-lg border border-indigo-500/30 transition flex items-center gap-1 cursor-pointer"
                  >
                    🗺️ Xem Bản Đồ Quán
                  </button>
                </div>

                {/* 📍 KHÁCH HÀNG */}
                <div className="space-y-1">
                  <span className="text-emerald-400 font-extrabold uppercase text-[10px] tracking-wider block">📍 Khách Hàng</span>
                  <div className="font-bold text-white text-sm">
                    {selectedOrder.customerName || selectedOrder.shippingAddress?.fullName || selectedOrder.userName || "Khách hàng"}
                  </div>
                  <div className="text-slate-300">
                    SĐT: {selectedOrder.phone || selectedOrder.shippingAddress?.phone || selectedOrder.customerPhone || "Chưa có"}
                  </div>
                  <div className="text-slate-400 text-[11px]">
                    Địa chỉ: {selectedOrder.shippingAddress?.address || selectedOrder.customerAddress || selectedOrder.address || "Chưa có địa chỉ khách"}
                  </div>
                  <button
                    onClick={() =>
                      openGoogleMaps(
                        selectedOrder.shippingAddress?.address || selectedOrder.customerAddress || selectedOrder.address
                      )
                    }
                    className="mt-2 text-[10px] bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold px-2.5 py-1 rounded-lg border border-emerald-500/30 transition flex items-center gap-1 cursor-pointer"
                  >
                    🗺️ Xem Bản Đồ Khách
                  </button>
                </div>
              </div>

              {/* Danh Sách Món Ăn/Sản Phẩm Trong Đơn */}
              <div className="space-y-2">
                <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider block">Chi Tiết Sản Phẩm trong Đơn</span>
                <div className="bg-slate-800/40 rounded-2xl border border-slate-700/60 p-3 divide-y divide-slate-700/40">
                  {(selectedOrder.items || selectedOrder.products || []).map((item: any, idx: number) => (
                    <div key={idx} className="py-2 flex justify-between items-center">
                      <div>
                        <div className="font-bold text-slate-200">{item.name || item.productName || "Sản phẩm"}</div>
                        <div className="text-[11px] text-slate-400">Số lượng: x{item.quantity || 1}</div>
                      </div>
                      <div className="font-bold text-slate-100">
                        {(Number(item.price || 0) * Number(item.quantity || 1)).toLocaleString("vi-VN")}đ
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* PHÂN CÔNG / ĐIỀU PHỐI SHIPPER */}
              <div className="bg-slate-800/60 p-4 rounded-2xl border border-indigo-500/30 space-y-3">
                <span className="text-indigo-400 font-bold text-xs flex items-center gap-1.5">
                  🛵 Điều Phối Shipper Nhận Đơn
                </span>
                <div className="flex gap-2">
                  <select
                    value={selectedShipperId}
                    onChange={(e) => setSelectedShipperId(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-700 text-white font-semibold rounded-xl p-2.5 text-xs outline-none focus:border-indigo-500"
                  >
                    <option value="">-- Chọn Shipper Khả Dụng --</option>
                    {shippers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.fullName || s.name || "Shipper"} ({s.phone || "SĐT N/A"})
                      </option>
                    ))}
                  </select>
                  <button
                    disabled={actionLoading || !selectedShipperId}
                    onClick={handleAssignShipper}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white font-bold px-4 py-2.5 rounded-xl transition cursor-pointer"
                  >
                    Gán Shipper
                  </button>
                </div>
              </div>

              {/* XỬ LÝ KHIẾU NẠI / HỦY ĐƠN & HOÀN TIỀN */}
              <div className="bg-slate-800/60 p-4 rounded-2xl border border-rose-500/30 space-y-3">
                <span className="text-rose-400 font-bold text-xs flex items-center gap-1.5">
                  ⚠️ Xử Lý Khiếu Nại / Hủy Đơn & Hoàn Tiền
                </span>
                <textarea
                  rows={2}
                  placeholder="Nhập lý do hủy đơn hoặc căn cứ hoàn tiền cho khách..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-white font-semibold rounded-xl p-2.5 text-xs outline-none focus:border-rose-500 resize-none"
                />
                <div className="flex gap-2">
                  <button
                    disabled={actionLoading}
                    onClick={() => handleUpdateOrderStatus("cancelled")}
                    className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-2 rounded-xl transition cursor-pointer"
                  >
                    ✕ Hủy Đơn Hàng
                  </button>
                  <button
                    disabled={actionLoading}
                    onClick={() => {
                      setRefundModalOrder(selectedOrder);
                      setRefundReason(cancelReason || "Admin thực hiện hoàn tiền đơn hàng");
                    }}
                    className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 rounded-xl transition cursor-pointer"
                  >
                    💰 Bảng Mẫu Hoàn Tiền
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 💰 MODAL HOÀN TIỀN CHUYÊN NGHIỆP DÀNH CHO ADMIN (CÓ TỰ ĐỘNG TẠO MÃ VIETQR) */}
      {refundModalOrder && (() => {
        // Trích xuất ưu tiên dữ liệu refundBankInfo từ Firestore Document
        const refundInfo = refundModalOrder.refundBankInfo || refundModalOrder.userInfo?.refundBankInfo || {};

        // 1. Số tài khoản: Ưu tiên bankAccount trong refundBankInfo
        const targetAccount = 
          refundInfo.bankAccount || 
          refundModalOrder.bankAccount || 
          "";

        // 2. Tên chủ tài khoản: Ưu tiên bankOwner trong refundBankInfo
        const targetOwner = 
          refundInfo.bankOwner || 
          refundModalOrder.bankOwner || 
          refundModalOrder.customerName || 
          refundModalOrder.recipientName || 
          refundModalOrder.shippingAddress?.fullName || 
          "Khách hàng";

        // 3. Tên Ngân Hàng: Ưu tiên bankName/bankCode trong refundBankInfo
        const targetBankName = 
          refundInfo.bankName || 
          refundModalOrder.bankName || 
          refundInfo.bankCode || 
          "Chưa cập nhật ngân hàng";

        const targetBankCodeRaw = refundInfo.bankCode || refundModalOrder.bankCode || targetBankName;

        const refundAmount = Number(refundModalOrder.paidAmount || refundModalOrder.totalPrice || refundModalOrder.total) || 0;
        const memoText = `HOANTIEN ${refundModalOrder.paymentCode || refundModalOrder.id.slice(0, 8).toUpperCase()}`;

        // Lấy mã ngân hàng rút gọn (BIN) tương ứng với Tên Ngân Hàng/Mã Ngân Hàng
        const bankCode = VIETQR_BANK_MAP[targetBankCodeRaw] || VIETQR_BANK_MAP[targetBankName] || "MB";

        // URL tạo mã VietQR tự động
        const qrUrl = targetAccount
          ? `https://img.vietqr.io/image/${bankCode}-${targetAccount}-compact2.png?amount=${refundAmount}&addInfo=${encodeURIComponent(memoText)}&accountName=${encodeURIComponent(targetOwner)}`
          : null;

        return (
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-purple-500/40 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden text-slate-200">
              {/* Header Modal Hoàn Tiền */}
              <div className="bg-purple-950/60 px-6 py-4 border-b border-purple-500/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">💰</span>
                  <div>
                    <h3 className="font-extrabold text-base text-white">Xác Nhận Hoàn Tiền Cho Khách</h3>
                    <p className="text-[11px] text-purple-300">Đơn hàng #{refundModalOrder.id}</p>
                  </div>
                </div>
                <button onClick={() => setRefundModalOrder(null)} className="text-slate-400 hover:text-white font-bold text-lg cursor-pointer">✕</button>
              </div>

              <div className="p-6 text-xs space-y-4 max-h-[80vh] overflow-y-auto">
                {/* 🖼️ MÃ QR CHUYỂN TIỀN TỰ ĐỘNG VIETQR */}
                {qrUrl ? (
                  <div className="bg-white p-3 rounded-2xl flex flex-col items-center justify-center shadow-lg border border-purple-500/30">
                    <img 
                      src={qrUrl} 
                      alt="VietQR Hoàn Tiền" 
                      className="w-56 h-auto object-contain rounded-lg"
                    />
                    <span className="text-slate-800 font-bold text-[11px] mt-1.5 flex items-center gap-1">
                      ⚡ Quét mã bằng App Ngân Hàng bất kỳ để chuyển tiền
                    </span>
                  </div>
                ) : (
                  <div className="bg-purple-900/30 border border-purple-500/30 p-4 rounded-2xl text-center relative">
                    <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider block">Số Tiền Hoàn Trả Khách</span>
                    <div className="text-2xl font-black text-purple-300 mt-1 flex items-center justify-center gap-2">
                      {refundAmount.toLocaleString("vi-VN")}đ
                      <button
                        onClick={() => handleCopy(refundAmount.toString(), "amount")}
                        className="text-[10px] bg-purple-800/60 hover:bg-purple-700 text-purple-200 px-2 py-0.5 rounded transition"
                      >
                        {copiedField === "amount" ? "✓ Đã copy" : "Copy"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Thông tin nhận lại tiền của khách */}
                <div className="bg-slate-800/60 border border-slate-700 p-4 rounded-2xl space-y-2.5">
                  <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider block">
                    Thông Tin Tài Khoản Nhận
                  </span>

                  {/* Tên chủ tài khoản */}
                  <div className="flex justify-between items-center py-1 border-b border-slate-700/50">
                    <span className="text-slate-400">Chủ tài khoản:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white uppercase">{targetOwner}</span>
                      <button
                        onClick={() => handleCopy(targetOwner, "owner")}
                        className="text-[10px] bg-slate-700 hover:bg-slate-600 px-2 py-0.5 rounded text-slate-200 transition"
                      >
                        {copiedField === "owner" ? "✓ Đã copy" : "Copy"}
                      </button>
                    </div>
                  </div>

                  {/* Số tài khoản */}
                  <div className="flex justify-between items-center py-1 border-b border-slate-700/50">
                    <span className="text-slate-400">Số tài khoản:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-indigo-300 text-sm">
                        {targetAccount || "Chưa cập nhật STK"}
                      </span>
                      {targetAccount && (
                        <button
                          onClick={() => handleCopy(targetAccount, "stk")}
                          className="text-[10px] bg-slate-700 hover:bg-slate-600 px-2 py-0.5 rounded text-slate-200 transition"
                        >
                          {copiedField === "stk" ? "✓ Đã copy" : "Copy"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Tên Ngân hàng */}
                  <div className="flex justify-between items-center py-1 border-b border-slate-700/50">
                    <span className="text-slate-400">Phương thức / Ngân hàng:</span>
                    <span className="font-bold text-amber-400">
                      {targetBankName}
                    </span>
                  </div>

                  {/* Nội dung chuyển khoản */}
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-400">Nội dung chuyển khoản:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-amber-300">
                        {memoText}
                      </span>
                      <button
                        onClick={() => handleCopy(memoText, "memo")}
                        className="text-[10px] bg-slate-700 hover:bg-slate-600 px-2 py-0.5 rounded text-slate-200 transition"
                      >
                        {copiedField === "memo" ? "✓ Đã copy" : "Copy"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Lý do hoàn tiền */}
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold uppercase text-[10px] tracking-wider block">
                    Lý do hoàn tiền (Căn cứ lưu trữ)
                  </label>
                  <textarea
                    rows={2}
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    placeholder="Nhập lý do hoàn tiền..."
                    className="w-full bg-slate-900 border border-slate-700 text-white font-semibold rounded-xl p-2.5 text-xs outline-none focus:border-purple-500 resize-none"
                  />
                </div>

                {/* Hướng dẫn thao tác */}
                <p className="text-[11px] text-amber-400/90 italic bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
                  💡 Admin dùng App <strong>{targetBankName}</strong> hoặc App Bank quét/copy các thông tin trên để chuyển trả tiền cho khách. Sau khi chuyển hoàn tất, bấm nút xác nhận bên dưới.
                </p>

                {/* Action buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setRefundModalOrder(null)}
                    className="w-1/3 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition cursor-pointer"
                  >
                    Hủy Bỏ
                  </button>
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleUpdateOrderStatus("refunded", refundReason)}
                    className="w-2/3 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl shadow-lg shadow-purple-600/30 transition cursor-pointer flex items-center justify-center gap-2"
                  >
                    {actionLoading ? "Đang xử lý..." : "✓ Đã Hoàn Tiền Thành Công"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}