import { NextResponse } from "next/server";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// 1. Khởi tạo Firebase Admin SDK (Chỉ khởi tạo 1 lần)
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const adminDb = getFirestore();

// 📥 1. Lấy lịch sử thông báo theo merchantId
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const merchantId = searchParams.get("merchantId");

    if (!merchantId) {
      return NextResponse.json(
        { success: false, message: "Thiếu merchantId" },
        { status: 400 }
      );
    }

    const notifRef = adminDb.collection("notifications");

    // Query từ Firestore với cả 2 trường targetUserId hoặc merchantId
    let snapshot = await notifRef
      .where("targetUserId", "==", merchantId)
      .get();

    // Fallback nếu không có dữ liệu theo targetUserId
    if (snapshot.empty) {
      snapshot = await notifRef
        .where("merchantId", "==", merchantId)
        .get();
    }

    const notifications: any[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      notifications.push({
        id: doc.id,
        title: data.title || "",
        body: data.body || data.message || "",
        message: data.body || data.message || "",
        isRead: data.isRead || false,
        targetRole: data.targetRole || "MERCHANT",
        targetUserId: data.targetUserId || data.merchantId || "",
        // 🔥 LẤY TRƯỜNG REPLIES TỪ FIRESTORE
        replies: Array.isArray(data.replies) ? data.replies : [],
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
      });
    });

    // Sắp xếp thời gian mới nhất lên đầu
    notifications.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({
      success: true,
      data: notifications,
    });
  } catch (error: any) {
    console.error("Lỗi lấy lịch sử thông báo từ Firebase:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Lỗi máy chủ nội bộ" },
      { status: 500 }
    );
  }
}

// 📤 2. Gửi và Lưu thông báo mới
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { merchantId, title, message, body: messageBody, targetRole = "MERCHANT" } = body;

    const notifMessage = message || messageBody;

    if (!merchantId || !title || !notifMessage) {
      return NextResponse.json(
        { success: false, message: "Vui lòng nhập đầy đủ targetUserId/merchantId, tiêu đề và nội dung" },
        { status: 400 }
      );
    }

    // Khởi tạo Document Data đồng bộ với cấu trúc trong Firebase Console của bạn
    const newDocData = {
      title,
      body: notifMessage,
      targetUserId: merchantId,
      merchantId: merchantId,
      targetRole: targetRole,
      isRead: false,
      replies: [], // 🔥 Khởi tạo mảng phản hồi rỗng mặc định
      createdAt: new Date(),
    };

    // Lưu vào Firestore
    const docRef = await adminDb.collection("notifications").add(newDocData);

    return NextResponse.json({
      success: true,
      message: "Gửi thông báo thành công!",
      data: {
        id: docRef.id,
        ...newDocData,
        createdAt: newDocData.createdAt.toISOString(),
      },
    });
  } catch (error: any) {
    console.error("Lỗi gửi thông báo đến Firebase:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Lỗi máy chủ" },
      { status: 500 }
    );
  }
}