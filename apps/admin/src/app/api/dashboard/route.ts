import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

/* =========================================================
   HELPERS
========================================================= */

const normalizeStatus = (value: unknown): string =>
  String(value ?? "")
    .toLowerCase()
    .trim();

const parseDate = (value: any): Date => {
  if (!value) return new Date(0);

  try {
    if (typeof value?.toDate === "function") {
      return value.toDate();
    }

    if (value?.seconds !== undefined) {
      return new Date(Number(value.seconds) * 1000);
    }

    if (value?._seconds !== undefined) {
      return new Date(Number(value._seconds) * 1000);
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? new Date(0)
      : date;
  } catch {
    return new Date(0);
  }
};

const serializeCreatedAt = (value: any): string | null => {
  const date = parseDate(value);

  return date.getTime() > 0
    ? date.toISOString()
    : null;
};

/* =========================================================
   STATUS GROUPS
========================================================= */

const PENDING_STATUSES = new Set([
  "pending_payment",
  "pending",
  "finding_driver",
]);

const ACTIVE_STATUSES = new Set([
  "accepted",
  "preparing",
  "processing",
  "ready",
  "ready_for_pickup",
  "assigned",
  "picking_up",
  "delivering",
  "shipping",
]);

const COMPLETED_STATUSES = new Set([
  "completed",
  "delivered",
]);

const CANCELLED_STATUSES = new Set([
  "cancelled",
  "canceled",
]);

const REFUNDED_STATUSES = new Set([
  "refunded",
]);

/* =========================================================
   DASHBOARD API

   QUAN TRỌNG:
   - API này KHÔNG tính tài chính.
   - Không tính lại Merchant commission.
   - Không tính lại phí Shipper.
   - Không tính lại Voucher.
   - Không tính lại "Sàn nhận thực".

   Finance Source of Truth = /api/revenue
========================================================= */

export async function GET() {
  try {
    const [
      ordersSnap,
      merchantsSnap,
      usersSnap,
      productsSnap,
    ] = await Promise.all([
      adminDb.collection("orders").get(),
      adminDb.collection("merchants").get(),
      adminDb.collection("users").get(),
      adminDb.collection("products").get(),
    ]);

    /* =====================================================
       ORDER STATUS STATS
    ===================================================== */

    let pendingOrders = 0;
    let activeOrders = 0;
    let completedOrders = 0;
    let cancelledOrders = 0;
    let refundedOrders = 0;

    const recentOrders: any[] = [];

    for (const orderDoc of ordersSnap.docs) {
      const data = orderDoc.data() as Record<string, any>;
      const status = normalizeStatus(data?.status);

      if (PENDING_STATUSES.has(status)) {
        pendingOrders += 1;
      }

      if (ACTIVE_STATUSES.has(status)) {
        activeOrders += 1;
      }

      if (COMPLETED_STATUSES.has(status)) {
        completedOrders += 1;
      }

      if (CANCELLED_STATUSES.has(status)) {
        cancelledOrders += 1;
      }

      if (REFUNDED_STATUSES.has(status)) {
        refundedOrders += 1;
      }

      /*
       * Giữ dữ liệu order gần như nguyên bản cho bảng
       * "Đơn hàng mới nhất".
       *
       * Không thêm platformProfit / shippingCut / commission
       * vì Dashboard không còn là nơi tính tài chính.
       */
      recentOrders.push({
        id: orderDoc.id,
        ...data,
        createdAt: serializeCreatedAt(data?.createdAt),
      });
    }

    recentOrders.sort((a, b) => {
      const timeA = parseDate(a?.createdAt).getTime();
      const timeB = parseDate(b?.createdAt).getTime();
      return timeB - timeA;
    });

    /* =====================================================
       MERCHANT STATUS
    ===================================================== */

    let pendingMerchants = 0;
    let activeMerchants = 0;

    for (const merchantDoc of merchantsSnap.docs) {
      const merchant = merchantDoc.data();
      const status = normalizeStatus(merchant?.status);

      if (status === "pending") {
        pendingMerchants += 1;
      }

      if (
        status === "approved" ||
        status === "active" ||
        status === "verified"
      ) {
        activeMerchants += 1;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          /* Operation only */
          totalOrders: ordersSnap.size,
          pendingOrders,
          activeOrders,
          completedOrders,
          cancelledOrders,
          refundedOrders,

          totalMerchants: merchantsSnap.size,
          pendingMerchants,
          activeMerchants,

          totalUsers: usersSnap.size,
          totalProducts: productsSnap.size,
        },

        recentOrders: recentOrders.slice(0, 5),
      },
    });
  } catch (error: any) {
    console.error("Lỗi Dashboard API:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Lỗi Dashboard API",
      },
      {
        status: 500,
      }
    );
  }
}
