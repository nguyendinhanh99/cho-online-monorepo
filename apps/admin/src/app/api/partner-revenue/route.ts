import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { calculatePlatformShippingShare } from "@/lib/shippingCalculator";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = (searchParams.get("type") || "MERCHANT").toUpperCase();
    const targetId = searchParams.get("id");
    const timeFrame = (searchParams.get("timeFrame") || "DAY").toUpperCase();

    if (!targetId) {
      return NextResponse.json({ success: false, message: "Thiếu ID đối tác" }, { status: 400 });
    }

    // 1. Lấy cấu hình tỷ lệ phần trăm chiết khấu sàn áp dụng cho Merchant
    const configDoc = await adminDb.collection("settings").doc("commission").get();
    const config = configDoc.exists ? configDoc.data() : { platformFeePercent: 10 };
    let platformFeePercent = Number(config?.platformFeePercent ?? 10);

    if (type === "MERCHANT") {
      const merchantDoc = await adminDb.collection("users").doc(targetId).get();
      if (merchantDoc.exists) {
        const merchantData = merchantDoc.data();
        if (merchantData?.commissionPercent !== undefined && merchantData?.commissionPercent !== null) {
          platformFeePercent = Number(merchantData.commissionPercent);
        }
      }
    }

    // 2. Query danh sách đơn hàng từ Firestore
    const ordersSnap = await adminDb.collection("orders").get();

    let totalGrossRevenue = 0;
    let totalPlatformCut = 0;
    let totalNetRevenue = 0;
    let completedCount = 0;

    const chartDataMap: Record<string, { gross: number; platformCut: number; net: number; count: number }> = {};
    const now = new Date();

    ordersSnap.docs.forEach((doc) => {
      const data = doc.data();
      const status = (data.status || "").toString().toLowerCase().trim();

      if (status === "completed" || status === "delivered") {
        if (type === "MERCHANT") {
          const merchantId = data.merchantId || data.storeId || data.shopId;
          if (merchantId !== targetId) return;
        } else if (type === "SHIPPER") {
          const shipperId = data.shipperId || data.driverId || data.assignedShipperId;
          if (shipperId !== targetId) return;
        }

        let createdAt = new Date();
        if (data.createdAt?.toDate) {
          createdAt = data.createdAt.toDate();
        } else if (data.createdAt?.seconds || data.createdAt?._seconds) {
          createdAt = new Date((data.createdAt.seconds || data.createdAt._seconds) * 1000);
        } else if (data.createdAt) {
          createdAt = new Date(data.createdAt);
        }

        if (timeFrame === "HOUR" && createdAt.toDateString() !== now.toDateString()) return;
        if (timeFrame === "DAY" && (createdAt.getMonth() !== now.getMonth() || createdAt.getFullYear() !== now.getFullYear())) return;
        if (timeFrame === "MONTH" && createdAt.getFullYear() !== now.getFullYear()) return;

        const totalAmount = Number(data.totalPrice ?? data.total ?? data.amount ?? 0);
        const shippingFee = Number(data.shippingFee ?? data.shipFee ?? 0);
        const subTotalPrice = Number(data.subTotalPrice ?? data.subtotal ?? (totalAmount > shippingFee ? totalAmount - shippingFee : totalAmount));
        const distanceKm = Number(data.distanceKm ?? 0);

        let gross = 0;
        let platformCut = 0;

        if (type === "MERCHANT") {
          // Lấy Giá Gốc (subTotalCostPrice) làm Doanh thu gộp
          let basePrice = Number(data.subTotalCostPrice ?? 0);
          
          if (!basePrice && Array.isArray(data.items)) {
            basePrice = data.items.reduce((sum: number, item: any) => {
              return sum + Number(item.costPrice ?? item.price ?? 0) * Number(item.quantity ?? 1);
            }, 0);
          }
          
          if (!basePrice) basePrice = subTotalPrice;

          gross = basePrice;
          platformCut = Math.round((gross * platformFeePercent) / 100);
        } else {
          gross = shippingFee;
          platformCut = calculatePlatformShippingShare(distanceKm, createdAt);
        }

        const net = Math.max(0, gross - platformCut);

        totalGrossRevenue += gross;
        totalPlatformCut += platformCut;
        totalNetRevenue += net;
        completedCount += 1;

        let key = "";
        if (timeFrame === "HOUR") {
          key = `${createdAt.getHours().toString().padStart(2, "0")}:00`;
        } else if (timeFrame === "DAY") {
          key = `${createdAt.getDate().toString().padStart(2, "0")}/${(createdAt.getMonth() + 1).toString().padStart(2, "0")}`;
        } else if (timeFrame === "MONTH") {
          key = `Thg ${(createdAt.getMonth() + 1).toString().padStart(2, "0")}/${createdAt.getFullYear()}`;
        } else if (timeFrame === "YEAR") {
          key = `Năm ${createdAt.getFullYear()}`;
        }

        if (!chartDataMap[key]) {
          chartDataMap[key] = { gross: 0, platformCut: 0, net: 0, count: 0 };
        }
        chartDataMap[key].gross += gross;
        chartDataMap[key].platformCut += platformCut;
        chartDataMap[key].net += net;
        chartDataMap[key].count += 1;
      }
    });

    const chartData = Object.keys(chartDataMap).map((k) => ({
      time: k,
      ...chartDataMap[k],
    }));

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalGrossRevenue,
          totalPlatformCut,
          totalNetRevenue,
          completedCount,
          appliedCommissionPercent: type === "MERCHANT" ? platformFeePercent : 0,
        },
        chartData,
      },
    });
  } catch (error: any) {
    console.error("Lỗi API Doanh Thu Đối Tác:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}