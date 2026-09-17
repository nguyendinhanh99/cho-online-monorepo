import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

// Helper kiểm tra hình thức thanh toán COD
const isCodPayment = (method?: string) => {
  if (!method) return false;
  const m = method.toLowerCase().trim();
  return m === "cod" || m === "cash";
};

// ==========================================
// HÀM TÍNH PHÍ SHIP SÀN GIỮ THEO SƠ ĐỒ BẬC THANG
// Dựa trên khoảng cách (Km) và Khung giờ phụ thu
// ==========================================
const calculatePlatformShippingCut = (distanceKm: number, createdAt: Date) => {
  let cut = 0;

  // 1. Phí theo Khoảng cách (Km)
  if (distanceKm <= 1) cut += 2000;
  else if (distanceKm <= 2) cut += 3000;
  else if (distanceKm <= 3) cut += 4000;
  else if (distanceKm <= 4) cut += 4500;
  else if (distanceKm <= 5) cut += 5000;
  else cut += 5500;

  // 2. Phụ thu Khung giờ cao điểm
  const hours = createdAt.getHours();
  const minutes = createdAt.getMinutes();
  const timeInMinutes = hours * 60 + minutes;

  if (timeInMinutes >= 11 * 60 && timeInMinutes <= 12 * 60 + 30) {
    cut += 500; // Khung 11:00 - 12:30
  } else if (timeInMinutes >= 18 * 60 && timeInMinutes <= 19 * 60 + 59) {
    cut += 1500; // Khung 18:00 - 19:59
  } else if (timeInMinutes >= 20 * 60 || timeInMinutes === 0) {
    cut += 2500; // Khung 20:00 - 23:59
  }

  return cut;
};

// 1. GET: Lấy cấu hình tỷ lệ + Thống kê doanh thu (Sàn hoặc Gian hàng / Shipper)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const timeFrame = searchParams.get("timeFrame") || "ALL"; // ALL, HOUR, DAY, MONTH, YEAR
    const type = searchParams.get("type") || "PLATFORM";      // PLATFORM | MERCHANT | SHIPPER
    const partnerId = searchParams.get("id") || searchParams.get("partnerId"); // ID Gian hàng / Shipper

    // Lấy cấu hình tỷ lệ chiết khấu từ Firestore
    const configDoc = await adminDb.collection("settings").doc("commission").get();
    const config = configDoc.exists
      ? configDoc.data()
      : { platformFeePercent: 10, shippingFeePercent: 20 };

    const platformFeePercent = Number(config?.platformFeePercent ?? 10);
    const shippingFeePercent = Number(config?.shippingFeePercent ?? 20);

    // Lấy toàn bộ danh sách đơn hàng
    const ordersSnap = await adminDb.collection("orders").get();

    let totalGMV = 0;
    let totalCodGMV = 0;   
    let totalBankGMV = 0;  
    let totalGrossRevenue = 0;
    let totalPlatformCut = 0;
    let totalNetRevenue = 0;
    let totalSubTotalCostPrice = 0;
    let totalSubTotalPrice = 0;
    let totalPlatformRevenue = 0;
    let totalShippingRevenue = 0; // Phí ship sàn thu
    let completedOrdersCount = 0;

    const chartDataMap: Record<
      string,
      { 
        gmv: number; 
        codAmount: number;   
        bankAmount: number;  
        gross: number;
        platformCut: number;
        net: number;
        subTotalCostPrice: number; 
        subTotalPrice: number;
        platformNet: number; 
        shippingNet: number; 
        count: number 
      }
    > = {};

    const now = new Date();

    ordersSnap.docs.forEach((doc) => {
      const data = doc.data();
      const status = (data.status || "").toString().toLowerCase().trim();

      // Kiểm tra trạng thái hoàn thành đơn hàng
      if (status === "completed" || status === "delivered") {
        
        // LỌC THEO ĐỐI TÁC (GIAN HÀNG / SHIPPER)
        if (type === "MERCHANT" && partnerId) {
          const orderMerchantId = data.merchantId || data.storeId || data.shopId;
          if (orderMerchantId !== partnerId) return;
        }

        if (type === "SHIPPER" && partnerId) {
          const orderShipperId = data.shipperId || data.driverId;
          if (orderShipperId !== partnerId) return;
        }

        // --- XỬ LÝ NGÀY THÁNG (createdAt) ---
        let createdAt = new Date();
        if (data.createdAt?.toDate) {
          createdAt = data.createdAt.toDate();
        } else if (data.createdAt?.seconds || data.createdAt?._seconds) {
          createdAt = new Date((data.createdAt.seconds || data.createdAt._seconds) * 1000);
        } else if (data.createdAt) {
          createdAt = new Date(data.createdAt);
        }

        // --- LỌC THEO TIMEFRAME ---
        if (timeFrame !== "ALL") {
          if (timeFrame === "HOUR") {
            if (createdAt.toDateString() !== now.toDateString()) return;
          } else if (timeFrame === "DAY") {
            if (
              createdAt.getMonth() !== now.getMonth() ||
              createdAt.getFullYear() !== now.getFullYear()
            ) return;
          } else if (timeFrame === "MONTH") {
            if (createdAt.getFullYear() !== now.getFullYear()) return;
          }
        }

        // --- TRÍCH XUẤT TIỀN TỆ ---
        const amount = Number(data.totalPrice ?? data.total ?? data.amount ?? 0);
        const shippingFee = Number(data.shippingFee ?? data.shipFee ?? data.deliveryFee ?? 0);

        // PHÂN LOẠI COD vs BANKING
        const isCod = isCodPayment(data.paymentMethod);
        const codAmount = isCod ? amount : 0;
        const bankAmount = !isCod ? amount : 0;

        // 1. TỔNG GIÁ GỐC CHƯA KHUYẾN MÃI (subTotalCostPrice)
        let costPriceTotal = Number(data.subTotalCostPrice ?? data.costPriceTotal ?? data.basePrice ?? 0);
        if (!costPriceTotal && Array.isArray(data.items)) {
          costPriceTotal = data.items.reduce((sum: number, item: any) => {
            const itemCost = Number(item.costPrice ?? item.basePrice ?? item.price ?? 0);
            const itemQty = Number(item.quantity ?? 1);
            return sum + itemCost * itemQty;
          }, 0);
        }
        if (!costPriceTotal) {
          costPriceTotal = amount > shippingFee ? amount - shippingFee : amount;
        }

        // 2. TỔNG GIÁ MÓN SAU KHUYẾN MÃI (subTotalPrice)
        let promoPriceTotal = Number(data.subTotalPrice ?? 0);
        if (!promoPriceTotal) {
          promoPriceTotal = Math.max(0, amount - shippingFee);
        }

        // --- TÍNH TOÁN THEO CHIẾT KHẤU MÓN & PHÍ SHIP SÀN THU ---
        
        // A. Chiết khấu món sàn thu = % * GIÁ MÓN GỐC CHƯA KM
        const platformNet = Math.round((costPriceTotal * platformFeePercent) / 100);

        // B. Chiết khấu ship sàn thu = Tính theo sơ đồ Bậc thang (Km + Khung giờ)
        const distanceKm = Number(data.distanceKm ?? data.distance ?? 0);
        let shippingNet = Number(data.shippingCut ?? 0);

        // Nếu DB chưa lưu shippingCut cứng, tự động tính bằng thuật toán bậc thang
        if (shippingNet === 0 && shippingFee > 0) {
          shippingNet = calculatePlatformShippingCut(distanceKm, createdAt);
        }

        let gross = promoPriceTotal;       // Doanh thu tổng món sau KM của quán
        let platformCut = platformNet;      // Chiết khấu trích cho sàn (tính từ giá gốc)
        let net = Math.max(0, promoPriceTotal - platformCut); // Quán thực nhận = Giá sau KM - Chiết khấu sàn từ giá gốc

        if (type === "SHIPPER") {
          gross = shippingFee;
          platformCut = shippingNet;
          net = gross - platformCut; // Shipper thực nhận = Phí ship - Phí sàn giữ
        }

        // Tích lũy tổng
        totalGMV += amount;
        totalCodGMV += codAmount;   
        totalBankGMV += bankAmount; 
        totalGrossRevenue += gross;
        totalPlatformCut += platformCut;
        totalNetRevenue += net;
        totalSubTotalCostPrice += costPriceTotal;
        totalSubTotalPrice += promoPriceTotal;
        totalPlatformRevenue += platformNet;
        totalShippingRevenue += shippingNet;
        completedOrdersCount += 1;

        // --- GOM NHÓM DỮ LIỆU BẢNG & BIỂU ĐỒ ---
        let key = "Tất cả";
        if (timeFrame === "HOUR") {
          key = `${createdAt.getHours().toString().padStart(2, "0")}:00`;
        } else if (timeFrame === "DAY") {
          key = `${createdAt.getDate().toString().padStart(2, "0")}/${(createdAt.getMonth() + 1)
            .toString()
            .padStart(2, "0")}`;
        } else if (timeFrame === "MONTH") {
          key = `Thg ${(createdAt.getMonth() + 1).toString().padStart(2, "0")}/${createdAt.getFullYear()}`;
        } else if (timeFrame === "YEAR") {
          key = `Năm ${createdAt.getFullYear()}`;
        }

        if (!chartDataMap[key]) {
          chartDataMap[key] = { 
            gmv: 0, 
            codAmount: 0, 
            bankAmount: 0, 
            gross: 0,
            platformCut: 0,
            net: 0,
            subTotalCostPrice: 0, 
            subTotalPrice: 0,
            platformNet: 0, 
            shippingNet: 0, 
            count: 0 
          };
        }
        
        chartDataMap[key].gmv += amount;
        chartDataMap[key].codAmount += codAmount;   
        chartDataMap[key].bankAmount += bankAmount; 
        chartDataMap[key].gross += gross;
        chartDataMap[key].platformCut += platformCut;
        chartDataMap[key].net += net;
        chartDataMap[key].subTotalCostPrice += costPriceTotal;
        chartDataMap[key].subTotalPrice += promoPriceTotal;
        chartDataMap[key].platformNet += platformNet;
        chartDataMap[key].shippingNet += shippingNet;
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
        config: {
          platformFeePercent,
          shippingFeePercent,
        },
        summary: {
          totalGMV,
          totalCodGMV,  
          totalBankGMV, 
          totalGrossRevenue,
          totalPlatformCut,
          totalNetRevenue,
          appliedCommissionPercent: type === "SHIPPER" ? shippingFeePercent : platformFeePercent,
          totalSubTotalCostPrice,
          totalSubTotalPrice,
          totalPlatformRevenue,
          totalShippingRevenue, // Trường trả ra Phí Ship Sàn Thu chuẩn cho Card KPI
          netTotalRevenue: totalPlatformRevenue + totalShippingRevenue, // Tổng Lợi Nhuận Sàn Thực Nhận
          totalOrders: completedOrdersCount,
        },
        chartData,
      },
    });
  } catch (error: any) {
    console.error("Lỗi Revenue API:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// 2. POST: Cập nhật tỷ lệ % lợi nhuận sàn & chi phí vận chuyển
export async function POST(request: Request) {
  try {
    const { platformFeePercent, shippingFeePercent } = await request.json();

    await adminDb.collection("settings").doc("commission").set(
      {
        platformFeePercent: Number(platformFeePercent) || 0,
        shippingFeePercent: Number(shippingFeePercent) || 0,
        updatedAt: new Date(),
      },
      { merge: true }
    );

    return NextResponse.json({ success: true, message: "Đã cập nhật tỷ lệ chiết khấu!" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}