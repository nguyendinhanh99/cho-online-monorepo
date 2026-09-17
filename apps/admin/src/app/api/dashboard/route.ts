import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

// Helper tính phí ship sàn giữ theo sơ đồ Km và Giờ
const calculatePlatformShippingCut = (distanceKm: number, createdAt: Date) => {
  let cut = 0;
  if (distanceKm <= 1) cut += 2000;
  else if (distanceKm <= 2) cut += 3000;
  else if (distanceKm <= 3) cut += 4000;
  else if (distanceKm <= 4) cut += 4500;
  else if (distanceKm <= 5) cut += 5000;
  else cut += 5500;

  const hours = createdAt.getHours();
  const minutes = createdAt.getMinutes();
  const timeInMinutes = hours * 60 + minutes;

  if (timeInMinutes >= 11 * 60 && timeInMinutes <= 12 * 60 + 30) cut += 500;
  else if (timeInMinutes >= 18 * 60 && timeInMinutes <= 19 * 60 + 59) cut += 1500;
  else if (timeInMinutes >= 20 * 60 || timeInMinutes === 0) cut += 2500;

  return cut;
};

export async function GET() {
  try {
    // 1. Lấy cấu hình hoa hồng sàn
    const configDoc = await adminDb.collection("settings").doc("commission").get();
    const config = configDoc.exists
      ? configDoc.data()
      : { platformFeePercent: 10, shippingFeePercent: 20 };

    const platformFeePercent = Number(config?.platformFeePercent ?? 10);
    const shippingFeePercent = Number(config?.shippingFeePercent ?? 20);

    // 2. Truy vấn đồng thời các collections
    const [ordersSnap, merchantsSnap, usersSnap, productsSnap] = await Promise.all([
      adminDb.collection("orders").get(),
      adminDb.collection("merchants").get(),
      adminDb.collection("users").get(),
      adminDb.collection("products").get(),
    ]);

    let totalGMV = 0;
    let platformProfit = 0;
    let pendingOrders = 0;

    const recentOrders: any[] = [];

    ordersSnap.docs.forEach((doc) => {
      const order = { id: doc.id, ...doc.data() } as any;
      const status = (order.status || "").toString().toLowerCase().trim();

      if (status === "pending" || status === "finding_driver") {
        pendingOrders += 1;
      }

      // Chỉ tính doanh thu/lợi nhuận các đơn hoàn thành
      if (status === "completed" || status === "delivered") {
        const amount = Number(order.totalPrice ?? order.total ?? order.amount ?? 0);
        const shippingFee = Number(order.shippingFee ?? order.shipFee ?? order.deliveryFee ?? 0);

        totalGMV += amount;

        // A. Tính Giá Món Gốc chưa KM (subTotalCostPrice)
        let subTotalCostPrice = Number(order.subTotalCostPrice ?? order.costPriceTotal ?? order.basePrice ?? 0);
        if (!subTotalCostPrice && Array.isArray(order.items)) {
          subTotalCostPrice = order.items.reduce((sum: number, item: any) => {
            const itemCost = Number(item.costPrice ?? item.basePrice ?? item.price ?? 0);
            const itemQty = Number(item.quantity ?? 1);
            return sum + itemCost * itemQty;
          }, 0);
        }
        if (!subTotalCostPrice) {
          subTotalCostPrice = amount > shippingFee ? amount - shippingFee : amount;
        }

        // B. Chiết khấu món = % * giá món gốc
        const itemFee = Math.round((subTotalCostPrice * platformFeePercent) / 100);

        // C. Chiết khấu ship sàn giữ (Km + Giờ)
        let createdDate = new Date();
        if (order.createdAt?.toDate) createdDate = order.createdAt.toDate();
        else if (order.createdAt?.seconds) createdDate = new Date(order.createdAt.seconds * 1000);
        else if (order.createdAt) createdDate = new Date(order.createdAt);

        const distanceKm = Number(order.distanceKm ?? order.distance ?? 0);
        let shipFee = Number(order.shippingCut ?? 0);
        if (shipFee === 0 && shippingFee > 0) {
          shipFee = calculatePlatformShippingCut(distanceKm, createdDate);
        }

        platformProfit += itemFee + shipFee;
      }

      recentOrders.push(order);
    });

    // Sắp xếp đơn mới nhất theo thời gian tạo
    recentOrders.sort((a, b) => {
      const timeA = a.createdAt?.seconds || (a.createdAt ? new Date(a.createdAt).getTime() / 1000 : 0);
      const timeB = b.createdAt?.seconds || (b.createdAt ? new Date(b.createdAt).getTime() / 1000 : 0);
      return timeB - timeA;
    });

    // Thống kê Gian hàng chờ duyệt
    let pendingMerchants = 0;
    merchantsSnap.docs.forEach((doc) => {
      const st = (doc.data().status || "").toString().toLowerCase().trim();
      if (st === "pending") pendingMerchants += 1;
    });

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          totalGMV,
          platformProfit,
          platformFeePercent,
          shippingFeePercent,
          totalMerchants: merchantsSnap.size,
          pendingMerchants,
          totalOrders: ordersSnap.size,
          pendingOrders,
          totalUsers: usersSnap.size,
          totalProducts: productsSnap.size,
        },
        recentOrders: recentOrders.slice(0, 5), // Top 5 đơn hàng mới nhất
      },
    });
  } catch (error: any) {
    console.error("Lỗi Dashboard API:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}