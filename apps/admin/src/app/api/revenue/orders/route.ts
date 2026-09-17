import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

// ==========================================
// HÀM TÍNH PHÍ SHIP SÀN GIỮ THEO SƠ ĐỒ
// Dựa trên khoảng cách (Km) và Khung giờ
// ==========================================
const calculatePlatformShippingCut = (distanceKm: number, createdAt: Date) => {
  let cut = 0;

  // 1. Tính phí sàn giữ theo Khoảng cách (Km)
  if (distanceKm <= 1) {
    cut += 2000;
  } else if (distanceKm <= 2) {
    cut += 3000;
  } else if (distanceKm <= 3) {
    cut += 4000;
  } else if (distanceKm <= 4) {
    cut += 4500;
  } else if (distanceKm <= 5) {
    cut += 5000;
  } else {
    cut += 5500; // Trên 5km
  }

  // 2. Tính phí cộng thêm theo Khung giờ phụ thu
  const hours = createdAt.getHours();
  const minutes = createdAt.getMinutes();
  const timeInMinutes = hours * 60 + minutes;

  if (timeInMinutes >= 11 * 60 && timeInMinutes <= 12 * 60 + 30) {
    // Khung 11:00 - 12:30
    cut += 500;
  } else if (timeInMinutes >= 18 * 60 && timeInMinutes <= 19 * 60 + 59) {
    // Khung 18:00 - 19:59
    cut += 1500;
  } else if (timeInMinutes >= 20 * 60 || timeInMinutes === 0) {
    // Khung 20:00 - 00:00 (đến hết 23:59)
    cut += 2500;
  }

  return cut;
};

// Định nghĩa kiểu dữ liệu đơn hàng
interface OrderDocument {
  docId: string;
  subTotalCostPrice?: number;
  costPriceTotal?: number;
  basePrice?: number;
  subTotalPrice?: number;
  subtotal?: number;
  itemsPrice?: number;
  shippingFee?: number;
  shipFee?: number;
  deliveryFee?: number;
  distanceKm?: number; // Cần thiết để tính phí theo sơ đồ
  totalPrice?: number;
  total?: number;
  amount?: number;
  finalAmount?: number;
  paymentCode?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  customerName?: string;
  recipientName?: string;
  storeName?: string;
  shopName?: string;
  merchantId?: string;
  shipperId?: string;
  status?: string;
  items?: any[];
  createdAt?: any;
  createdDate?: Date;
  shippingCut?: number; // Phí sàn giữ đã lưu trong DB (nếu có)
  [key: string]: any;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const time = searchParams.get("time");            
    const timeFrame = searchParams.get("timeFrame") || "DAY"; 
    const viewType = searchParams.get("viewType");    
    const partnerId = searchParams.get("partnerId");  

    // Tải cấu hình % từ Firestore (Chỉ dùng cho Gian hàng)
    const configDoc = await adminDb.collection("settings").doc("commission").get();
    const config = configDoc.exists
      ? configDoc.data()
      : { platformFeePercent: 10 };

    const platformFeePercent = Number(config?.platformFeePercent ?? 10);

    const ordersSnap = await adminDb.collection("orders").get();

    if (ordersSnap.empty) {
      return NextResponse.json({ success: true, data: [] });
    }

    const filteredOrders: OrderDocument[] = [];

    ordersSnap.docs.forEach((doc) => {
      const data = doc.data() as Record<string, any>;
      const status = (data.status || "").toString().toLowerCase().trim();

      if (status === "completed" || status === "delivered") {
        if (viewType === "MERCHANT" && partnerId) {
          const orderMerchantId = data.merchantId || data.storeId || data.shopId;
          if (orderMerchantId !== partnerId) return;
        }
        if (viewType === "SHIPPER" && partnerId) {
          const orderShipperId = data.shipperId || data.driverId;
          if (orderShipperId !== partnerId) return;
        }

        let createdDate = new Date();
        if (data.createdAt?.toDate) {
          createdDate = data.createdAt.toDate();
        } else if (data.createdAt?.seconds || data.createdAt?._seconds) {
          createdDate = new Date((data.createdAt.seconds || data.createdAt._seconds) * 1000);
        } else if (data.createdAt) {
          createdDate = new Date(data.createdAt);
        }

        let key = "Tất cả";
        if (timeFrame === "HOUR") {
          key = `${createdDate.getHours().toString().padStart(2, "0")}:00`;
        } else if (timeFrame === "DAY") {
          key = `${createdDate.getDate().toString().padStart(2, "0")}/${(createdDate.getMonth() + 1).toString().padStart(2, "0")}`;
        } else if (timeFrame === "MONTH") {
          key = `Thg ${(createdDate.getMonth() + 1).toString().padStart(2, "0")}/${createdDate.getFullYear()}`;
        } else if (timeFrame === "YEAR") {
          key = `Năm ${createdDate.getFullYear()}`;
        }

        if (time && time !== "Tất cả" && key !== time) return;

        filteredOrders.push({ docId: doc.id, ...data, createdDate });
      }
    });

    const resultData = filteredOrders.map((order: OrderDocument) => {
      const amount = Number(order.totalPrice ?? order.total ?? order.amount ?? order.finalAmount ?? 0);
      const shippingFee = Number(order.shippingFee ?? order.shipFee ?? order.deliveryFee ?? 0);

      // 1. TÍNH GIÁ GỐC CHƯA KHUYẾN MÃI (subTotalCostPrice)
      let subTotalCostPrice = Number(order.subTotalCostPrice ?? order.costPriceTotal ?? order.basePrice ?? 0);
      if (!subTotalCostPrice && Array.isArray(order.items)) {
        subTotalCostPrice = order.items.reduce((sum: number, item: any) => {
          const itemCost = Number(item.costPrice ?? item.basePrice ?? item.price ?? 0);
          const itemQty = Number(item.quantity ?? 1);
          return sum + itemCost * itemQty;
        }, 0);
      }
      if (!subTotalCostPrice) subTotalCostPrice = amount > shippingFee ? amount - shippingFee : amount;

      // 2. TÍNH GIÁ MÓN SAU KHUYẾN MÃI (subTotalPrice)
      let subTotalPrice = Number(order.subTotalPrice ?? order.subtotal ?? order.itemsPrice ?? 0);
      if (!subTotalPrice) subTotalPrice = Math.max(0, amount - shippingFee);

      // 3. CHIẾT KHẤU SÀN TRÊN MÓN (Tính từ Giá Gốc chưa KM)
      const platformCut = Math.round((subTotalCostPrice * platformFeePercent) / 100);

      // 4. CHIẾT KHẤU SHIP SÀN GIỮ (Tính theo sơ đồ Km và Giờ)
      const distanceKm = Number(order.distanceKm ?? order.distance ?? 0);
      
      // Ưu tiên lấy phí sàn đã lưu cứng trong DB lúc đặt đơn, nếu không có/bằng 0 thì tự động tính theo sơ đồ
      let shippingCut = Number(order.shippingCut ?? 0);
      if (shippingCut === 0 && shippingFee > 0) {
        shippingCut = calculatePlatformShippingCut(distanceKm, order.createdDate || new Date());
      }

      return {
        id: order.docId,
        paymentCode: order.paymentCode || order.docId,
        paymentMethod: order.paymentMethod || "banking", 
        paymentStatus: order.paymentStatus || "paid",
        customerName: order.customerName || order.recipientName || "Khách hàng",
        storeName: order.storeName || order.shopName || "Gian hàng",
        subTotalCostPrice,                       
        subTotalPrice,                           
        basePrice: subTotalCostPrice,            
        platformFeePercent,                      
        platformCut,                             
        shippingFee,
        distanceKm, // Trả về thêm khoảng cách để dễ debug
        shippingCut, // Trả về phí sàn giữ chính xác theo sơ đồ
        totalPrice: amount,
        status: "Hoàn thành",
        createdAt: order.createdDate ? order.createdDate.toISOString() : order.createdAt,
      };
    });

    return NextResponse.json({ success: true, data: resultData });
  } catch (error: any) {
    console.error("Lỗi khi truy vấn đơn hàng chi tiết từ Firestore:", error);
    return NextResponse.json({ success: false, message: error.message || "Lỗi Firestore" }, { status: 500 });
  }
}