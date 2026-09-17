import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

// 1. GET: Lấy danh sách đối soát & dữ liệu T+1
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const roleParam = searchParams.get("role") || "ALL"; // ALL, MERCHANT, SHIPPER

    // Lấy phí cấu hình sàn từ Settings (Mặc định 10%)
    let platformFeePercent = 10;
    let shippingFeePercent = 10;
    try {
      const settingsDoc = await adminDb.collection("settings").doc("general").get();
      if (settingsDoc.exists) {
        const sData = settingsDoc.data();
        if (sData?.merchantCommissionRate) platformFeePercent = Number(sData.merchantCommissionRate);
        if (sData?.shipperCommissionRate) shippingFeePercent = Number(sData.shipperCommissionRate);
      }
    } catch (e) {
      console.warn("Chưa lấy được settings, dùng fee mặc định 10%");
    }

    // Lấy lịch sử nạp/chuyển khoản từ topup_requests
    const topupSnap = await adminDb.collection("topup_requests").get();
    const allTopupRequests: any[] = [];
    topupSnap.docs.forEach((doc) => {
      const tData = doc.data();
      allTopupRequests.push({
        id: doc.id,
        amount: Number(tData.amount || 0),
        transferContent: tData.transferContent || "",
        billImage: tData.billImage || "",
        status: tData.status || "PENDING",
        type: tData.type || "DEBT_CLEARANCE",
        createdAt: tData.createdAt ? tData.createdAt.toDate() : null,
        shipperUid: tData.shipperUid || tData.userId || "",
      });
    });

    // Lấy danh sách đơn hàng hoàn tất
    const ordersSnap = await adminDb.collection("orders").get();
    const completedOrders: any[] = [];
    ordersSnap.docs.forEach((doc) => {
      const data = doc.data();
      const status = (data.status || "").toString().toLowerCase().trim();
      if (status === "completed" || status === "delivered" || status === "hoan_thanh") {
        completedOrders.push({ id: doc.id, ...data });
      }
    });

    let partnersData: any[] = [];

    // Truy vấn MERCHANTS
    if (roleParam === "ALL" || roleParam === "MERCHANT") {
      const merchantsSnap = await adminDb.collection("merchants").get();
      merchantsSnap.docs.forEach((doc) => {
        const m = doc.data();
        const mId = doc.id;

        const mOrders = completedOrders.filter(
          (o) => o.merchantId === mId || o.storeId === mId || o.sellerId === mId
        );

        let totalGMV = 0;
        mOrders.forEach((o) => {
          const amount = Number(o.totalPrice ?? o.total ?? o.amount ?? 0);
          const shipFee = Number(o.shippingFee ?? o.shipFee ?? 0);
          const subtotal = Number(o.subtotal ?? (amount > shipFee ? amount - shipFee : amount));
          totalGMV += subtotal;
        });

        const platformFee = (totalGMV * platformFeePercent) / 100;
        const unpaidAmount = totalGMV - platformFee;
        const merchantTopups = allTopupRequests.filter((t) => t.shipperUid === mId);

        partnersData.push({
          id: mId,
          role: "MERCHANT",
          name: m.fullName || m.ownerName || m.name || m.storeName || "Chưa đặt tên Store",
          phone: m.phone || m.phoneNumber || "---",
          bankAccount: {
            bankName: m.bankAccount?.bankName || m.bankName || "Chưa cập nhật",
            accountNumber: m.bankAccount?.accountNumber || m.accountNumber || "---",
            accountHolder: m.bankAccount?.accountHolder || m.accountHolder || m.bankOwner || "---",
          },
          topupHistory: merchantTopups,
          totalGMV,
          platformFee,
          unpaidAmount,
          isPaid: m.isPaid ?? false,
          t1Status: m.t1Status || (m.isPaid ? "PAID_T1" : "PENDING_T"),
          paidAt: m.paidAt || null,
          accountantNote: m.accountantNote || "",
        });
      });
    }

    // Truy vấn SHIPPERS
    if (roleParam === "ALL" || roleParam === "SHIPPER") {
      const shippersSnap = await adminDb.collection("shippers").get();
      shippersSnap.docs.forEach((doc) => {
        const s = doc.data();
        const sId = doc.id;

        const sOrders = completedOrders.filter(
          (o) => o.shipperId === sId || o.driverId === sId
        );

        let totalGMV = 0;
        sOrders.forEach((o) => {
          const shipFee = Number(o.shippingFee ?? o.shipFee ?? o.deliveryFee ?? 0);
          totalGMV += shipFee;
        });

        const platformFee = (totalGMV * shippingFeePercent) / 100;
        const unpaidAmount = totalGMV - platformFee;
        const shipperTopups = allTopupRequests.filter((t) => t.shipperUid === sId);

        partnersData.push({
          id: sId,
          role: "SHIPPER",
          name: s.fullName || s.name || s.driverName || "Chưa đặt tên Shipper",
          phone: s.phone || s.phoneNumber || "---",
          bankAccount: {
            bankName: s.bankAccount?.bankName || s.bankName || "Chưa cập nhật",
            accountNumber: s.bankAccount?.accountNumber || s.accountNumber || "---",
            accountHolder: s.bankAccount?.accountHolder || s.accountHolder || "---",
          },
          topupHistory: shipperTopups,
          totalGMV,
          platformFee,
          unpaidAmount,
          isPaid: s.isPaid ?? false,
          t1Status: s.t1Status || (s.isPaid ? "PAID_T1" : "PENDING_T"),
          paidAt: s.paidAt || null,
          accountantNote: s.accountantNote || "",
        });
      });
    }

    return NextResponse.json({ success: true, data: partnersData });
  } catch (error: any) {
    console.error("Lỗi API Accounting GET:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Lỗi truy xuất dữ liệu" },
      { status: 500 }
    );
  }
}

// 2. PATCH: Cập nhật trạng thái T+1 & Ghi chú cho hàng loạt đối tác
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { partnerIds, isPaid, t1Status, accountantNote } = body;

    if (!partnerIds || !Array.isArray(partnerIds) || partnerIds.length === 0) {
      return NextResponse.json(
        { success: false, message: "Danh sách đối tác không hợp lệ" },
        { status: 400 }
      );
    }

    const batch = adminDb.batch();

    for (const id of partnerIds) {
      const merchantRef = adminDb.collection("merchants").doc(id);
      const merchantDoc = await merchantRef.get();

      if (merchantDoc.exists) {
        const updateData: any = {};
        if (typeof isPaid === "boolean") updateData.isPaid = isPaid;
        if (t1Status) updateData.t1Status = t1Status;
        if (accountantNote !== undefined) updateData.accountantNote = accountantNote;
        updateData.updatedAt = new Date();

        batch.update(merchantRef, updateData);
      } else {
        const shipperRef = adminDb.collection("shippers").doc(id);
        const shipperDoc = await shipperRef.get();

        if (shipperDoc.exists) {
          const updateData: any = {};
          if (typeof isPaid === "boolean") updateData.isPaid = isPaid;
          if (t1Status) updateData.t1Status = t1Status;
          if (accountantNote !== undefined) updateData.accountantNote = accountantNote;
          updateData.updatedAt = new Date();

          batch.update(shipperRef, updateData);
        }
      }
    }

    await batch.commit();

    return NextResponse.json({
      success: true,
      message: `Đã cập nhật thành công cho ${partnerIds.length} bản ghi!`,
    });
  } catch (error: any) {
    console.error("Lỗi API Accounting PATCH:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Lỗi cập nhật máy chủ" },
      { status: 500 }
    );
  }
}