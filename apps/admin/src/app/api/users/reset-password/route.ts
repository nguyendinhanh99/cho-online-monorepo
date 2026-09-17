import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin"; // Import cấu hình Firebase Admin của bạn

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, newPassword } = body;

    // 1. Kiểm tra dữ liệu đầu vào
    if (!userId || !newPassword) {
      return NextResponse.json(
        { success: false, message: "Thiếu userId hoặc newPassword" },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { success: false, message: "Mật khẩu phải từ 6 ký tự trở lên" },
        { status: 400 }
      );
    }

    // 2. Đặt lại mật khẩu trên Firebase Authentication qua Firebase Admin SDK
    await adminAuth.updateUser(userId, {
      password: newPassword,
    });

    return NextResponse.json({
      success: true,
      message: "Cập nhật mật khẩu thành công!",
    });
  } catch (error: any) {
    console.error("Lỗi đổi mật khẩu:", error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Không thể cập nhật mật khẩu",
      },
      { status: 500 }
    );
  }
}