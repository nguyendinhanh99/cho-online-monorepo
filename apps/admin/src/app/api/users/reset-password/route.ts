import { randomInt } from "crypto";

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

const ALLOWED_ADMIN_ROLES =
  new Set([
    "ADMIN",
    "SUPPORT",
  ]);

const ALLOWED_TARGET_TYPES =
  new Set([
    "CUSTOMER",
    "SHIPPER",
  ]);

type AuthorizedAdmin = {
  uid: string;
  role: string;
};

type RequestAction =
  | "RESET"
  | "REJECT";

/* ============================================================
   ADMIN AUTH
============================================================ */

const getBearerToken = (
  request: Request
): string => {
  const authorization =
    request.headers.get(
      "authorization"
    ) || "";

  if (
    !authorization.startsWith(
      "Bearer "
    )
  ) {
    return "";
  }

  return authorization
    .slice(7)
    .trim();
};

const requireAuthorizedAdmin =
  async (
    request: Request
  ): Promise<
    AuthorizedAdmin | null
  > => {
    const token =
      getBearerToken(
        request
      );

    if (!token) {
      return null;
    }

    try {
      const decoded =
        await adminAuth
          .verifyIdToken(
            token
          );

      let role =
        String(
          decoded.role ||
            decoded.adminRole ||
            ""
        )
          .trim()
          .toUpperCase();

      if (
        decoded.admin === true
      ) {
        role = "ADMIN";
      }

      if (
        !ALLOWED_ADMIN_ROLES.has(
          role
        )
      ) {
        const profile =
          await adminDb
            .collection(
              "users"
            )
            .doc(decoded.uid)
            .get();

        if (
          profile.exists
        ) {
          role =
            String(
              profile.data()
                ?.role ||
                ""
            )
              .trim()
              .toUpperCase();
        }
      }

      if (
        !ALLOWED_ADMIN_ROLES.has(
          role
        )
      ) {
        return null;
      }

      return {
        uid:
          decoded.uid,
        role,
      };
    } catch (error) {
      console.warn(
        "[RESET PASSWORD] Admin token invalid:",
        error
      );

      return null;
    }
  };

/* ============================================================
   HELPERS
============================================================ */

const normalizePhone = (
  value: unknown
): string => {
  let phone =
    String(
      value ?? ""
    )
      .trim()
      .replace(
        /[^\d+]/g,
        ""
      );

  if (
    phone.startsWith(
      "+84"
    )
  ) {
    phone =
      `0${phone.slice(3)}`;
  }

  return phone.replace(
    /\D/g,
    ""
  );
};

const getExpectedAuthEmail = (
  userType: string,
  phone: string
): string => {
  if (
    userType === "SHIPPER"
  ) {
    return `${phone}@shipper.choonline.vn`;
  }

  return `${phone}@choonline.internal`;
};

const getProfileCollection = (
  userType: string
): "users" | "shippers" => {
  return userType ===
    "SHIPPER"
    ? "shippers"
    : "users";
};

const timestampToIso = (
  value: unknown
): string | null => {
  if (!value) {
    return null;
  }

  if (
    value instanceof
      Timestamp
  ) {
    return value
      .toDate()
      .toISOString();
  }

  if (
    typeof (value as any)
      ?.toDate ===
    "function"
  ) {
    return (value as any)
      .toDate()
      .toISOString();
  }

  const date =
    new Date(
      value as any
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date.toISOString();
};

const serializeRequest = (
  id: string,
  data: Record<
    string,
    any
  >
) => ({
  id,
  ...data,

  requestedAt:
    timestampToIso(
      data.requestedAt
    ),

  lastRequestedAt:
    timestampToIso(
      data.lastRequestedAt
    ),

  createdAt:
    timestampToIso(
      data.createdAt
    ),

  updatedAt:
    timestampToIso(
      data.updatedAt
    ),

  resolvedAt:
    timestampToIso(
      data.resolvedAt
    ),

  rejectedAt:
    timestampToIso(
      data.rejectedAt
    ),
});

const generateTemporaryPassword =
  (): string => {
    const upper =
      "ABCDEFGHJKLMNPQRSTUVWXYZ";

    const lower =
      "abcdefghijkmnopqrstuvwxyz";

    const digits =
      "23456789";

    const symbols =
      "!@#$%";

    const all =
      upper +
      lower +
      digits +
      symbols;

    const pick = (
      chars: string
    ) =>
      chars[
        randomInt(
          0,
          chars.length
        )
      ];

    const chars = [
      pick(upper),
      pick(lower),
      pick(digits),
      pick(symbols),
    ];

    while (
      chars.length < 12
    ) {
      chars.push(
        pick(all)
      );
    }

    for (
      let i =
        chars.length - 1;
      i > 0;
      i--
    ) {
      const j =
        randomInt(
          0,
          i + 1
        );

      [
        chars[i],
        chars[j],
      ] = [
        chars[j],
        chars[i],
      ];
    }

    return chars.join("");
  };

/**
 * Resolve Auth user từ request.
 * Hỗ trợ cả request cũ lẫn request mới.
 */
const resolveAuthUser =
  async (
    requestData:
      Record<
        string,
        any
      >,
    userType: string
  ) => {
    const phone =
      normalizePhone(
        requestData.phone
      );

    const candidateUids =
      Array.from(
        new Set(
          [
            String(
              requestData.authUid ||
                ""
            ).trim(),

            String(
              requestData.userId ||
                ""
            ).trim(),
          ].filter(Boolean)
        )
      );

    for (
      const uid
      of candidateUids
    ) {
      try {
        return await adminAuth
          .getUser(uid);
      } catch (error: any) {
        if (
          error?.code !==
          "auth/user-not-found"
        ) {
          throw error;
        }
      }
    }

    if (phone) {
      const expectedEmail =
        getExpectedAuthEmail(
          userType,
          phone
        );

      try {
        return await adminAuth
          .getUserByEmail(
            expectedEmail
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

    const authEmail =
      String(
        requestData.authEmail ||
          ""
      )
        .trim()
        .toLowerCase();

    if (authEmail) {
      try {
        return await adminAuth
          .getUserByEmail(
            authEmail
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

    return null;
  };

/* ============================================================
   GET - LIST REQUESTS
============================================================ */

export async function GET(
  request: Request
) {
  try {
    const admin =
      await requireAuthorizedAdmin(
        request
      );

    if (!admin) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Bạn không có quyền truy cập chức năng này.",
        },
        {
          status: 403,
        }
      );
    }

    const snapshot =
      await adminDb
        .collection(
          REQUEST_COLLECTION
        )
        .orderBy(
          "lastRequestedAt",
          "desc"
        )
        .limit(100)
        .get();

    const data =
      snapshot.docs.map(
        (docSnap) =>
          serializeRequest(
            docSnap.id,
            docSnap.data()
          )
      );

    return NextResponse.json(
      {
        success: true,
        data,
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
      "[RESET PASSWORD] GET:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Không thể tải yêu cầu cấp lại mật khẩu.",
      },
      {
        status: 500,
      }
    );
  }
}

/* ============================================================
   POST - RESET / REJECT
============================================================ */

export async function POST(
  request: Request
) {
  try {
    const admin =
      await requireAuthorizedAdmin(
        request
      );

    if (!admin) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Bạn không có quyền thực hiện thao tác này.",
        },
        {
          status: 403,
        }
      );
    }

    const body =
      await request.json();

    const requestId =
      String(
        body?.requestId ||
          ""
      ).trim();

    const action =
      String(
        body?.action ||
          ""
      )
        .trim()
        .toUpperCase() as
        RequestAction;

    if (!requestId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Thiếu requestId.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      action !== "RESET" &&
      action !== "REJECT"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Action không hợp lệ.",
        },
        {
          status: 400,
        }
      );
    }

    const requestRef =
      adminDb
        .collection(
          REQUEST_COLLECTION
        )
        .doc(requestId);

    const requestSnap =
      await requestRef.get();

    if (
      !requestSnap.exists
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Không tìm thấy yêu cầu.",
        },
        {
          status: 404,
        }
      );
    }

    const requestData =
      requestSnap.data() ||
      {};

    const status =
      String(
        requestData.status ||
          ""
      )
        .trim()
        .toUpperCase();

    if (
      status === "RESOLVED"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Yêu cầu này đã được xử lý trước đó.",
        },
        {
          status: 409,
        }
      );
    }

    if (
      status === "REJECTED"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Yêu cầu này đã bị từ chối.",
        },
        {
          status: 409,
        }
      );
    }

    const userType =
      String(
        requestData.userType ||
          "CUSTOMER"
      )
        .trim()
        .toUpperCase();

    if (
      !ALLOWED_TARGET_TYPES.has(
        userType
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Loại tài khoản không được hỗ trợ.",
        },
        {
          status: 400,
        }
      );
    }

    /* --------------------------------------------------------
       REJECT
    -------------------------------------------------------- */

    if (
      action === "REJECT"
    ) {
      await requestRef.set(
        {
          status:
            "REJECTED",

          rejectedAt:
            FieldValue.serverTimestamp(),

          rejectedBy:
            admin.uid,

          rejectedByRole:
            admin.role,

          updatedAt:
            FieldValue.serverTimestamp(),
        },
        {
          merge: true,
        }
      );

      return NextResponse.json(
        {
          success: true,
          message:
            "Đã từ chối yêu cầu.",
        },
        {
          status: 200,
        }
      );
    }

    /* --------------------------------------------------------
       RESET
    -------------------------------------------------------- */

    const authUser =
      await resolveAuthUser(
        requestData,
        userType
      );

    if (!authUser) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Không tìm thấy tài khoản Firebase Authentication tương ứng.",
        },
        {
          status: 404,
        }
      );
    }

    const userId =
      authUser.uid;

    const temporaryPassword =
      generateTemporaryPassword();

    /**
     * Đổi mật khẩu Firebase Auth.
     */
    await adminAuth.updateUser(
      userId,
      {
        password:
          temporaryPassword,
      }
    );

    /**
     * Thu hồi refresh token cũ.
     */
    await adminAuth
      .revokeRefreshTokens(
        userId
      );

    /**
     * Xác định đúng collection profile:
     * CUSTOMER -> users
     * SHIPPER  -> shippers
     */
    const profileCollection =
      String(
        requestData.firestoreCollection ||
          getProfileCollection(
            userType
          )
      ) === "shippers"
        ? "shippers"
        : "users";

    const firestoreUserId =
      String(
        requestData.firestoreUserId ||
          userId
      ).trim();

    const batch =
      adminDb.batch();

    const profileRef =
      adminDb
        .collection(
          profileCollection
        )
        .doc(
          firestoreUserId
        );

    /**
     * KHÔNG lưu temporaryPassword vào Firestore.
     */
    batch.set(
      profileRef,
      {
        uid:
          userId,

        authUid:
          userId,

        authEmail:
          authUser.email ||
          requestData.authEmail ||
          null,

        mustChangePassword:
          true,

        passwordResetAt:
          FieldValue.serverTimestamp(),

        passwordResetBy:
          admin.uid,

        passwordResetByRole:
          admin.role,

        passwordResetRequestId:
          requestId,

        updatedAt:
          FieldValue.serverTimestamp(),
      },
      {
        merge: true,
      }
    );

    batch.set(
      requestRef,
      {
        userId,
        authUid:
          userId,

        authEmail:
          authUser.email ||
          requestData.authEmail ||
          null,

        status:
          "RESOLVED",

        resolution:
          "TEMP_PASSWORD_CREATED",

        resolvedAt:
          FieldValue.serverTimestamp(),

        resolvedBy:
          admin.uid,

        resolvedByRole:
          admin.role,

        updatedAt:
          FieldValue.serverTimestamp(),
      },
      {
        merge: true,
      }
    );

    await batch.commit();

    /**
     * Mật khẩu tạm chỉ trả về đúng response này cho Admin.
     */
    return NextResponse.json(
      {
        success: true,

        message:
          "Đã tạo mật khẩu tạm thời.",

        temporaryPassword,

        resolvedUserId:
          userId,

        userType,
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
      "[RESET PASSWORD] POST:",
      error?.code ||
        error?.message ||
        error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Không thể xử lý yêu cầu cấp lại mật khẩu.",
      },
      {
        status: 500,
      }
    );
  }
}
