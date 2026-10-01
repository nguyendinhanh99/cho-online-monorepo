import { NextResponse } from "next/server";
import {
  FieldValue,
  Timestamp,
} from "firebase-admin/firestore";

import {
  adminAuth,
  adminDb,
} from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REQUEST_COLLECTION =
  "passwordResetRequests";

const REQUEST_COOLDOWN_MS =
  60 * 1000;

/* ============================================================
   HELPERS
============================================================ */

const normalizePhone = (
  value: unknown
): string => {
  let phone = String(
    value ?? ""
  )
    .trim()
    .replace(/[^\d+]/g, "");

  if (phone.startsWith("+84")) {
    phone =
      `0${phone.slice(3)}`;
  }

  return phone.replace(
    /\D/g,
    ""
  );
};

const isValidVietnamPhone = (
  phone: string
): boolean =>
  /^0\d{9}$/.test(phone);

const getShipperVirtualEmail = (
  phone: string
): string =>
  `${phone}@shipper.choonline.vn`;

type FoundShipper = {
  firestoreUserId: string;
  authUid: string;
  authEmail: string;
  fullName: string;
};

async function findShipperByPhone(
  phone: string
): Promise<
  FoundShipper | null
> {
  let shipperDocId = "";
  let shipperData:
    | Record<string, any>
    | null = null;

  /**
   * Shipper registration hiện tại lưu field "phone".
   * Hỗ trợ thêm "phoneNumber" để tương thích dữ liệu cũ.
   */
  for (
    const field
    of [
      "phone",
      "phoneNumber",
    ]
  ) {
    const snapshot =
      await adminDb
        .collection("shippers")
        .where(
          field,
          "==",
          phone
        )
        .limit(1)
        .get();

    if (!snapshot.empty) {
      const docSnap =
        snapshot.docs[0];

      shipperDocId =
        docSnap.id;

      shipperData =
        docSnap.data() ||
        {};

      break;
    }
  }

  if (!shipperData) {
    return null;
  }

  /**
   * Firebase Auth email chính xác của Shipper hiện tại:
   * {phone}@shipper.choonline.vn
   */
  const virtualEmail =
    getShipperVirtualEmail(
      phone
    );

  let authUser:
    | Awaited<
        ReturnType<
          typeof adminAuth.getUser
        >
      >
    | null = null;

  /**
   * Ưu tiên tìm theo email Auth vì đây là nguồn đáng tin nhất
   * nếu Firestore uid từng bị lệch.
   */
  try {
    authUser =
      await adminAuth
        .getUserByEmail(
          virtualEmail
        );
  } catch (error: any) {
    if (
      error?.code !==
      "auth/user-not-found"
    ) {
      throw error;
    }
  }

  /**
   * Fallback theo uid trong Firestore/document id.
   */
  if (!authUser) {
    const candidateUids =
      Array.from(
        new Set(
          [
            String(
              shipperData.uid ||
                ""
            ).trim(),
            shipperDocId,
          ].filter(Boolean)
        )
      );

    for (
      const uid
      of candidateUids
    ) {
      try {
        authUser =
          await adminAuth
            .getUser(uid);

        break;
      } catch (error: any) {
        if (
          error?.code !==
          "auth/user-not-found"
        ) {
          throw error;
        }
      }
    }
  }

  if (!authUser) {
    console.warn(
      "[SHIPPER PASSWORD RESET] Firestore profile có nhưng không resolve được Firebase Auth:",
      {
        phone,
        firestoreUserId:
          shipperDocId,
        expectedEmail:
          virtualEmail,
      }
    );

    return null;
  }

  return {
    firestoreUserId:
      shipperDocId,

    authUid:
      authUser.uid,

    authEmail:
      authUser.email ||
      virtualEmail,

    fullName:
      String(
        shipperData.fullName ||
          shipperData.name ||
          shipperData.driverName ||
          authUser.displayName ||
          "Đối tác Shipper"
      ),
  };
}

/* ============================================================
   POST
============================================================ */

export async function POST(
  request: Request
) {
  try {
    let body: any = null;

    try {
      body =
        await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message:
            "Dữ liệu gửi lên không hợp lệ.",
        },
        {
          status: 400,
        }
      );
    }

    const phone =
      normalizePhone(
        body?.phone
      );

    if (
      !isValidVietnamPhone(
        phone
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Số điện thoại chưa hợp lệ.",
        },
        {
          status: 400,
        }
      );
    }

    const shipper =
      await findShipperByPhone(
        phone
      );

    /**
     * Không tiết lộ cho frontend việc tài khoản có tồn tại hay không.
     */
    if (!shipper) {
      return NextResponse.json(
        {
          success: true,
          message:
            "Nếu số điện thoại được đăng ký, yêu cầu sẽ được chuyển tới bộ phận hỗ trợ.",
        },
        {
          status: 200,
          headers: {
            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    const requestRef =
      adminDb
        .collection(
          REQUEST_COLLECTION
        )
        .doc(
          `shipper_${phone}`
        );

    const existingSnap =
      await requestRef.get();

    if (
      existingSnap.exists
    ) {
      const existing =
        existingSnap.data() ||
        {};

      const last =
        existing.lastRequestedAt;

      if (
        last instanceof
          Timestamp &&
        Date.now() -
          last.toMillis() <
          REQUEST_COOLDOWN_MS
      ) {
        return NextResponse.json(
          {
            success: true,
            message:
              "Yêu cầu của bạn đã được ghi nhận.",
          },
          {
            status: 200,
            headers: {
              "Cache-Control":
                "no-store",
            },
          }
        );
      }
    }

    const payload: Record<
      string,
      unknown
    > = {
      requestId:
        requestRef.id,

      userType:
        "SHIPPER",

      userId:
        shipper.authUid,

      authUid:
        shipper.authUid,

      authEmail:
        shipper.authEmail,

      firestoreCollection:
        "shippers",

      firestoreUserId:
        shipper.firestoreUserId,

      phone,

      /**
       * customerName được giữ để tương thích UI Admin hiện tại.
       * displayName/shipperName là field đúng nghĩa hơn.
       */
      customerName:
        shipper.fullName,

      displayName:
        shipper.fullName,

      shipperName:
        shipper.fullName,

      status:
        "PENDING",

      source:
        "SHIPPER_LOGIN_FORGOT_PASSWORD",

      requestCount:
        FieldValue.increment(1),

      requestedAt:
        FieldValue.serverTimestamp(),

      lastRequestedAt:
        FieldValue.serverTimestamp(),

      updatedAt:
        FieldValue.serverTimestamp(),

      resolvedAt: null,
      resolvedBy: null,
      rejectedAt: null,
      rejectedBy: null,
      note: "",
    };

    if (
      !existingSnap.exists
    ) {
      payload.createdAt =
        FieldValue.serverTimestamp();
    }

    await requestRef.set(
      payload,
      {
        merge: true,
      }
    );

    return NextResponse.json(
      {
        success: true,
        message:
          "Yêu cầu đã được chuyển tới bộ phận hỗ trợ Anvami.",
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  } catch (error: any) {
    console.error(
      "[SHIPPER PASSWORD RESET REQUEST]",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Máy chủ chưa thể ghi nhận yêu cầu. Vui lòng thử lại.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  }
}
