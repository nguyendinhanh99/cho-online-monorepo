import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

// 1. GET: Lấy danh sách Merchants kèm Thống kê Doanh Thu & Sản Phẩm
export async function GET() {
  try {
    const [merchantsSnap, productsSnap, ordersSnap] = await Promise.all([
      adminDb.collection("merchants").get(),
      adminDb.collection("products").get(),
      adminDb.collection("orders").get(),
    ]);

    const products = productsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const orders = ordersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    const merchantList = merchantsSnap.docs.map((doc) => {
      const data = doc.data();
      const merchantId = doc.id;

      // Tính tổng số sản phẩm thuộc Shop
      const shopProducts = products.filter((p: any) => p.merchantId === merchantId);

      // Tính tổng doanh thu từ các đơn hàng thành công
      const shopOrders = orders.filter(
        (o: any) => o.merchantId === merchantId && (o.status === "DELIVERED" || o.status === "COMPLETED")
      );
      const totalRevenue = shopOrders.reduce((sum: number, o: any) => sum + (Number(o.totalPrice) || 0), 0);

      return {
        id: merchantId,
        ...data,
        totalProducts: shopProducts.length,
        totalOrders: shopOrders.length,
        totalRevenue,
      };
    });

    return NextResponse.json({ success: true, data: merchantList });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// 2. PATCH: Cập nhật Trạng thái Duyệt / Khóa Gian Hàng
export async function PATCH(request: Request) {
  try {
    const { merchantId, status } = await request.json();
    if (!merchantId || !status) {
      return NextResponse.json({ success: false, message: "Thiếu dữ liệu" }, { status: 400 });
    }

    await adminDb.collection("merchants").doc(merchantId).update({
      status,
      updatedAt: new Date(),
    });

    return NextResponse.json({ success: true, message: "Cập nhật trạng thái gian hàng thành công!" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// 3. POST: Gửi Thông Báo Trực Tiếp Tới Merchant (Notification Collection)
export async function POST(request: Request) {
  try {
    const { merchantId, title, body } = await request.json();

    if (!merchantId || !title || !body) {
      return NextResponse.json({ success: false, message: "Thiếu nội dung thông báo" }, { status: 400 });
    }

    // Lưu thông báo vào sub-collection hoặc collection notifications
    await adminDb.collection("notifications").add({
      targetUserId: merchantId,
      targetRole: "MERCHANT",
      title,
      body,
      isRead: false,
      createdAt: new Date(),
    });

    return NextResponse.json({ success: true, message: "Đã gửi thông báo tới gian hàng!" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}