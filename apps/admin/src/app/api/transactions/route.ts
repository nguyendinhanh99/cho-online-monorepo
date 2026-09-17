import { NextResponse } from "next/server";
// Kiểm tra lại đường dẫn file firebase-admin của bạn trong dự án
import { adminDb as db } from "@/lib/firebase-admin";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role");

    let query: FirebaseFirestore.Query = db.collection("transactions").orderBy("createdAt", "desc").limit(100);

    if (role && role !== "ALL") {
      query = query.where("role", "==", role);
    }

    const snapshot = await query.get();

    // Định nghĩa tham số doc: any hoặc gán biến data trước để tránh lỗi TypeScript implicit any
    const transactions = snapshot.docs.map((doc: any) => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        transactionId: data.transactionId || doc.id,
        partnerId: data.partnerId || "",
        partnerName: data.partnerName || "N/A",
        phone: data.phone || "",
        amount: data.amount || 0,
        bankName: data.bankName || "",
        bankAccount: data.bankAccount || "",
        status: data.status || "SUCCESS",
        note: data.note || "",
        createdAt: data.createdAt || new Date().toISOString(),
      };
    });

    return NextResponse.json({ success: true, data: transactions });
  } catch (error: any) {
    console.error("Lỗi API Transactions GET:", error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}