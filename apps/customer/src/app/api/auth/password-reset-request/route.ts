import { NextResponse } from "next/server";
import {
  FieldValue,
  Timestamp,
} from "firebase-admin/firestore";
import {
  adminAuth,
  adminDb,
} from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REQUEST_COLLECTION =
  "passwordResetRequests";

const REQUEST_COOLDOWN_MS =
  60 * 1000;

const normalizePhone = (
  value: unknown
): string => {
  let phone = String(
    value ?? ""
  )
    .trim()
    .replace(/[^\d+]/g, "");

  if (
    phone.startsWith("+84")
  ) {
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

const legacyEmailFromPhone = (
  phone: string
): string =>
  `${phone}@choonline.internal`;

type FoundCustomer = {
  firestoreUserId: string;
  authUid: string;
  authEmail: string;
  fullName: string;
};

async function findCustomerByPhone(
  phone: string
): Promise<
  FoundCustomer | null
> {
  /**
   * ============================================================
   * 1. Tìm profile Firestore theo SĐT.
   * ============================================================
   */
  let userDocId = "";
  let userData:
    | Record<string, any>
    | null = null;

  for (
    const field
    of [
      "phoneNumber",
      "phone",
    ]
  ) {
    const snapshot =
      await adminDb
        .collection("users")
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

      userDocId =
        docSnap.id;

      userData =
        docSnap.data() ||
        {};

      break;
    }
  }

  if (!userData) {
    return null;
  }

  /**
   * ============================================================
   * 2. Resolve Firebase Authentication user thật.
   *
   * Với hệ thống customer cũ của Anvami:
   *   0865234554
   *      ->
   *   0865234554@choonline.internal
   *
   * Không tin tuyệt đối field data.uid vì có thể là dữ liệu cũ/
   * lệch. Firebase Auth mới là nguồn chuẩn để reset password.
   * ============================================================
   */
  const legacyEmail =
    legacyEmailFromPhone(
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
   * Ưu tiên email legacy vì đây là format chính xác
   * từ auth.service.ts cũ của bạn.
   */
  try {
    authUser =
      await adminAuth
        .getUserByEmail(
          legacyEmail
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
   * Nếu tài khoản đã từng được migrate / có authEmail,
   * thử email đó.
   */
  if (!authUser) {
    const candidateEmail =
      String(
        userData.authEmail ||
          userData.email ||
          ""
      )
        .trim()
        .toLowerCase();

    if (candidateEmail) {
      try {
        authUser =
          await adminAuth
            .getUserByEmail(
              candidateEmail
            );
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

  /**
   * Cuối cùng mới fallback theo UID Firestore.
   */
  if (!authUser) {
    const candidateUids =
      Array.from(
        new Set(
          [
            String(
              userData.uid ||
                ""
            ).trim(),
            userDocId,
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

  /**
   * Firestore có profile nhưng Auth user không tồn tại
   * trong project Firebase hiện tại.
   *
   * Không tạo request "resettable" vì Admin chắc chắn
   * không thể update password cho user đó.
   */
  if (!authUser) {
    console.warn(
      "[PASSWORD RESET REQUEST] Firestore customer exists but Firebase Auth user was not resolved:",
      {
        phone,
        firestoreUserId:
          userDocId,
        firestoreUid:
          userData.uid ||
          null,
        expectedLegacyEmail:
          legacyEmail,
        adminProjectId:
          process.env
            .FIREBASE_PROJECT_ID ||
          process.env
            .NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
          null,
      }
    );

    return null;
  }

  return {
    firestoreUserId:
      userDocId,

    authUid:
      authUser.uid,

    authEmail:
      authUser.email ||
      legacyEmail,

    fullName:
      String(
        userData.fullName ||
          userData.name ||
          authUser.displayName ||
          "Khách hàng"
      ),
  };
}

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

    const customer =
      await findCustomerByPhone(
        phone
      );

    /**
     * Không tiết lộ ở UI liệu tài khoản có tồn tại hay không.
     */
    if (!customer) {
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
          `customer_${phone}`
        );

    const existing =
      await requestRef.get();

    if (existing.exists) {
      const data =
        existing.data() ||
        {};

      const last =
        data.lastRequestedAt;

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
        "CUSTOMER",

      /**
       * userId giữ tương thích code Admin.
       * Giá trị bây giờ luôn là Auth UID thật.
       */
      userId:
        customer.authUid,

      authUid:
        customer.authUid,

      authEmail:
        customer.authEmail,

      firestoreUserId:
        customer.firestoreUserId,

      phone,

      customerName:
        customer.fullName,

      status:
        "PENDING",

      source:
        "LOGIN_FORGOT_PASSWORD",

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

    if (!existing.exists) {
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
      "[PASSWORD RESET REQUEST API]",
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
