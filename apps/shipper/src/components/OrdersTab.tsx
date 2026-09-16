"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@cho-online/firebase";
import { collection, onSnapshot, doc, updateDoc } from "firebase/firestore";

interface ReviewInfo {
  driverRating?: number;
  driverComment?: string;
  reviewedAt?: string;
}

interface OrderItem {
  id: string;
  storeName: string;
  storeAddress: string;
  storeLat?: number;
  storeLng?: number;
  customerLat?: number;
  customerLng?: number;
  distanceKm?: number;
  distanceStr?: string;
  customerLocation?: { latitude?: number; longitude?: number };
  storePhone?: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress: string;
  shippingFee: number;
  totalAmount?: number;
  paymentMethod?: string;
  amountToCollect?: number;
  items?: Array<{
    name: string;
    quantity: number;
    price?: number;
    note?: string;
  }>;
  note?: string;
  status: string;
  shipperId?: string | null;
  createdAt?: any;
  reviewInfo?: ReviewInfo;
  rawData?: any;
}

export default function OrdersTab() {
  const { profile } = useAuth();
  const [filter, setFilter] = useState<
    "ALL" | "AVAILABLE" | "DELIVERING" | "COMPLETED"
  >("AVAILABLE");
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 🗺️ Hàm hỗ trợ mở ứng dụng Bản đồ Google Maps
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

  // 1. Lắng nghe toàn bộ Đơn hàng Realtime từ Firestore
  useEffect(() => {
    if (!profile?.uid) {
      setLoading(false);
      return;
    }

    const ordersRef = collection(db, "orders");

    const unsubscribe = onSnapshot(
      ordersRef,
      (snapshot) => {
        const fetchedOrders: OrderItem[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();

          const resolvedStorePhone =
            data.storePhone ||
            data.shopPhone ||
            data.merchantPhone ||
            data.restaurantPhone ||
            "";

          const resolvedCustomerPhone =
            data.customerPhone ||
            data.recipientPhone ||
            data.userPhone ||
            data.phone ||
            "";

          const rawItems = data.items || data.products || data.cart || [];
          const parsedItems = Array.isArray(rawItems)
            ? rawItems.map((item: any) => ({
                name: item.name || item.title || item.productName || "Món ăn",
                quantity: Number(item.quantity || item.qty || item.count || 1),
                price: Number(item.price || item.unitPrice || 0),
                note: item.note || item.options || "",
              }))
            : [];

          // Tính tổng giá trị tiền món ăn gốc/chưa giảm
          const calculatedItemsTotal = parsedItems.reduce(
            (sum: number, item: any) => sum + item.price * item.quantity,
            0
          );

          const shippingFee = Number(data.shippingFee) || 0;

          // Tiền món hiển thị riêng
          const totalAmount = Number(
            data.subTotalPrice ?? data.subtotalPrice ?? calculatedItemsTotal
          );

          // Tổng thanh toán thực tế của đơn (Đã tính Phí ship, Voucher, Điểm thưởng)
          const totalPrice = Number(
            data.totalPrice ?? data.totalAmount ?? data.grandTotal ?? (totalAmount + shippingFee)
          );

          // 🔍 Lấy chính xác paymentMethod
          const rawPaymentMethod = String(
            data.paymentMethod || data.paymentType || "cod"
          ).trim().toUpperCase();

          // Cập nhật chính xác số tiền COD thực tế tài xế cần thu từ khách
          const amountToCollect =
            data.amountToCollect !== undefined && data.amountToCollect !== null
              ? Number(data.amountToCollect)
              : totalPrice;

          return {
            id: docSnap.id,
            storeName: data.storeName || data.shopName || "Cửa hàng",
            storeAddress:
              data.storeAddress ||
              data.shopAddress ||
              data.merchantAddress ||
              "Đang cập nhật địa chỉ quán",
            storeLat: Number(data.storeLat ?? data.storeLocation?.latitude ?? 0) || undefined,
            storeLng: Number(data.storeLng ?? data.storeLocation?.longitude ?? 0) || undefined,
            customerLat: Number(data.customerLat ?? data.location?.latitude ?? data.lat ?? 0) || undefined,
            customerLng: Number(data.customerLng ?? data.location?.longitude ?? data.lng ?? 0) || undefined,
            customerLocation: data.location
              ? {
                  latitude: Number(data.location.latitude) || undefined,
                  longitude: Number(data.location.longitude) || undefined,
                }
              : undefined,
            distanceKm: Number(data.distanceKm) || undefined,
            distanceStr: data.distanceStr || undefined,
            storePhone: resolvedStorePhone,
            customerName:
              data.customerName || data.recipientName || "Khách hàng",
            customerPhone: resolvedCustomerPhone,
            customerAddress:
              data.customerAddress ||
              data.address ||
              "Địa chỉ giao hàng",
            shippingFee,
            totalAmount,
            paymentMethod: rawPaymentMethod,
            amountToCollect,
            items: parsedItems,
            note: data.note || data.customerNote || "",
            status: (data.status || "pending").toLowerCase(),
            shipperId: data.shipperId || null,
            createdAt: data.createdAt || data.acceptedAt || null,
            reviewInfo: data.reviewInfo || null,
            rawData: data,
          };
        });

        // 🔥 SẮP XẾP ĐƠN HÀNG MỚI NHẤT LÊN TRÊN CÙNG
        fetchedOrders.sort((a, b) => {
          const getTime = (val: any) => {
            if (!val) return 0;
            if (typeof val.toDate === "function") return val.toDate().getTime();
            if (typeof val === "string" || typeof val === "number") return new Date(val).getTime();
            return 0;
          };
          return getTime(b.createdAt) - getTime(a.createdAt);
        });

        console.groupCollapsed(`📦 [ORDERS] Firestore realtime: ${fetchedOrders.length} đơn`);
        console.table(
          fetchedOrders.map((o) => ({
            id: o.id,
            status: o.status,
            shipperId: o.shipperId || "",
            store: o.storeName,
            customer: o.customerName || "",
            storeLat: o.storeLat ?? "",
            storeLng: o.storeLng ?? "",
            customerLat: o.customerLat ?? "",
            customerLng: o.customerLng ?? "",
            distanceKm: o.distanceKm ?? "",
            shippingFee: o.shippingFee,
            totalAmount: o.totalAmount ?? 0,
            totalPrice: Number(o.rawData?.totalPrice ?? o.amountToCollect ?? 0),
          }))
        );
        console.log("📦 Orders mapped:", fetchedOrders);
        fetchedOrders.forEach((order) => {
          console.groupCollapsed(`🧾 Order ${order.id}`);
          console.log("Raw Firestore:", order.rawData);
          console.log("Shop:", { address: order.storeAddress, lat: order.storeLat, lng: order.storeLng });
          console.log("Customer:", { address: order.customerAddress, lat: order.customerLat, lng: order.customerLng, location: order.customerLocation });
          console.log("Route:", { distanceKm: order.distanceKm, distanceStr: order.distanceStr, shippingFee: order.shippingFee });
          console.log("Items:", order.items);
          console.groupEnd();
        });
        console.groupEnd();

        setOrders(fetchedOrders);
        setLoading(false);
      },
      (error) => {
        console.error("❌ Lỗi Realtime Firestore Orders:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [profile?.uid]);

  // 2. Lọc đơn hàng
  const filteredOrders = orders.filter((order) => {
    const status = (order.status || "").toLowerCase();
    const isMyOrder = order.shipperId === profile?.uid;
    const isUnassigned = !order.shipperId;

    // Bổ sung ready_for_pickup và ready vào điều kiện đơn sẵn có
    const isAvailableStatus = [
      "pending",
      "finding_driver",
      "preparing",
      "processing",
      "accepted",
      "ready_for_pickup",
      "ready",
    ].includes(status);

    // Bổ sung ready_for_pickup và ready vào điều kiện đang giao
    const isDeliveringStatus = [
      "assigned",
      "picking_up",
      "delivering",
      "shipping",
      "preparing",
      "processing",
      "accepted",
      "ready_for_pickup",
      "ready",
    ].includes(status);

    if (filter === "AVAILABLE") {
      return isUnassigned && isAvailableStatus;
    }
    if (filter === "DELIVERING") {
      return isMyOrder && isDeliveringStatus;
    }
    if (filter === "COMPLETED") {
      return isMyOrder && status === "completed";
    }
    return true;
  });

  // 3. Hàm cập nhật trạng thái đơn hàng (Đồng bộ với trạng thái Quán)
  const handleUpdateStatus = async (
    id: string,
    nextStatus: string,
    alertText?: string,
    autoOpenMapsAddress?: string,
    lat?: number,
    lng?: number
  ) => {
    if (!profile?.uid) return;

    const currentOrder = orders.find((o) => o.id === id);

    try {
      const orderRef = doc(db, "orders", id);
      const updateData: any = {
        updatedAt: new Date().toISOString(),
      };

      // 🛠️ GIỮ NGUYÊN TRẠNG THÁI QUÁN:
      // Nếu Shipper bấm nhận đơn lần đầu:
      // - Gán thông tin Shipper.
      // - Nếu đơn hàng ở trạng thái Quán đang xử lý ("accepted", "preparing", "processing", "ready_for_pickup", "ready"),
      //   GIỮ NGUYÊN trạng thái đó. Chỉ đổi status nếu đơn đang là "pending" hoặc "finding_driver".
      if (!currentOrder?.shipperId) {
        updateData.shipperId = profile.uid;
        updateData.shipperName = profile.fullName || "Tài xế";
        updateData.acceptedAt = new Date().toISOString();

        const storeWorkingStatuses = [
          "accepted",
          "preparing",
          "processing",
          "ready_for_pickup",
          "ready",
        ];
        if (storeWorkingStatuses.includes(currentOrder?.status || "")) {
          // Giữ nguyên status hiện tại của Quán
          updateData.status = currentOrder?.status;
        } else {
          updateData.status = nextStatus;
        }
      } else {
        // Nếu đã có shipperId rồi (các bước sau như Lấy hàng/Hoàn thành), cập nhật status bình thường
        updateData.status = nextStatus;
      }

      if (nextStatus === "completed") {
        updateData.completedAt = new Date().toISOString();
      }

      await updateDoc(orderRef, updateData);

      if (alertText) {
        alert(alertText);
      }

      if (autoOpenMapsAddress) {
        console.log("🗺️ Opening Google Maps:", { address: autoOpenMapsAddress, lat, lng });
        openGoogleMaps(autoOpenMapsAddress, lat, lng);
      }

      if (filter === "AVAILABLE") {
        setFilter("DELIVERING");
      }
    } catch (error) {
      console.error("Lỗi cập nhật trạng thái đơn:", error);
      alert("Không thể cập nhật đơn hàng. Vui lòng thử lại!");
    }
  };

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center p-8">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-0 flex-1 overflow-y-auto p-4 space-y-4 pb-32 font-sans touch-pan-y">
      {/* Header Tab */}
      <div className="flex items-center justify-between shrink-0">
        <h2 className="text-base font-extrabold text-slate-800">
          Quản lý Đơn hàng
        </h2>
        <span className="text-xs font-bold text-slate-400">
          Hiển thị: {filteredOrders.length} / {orders.length} đơn
        </span>
      </div>

      {/* Bộ lọc tab */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl text-[11px] font-bold shrink-0">
        <button
          onClick={() => setFilter("AVAILABLE")}
          className={`flex-1 py-2 rounded-xl transition cursor-pointer ${
            filter === "AVAILABLE"
              ? "bg-white text-emerald-600 shadow-xs"
              : "text-slate-400 hover:text-slate-600"
          }`}
        >
          Mới tinh 🔔 (
          {
            orders.filter(
              (o) =>
                !o.shipperId &&
                [
                  "pending",
                  "finding_driver",
                  "preparing",
                  "processing",
                  "accepted",
                  "ready_for_pickup",
                  "ready",
                ].includes(o.status)
            ).length
          }
          )
        </button>
        <button
          onClick={() => setFilter("DELIVERING")}
          className={`flex-1 py-2 rounded-xl transition cursor-pointer ${
            filter === "DELIVERING"
              ? "bg-white text-amber-600 shadow-xs"
              : "text-slate-400 hover:text-slate-600"
          }`}
        >
          Đang giao 🛵 (
          {
            orders.filter(
              (o) =>
                o.shipperId === profile?.uid &&
                [
                  "delivering",
                  "assigned",
                  "picking_up",
                  "shipping",
                  "preparing",
                  "processing",
                  "accepted",
                  "ready_for_pickup",
                  "ready",
                ].includes(o.status)
            ).length
          }
          )
        </button>
        <button
          onClick={() => setFilter("COMPLETED")}
          className={`flex-1 py-2 rounded-xl transition cursor-pointer ${
            filter === "COMPLETED"
              ? "bg-white text-blue-600 shadow-xs"
              : "text-slate-400 hover:text-slate-600"
          }`}
        >
          Đã xong 🎉
        </button>
      </div>

      {/* Danh sách đơn hàng */}
      <div className="space-y-3 pb-6">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs font-medium space-y-1">
            <p>Chưa có đơn hàng nào trong mục này</p>
            <p className="text-[10px] text-slate-300">
              Đơn mới tạo sẽ lập tức xuất hiện ở đây
            </p>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const isAvailable = !order.shipperId;
            const isMyOrder = order.shipperId === profile?.uid;

            // 💵 Kiểm tra nếu phương thức thanh toán là COD / Tiền mặt
            const isCOD =
              !order.paymentMethod ||
              order.paymentMethod === "COD" ||
              order.paymentMethod === "CASH" ||
              order.paymentMethod === "TIEN_MAT";

            const isReadyForPickup =
              order.status === "ready_for_pickup" || order.status === "ready";

            return (
              <div
                key={order.id}
                className="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs space-y-3"
              >
                {/* ID Đơn & Trạng thái */}
                <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                  <span className="font-extrabold text-xs text-slate-800">
                    #{order.id.slice(0, 8)}
                  </span>

                  <span
                    className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full ${
                      isAvailable
                        ? "bg-purple-50 text-purple-600 border border-purple-100 animate-pulse"
                        : isReadyForPickup
                        ? "bg-teal-50 text-teal-700 border border-teal-200 animate-pulse"
                        : order.status === "assigned"
                        ? "bg-blue-50 text-blue-600 border border-blue-100"
                        : order.status === "picking_up"
                        ? "bg-orange-50 text-orange-600 border border-orange-100 animate-pulse"
                        : order.status === "completed"
                        ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                        : "bg-amber-50 text-amber-600 border border-amber-100"
                    }`}
                  >
                    {isAvailable
                      ? "Đơn mới chờ nhận"
                      : isReadyForPickup
                      ? "🛍️ Quán đã làm xong - Chờ lấy"
                      : order.status === "assigned"
                      ? "Đã nhận đơn"
                      : order.status === "picking_up"
                      ? "Đang tới lấy hàng"
                      : order.status === "completed"
                      ? "Hoàn thành"
                      : "Đang giao hàng"}
                  </span>
                </div>

                {/* THÔNG TIN QUÁN & KHÁCH HÀNG */}
                <div className="space-y-2.5 text-xs">
                  {/* QUÁN ĂN */}
                  <div className="flex justify-between items-start gap-2 bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                    <div className="flex-1">
                      <p className="font-bold text-slate-900 flex items-center gap-1 text-xs">
                        <span>🏪</span> {order.storeName}
                      </p>
                      <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                        📍 {order.storeAddress}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {order.storePhone ? (
                        <a
                          href={`tel:${order.storePhone}`}
                          className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-2 py-1 rounded-lg text-[10px] flex items-center gap-1 transition shadow-xs"
                        >
                          📞 Gọi quán
                        </a>
                      ) : (
                        <span className="text-[10px] text-slate-300 font-medium">
                          Chưa có SĐT
                        </span>
                      )}

                      <button
                        onClick={() =>
                          openGoogleMaps(
                            order.storeAddress,
                            order.storeLat,
                            order.storeLng
                          )
                        }
                        className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold px-2 py-1 rounded-lg text-[10px] flex items-center gap-1 transition border border-indigo-100 cursor-pointer"
                      >
                        🗺️ Maps
                      </button>
                    </div>
                  </div>

                  {/* KHÁCH HÀNG */}
                  <div className="flex justify-between items-start gap-2 bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                    <div className="flex-1">
                      <p className="font-bold text-slate-800 flex items-center gap-1 text-xs">
                        <span>👤</span> {order.customerName}
                      </p>
                      <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                        📍 {order.customerAddress}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {order.customerPhone ? (
                        <a
                          href={`tel:${order.customerPhone}`}
                          className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-2 py-1 rounded-lg text-[10px] flex items-center gap-1 transition shadow-xs"
                        >
                          📞 Gọi khách
                        </a>
                      ) : (
                        <span className="text-[10px] text-slate-300 font-medium">
                          Chưa có SĐT
                        </span>
                      )}

                      <button
                        onClick={() => {
                          console.log("🗺️ CUSTOMER MAP CLICK", {
                            orderId: order.id,
                            address: order.customerAddress,
                            customerLat: order.customerLat,
                            customerLng: order.customerLng,
                            location: order.customerLocation,
                          });
                          openGoogleMaps(
                            order.customerAddress,
                            order.customerLat,
                            order.customerLng
                          );
                        }}
                        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-600 font-bold px-2 py-1 rounded-lg text-[10px] flex items-center gap-1 transition border border-emerald-100 cursor-pointer"
                      >
                        🗺️ Maps
                      </button>
                    </div>
                  </div>
                </div>

                {/* THÔNG TIN DANH SÁCH MÓN ĂN */}
                <div className="bg-amber-50/40 border border-amber-100/60 rounded-xl p-2.5 text-xs space-y-2">
                  <p className="font-extrabold text-amber-900 text-[11px] uppercase tracking-wider flex items-center justify-between border-b border-amber-100/80 pb-1">
                    <span>🛍️ Danh sách món ({order.items?.length || 0})</span>
                    {order.totalAmount ? (
                      <span className="text-slate-700 font-bold">
                        Tiền món: {order.totalAmount.toLocaleString("vi-VN")} đ
                      </span>
                    ) : null}
                  </p>

                  {order.items && order.items.length > 0 ? (
                    <div className="space-y-1">
                      {order.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between items-center text-[11px]"
                        >
                          <span className="font-semibold text-slate-800">
                            <span className="text-amber-600 font-bold mr-1">
                              x{item.quantity}
                            </span>{" "}
                            {item.name}
                            {item.note && (
                              <span className="text-slate-400 text-[10px] italic block">
                                (Ghi chú: {item.note})
                              </span>
                            )}
                          </span>
                          {item.price ? (
                            <span className="text-slate-600 font-medium shrink-0">
                              {(item.price * item.quantity).toLocaleString(
                                "vi-VN"
                              )}{" "}
                              đ
                            </span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic">
                      Chi tiết món ăn đang được cập nhật...
                    </p>
                  )}

                  {order.note && (
                    <div className="pt-1 border-t border-amber-100 text-[11px] text-rose-600 font-medium">
                      📝 <span className="font-bold">Ghi chú:</span> {order.note}
                    </div>
                  )}
                </div>

                {/* HIỂN THỊ THÔNG TIN COD VÀ SỐ TIỀN CẦN THU */}
                {isCOD ? (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs flex items-center justify-between shadow-xs">
                    <div>
                      <span className="text-[10px] font-black text-rose-600 uppercase tracking-wider block flex items-center gap-1">
                        🏷️ Hình thức: Thanh toán COD (Tiền mặt)
                      </span>
                      <span className="text-xs font-bold text-slate-800 mt-0.5 block">
                        Số tiền cần thu từ khách:
                      </span>
                    </div>
                    <span className="text-base font-black text-rose-600">
                      {(order.amountToCollect || 0).toLocaleString("vi-VN")} đ
                    </span>
                  </div>
                ) : (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-xs flex items-center justify-between">
                    <span className="text-[11px] font-extrabold text-emerald-700 flex items-center gap-1">
                      💳 Đã thanh toán chuyển khoản
                    </span>
                    <span className="text-[11px] font-bold text-emerald-600">
                      Khách không cần trả thêm
                    </span>
                  </div>
                )}

                {/* HIỂN THỊ ĐÁNH GIÁ TÀI XẾ */}
                {order.reviewInfo && (order.reviewInfo.driverRating || order.reviewInfo.driverComment) ? (
                  <div className="bg-amber-50/80 border border-amber-200/70 rounded-xl p-2.5 text-xs space-y-1.5">
                    <div className="flex items-center justify-between border-b border-amber-200/50 pb-1">
                      <span className="font-extrabold text-amber-900 text-[11px] flex items-center gap-1">
                        💬 Đánh giá dành cho tài xế
                      </span>
                      {order.reviewInfo.driverRating ? (
                        <span className="font-black text-amber-600 text-xs">
                          {"⭐".repeat(order.reviewInfo.driverRating)} ({order.reviewInfo.driverRating}/5)
                        </span>
                      ) : null}
                    </div>

                    {order.reviewInfo.driverComment && (
                      <p className="text-slate-700 font-medium text-[11px] italic">
                        🛵 <span className="font-semibold text-slate-900">Khách nhận xét:</span> &ldquo;{order.reviewInfo.driverComment}&rdquo;
                      </p>
                    )}
                  </div>
                ) : order.status === "completed" ? (
                  <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 text-center">
                    <span className="text-[10px] text-slate-400 font-semibold italic">
                      Khách hàng chưa để lại đánh giá cho tài xế
                    </span>
                  </div>
                ) : null}

                {/* NÚT THAO TÁC SHIPPER */}
                <div className="flex items-center justify-end pt-2 border-t border-slate-50">
                  {isAvailable && (
                    <button
                      onClick={() =>
                        handleUpdateStatus(
                          order.id,
                          "assigned",
                          `🎉 Bạn đã nhận thành công đơn hàng #${order.id.slice(
                            0,
                            8
                          )}!`
                        )
                      }
                      className="bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-extrabold px-3.5 py-2 rounded-xl text-[11px] transition shadow-xs cursor-pointer"
                    >
                      ⚡ Nhận đơn ngay
                    </button>
                  )}

                  {isMyOrder &&
                    (order.status === "assigned" ||
                      order.status === "accepted" ||
                      order.status === "preparing" ||
                      order.status === "processing" ||
                      isReadyForPickup) && (
                      <button
                        onClick={() =>
                          handleUpdateStatus(
                            order.id,
                            "picking_up",
                            undefined,
                            order.storeAddress,
                            order.storeLat,
                            order.storeLng
                          )
                        }
                        className={`active:scale-95 text-white font-extrabold px-3 py-2 rounded-xl text-[11px] transition shadow-xs cursor-pointer flex items-center gap-1 ${
                          isReadyForPickup
                            ? "bg-teal-600 hover:bg-teal-700 ring-2 ring-teal-200"
                            : "bg-orange-500 hover:bg-orange-600"
                        }`}
                      >
                        {isReadyForPickup ? "🛍️ Quán đã làm xong - Đến lấy hàng" : "🚀 Đến lấy hàng & Mở Bản đồ"}
                      </button>
                    )}

                  {isMyOrder && order.status === "picking_up" && (
                    <button
                      onClick={() =>
                        handleUpdateStatus(
                          order.id,
                          "delivering",
                          undefined,
                          order.customerAddress,
                          order.customerLat,
                          order.customerLng
                        )
                      }
                      className="bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-extrabold px-3 py-2 rounded-xl text-[11px] transition shadow-xs cursor-pointer flex items-center gap-1"
                    >
                      🛵 Đã lấy hàng & Giao tới khách
                    </button>
                  )}

                  {isMyOrder &&
                    (order.status === "delivering" ||
                      order.status === "shipping") && (
                      <button
                        onClick={() =>
                          handleUpdateStatus(
                            order.id,
                            "completed",
                            `✅ Đã xác nhận giao thành công đơn #${order.id.slice(
                              0,
                              8
                            )}!`
                          )
                        }
                        className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold px-3 py-2 rounded-xl text-[11px] transition cursor-pointer"
                      >
                        ✓ Đã giao thành công
                      </button>
                    )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}