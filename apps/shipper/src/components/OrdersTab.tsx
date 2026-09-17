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

  // =========================
  // STORE
  // =========================
  storeName: string;
  storeAddress: string;
  storeLat?: number;
  storeLng?: number;
  storePhone?: string;

  // =========================
  // CUSTOMER
  // =========================
  customerName?: string;
  customerPhone?: string;
  customerAddress: string;
  customerLat?: number;
  customerLng?: number;
  customerLocation?: {
    latitude?: number;
    longitude?: number;
  };

  // =========================
  // ROUTE
  // =========================
  distanceKm?: number;
  distanceStr?: string;

  // =========================
  // PAYMENT
  // =========================
  shippingFee: number;
  totalAmount: number; // tiền món
  totalPrice: number; // tổng đơn
  paymentMethod?: string;
  amountToCollect: number;

  // =========================
  // ITEMS
  // Không dùng price ở UI shipper
  // =========================
  items?: Array<{
    id?: string;
    name: string;
    quantity: number;
    note?: string;
  }>;

  note?: string;

  // =========================
  // STATUS
  // =========================
  status: string;
  shipperId?: string | null;
  createdAt?: any;

  // =========================
  // REVIEW
  // =========================
  reviewInfo?: ReviewInfo | null;

  // =========================
  // RAW DATA
  // =========================
  rawData?: any;
}

export default function OrdersTab() {
  const { profile } = useAuth();

  const [filter, setFilter] = useState<
    "ALL" | "AVAILABLE" | "DELIVERING" | "COMPLETED"
  >("AVAILABLE");

  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  // =========================================================
  // HELPER
  // =========================================================

  const formatMoney = (value: number) => {
    return `${Number(value || 0).toLocaleString("vi-VN")} đ`;
  };

  const getValidCoordinate = (value: any): number | undefined => {
    const number = Number(value);

    return Number.isFinite(number) ? number : undefined;
  };

  const getTotalItemQuantity = (
    items?: Array<{
      name: string;
      quantity: number;
      note?: string;
    }>
  ) => {
    return (
      items?.reduce((sum, item) => {
        return sum + (Number(item.quantity) || 0);
      }, 0) || 0
    );
  };

  // =========================================================
  // GOOGLE MAPS
  // =========================================================

  const openGoogleMaps = (
    address: string,
    lat?: number,
    lng?: number
  ) => {
    let mapsUrl = "";

    const hasValidCoordinates =
      Number.isFinite(lat) && Number.isFinite(lng);

    if (hasValidCoordinates) {
      mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    } else if (
      address &&
      address !== "Đang cập nhật địa chỉ" &&
      address !== "Địa chỉ giao hàng" &&
      address !== "Đang cập nhật địa chỉ quán"
    ) {
      const encodedAddress = encodeURIComponent(address);

      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
    } else {
      alert("Chưa có thông tin địa chỉ cụ thể!");
      return;
    }

    window.open(mapsUrl, "_blank", "noopener,noreferrer");
  };

  // =========================================================
  // 1. REALTIME ORDERS
  // =========================================================

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

          // =====================================================
          // STORE PHONE
          // =====================================================

          const resolvedStorePhone =
            data.storePhone ||
            data.shopPhone ||
            data.merchantPhone ||
            data.restaurantPhone ||
            "";

          // =====================================================
          // CUSTOMER PHONE
          // =====================================================

          const resolvedCustomerPhone =
            data.customerPhone ||
            data.recipientPhone ||
            data.userPhone ||
            data.phone ||
            "";

          // =====================================================
          // ITEMS
          // =====================================================
          //
          // Shipper KHÔNG cần thấy:
          // - price
          // - unitPrice
          // - originalPrice
          // - discount
          // - sale
          //
          // Chỉ lấy:
          // - tên
          // - số lượng
          // - ghi chú
          //

          const rawItems =
            data.items ||
            data.products ||
            data.cart ||
            [];

          const parsedItems: OrderItem["items"] = Array.isArray(rawItems)
            ? rawItems.map((item: any) => ({
                id: item.id || item.productId || undefined,

                name:
                  item.name ||
                  item.title ||
                  item.productName ||
                  "Món ăn",

                quantity:
                  Number(
                    item.quantity ??
                      item.qty ??
                      item.count ??
                      1
                  ) || 1,

                note:
                  item.note ||
                  item.options ||
                  "",
              }))
            : [];

          // =====================================================
          // SHIPPING FEE
          // =====================================================

          const shippingFee =
            Number(data.shippingFee) || 0;

          // =====================================================
          // TIỀN MÓN
          // =====================================================
          //
          // QUAN TRỌNG:
          // Không tính bằng items.
          //
          // Lý do:
          // giá từng item trong order có thể có logic khuyến mãi.
          //
          // Firestore đã có:
          // subTotalPrice = tổng tiền món thực tế.
          //

          const totalAmount =
            Number(
              data.subTotalPrice ??
                data.subtotalPrice ??
                0
            ) || 0;

          // =====================================================
          // TỔNG ĐƠN
          // =====================================================

          const totalPrice =
            Number(
              data.totalPrice ??
                data.grandTotal ??
                data.finalTotal ??
                data.totalAmount ??
                totalAmount + shippingFee
            ) || 0;

          // =====================================================
          // PAYMENT METHOD
          // =====================================================

          const rawPaymentMethod = String(
            data.paymentMethod ||
              data.paymentType ||
              "cod"
          )
            .trim()
            .toUpperCase();

          // =====================================================
          // AMOUNT TO COLLECT
          // =====================================================

          const amountToCollect =
            data.amountToCollect !== undefined &&
            data.amountToCollect !== null
              ? Number(data.amountToCollect) || 0
              : rawPaymentMethod === "COD" ||
                rawPaymentMethod === "CASH" ||
                rawPaymentMethod === "TIEN_MAT"
              ? totalPrice
              : 0;

          // =====================================================
          // STORE LOCATION
          // =====================================================

          const storeLat = getValidCoordinate(
            data.storeLat ??
              data.storeLocation?.latitude
          );

          const storeLng = getValidCoordinate(
            data.storeLng ??
              data.storeLocation?.longitude
          );

          // =====================================================
          // CUSTOMER LOCATION
          // =====================================================

          const customerLat = getValidCoordinate(
            data.customerLat ??
              data.customerLocation?.latitude ??
              data.location?.latitude ??
              data.lat
          );

          const customerLng = getValidCoordinate(
            data.customerLng ??
              data.customerLocation?.longitude ??
              data.location?.longitude ??
              data.lng
          );

          const customerLocationSource =
            data.customerLocation ||
            data.location ||
            null;

          const customerLocation =
            customerLocationSource
              ? {
                  latitude: getValidCoordinate(
                    customerLocationSource.latitude
                  ),
                  longitude: getValidCoordinate(
                    customerLocationSource.longitude
                  ),
                }
              : undefined;

          return {
            id: docSnap.id,

            // STORE
            storeName:
              data.storeName ||
              data.shopName ||
              "Cửa hàng",

            storeAddress:
              data.storeAddress ||
              data.shopAddress ||
              data.merchantAddress ||
              "Đang cập nhật địa chỉ quán",

            storeLat,
            storeLng,
            storePhone: resolvedStorePhone,

            // CUSTOMER
            customerName:
              data.customerName ||
              data.recipientName ||
              "Khách hàng",

            customerPhone: resolvedCustomerPhone,

            customerAddress:
              data.customerAddress ||
              data.address ||
              "Địa chỉ giao hàng",

            customerLat,
            customerLng,
            customerLocation,

            // ROUTE
            distanceKm:
              Number(data.distanceKm) || undefined,

            distanceStr:
              data.distanceStr || undefined,

            // PAYMENT
            shippingFee,
            totalAmount,
            totalPrice,
            paymentMethod: rawPaymentMethod,
            amountToCollect,

            // ITEMS
            items: parsedItems,

            note:
              data.note ||
              data.customerNote ||
              "",

            // STATUS
            status:
              String(data.status || "pending").toLowerCase(),

            shipperId:
              data.shipperId || null,

            createdAt:
              data.createdAt ||
              data.acceptedAt ||
              null,

            // REVIEW
            reviewInfo:
              data.reviewInfo || null,

            // RAW
            rawData: data,
          };
        });

        // =====================================================
        // SORT NEWEST FIRST
        // =====================================================

        fetchedOrders.sort((a, b) => {
          const getTime = (value: any) => {
            if (!value) return 0;

            if (typeof value?.toDate === "function") {
              return value.toDate().getTime();
            }

            if (
              typeof value === "string" ||
              typeof value === "number"
            ) {
              const time = new Date(value).getTime();

              return Number.isFinite(time)
                ? time
                : 0;
            }

            return 0;
          };

          return (
            getTime(b.createdAt) -
            getTime(a.createdAt)
          );
        });

        // =====================================================
        // DEBUG
        // =====================================================

        console.groupCollapsed(
          `📦 [ORDERS] Firestore realtime: ${fetchedOrders.length} đơn`
        );

        console.table(
          fetchedOrders.map((order) => ({
            id: order.id,

            status: order.status,

            shipperId:
              order.shipperId || "",

            store:
              order.storeName,

            customer:
              order.customerName || "",

            storeLat:
              order.storeLat ?? "",

            storeLng:
              order.storeLng ?? "",

            customerLat:
              order.customerLat ?? "",

            customerLng:
              order.customerLng ?? "",

            distanceKm:
              order.distanceKm ?? "",

            shippingFee:
              order.shippingFee,

            totalAmount:
              order.totalAmount,

            totalPrice:
              order.totalPrice,

            amountToCollect:
              order.amountToCollect,

            paymentMethod:
              order.paymentMethod || "",
          }))
        );

        console.log(
          "📦 Orders mapped:",
          fetchedOrders
        );

        fetchedOrders.forEach((order) => {
          console.groupCollapsed(
            `🧾 Order ${order.id}`
          );

          console.log(
            "Raw Firestore:",
            order.rawData
          );

          console.log("Shop:", {
            address:
              order.storeAddress,
            lat:
              order.storeLat,
            lng:
              order.storeLng,
          });

          console.log("Customer:", {
            address:
              order.customerAddress,
            lat:
              order.customerLat,
            lng:
              order.customerLng,
            location:
              order.customerLocation,
          });

          console.log("Route:", {
            distanceKm:
              order.distanceKm,
            distanceStr:
              order.distanceStr,
            shippingFee:
              order.shippingFee,
          });

          console.log("Items:", order.items);

          console.log("Payment:", {
            method:
              order.paymentMethod,
            food:
              order.totalAmount,
            shipping:
              order.shippingFee,
            total:
              order.totalPrice,
            collect:
              order.amountToCollect,
          });

          console.groupEnd();
        });

        console.groupEnd();

        setOrders(fetchedOrders);
        setLoading(false);
      },
      (error) => {
        console.error(
          "❌ Lỗi Realtime Firestore Orders:",
          error
        );

        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [profile?.uid]);

  // =========================================================
  // 2. FILTER ORDERS
  // =========================================================

  const filteredOrders = orders.filter((order) => {
    const status =
      (order.status || "").toLowerCase();

    const isMyOrder =
      order.shipperId === profile?.uid;

    const isUnassigned =
      !order.shipperId;

    const isAvailableStatus = [
      "pending",
      "finding_driver",
      "preparing",
      "processing",
      "accepted",
      "ready_for_pickup",
      "ready",
    ].includes(status);

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
      return (
        isUnassigned &&
        isAvailableStatus
      );
    }

    if (filter === "DELIVERING") {
      return (
        isMyOrder &&
        isDeliveringStatus
      );
    }

    if (filter === "COMPLETED") {
      return (
        isMyOrder &&
        status === "completed"
      );
    }

    return true;
  });

  // =========================================================
  // 3. UPDATE STATUS
  // =========================================================

  const handleUpdateStatus = async (
    id: string,
    nextStatus: string,
    alertText?: string,
    autoOpenMapsAddress?: string,
    lat?: number,
    lng?: number
  ) => {
    if (!profile?.uid) return;

    const currentOrder =
      orders.find(
        (order) => order.id === id
      );

    try {
      const orderRef = doc(
        db,
        "orders",
        id
      );

      const updateData: any = {
        updatedAt:
          new Date().toISOString(),
      };

      // =====================================================
      // NHẬN ĐƠN LẦN ĐẦU
      // =====================================================

      if (!currentOrder?.shipperId) {
        updateData.shipperId =
          profile.uid;

        updateData.shipperName =
          profile.fullName ||
          "Tài xế";

        updateData.acceptedAt =
          new Date().toISOString();

        const storeWorkingStatuses = [
          "accepted",
          "preparing",
          "processing",
          "ready_for_pickup",
          "ready",
        ];

        if (
          storeWorkingStatuses.includes(
            currentOrder?.status || ""
          )
        ) {
          // Giữ nguyên trạng thái của quán
          updateData.status =
            currentOrder?.status;
        } else {
          updateData.status =
            nextStatus;
        }
      } else {
        // ===================================================
        // ĐƠN ĐÃ CÓ SHIPPER
        // ===================================================

        updateData.status =
          nextStatus;
      }

      // =====================================================
      // COMPLETED
      // =====================================================

      if (
        nextStatus === "completed"
      ) {
        updateData.completedAt =
          new Date().toISOString();
      }

      await updateDoc(
        orderRef,
        updateData
      );

      // =====================================================
      // ALERT
      // =====================================================

      if (alertText) {
        alert(alertText);
      }

      // =====================================================
      // OPEN MAPS
      // =====================================================

      if (autoOpenMapsAddress) {
        console.log(
          "🗺️ Opening Google Maps:",
          {
            address:
              autoOpenMapsAddress,
            lat,
            lng,
          }
        );

        openGoogleMaps(
          autoOpenMapsAddress,
          lat,
          lng
        );
      }

      // =====================================================
      // AVAILABLE -> DELIVERING
      // =====================================================

      if (
        filter === "AVAILABLE"
      ) {
        setFilter(
          "DELIVERING"
        );
      }
    } catch (error) {
      console.error(
        "❌ Lỗi cập nhật trạng thái đơn:",
        error
      );

      alert(
        "Không thể cập nhật đơn hàng. Vui lòng thử lại!"
      );
    }
  };

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center p-8">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="w-full h-full min-h-0 flex-1 overflow-y-auto p-4 space-y-4 pb-32 font-sans touch-pan-y">
      {/* =====================================================
          HEADER
      ====================================================== */}

      <div className="flex items-center justify-between shrink-0">
        <h2 className="text-base font-extrabold text-slate-800">
          Quản lý Đơn hàng
        </h2>

        <span className="text-xs font-bold text-slate-400">
          Hiển thị: {filteredOrders.length} /{" "}
          {orders.length} đơn
        </span>
      </div>

      {/* =====================================================
          FILTER TABS
      ====================================================== */}

      <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl text-[11px] font-bold shrink-0">
        {/* AVAILABLE */}

        <button
          onClick={() =>
            setFilter("AVAILABLE")
          }
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

        {/* DELIVERING */}

        <button
          onClick={() =>
            setFilter("DELIVERING")
          }
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
                o.shipperId ===
                  profile?.uid &&
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

        {/* COMPLETED */}

        <button
          onClick={() =>
            setFilter("COMPLETED")
          }
          className={`flex-1 py-2 rounded-xl transition cursor-pointer ${
            filter === "COMPLETED"
              ? "bg-white text-blue-600 shadow-xs"
              : "text-slate-400 hover:text-slate-600"
          }`}
        >
          Đã xong 🎉
        </button>
      </div>

      {/* =====================================================
          ORDERS LIST
      ====================================================== */}

      <div className="space-y-3 pb-6">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs font-medium space-y-1">
            <p>
              Chưa có đơn hàng nào trong mục này
            </p>

            <p className="text-[10px] text-slate-300">
              Đơn mới tạo sẽ lập tức xuất hiện ở đây
            </p>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const isAvailable =
              !order.shipperId;

            const isMyOrder =
              order.shipperId ===
              profile?.uid;

            const normalizedPaymentMethod =
              String(
                order.paymentMethod ||
                  ""
              )
                .trim()
                .toUpperCase();

            const isCOD =
              normalizedPaymentMethod ===
                "COD" ||
              normalizedPaymentMethod ===
                "CASH" ||
              normalizedPaymentMethod ===
                "TIEN_MAT";

            const isReadyForPickup =
              order.status ===
                "ready_for_pickup" ||
              order.status === "ready";

            const totalItemQuantity =
              getTotalItemQuantity(
                order.items
              );

            return (
              <div
                key={order.id}
                className="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs space-y-3"
              >
                {/* =================================================
                    ORDER ID + STATUS
                ================================================== */}

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
                        : order.status ===
                          "assigned"
                        ? "bg-blue-50 text-blue-600 border border-blue-100"
                        : order.status ===
                          "picking_up"
                        ? "bg-orange-50 text-orange-600 border border-orange-100 animate-pulse"
                        : order.status ===
                          "completed"
                        ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                        : "bg-amber-50 text-amber-600 border border-amber-100"
                    }`}
                  >
                    {isAvailable
                      ? "Đơn mới chờ nhận"
                      : isReadyForPickup
                      ? "🛍️ Quán đã làm xong - Chờ lấy"
                      : order.status ===
                        "assigned"
                      ? "Đã nhận đơn"
                      : order.status ===
                        "picking_up"
                      ? "Đang tới lấy hàng"
                      : order.status ===
                        "completed"
                      ? "Hoàn thành"
                      : "Đang giao hàng"}
                  </span>
                </div>

                {/* =================================================
                    STORE + CUSTOMER
                ================================================== */}

                <div className="space-y-2.5 text-xs">
                  {/* STORE */}

                  <div className="flex justify-between items-start gap-2 bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 flex items-center gap-1 text-xs">
                        <span>🏪</span>
                        <span className="truncate">
                          {order.storeName}
                        </span>
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

                  {/* CUSTOMER */}

                  <div className="flex justify-between items-start gap-2 bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-800 flex items-center gap-1 text-xs">
                        <span>👤</span>

                        <span className="truncate">
                          {order.customerName}
                        </span>
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
                          console.log(
                            "🗺️ CUSTOMER MAP CLICK",
                            {
                              orderId:
                                order.id,
                              address:
                                order.customerAddress,
                              customerLat:
                                order.customerLat,
                              customerLng:
                                order.customerLng,
                              location:
                                order.customerLocation,
                            }
                          );

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

                {/* =================================================
                    ITEM LIST
                ================================================== */}

                <div className="bg-amber-50/40 border border-amber-100/60 rounded-xl p-2.5 text-xs space-y-2">
                  <div className="flex items-center justify-between border-b border-amber-100/80 pb-1">
                    <p className="font-extrabold text-amber-900 text-[11px] uppercase tracking-wider">
                      🛍️ Danh sách món
                    </p>

                    <span className="text-[10px] font-bold text-amber-700">
                      {totalItemQuantity} món
                    </span>
                  </div>

                  {order.items &&
                  order.items.length > 0 ? (
                    <div className="space-y-1.5">
                      {order.items.map(
                        (item, idx) => (
                          <div
                            key={`${order.id}-item-${idx}`}
                            className="flex items-start gap-2 text-[11px]"
                          >
                            <span className="text-amber-600 font-extrabold shrink-0 min-w-[28px]">
                              x{item.quantity}
                            </span>

                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-slate-800">
                                {item.name}
                              </p>

                              {item.note ? (
                                <p className="text-slate-400 text-[10px] italic mt-0.5">
                                  Ghi chú:{" "}
                                  {item.note}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic">
                      Chi tiết món ăn đang được cập nhật...
                    </p>
                  )}

                  {order.note ? (
                    <div className="pt-1.5 border-t border-amber-100 text-[11px] text-rose-600 font-medium">
                      📝{" "}
                      <span className="font-bold">
                        Ghi chú đơn:
                      </span>{" "}
                      {order.note}
                    </div>
                  ) : null}
                </div>

                {/* =================================================
                    MONEY SUMMARY
                ================================================== */}

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">

                  <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                    <span className="text-xs font-extrabold text-slate-800">
                      Tổng đơn
                    </span>

                    <span className="text-base font-black text-slate-900">
                      {formatMoney(
                        order.totalPrice
                      )}
                    </span>
                  </div>
                </div>

                {/* =================================================
                    PAYMENT
                ================================================== */}

                {isCOD ? (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs flex items-center justify-between shadow-xs">
                    <div className="min-w-0">
                      <span className="text-[10px] font-black text-rose-600 uppercase tracking-wider block">
                        🏷️ Thanh toán COD
                      </span>

                      <span className="text-xs font-bold text-slate-800 mt-0.5 block">
                        Số tiền cần thu từ khách
                      </span>
                    </div>

                    <span className="text-base font-black text-rose-600 shrink-0 ml-3">
                      {formatMoney(
                        order.amountToCollect
                      )}
                    </span>
                  </div>
                ) : (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-xs flex items-center justify-between">
                    <span className="text-[11px] font-extrabold text-emerald-700 flex items-center gap-1">
                      💳 Đã thanh toán online
                    </span>

                    <span className="text-[11px] font-bold text-emerald-600">
                      Khách không cần trả thêm
                    </span>
                  </div>
                )}

                {/* =================================================
                    REVIEW
                ================================================== */}

                {order.reviewInfo &&
                (order.reviewInfo
                  .driverRating ||
                  order.reviewInfo
                    .driverComment) ? (
                  <div className="bg-amber-50/80 border border-amber-200/70 rounded-xl p-2.5 text-xs space-y-1.5">
                    <div className="flex items-center justify-between border-b border-amber-200/50 pb-1">
                      <span className="font-extrabold text-amber-900 text-[11px] flex items-center gap-1">
                        💬 Đánh giá dành cho tài xế
                      </span>

                      {order.reviewInfo
                        .driverRating ? (
                        <span className="font-black text-amber-600 text-xs">
                          {"⭐".repeat(
                            order.reviewInfo
                              .driverRating
                          )}{" "}
                          (
                          {
                            order
                              .reviewInfo
                              .driverRating
                          }
                          /5)
                        </span>
                      ) : null}
                    </div>

                    {order.reviewInfo
                      .driverComment ? (
                      <p className="text-slate-700 font-medium text-[11px] italic">
                        🛵{" "}
                        <span className="font-semibold text-slate-900">
                          Khách nhận xét:
                        </span>{" "}
                        &ldquo;
                        {
                          order
                            .reviewInfo
                            .driverComment
                        }
                        &rdquo;
                      </p>
                    ) : null}
                  </div>
                ) : order.status ===
                  "completed" ? (
                  <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 text-center">
                    <span className="text-[10px] text-slate-400 font-semibold italic">
                      Khách hàng chưa để lại đánh giá cho tài xế
                    </span>
                  </div>
                ) : null}

                {/* =================================================
                    ACTIONS
                ================================================== */}

                <div className="flex items-center justify-end pt-2 border-t border-slate-50">
                  {/* NHẬN ĐƠN */}

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

                  {/* ĐẾN LẤY HÀNG */}

                  {isMyOrder &&
                    (order.status ===
                      "assigned" ||
                      order.status ===
                        "accepted" ||
                      order.status ===
                        "preparing" ||
                      order.status ===
                        "processing" ||
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
                        {isReadyForPickup
                          ? "🛍️ Quán đã làm xong - Đến lấy hàng"
                          : "🚀 Đến lấy hàng & Mở Bản đồ"}
                      </button>
                    )}

                  {/* ĐÃ LẤY HÀNG */}

                  {isMyOrder &&
                    order.status ===
                      "picking_up" && (
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

                  {/* HOÀN THÀNH */}

                  {isMyOrder &&
                    (order.status ===
                      "delivering" ||
                      order.status ===
                        "shipping") && (
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