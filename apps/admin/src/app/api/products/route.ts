import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

// 1. GET: Lấy danh sách sản phẩm
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const merchantId = searchParams.get("merchantId");

    let query: FirebaseFirestore.Query = adminDb.collection("products");

    if (merchantId) {
      query = query.where("merchantId", "==", merchantId);
    }

    const snapshot = await query.get();
    const products = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ success: true, data: products });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// 2. DELETE: Xóa sản phẩm vi phạm
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");

    if (!productId) {
      return NextResponse.json({ success: false, message: "Thiếu productId" }, { status: 400 });
    }

    await adminDb.collection("products").doc(productId).delete();

    return NextResponse.json({ success: true, message: "Đã xóa sản phẩm thành công!" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}