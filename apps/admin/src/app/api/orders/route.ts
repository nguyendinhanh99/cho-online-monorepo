import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

// 1. GET: Lấy danh sách Đơn Hàng & Danh sách Tài xế (Shipper)
export async function GET() {
  try {
    const [ordersSnap, shippersSnap, usersShipperSnap] = await Promise.all([
      adminDb.collection("orders").get(),
      adminDb.collection("shippers").get(),
      adminDb.collection("users").where("role", "in", ["SHIPPER", "shipper"]).get(),
    ]);

    // Lấy trước map dữ liệu users để lấy refundBankInfo
    const usersSnap = await adminDb.collection("users").get();
    const userBankMap = new Map();
    usersSnap.docs.forEach((doc) => {
      const data = doc.data();
      if (data.refundBankInfo) {
        userBankMap.set(doc.id, data.refundBankInfo);
      }
    });

    const orders = ordersSnap.docs.map((doc) => {
      const data = doc.data();
      const userId = data.userId || data.customerId;
      const userBankInfo = userId ? userBankMap.get(userId) : null;

      return {
        id: doc.id,
        ...data,
        // Ưu tiên refundBankInfo trong đơn hàng, nếu không có thì lấy từ tài khoản User
        refundBankInfo: data.refundBankInfo || userBankInfo || null,
      };
    });

    const shipperMap = new Map();
    shippersSnap.docs.forEach((doc) => {
      shipperMap.set(doc.id, { id: doc.id, ...doc.data() });
    });
    usersShipperSnap.docs.forEach((doc) => {
      if (!shipperMap.has(doc.id)) {
        shipperMap.set(doc.id, { id: doc.id, ...doc.data() });
      }
    });

    const shippers = Array.from(shipperMap.values());

    orders.sort((a: any, b: any) => {
      const timeA = new Date(a.createdAt?.seconds ? a.createdAt.seconds * 1000 : a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt?.seconds ? b.createdAt.seconds * 1000 : b.createdAt || 0).getTime();
      return timeB - timeA;
    });

    return NextResponse.json({ success: true, data: { orders, shippers } });
  } catch (error: any) {
    console.error("Lỗi GET Admin Orders:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// 2. PATCH: Cập nhật Trạng Thái Đơn / Điều Phối Shipper / Hủy / Hoàn Tiền
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { orderId, status, shipperId, shipperName, cancelReason } = body;

    if (!orderId) {
      return NextResponse.json({ success: false, message: "Thiếu orderId" }, { status: 400 });
    }

    const orderRef = adminDb.collection("orders").doc(orderId);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      return NextResponse.json({ success: false, message: "Không tìm thấy đơn hàng" }, { status: 404 });
    }

    const orderData = orderDoc.data();
    const updateData: any = { 
      updatedAt: new Date().toISOString() 
    };

    if (shipperId) {
      updateData.shipperId = shipperId;
      updateData.shipperName = shipperName || "Tài xế được điều phối";
      updateData.status = status || "delivering";
      updateData.acceptedAt = new Date().toISOString();
    } else if (status === "finding_driver" || status === "pending") {
      updateData.status = status;
      updateData.shipperId = null;
      updateData.shipperName = null;
    } else if (status) {
      updateData.status = status.toLowerCase();
    }

    if (cancelReason) {
      updateData.cancelReason = cancelReason;
    }

    // Lấy refundBankInfo từ user nếu chuyển trạng thái refunded/cancelled
    if (status?.toLowerCase() === "refunded" || status?.toLowerCase() === "cancelled") {
      const userId = orderData?.userId || orderData?.customerId;
      
      if (userId) {
        try {
          const userDoc = await adminDb.collection("users").doc(userId).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            if (userData?.refundBankInfo) {
              updateData.refundBankInfo = userData.refundBankInfo;
              updateData.bankName = userData.refundBankInfo.bankName;
              updateData.bankAccount = userData.refundBankInfo.bankAccount;
              updateData.bankOwner = userData.refundBankInfo.bankOwner;
              updateData.bankCode = userData.refundBankInfo.bankCode;
            }
          }
        } catch (err) {
          console.warn("Lỗi lấy refundBankInfo:", err);
        }
      }
      updateData.refundedAt = new Date().toISOString();
    }

    await orderRef.update(updateData);

    return NextResponse.json({ 
      success: true, 
      message: "Cập nhật đơn hàng thành công!",
      data: updateData 
    });
  } catch (error: any) {
    console.error("Lỗi PATCH Admin Orders:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}