import { NextResponse } from "next/server";
import { initializeApp, getApps, cert, getApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// ==========================================
// 1. KHỞI TẠO FIREBASE ADMIN DB AN TOÀN
// ==========================================
const projectId =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
  "nishop-de3c5";
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;

function getAdminDb() {
  if (getApps().length > 0) {
    return getFirestore(getApp());
  }

  if (clientEmail && privateKey) {
    const app = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, "\n"),
      }),
      projectId,
    });
    return getFirestore(app);
  }

  const app = initializeApp({ projectId });
  return getFirestore(app);
}

const adminDb = getAdminDb();

// Hạn mức giữ nợ tối đa (Nếu nợ dưới mốc này sau khi trừ tiền nộp -> Mở khóa)
const MAX_DEBT_LIMIT = 2000000;

// ==========================================
// 2. BẢNG ÁNH XẠ NGÂN HÀNG & PARSER
// ==========================================
const BANK_MAP: { [key: string]: string } = {
  VCB: "Vietcombank", MBVCB: "Vietcombank", CTG: "VietinBank", ICB: "VietinBank",
  BIDV: "BIDV", VBA: "Agribank", AGB: "Agribank", MB: "MBBank", MBB: "MBBank",
  TCB: "Techcombank", VPB: "VPBank", VPBANK: "VPBank", ACB: "ACB", TPB: "TPBank",
  TPBANK: "TPBank", STB: "Sacombank", SACOMBANK: "Sacombank", HDB: "HDBank", HDBANK: "HDBank",
  VIB: "VIB", MSB: "MSB", OCB: "OCB", SHB: "SHB", LPB: "LPBank", SSB: "SeABank",
  CAKE: "Cake by VPBank", TNEX: "TNEX (MSB)", TIMO: "Timo", MOMO: "Ví MoMo", ZALO: "Ví ZaloPay", VIETTEL: "Viettel Money",
};

function parseSePayContent(content: string) {
  if (!content) return null;

  let detectedWallet = "";
  if (/MOMO|MOMO_WALLET/i.test(content)) detectedWallet = "Ví MoMo";
  else if (/ZALO|ZALOPAY/i.test(content)) detectedWallet = "Ví ZaloPay";
  else if (/VIETTEL|VTMONEY|VIETTELPAY/i.test(content)) detectedWallet = "Viettel Money";

  const match = content.match(/(?:CT\s+tu|tu|from)\s+(\d+)\s+(.*?)\s+(?:toi|to)\s+\d+/i);
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

  return {
    bankAccount: match ? match[1] : "",
    bankOwner: match ? match[2].trim() : "",
    bankName: senderBank,
  };
}

// ==========================================
// 3. API HANDLERS
// ==========================================
export async function GET() {
  return NextResponse.json({ status: "ok", message: "API SePay Webhook Ready" }, { status: 200 });
}

export async function POST(request: Request) {
  console.log("\n=================== 🚀 WEBHOOK INCOMING ===================");
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch (err) {
      console.error("❌ ERROR PARSING JSON BODY:", err);
    }

    console.log("📦 1. RAW BODY RECEIVE FROM SEPAY:", JSON.stringify(body, null, 2));

    const data = body.data || body;
    const rawContent = String(data.content || data.description || data.code || "").trim();
    const finalAmount = Number(data.transferAmount || data.amount || 0);
    const finalTransactionId = String(data.id || data.referenceCode || Date.now());

    console.log(`🔎 2. EXTRACTED DATA:
      - Content: "${rawContent}"
      - Amount: ${finalAmount}
      - TransactionId: "${finalTransactionId}"`);

    // A. Xử lý request test từ SePay
    if (!rawContent && finalAmount === 0) {
      console.log("✅ 3. SEPAY TEST WEBHOOK DETECTED (PASS)");
      return NextResponse.json({ success: true, message: "Test webhook successful" }, { status: 200 });
    }

    if (finalAmount <= 0) {
      console.warn("⚠️ 3. AMOUNT IS <= 0, SKIPPING...");
      return NextResponse.json({ success: true, message: "Bỏ qua giao dịch <= 0đ" }, { status: 200 });
    }

    // B. Kiểm tra Regex NOP <UID>
    const match = rawContent.match(/NOP\s*([A-Za-z0-9_-]+)/i);

    if (!match || !match[1]) {
      console.error(`❌ 3. REGEX MATCH FAILED! No 'NOP <UID>' found in content: "${rawContent}"`);
      return NextResponse.json(
        { success: false, message: `Bỏ qua: Không tìm thấy cú pháp 'NOP <UID>' trong nội dung: ${rawContent}` },
        { status: 200 }
      );
    }

    const shipperId = match[1].trim();
    console.log(`🎯 3. FOUND SHIPPER UID: "${shipperId}"`);

    const bankDetails = parseSePayContent(rawContent);

    // C. Lấy thông tin Shipper từ Firestore
    let driverName = "Tài xế";
    let driverPhone = "";
    let currentDebt = 0;
    let isLocked = false;
    let shipperExist = false;

    try {
      console.log(`🔥 4. FETCHING SHIPPER DOC FROM FIRESTORE: shippers/${shipperId}...`);
      const shipperRef = adminDb.collection("shippers").doc(shipperId);
      const shipperSnap = await shipperRef.get();

      if (shipperSnap.exists) {
        shipperExist = true;
        const driverData = shipperSnap.data();
        driverName = driverData?.fullName || driverData?.name || "Tài xế";
        driverPhone = driverData?.phone || "";
        currentDebt = Number(driverData?.currentDebt || 0);
        isLocked = Boolean(driverData?.isLocked || driverData?.status === "BLOCKED");
        console.log(`✅ 4. SHIPPER FOUND: Name="${driverName}", Phone="${driverPhone}", CurrentDebt=${currentDebt}`);
      } else {
        console.warn(`⚠️ 4. SHIPPER DOC DOES NOT EXIST IN DATABASE: shippers/${shipperId}`);
      }
    } catch (err: any) {
      console.error("❌ 4. ERROR READING SHIPPER DOC FROM FIRESTORE:", err);
    }

// D. Ghi dữ liệu vào collection topup_requests
    try {
      console.log(`📝 5. WRITING TO topup_requests/${finalTransactionId}...`);
      await adminDb.collection("topup_requests").doc(finalTransactionId).set({
        transactionId: finalTransactionId,
        shipperId: shipperId,     // Đánh lưu cả 2 để Client query kiểu gì cũng dính
        shipperUid: shipperId,    
        driverName: driverName,
        phone: driverPhone,
        amount: finalAmount,
        transferAmount: finalAmount,
        bankDescription: rawContent,
        bankAccount: bankDetails?.bankAccount || "",
        bankOwner: bankDetails?.bankOwner || "",
        bankName: bankDetails?.bankName || "Chuyển khoản Ngân hàng",
        createdAt: new Date().toISOString(),
        status: "COMPLETED",
        type: "AUTO_SEPAY",
        source: "webhook_bank",
        rawData: body,
      });
      console.log(`✅ 5. SUCCESS WRITING TO topup_requests!`);
    } catch (err: any) {
      console.error("❌ 5. ERROR WRITING TO topup_requests:", err);
    }

    // E. Ghi dữ liệu vào collection payments
    try {
      console.log(`📝 6. WRITING TO payments/${finalTransactionId}...`);
      await adminDb.collection("payments").doc(finalTransactionId).set({
        transactionId: finalTransactionId,
        shipperId: shipperId,
        amount: finalAmount,
        content: rawContent,
        status: "success",
        createdAt: new Date().toISOString(),
        bankAccount: bankDetails?.bankAccount || "",
        bankOwner: bankDetails?.bankOwner || "",
        bankName: bankDetails?.bankName || "Chuyển khoản Ngân hàng",
        rawData: body,
      });
      console.log(`✅ 6. SUCCESS WRITING TO payments!`);
    } catch (err: any) {
      console.error("❌ 6. ERROR WRITING TO payments:", err);
    }

    // F. Cập nhật trạng thái mở khóa & Giảm Công nợ cho Shipper
    if (shipperExist) {
      try {
        console.log(`🔓 7. UPDATING UNLOCK STATUS & DEBT IN shippers/${shipperId}...`);
        const shipperRef = adminDb.collection("shippers").doc(shipperId);

        // Tính công nợ mới sau khi trừ tiền vừa nộp
        const newDebt = Math.max(0, currentDebt - finalAmount);
        const shouldUnlock = newDebt < MAX_DEBT_LIMIT;

        const updateData: any = {
          currentDebt: newDebt,
          totalPaid: FieldValue.increment(finalAmount),
          lastPaymentAmount: finalAmount,
          lastPaymentAt: new Date().toISOString(),
        };

        // Tự động mở khóa tài khoản nếu công nợ đã giảm xuống dưới hạn mức cho phép (2.000.000đ)
        if (shouldUnlock && isLocked) {
          updateData.isLocked = false;
          updateData.status = "ACTIVE";
          updateData.blockReason = FieldValue.delete();
          updateData.lockReason = FieldValue.delete();
          updateData.lockedReason = FieldValue.delete();
          updateData.unlockedAt = new Date().toISOString();
        }

        await shipperRef.set(updateData, { merge: true });
        console.log(`✅ 7. SUCCESS UPDATING SHIPPER DOC! New Debt: ${newDebt}, Unlocked: ${shouldUnlock}`);
      } catch (err: any) {
        console.error("❌ 7. ERROR UPDATING SHIPPER DOC:", err);
      }
    }

    console.log("=================== 🎉 ALL PROCESS COMPLETED ===================\n");

    return NextResponse.json(
      {
        success: true,
        message: "Xử lý webhook hoàn tất thành công",
        shipperId: shipperId,
        amount: finalAmount,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("💥 CRITICAL WEBHOOK CRASH:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 200 });
  }
}