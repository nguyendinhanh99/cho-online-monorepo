import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin"; // Sử dụng Firebase Admin SDK thay vì Client SDK
import { FieldValue } from "firebase-admin/firestore";

export async function POST(request: Request) {
  try {
    const { orderId, userId, cancelReason } = await request.json();

    if (!orderId || !userId) {
      return NextResponse.json(
        { error: "Thiếu thông tin orderId hoặc userId" },
        { status: 400 }
      );
    }

    // 1. Lấy thông tin đơn hàng từ Firestore qua Admin SDK
    const orderRef = adminDb.collection("orders").doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return NextResponse.json(
        { error: "Đơn hàng không tồn tại" },
        { status: 404 }
      );
    }

    const orderData = orderSnap.data();

    // 2. Kiểm tra quyền sở hữu đơn hàng
    if (orderData?.userId !== userId) {
      return NextResponse.json(
        { error: "Bạn không có quyền hủy đơn hàng này" },
        { status: 403 }
      );
    }

    // 3. Kiểm tra trạng thái đơn hàng (Chỉ hủy được khi pending hoặc accepted)
    const currentStatus = (orderData?.status || "").toLowerCase();
    if (currentStatus !== "pending" && currentStatus !== "accepted") {
      return NextResponse.json(
        { error: "Đơn hàng đã được chế biến hoặc đang giao, không thể hủy!" },
        { status: 400 }
      );
    }

    // 4. Cập nhật trạng thái đơn hàng thành "cancelled"
    await orderRef.update({
      status: "cancelled",
      cancelledAt: new Date().toISOString(),
      cancelReason: cancelReason || "Người dùng yêu cầu hủy",
    });

    // 5. Hoàn trả điểm tích lũy nếu có
    if (orderData?.pointsUsed && orderData.pointsUsed > 0) {
      const userRef = adminDb.collection("users").doc(userId);
      await userRef.update({
        points: FieldValue.increment(orderData.pointsUsed),
      });
    }

    return NextResponse.json({
      success: true,
      message: "Đã hủy đơn hàng thành công!",
    });
  } catch (error: any) {
    console.error("Lỗi API cancel order:", error);
    return NextResponse.json(
      { error: error?.message || "Lỗi máy chủ nội bộ" },
      { status: 500 }
    );
  }
}