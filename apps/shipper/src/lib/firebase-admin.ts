import {
  cert,
  getApp,
  getApps,
  initializeApp,
} from "firebase-admin/app";

import {
  getFirestore,
} from "firebase-admin/firestore";

import {
  getAuth,
} from "firebase-admin/auth";

/* ============================================================
   ENV
============================================================ */

const projectId =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
  "nishop-de3c5";

const clientEmail =
  process.env.FIREBASE_CLIENT_EMAIL;

const privateKey =
  process.env.FIREBASE_PRIVATE_KEY;

/* ============================================================
   INIT FIREBASE ADMIN
============================================================ */

function initAdmin() {
  /**
   * Next.js dev / hot reload có thể chạy file nhiều lần.
   * Không initialize Firebase Admin lần thứ 2.
   */
  if (getApps().length > 0) {
    return getApp();
  }

  /**
   * Firebase Admin ở local/server cần Service Account
   * để thao tác Authentication và Firestore.
   */
  if (
    !projectId ||
    !clientEmail ||
    !privateKey
  ) {
    throw new Error(
      [
        "Thiếu cấu hình Firebase Admin.",
        "Cần kiểm tra:",
        "FIREBASE_PROJECT_ID",
        "FIREBASE_CLIENT_EMAIL",
        "FIREBASE_PRIVATE_KEY",
      ].join(" ")
    );
  }

  /**
   * Private key trong .env thường được lưu:
   *
   * -----BEGIN PRIVATE KEY-----\nABC...\n-----END PRIVATE KEY-----\n
   *
   * Cần chuyển \\n thành newline thật.
   */
  const formattedPrivateKey =
    privateKey.replace(
      /\\n/g,
      "\n"
    );

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey:
        formattedPrivateKey,
    }),

    projectId,
  });
}

/* ============================================================
   EXPORT
============================================================ */

const adminApp =
  initAdmin();

export const adminDb =
  getFirestore(
    adminApp
  );

export const adminAuth =
  getAuth(
    adminApp
  );

/**
 * Giữ alias này nếu các file cũ đang import:
 *
 * import { db } from "@/lib/firebase-admin";
 */
export const db =
  adminDb;