import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin"; // Import từ file firebaseAdmin.ts trong dự án của bạn

// 1. Bảng ánh xạ mã nhận diện đầu chuỗi -> Tên ngân hàng / Ví điện tử
const BANK_MAP: { [key: string]: string } = {
  // Big 4
  VCB: "Vietcombank",
  MBVCB: "Vietcombank",
  CTG: "VietinBank",
  ICB: "VietinBank",
  BIDV: "BIDV",
  VBA: "Agribank",
  AGB: "Agribank",

  // Ngân hàng Thương mại Cổ phần lớn
  MB: "MBBank",
  MBB: "MBBank",
  TCB: "Techcombank",
  VPB: "VPBank",
  VPBANK: "VPBank",
  ACB: "ACB",
  TPB: "TPBank",
  TPBANK: "TPBank",
  STB: "Sacombank",
  SACOMBANK: "Sacombank",
  HDB: "HDBank",
  HDBANK: "HDBank",
  VIB: "VIB",
  MSB: "MSB",
  OCB: "OCB",
  SHB: "SHB",
  LPB: "LPBank (LienVietPostBank)",
  LIENVIET: "LPBank (LienVietPostBank)",
  SSB: "SeABank",
  SEABANK: "SeABank",

  // Ngân hàng Thương mại Cổ phần khác & Ví điện tử
  EIB: "Eximbank",
  EXIMBANK: "Eximbank",
  ABB: "ABBANK",
  ABBANK: "ABBANK",
  NCB: "NCB",
  SCB: "SCB",
  VAB: "VietABank",
  VIETABANK: "VietABank",
  BVB: "BaoVietBank",
  BAOVIET: "BaoVietBank",
  PGB: "PGBank",
  PGBANK: "PGBank",
  GPB: "GPBank",
  SGB: "SaigonBank",
  SAIGONBANK: "SaigonBank",
  KBN: "Kienlongbank",
  KIENLONGBANK: "Kienlongbank",
  VARB: "Agribank",
  CAKE: "Cake by VPBank",
  UBANK: "Ubank by VPBank",
  TNEX: "TNEX (MSB)",
  TIMO: "Timo",
  MOMO: "Ví MoMo",
  ZALO: "Ví ZaloPay",
  VIETTEL: "Viettel Money",
};

// 2. Hàm bóc tách thông tin tài khoản (Hỗ trợ Ngân hàng & Ví điện tử qua SĐT)
function parseSePayContent(content: string, orderPhone?: string, customerName?: string) {
  if (!content) return null;

  // 1. Nhận diện Ví điện tử dựa trên từ khóa trong nội dung giao dịch
  let detectedWallet = "";
  if (/MOMO|MOMO_WALLET/i.test(content)) {
    detectedWallet = "Ví MoMo";
  } else if (/ZALO|ZALOPAY/i.test(content)) {
    detectedWallet = "Ví ZaloPay";
  } else if (/VIETTEL|VTMONEY|VIETTELPAY/i.test(content)) {
    detectedWallet = "Viettel Money";
  } else if (/SHOPEE|SHOPEEPAY/i.test(content)) {
    detectedWallet = "ShopeePay";
  }

  // 2. Kiểm tra nếu chuỗi dạng "MãGD-SĐT-MãĐơn" (Ví dụ: 145180128744-0865234554-DH1788489978)
  const dashMatch = content.match(/(\d+)-(0\d{9,10})-(DH\d+)/i);
  if (dashMatch) {
    return {
      bankAccount: dashMatch[2], // Lấy chính xác SĐT: 0865234554
      bankOwner: customerName || "Khách hàng",
      // Ưu tiên tên Ví nhận diện được, nếu không có thì mặc định Ví MoMo / Chuyển khoản SĐT
      bankName: detectedWallet || "Ví MoMo / Chuyển khoản SĐT",
    };
  }

  // 3. Chuẩn hóa chuyển khoản ngân hàng dạng "CT tu <STK> <TEN> toi <STK_NHAN>"
  const match = content.match(/(?:CT\s+tu|tu|from)\s+(\d+)\s+(.*?)\s+(?:toi|to)\s+\d+/i);

  // Nhận diện ngân hàng gửi dựa vào mã prefix ở đầu chuỗi
  const prefixMatch = content.match(/^([A-Z0-9]+)/i);
  let senderBank = detectedWallet || "Ngân hàng chuyển tiền";

  if (!detectedWallet && prefixMatch) {
    const code = prefixMatch[1].toUpperCase();
    for (const key in BANK_MAP) {
      if (code.startsWith(key)) {
        senderBank = BANK_MAP[key];
        break;
      }
    }
  }

  if (match) {
    return {
      bankAccount: match[1],
      bankOwner: match[2].trim(),
      bankName: senderBank,
    };
  }

  // 4. Dự phòng nếu không bắt được pattern chuẩn
  return {
    bankAccount: orderPhone || "",
    bankOwner: customerName || "",
    bankName: senderBank,
  };
}

export async function GET() {
  return NextResponse.json(
    { status: "ok", message: "API SePay Webhook đã sẵn sàng!" },
    { status: 200 }
  );
}

export async function POST(request: Request) {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      console.log("📩 Webhook nhận request rỗng/không đúng định dạng JSON");
    }

    console.log("📩 SePay Webhook Payload nhận được:", body);

    const { content, code, transferAmount, id: transactionId } = body || {};
    const rawContent = (content || code || "").toString().trim();

    // 1. Xử lý khi SePay bấm nút "Gửi thử" (Test Webhook)
    if (!rawContent) {
      console.log("✅ Nhận được request test thành công từ SePay");
      return NextResponse.json(
        { success: true, message: "Test webhook successful" },
        { status: 200 }
      );
    }

    // 2. Trích xuất mã đơn hàng DH...
    const match = rawContent.match(/DH\d+/i);
    const extractedCode = match ? match[0].toUpperCase() : rawContent;
    console.log("🔎 Đang tìm đơn hàng với paymentCode:", extractedCode);

    // 3. Truy vấn Firestore bằng Admin SDK
    const ordersSnapshot = await adminDb
      .collection("orders")
      .where("paymentCode", "==", extractedCode)
      .get();

    if (ordersSnapshot.empty) {
      console.warn("⚠️ Không tìm thấy đơn hàng với mã:", extractedCode);
      return NextResponse.json(
        { success: false, message: "Order not found" },
        { status: 200 }
      );
    }

    // 4. Lấy dữ liệu đơn hàng hiện tại
    const orderDoc = ordersSnapshot.docs[0];
    const orderData = orderDoc.data();

    // 5. Bóc tách thông tin tài khoản chuyển tiền
    const bankDetails = parseSePayContent(
      rawContent,
      orderData?.phone || orderData?.customerPhone,
      orderData?.customerName || orderData?.recipientName
    );

    // 6. Cập nhật dữ liệu vào Firestore
    await orderDoc.ref.update({
      status: "paid",
      paymentStatus: "paid",
      paidAt: new Date().toISOString(),
      paidAmount: transferAmount || 0,
      sePayTransactionId: transactionId || null,

      // Thông tin phục vụ Hoàn Tiền
      bankAccount: bankDetails?.bankAccount || "",
      bankOwner: bankDetails?.bankOwner || "",
      bankName: bankDetails?.bankName || "Chuyển khoản Ngân hàng",
      rawPaymentContent: content || "",
    });

    console.log(
      `✅ Cập nhật thành công đơn hàng & thông tin thanh toán: ${orderDoc.id}`
    );

    return NextResponse.json(
      { success: true, message: "Cập nhật thành công" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("❌ Lỗi crash Webhook:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 200 }
    );
  }
}