import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

/* =========================================================
   NEXT.JS CONFIG
========================================================= */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================================================
   SECURITY
========================================================= */

/**
 * Chỉ IP này được phép truy cập khi production.
 */
const ALLOWED_IPS = ["10.0.172.222"];

/**
 * Localhost chỉ được phép khi chạy:
 *
 * pnpm dev
 */
const DEVELOPMENT_IPS = [
  "127.0.0.1",
  "::1",
  "::ffff:127.0.0.1",
];

/* =========================================================
   IP HELPERS
========================================================= */

const normalizeIp = (value: string): string => {
  let ip = String(value ?? "").trim();

  if (!ip) {
    return "";
  }

  /**
   * IPv4 mapped IPv6
   *
   * ::ffff:10.0.172.222
   * ->
   * 10.0.172.222
   */
  if (ip.startsWith("::ffff:")) {
    ip = ip.substring(7);
  }

  /**
   * IPv4 kèm port:
   *
   * 10.0.172.222:54321
   */
  if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(ip)) {
    ip = ip.split(":")[0];
  }

  return ip;
};

const getClientIp = (request: Request): string => {
  /**
   * =======================================================
   * CLOUDFLARE
   * =======================================================
   */

  const cloudflareIp =
    request.headers.get("cf-connecting-ip");

  if (cloudflareIp) {
    return normalizeIp(cloudflareIp);
  }

  /**
   * =======================================================
   * VERCEL / NGINX / REVERSE PROXY
   * =======================================================
   */

  const forwardedFor =
    request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    const firstIp =
      forwardedFor.split(",")[0];

    return normalizeIp(firstIp);
  }

  /**
   * =======================================================
   * NGINX / OTHER PROXY
   * =======================================================
   */

  const realIp =
    request.headers.get("x-real-ip");

  if (realIp) {
    return normalizeIp(realIp);
  }

  return "";
};

const isAllowedIp = (
  request: Request
): boolean => {
  const clientIp =
    getClientIp(request);

  /**
   * Cho phép localhost để test bằng Postman
   * khi chạy development.
   */
  if (
    process.env.NODE_ENV !== "production"
  ) {
    if (
      DEVELOPMENT_IPS.includes(
        clientIp
      )
    ) {
      return true;
    }

    /**
     * Một số môi trường Next.js local
     * không expose IP tới Route Handler.
     *
     * Cho phép khi dev để Postman localhost
     * vẫn test được.
     */
    if (!clientIp) {
      return true;
    }
  }

  return ALLOWED_IPS.includes(
    clientIp
  );
};

/* =========================================================
   FIRESTORE VALUE SERIALIZER
========================================================= */

/**
 * Firebase chứa một số kiểu dữ liệu
 * JSON.stringify không thể biểu diễn đẹp trực tiếp:
 *
 * Timestamp
 * GeoPoint
 * DocumentReference
 * Buffer
 * Date
 *
 * Hàm này chuyển tất cả về JSON.
 */
const serializeFirestoreValue = (
  value: any
): any => {
  /**
   * null / undefined
   */
  if (value === null) {
    return null;
  }

  if (value === undefined) {
    return null;
  }

  /**
   * Primitive
   */
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  /**
   * BigInt
   */
  if (typeof value === "bigint") {
    return value.toString();
  }

  /**
   * JavaScript Date
   */
  if (value instanceof Date) {
    return value.toISOString();
  }

  /**
   * Firestore Timestamp
   */
  if (
    typeof value?.toDate === "function"
  ) {
    try {
      return value
        .toDate()
        .toISOString();
    } catch {
      // tiếp tục kiểm tra bên dưới
    }
  }

  /**
   * Timestamp dạng:
   *
   * {
   *   seconds: ...
   *   nanoseconds: ...
   * }
   */
  if (
    typeof value === "object" &&
    typeof value?.seconds === "number" &&
    typeof value?.nanoseconds === "number"
  ) {
    return new Date(
      value.seconds * 1000
    ).toISOString();
  }

  /**
   * Timestamp internal:
   *
   * {
   *   _seconds: ...
   *   _nanoseconds: ...
   * }
   */
  if (
    typeof value === "object" &&
    typeof value?._seconds === "number"
  ) {
    return new Date(
      value._seconds * 1000
    ).toISOString();
  }

  /**
   * Firestore GeoPoint
   */
  if (
    typeof value === "object" &&
    typeof value?.latitude === "number" &&
    typeof value?.longitude === "number"
  ) {
    return {
      latitude:
        value.latitude,

      longitude:
        value.longitude,
    };
  }

  /**
   * Buffer
   */
  if (
    typeof Buffer !== "undefined" &&
    Buffer.isBuffer(value)
  ) {
    return {
      type: "base64",
      data: value.toString("base64"),
    };
  }

  /**
   * Firestore DocumentReference
   */
  if (
    typeof value === "object" &&
    typeof value?.path === "string" &&
    value?.firestore
  ) {
    return {
      type: "DocumentReference",
      path: value.path,
    };
  }

  /**
   * Array
   */
  if (Array.isArray(value)) {
    return value.map((item) =>
      serializeFirestoreValue(item)
    );
  }

  /**
   * Object / Map
   */
  if (typeof value === "object") {
    const output: Record<
      string,
      any
    > = {};

    for (const [
      key,
      childValue,
    ] of Object.entries(value)) {
      output[key] =
        serializeFirestoreValue(
          childValue
        );
    }

    return output;
  }

  return String(value);
};

/* =========================================================
   READ DOCUMENT
========================================================= */

const readDocument = async (
  doc: any,
  includeSubcollections: boolean
): Promise<{
  data: Record<string, any>;
  totalDocuments: number;
}> => {
  const rawData =
    doc.data() ?? {};

  const serializedData =
    serializeFirestoreValue(rawData);

  let totalDocuments = 1;

  const documentResult: Record<
    string,
    any
  > = {
    id: doc.id,

    path: doc.ref.path,

    ...serializedData,
  };

  /**
   * =======================================================
   * SUBCOLLECTIONS
   * =======================================================
   */

  if (includeSubcollections) {
    const subcollections =
      await doc.ref.listCollections();

    if (
      subcollections.length > 0
    ) {
      const subcollectionData: Record<
        string,
        any
      > = {};

      for (
        const subcollection of subcollections
      ) {
        const result =
          await readCollection(
            subcollection,
            true
          );

        subcollectionData[
          subcollection.id
        ] = {
          count:
            result.documents.length,

          totalDocuments:
            result.totalDocuments,

          documents:
            result.documents,
        };

        totalDocuments +=
          result.totalDocuments;
      }

      documentResult._subcollections =
        subcollectionData;
    }
  }

  return {
    data: documentResult,
    totalDocuments,
  };
};

/* =========================================================
   READ COLLECTION
========================================================= */

const readCollection = async (
  collectionRef: any,
  includeSubcollections: boolean
): Promise<{
  documents: any[];
  totalDocuments: number;
}> => {
  const snapshot =
    await collectionRef.get();

  const documents: any[] = [];

  let totalDocuments = 0;

  /**
   * Dùng for...of thay vì Promise.all
   * để hạn chế việc bắn quá nhiều query
   * Firebase cùng lúc.
   */
  for (
    const doc of snapshot.docs
  ) {
    const result =
      await readDocument(
        doc,
        includeSubcollections
      );

    documents.push(
      result.data
    );

    totalDocuments +=
      result.totalDocuments;
  }

  return {
    documents,
    totalDocuments,
  };
};

/* =========================================================
   GET
========================================================= */

export async function GET(
  request: Request
) {
  const startedAt =
    Date.now();

  try {
    /* =====================================================
       IP SECURITY
    ===================================================== */

    const clientIp =
      getClientIp(request);

    if (!isAllowedIp(request)) {
      console.warn(
        "[FIREBASE DATA API] BLOCKED",
        {
          clientIp:
            clientIp || "UNKNOWN",

          date:
            new Date().toISOString(),
        }
      );

      return NextResponse.json(
        {
          success: false,

          message: "Forbidden",

          /**
           * Có thể xóa field này khi production
           * nếu bạn không muốn expose IP.
           */
          ip:
            clientIp || null,
        },
        {
          status: 403,

          headers: {
            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    /* =====================================================
       QUERY PARAMS
    ===================================================== */

    const { searchParams } =
      new URL(request.url);

    /**
     * Mặc định lấy subcollection.
     *
     * ?subcollections=false
     * nếu chỉ muốn collection chính.
     */
    const includeSubcollections =
      searchParams.get(
        "subcollections"
      ) !== "false";

    /**
     * Có thể lấy riêng một collection:
     *
     * ?collection=orders
     */
    const requestedCollection =
      searchParams
        .get("collection")
        ?.trim() || "";

    /* =====================================================
       SINGLE COLLECTION
    ===================================================== */

    if (requestedCollection) {
      const collectionRef =
        adminDb.collection(
          requestedCollection
        );

      const result =
        await readCollection(
          collectionRef,
          includeSubcollections
        );

      return NextResponse.json(
        {
          success: true,

          mode:
            "SINGLE_COLLECTION",

          collection:
            requestedCollection,

          count:
            result.documents.length,

          totalDocuments:
            result.totalDocuments,

          includeSubcollections,

          exportedAt:
            new Date().toISOString(),

          processingTimeMs:
            Date.now() -
            startedAt,

          data:
            result.documents,
        },
        {
          headers: {
            "Cache-Control":
              "no-store, no-cache, must-revalidate",

            Pragma:
              "no-cache",

            Expires:
              "0",
          },
        }
      );
    }

    /* =====================================================
       GET ALL TOP LEVEL COLLECTIONS
    ===================================================== */

    const collections =
      await adminDb.listCollections();

    const firebaseData: Record<
      string,
      any
    > = {};

    let totalDocuments = 0;

    /* =====================================================
       READ EVERYTHING
    ===================================================== */

    for (
      const collectionRef of collections
    ) {
      try {
        const result =
          await readCollection(
            collectionRef,
            includeSubcollections
          );

        firebaseData[
          collectionRef.id
        ] = {
          count:
            result.documents.length,

          totalDocuments:
            result.totalDocuments,

          documents:
            result.documents,
        };

        totalDocuments +=
          result.totalDocuments;
      } catch (error: any) {
        console.error(
          `[FIREBASE DATA API] Lỗi collection ${collectionRef.id}:`,
          error
        );

        firebaseData[
          collectionRef.id
        ] = {
          count: 0,

          totalDocuments: 0,

          documents: [],

          error:
            error?.message ||
            "Không đọc được collection",
        };
      }
    }

    /* =====================================================
       SUCCESS
    ===================================================== */

    console.log(
      "[FIREBASE DATA API] SUCCESS",
      {
        clientIp,

        collections:
          collections.length,

        totalDocuments,

        processingTimeMs:
          Date.now() -
          startedAt,
      }
    );

    return NextResponse.json(
      {
        success: true,

        mode:
          "FULL_FIRESTORE_EXPORT",

        database:
          "(default)",

        collectionCount:
          collections.length,

        totalDocuments,

        includeSubcollections,

        exportedAt:
          new Date().toISOString(),

        processingTimeMs:
          Date.now() -
          startedAt,

        data:
          firebaseData,
      },
      {
        headers: {
          /**
           * Không cache dữ liệu Firebase.
           */
          "Cache-Control":
            "no-store, no-cache, must-revalidate",

          Pragma:
            "no-cache",

          Expires:
            "0",
        },
      }
    );
  } catch (error: any) {
    console.error(
      "[FIREBASE DATA API] ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Không thể lấy dữ liệu Firebase",
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