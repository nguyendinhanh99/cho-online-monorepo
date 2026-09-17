// apps/admin/app/api/dispatch/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { sendPushNotification } from "@/lib/fcm";

// 1. Định nghĩa Interface để ép kiểu cho TypeScript
interface ShipperData {
  id: string;
  fcmToken?: string;
  isOnline?: boolean;
  isBusy?: boolean;
  [key: string]: any;
}

export async function POST(req: Request) {
  try {
    const { orderId } = await req.json();

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "Thiếu orderId" },
        { status: 400 }
      );
    }

    // 2. Lấy thông tin đơn hàng từ Firestore
    const orderDoc = await adminDb.collection("orders").doc(orderId).get();
    if (!orderDoc.exists) {
      return NextResponse.json(
        { success: false, error: "Đơn không tồn tại" },
        { status: 404 }
      );
    }

    const orderData = orderDoc.data();

    // 3. Tìm Shipper đang Online và rảnh việc
    const shippersSnap = await adminDb
      .collection("shippers")
      .where("isOnline", "==", true)
      .where("isBusy", "==", false)
      .get();

    // Áp kiểu ShipperData để hết gạch đỏ s.fcmToken
    const availableShippers: ShipperData[] = shippersSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Lọc danh sách FCM Tokens hợp lệ của Shipper
    const shipperTokens = availableShippers
      .map((s) => s.fcmToken)
      .filter((token): token is string => Boolean(token));

    // 4. BẮN THÔNG BÁO TỚI 3 BÊN:

    // -> Bắn tới Shipper (Ứng tuyển nhận đơn)
    if (shipperTokens.length > 0) {
      await sendPushNotification({
        targetTokens: shipperTokens,
        title: "🛵 Có đơn hàng mới!",
        body: `Đơn #${orderId.slice(0, 6)} - Giá trị ${(
          orderData?.totalPrice || 0
        ).toLocaleString("vi-VN")}đ`,
        data: { orderId, type: "NEW_ORDER" },
      });
    }

    // -> Bắn tới Merchant (Chuẩn bị hàng)
    if (orderData?.merchantFcmToken) {
      await sendPushNotification({
        targetTokens: [orderData.merchantFcmToken],
        title: "🏪 Đơn hàng mới cần xác nhận",
        body: `Khách hàng vừa đặt đơn #${orderId.slice(0, 6)}`,
        data: { orderId, type: "MERCHANT_NEW_ORDER" },
      });
    }

    // -> Bắn tới Customer (Cập nhật trạng thái UI)
    if (orderData?.customerFcmToken) {
      await sendPushNotification({
        targetTokens: [orderData.customerFcmToken],
        title: "📲 Đã tiếp nhận đơn hàng",
        body: "Hệ thống đang điều phối tài xế gần bạn nhất...",
        data: { orderId, type: "ORDER_PROCESSING" },
      });
    }

    return NextResponse.json({
      success: true,
      notifiedShippersCount: shipperTokens.length,
    });
  } catch (error: any) {
    console.error("Lỗi Dispatcher:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}