import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";

// ============================================================
// HELPERS
// ============================================================

const normalizeRole = (role: unknown) =>
  String(role || "").trim().toUpperCase();

const getTargetCollection = (role: unknown) => {
  const upperRole = normalizeRole(role);

  if (upperRole === "MERCHANT") return "merchants";
  if (upperRole === "SHIPPER") return "shippers";

  return "users";
};

const normalizeCommission = (value: unknown): number => {
  if (value === undefined || value === null || value === "") {
    return 0;
  }

  const parsed = Number(String(value).replace(",", "."));

  if (!Number.isFinite(parsed)) {
    throw new Error("Chiết khấu không hợp lệ.");
  }

  if (parsed < 0 || parsed > 100) {
    throw new Error("Chiết khấu phải nằm trong khoảng 0% đến 100%.");
  }

  return Number(parsed.toFixed(2));
};

// ============================================================
// 1. GET - LẤY DANH SÁCH NGƯỜI DÙNG / MERCHANT / SHIPPER
// ============================================================

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetRole = normalizeRole(searchParams.get("role") || "ALL");

    let resultList: any[] = [];

    // ========================================================
    // 1. MERCHANTS
    // ========================================================

    if (targetRole === "MERCHANT" || targetRole === "ALL") {
      const merchantSnap = await adminDb.collection("merchants").get();

      const merchants = merchantSnap.docs.map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          uid: doc.id,

          ...data,

          role: "MERCHANT",

          fullName:
            data.fullName ||
            data.ownerName ||
            data.shopName ||
            "Gian Hàng",

          phone: data.phone || data.phoneNumber || "",

          // ✅ Chiết khấu Merchant
          commissionPercent: normalizeCommission(
            data.commissionPercent ??
              data.platformCommissionPercent ??
              data.merchantCommissionPercent ??
              data.platformFeePercent ??
              0
          ),

          // ✅ Chuẩn hóa địa chỉ
          address:
            data.address ||
            data.storeAddress ||
            data.shopAddress ||
            data.merchantAddress ||
            "",

          storeAddress:
            data.storeAddress ||
            data.address ||
            data.shopAddress ||
            data.merchantAddress ||
            "",

          shopName:
            data.shopName ||
            data.storeName ||
            data.name ||
            "Gian Hàng",

          storeName:
            data.storeName ||
            data.shopName ||
            data.name ||
            "Gian Hàng",
        };
      });

      resultList = [...resultList, ...merchants];
    }

    // ========================================================
    // 2. SHIPPERS
    // ========================================================

    if (targetRole === "SHIPPER" || targetRole === "ALL") {
      const shipperSnap = await adminDb.collection("shippers").get();

      const shippers = shipperSnap.docs.map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          uid: doc.id,

          ...data,

          role: "SHIPPER",

          idCardNumber:
            data.identityCardNumber || data.idCardNumber || "",
        };
      });

      resultList = [...resultList, ...shippers];
    }

    // ========================================================
    // 3. USERS
    // ========================================================

    if (
      ["ADMIN", "OPERATOR", "SUPPORT", "CUSTOMER", "ALL"].includes(
        targetRole
      )
    ) {
      const userSnap = await adminDb.collection("users").get();

      const users = userSnap.docs
        .map((doc) => {
          const data = doc.data();

          const userRole = normalizeRole(
            data.role || "CUSTOMER"
          );

          return {
            id: doc.id,
            uid: doc.id,

            ...data,

            role: userRole,
          };
        })
        .filter((user) => {
          if (targetRole === "ALL") return true;

          return user.role === targetRole;
        });

      resultList = [...resultList, ...users];
    }

    return NextResponse.json({
      success: true,
      data: resultList,
    });
  } catch (error: any) {
    console.error("❌ Lỗi lấy danh sách user:", error);

    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Không thể lấy danh sách người dùng.",
      },
      { status: 500 }
    );
  }
}

// ============================================================
// 2. PATCH
//    - Duyệt
//    - Khóa
//    - Mở khóa
//    - Cập nhật phí shipper
//    - Cập nhật CHIẾT KHẤU MERCHANT
// ============================================================

export async function PATCH(request: Request) {
  console.log("=== 🚀 BẮT ĐẦU PATCH /api/users ===");

  try {
    const body = await request.json();

    console.log(
      "📥 Payload nhận từ Client:",
      JSON.stringify(body, null, 2)
    );

    const {
      userId,
      status,
      role,
      blockReason,
      isDepositPaid,
      commissionPercent,
      updateType,
    } = body;

    // ========================================================
    // VALIDATE
    // ========================================================

    if (!userId) {
      console.log("❌ Thiếu userId");

      return NextResponse.json(
        {
          success: false,
          message: "❌ Thiếu dữ liệu bắt buộc (userId)",
        },
        { status: 400 }
      );
    }

    const upperRole = normalizeRole(role);

    const targetCollection = getTargetCollection(upperRole);

    const nowIso = new Date().toISOString();

    console.log(
      `📝 Collection target: ${targetCollection}`
    );

    // ========================================================
    // 🔥 CASE 1:
    // CẬP NHẬT CHIẾT KHẤU MERCHANT
    // ========================================================

    if (
      updateType === "MERCHANT_COMMISSION" ||
      commissionPercent !== undefined
    ) {
      if (upperRole !== "MERCHANT") {
        return NextResponse.json(
          {
            success: false,
            message:
              "Chỉ Merchant mới được cấu hình chiết khấu.",
          },
          { status: 400 }
        );
      }

      const commission = normalizeCommission(
        commissionPercent
      );

      console.log(
        `💰 Cập nhật commissionPercent = ${commission}% cho Merchant ${userId}`
      );

      const merchantRef = adminDb
        .collection("merchants")
        .doc(userId);

      // Kiểm tra Merchant tồn tại
      const merchantSnap = await merchantRef.get();

      if (!merchantSnap.exists) {
        return NextResponse.json(
          {
            success: false,
            message: "Không tìm thấy Merchant.",
          },
          { status: 404 }
        );
      }

      const merchantData = merchantSnap.data() || {};

      const currentStatus =
        status ||
        merchantData.status ||
        "PENDING";

      // ✅ Chỉ cập nhật commission
      // + updatedAt
      // Không thay đổi status nếu admin chỉ sửa chiết khấu.

      await merchantRef.update({
        commissionPercent: commission,

        updatedAt: nowIso,

        // Giữ lại status hiện tại
        status: currentStatus,
      });

      console.log(
        `✅ Đã lưu commissionPercent=${commission}% vào merchants/${userId}`
      );

      return NextResponse.json({
        success: true,
        message: `Đã cập nhật chiết khấu ${commission}% cho Merchant.`,
        data: {
          userId,
          role: "MERCHANT",
          commissionPercent: commission,
          status: currentStatus,
        },
      });
    }

    // ========================================================
    // CASE 2:
    // PATCH TRẠNG THÁI
    // ========================================================

    if (!status) {
      console.log(
        "❌ Lỗi: Thiếu status trong request trạng thái"
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "❌ Thiếu dữ liệu bắt buộc (status)",
        },
        { status: 400 }
      );
    }

    const reasonText =
      blockReason ||
      "Tài khoản bị tạm khóa bởi Quản trị viên";

    // ========================================================
    // PAYLOAD CƠ BẢN
    // ========================================================

    const updatePayload: Record<string, any> = {
      status,

      blockReason:
        status === "BLOCKED"
          ? reasonText
          : "",

      updatedAt: nowIso,
    };

    // ========================================================
    // SHIPPER DEPOSIT
    // ========================================================

    if (typeof isDepositPaid === "boolean") {
      updatePayload.isDepositPaid =
        isDepositPaid;

      updatePayload.depositStatus =
        isDepositPaid
          ? "PAID"
          : "UNPAID";
    }

    // ========================================================
    // FIRESTORE UPDATE
    // ========================================================

    console.log(
      `📝 Đang cập nhật document [${userId}] trong [${targetCollection}]`
    );

    await adminDb
      .collection(targetCollection)
      .doc(userId)
      .update(updatePayload);

    console.log(
      "✅ Cập nhật Firestore thành công!"
    );

    // ========================================================
    // NOTIFICATION
    // ========================================================

    if (
      status === "BLOCKED" ||
      status === "APPROVED" ||
      status === "REJECTED"
    ) {
      let notifTitle =
        "🎉 Tài khoản đã được phê duyệt";

      let notifBody =
        "Tài khoản của bạn đã được duyệt và hoạt động bình thường.";

      let notifType =
        "ACCOUNT_APPROVED";

      if (status === "BLOCKED") {
        notifTitle =
          "⛔ Tài khoản của bạn đã bị khóa";

        notifBody =
          `Lý do: ${reasonText}`;

        notifType =
          "ACCOUNT_BLOCKED";
      } else if (status === "REJECTED") {
        notifTitle =
          "❌ Hồ sơ đăng ký bị từ chối";

        notifBody =
          `Lý do: ${reasonText}`;

        notifType =
          "ACCOUNT_REJECTED";
      }

      const notifRef = adminDb
        .collection("notifications")
        .doc();

      await notifRef.set({
        userId,

        title: notifTitle,

        body: notifBody,

        type: notifType,

        isRead: false,

        createdAt: nowIso,
      });

      console.log(
        "🎉 Tạo notification thành công!"
      );
    }

    console.log(
      "=== ✅ KẾT THÚC PATCH THÀNH CÔNG ==="
    );

    return NextResponse.json({
      success: true,
      message: "Cập nhật thành công!",
    });
  } catch (error: any) {
    console.error(
      "🔴 LỖI TRONG QUÁ TRÌNH PATCH:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Có lỗi xảy ra khi cập nhật.",
      },
      { status: 500 }
    );
  }
}

// ============================================================
// 3. PUT
//    CẬP NHẬT THÔNG TIN CHI TIẾT
// ============================================================

export async function PUT(request: Request) {
  try {
    const body = await request.json();

    const {
      userId,
      role,
      fullName,
      phone,
      identityCardNumber,
      address,
      shopName,
      licensePlate,
      vehicleType,
      storeAddress,
      commissionPercent,
    } = body;

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          message: "Thiếu ID người dùng",
        },
        { status: 400 }
      );
    }

    const upperRole = normalizeRole(role);

    let targetCollection = "users";

    let updatePayload: Record<string, any> = {
      updatedAt: new Date().toISOString(),
    };

    // ========================================================
    // MERCHANT
    // ========================================================

    if (upperRole === "MERCHANT") {
      targetCollection = "merchants";

      // Chuẩn hóa địa chỉ.
      const normalizedAddress =
        String(
          address ??
            storeAddress ??
            ""
        ).trim();

      // Nếu client truyền commission thì validate.
      const hasCommission =
        commissionPercent !== undefined &&
        commissionPercent !== null &&
        commissionPercent !== "";

      const normalizedCommission =
        hasCommission
          ? normalizeCommission(
              commissionPercent
            )
          : undefined;

      updatePayload = {
        ...updatePayload,

        fullName:
          String(fullName || "").trim(),

        ownerName:
          String(fullName || "").trim(),

        phone:
          String(phone || "").trim(),

        phoneNumber:
          String(phone || "").trim(),

        // ====================================================
        // ✅ ĐỊA CHỈ
        // ====================================================

        address: normalizedAddress,

        storeAddress: normalizedAddress,

        // ====================================================
        // ✅ TÊN SHOP
        // ====================================================

        shopName:
          String(shopName || "").trim(),

        storeName:
          String(shopName || "").trim(),
      };

      // ======================================================
      // ✅ COMMISSION
      // Chỉ cập nhật khi PUT có truyền commission.
      // Không tự ghi đè commission cũ thành 0.
      // ======================================================

      if (normalizedCommission !== undefined) {
        updatePayload.commissionPercent =
          normalizedCommission;
      }

      // ======================================================
      // UPDATE MERCHANT
      // ======================================================

      await adminDb
        .collection(targetCollection)
        .doc(userId)
        .update(updatePayload);

      console.log(
        `✅ Merchant ${userId} updated`,
        updatePayload
      );

      return NextResponse.json({
        success: true,
        message:
          "Cập nhật thông tin Merchant thành công!",
        data: updatePayload,
      });
    }

    // ========================================================
    // SHIPPER
    // ========================================================

    if (upperRole === "SHIPPER") {
      targetCollection = "shippers";

      updatePayload = {
        ...updatePayload,

        fullName:
          String(fullName || "").trim(),

        phone:
          String(phone || "").trim(),

        identityCardNumber:
          String(
            identityCardNumber || ""
          ).trim(),

        licensePlate:
          String(
            licensePlate || ""
          ).trim(),

        vehicleType:
          vehicleType || "MOTORBIKE",
      };
    }

    // ========================================================
    // USER / CUSTOMER / ADMIN / OPERATOR / SUPPORT
    // ========================================================

    else if (upperRole !== "MERCHANT") {
      targetCollection = "users";

      updatePayload = {
        ...updatePayload,

        fullName:
          String(fullName || "").trim(),

        phone:
          String(phone || "").trim(),

        idCardNumber:
          String(
            identityCardNumber || ""
          ).trim(),

        role:
          upperRole || "CUSTOMER",
      };
    }

    // ========================================================
    // UPDATE USER / SHIPPER
    // ========================================================

    await adminDb
      .collection(targetCollection)
      .doc(userId)
      .update(updatePayload);

    return NextResponse.json({
      success: true,
      message:
        "Cập nhật thông tin thành công!",
      data: updatePayload,
    });
  } catch (error: any) {
    console.error(
      "❌ Lỗi cập nhật:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Không thể cập nhật thông tin.",
      },
      { status: 500 }
    );
  }
}

// ============================================================
// 4. DELETE
// ============================================================

export async function DELETE(request: Request) {
  try {
    const { searchParams } =
      new URL(request.url);

    const userId =
      searchParams.get("userId");

    const role =
      searchParams.get("role");

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          message: "Thiếu ID người dùng",
        },
        { status: 400 }
      );
    }

    const targetCollection =
      getTargetCollection(role);

    // ========================================================
    // XÓA FIRESTORE
    // ========================================================

    await adminDb
      .collection(targetCollection)
      .doc(userId)
      .delete();

    // ========================================================
    // XÓA FIREBASE AUTH
    // ========================================================

    try {
      await adminAuth.deleteUser(
        userId
      );
    } catch (authErr) {
      console.log(
        "ℹ️ Tài khoản Auth không tồn tại hoặc đã được xóa:",
        authErr
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Đã xóa tài khoản vĩnh viễn!",
    });
  } catch (error: any) {
    console.error(
      "❌ Lỗi xóa người dùng:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Không thể xóa người dùng.",
      },
      { status: 500 }
    );
  }
}