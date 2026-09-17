import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fullName, phone, idCardNumber, password, role, adminSecretKey } = body;

    // 1. Kiểm tra Secret Key trực tiếp từ môi trường Server
    const SERVER_SECRET = process.env.ADMIN_SECRET_KEY;
    if (!SERVER_SECRET || adminSecretKey !== SERVER_SECRET) {
      return NextResponse.json(
        { message: "Mã xác thực Admin không hợp lệ!" },
        { status: 403 }
      );
    }

    // 2. Validate dữ liệu đầu vào
    if (!phone || !idCardNumber || idCardNumber.length !== 12 || password.length < 6) {
      return NextResponse.json(
        { message: "Dữ liệu đăng ký không đúng định dạng!" },
        { status: 400 }
      );
    }

    // 3. Tạo Virtual Email
    const virtualEmail = `${phone.trim()}.${idCardNumber.trim()}@system.local`;

    // 4. Tạo User trên Firebase Auth bằng Admin SDK
    const userRecord = await adminAuth.createUser({
      email: virtualEmail,
      password: password,
      displayName: fullName,
    });

    // 5. Lưu thông tin Profile chuẩn vào Firestore
    await adminDb.collection("users").doc(userRecord.uid).set({
      uid: userRecord.uid,
      fullName: fullName.trim(),
      phone: phone.trim(),
      idCardNumber: idCardNumber.trim(),
      role: role || "ADMIN",
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json({ success: true, uid: userRecord.uid });
  } catch (error: any) {
    console.error("Lỗi đăng ký Admin:", error);
    return NextResponse.json(
      { message: error.message || "Đã có lỗi xảy ra phía Server!" },
      { status: 500 }
    );
  }
}