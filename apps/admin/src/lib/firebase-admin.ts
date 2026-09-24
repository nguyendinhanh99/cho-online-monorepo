import {
  cert,
  getApp,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app";

import {
  getAuth,
  type Auth,
} from "firebase-admin/auth";

import {
  getFirestore,
  type Firestore,
} from "firebase-admin/firestore";

import {
  getMessaging,
  type Messaging,
} from "firebase-admin/messaging";

/* =========================================================
   ENV
========================================================= */

const projectId =
  process.env.FIREBASE_PROJECT_ID?.trim();

const clientEmail =
  process.env.FIREBASE_CLIENT_EMAIL?.trim();

const rawPrivateKey =
  process.env.FIREBASE_PRIVATE_KEY;

const privateKey =
  rawPrivateKey
    ?.replace(/\\n/g, "\n")
    .trim();

/* =========================================================
   CREATE / GET FIREBASE ADMIN APP
========================================================= */

const getAdminApp = (): App => {
  /*
   * Firebase Admin đã được khởi tạo trước đó
   * -> dùng lại app hiện tại.
   */
  if (getApps().length > 0) {
    return getApp();
  }

  /* =======================================================
     VALIDATE ENV
  ======================================================= */

  const missingEnv: string[] = [];

  if (!projectId) {
    missingEnv.push(
      "FIREBASE_PROJECT_ID"
    );
  }

  if (!clientEmail) {
    missingEnv.push(
      "FIREBASE_CLIENT_EMAIL"
    );
  }

  if (!privateKey) {
    missingEnv.push(
      "FIREBASE_PRIVATE_KEY"
    );
  }

  if (missingEnv.length > 0) {
    throw new Error(
      `[Firebase Admin] Thiếu biến môi trường: ${missingEnv.join(", ")}`
    );
  }

  /* =======================================================
     INITIALIZE
  ======================================================= */

  try {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),

      projectId,
    });
  } catch (error) {
    console.error(
      "[Firebase Admin] Lỗi initializeApp:",
      error
    );

    /*
     * QUAN TRỌNG:
     *
     * Không được nuốt lỗi rồi tiếp tục chạy
     * getAuth/getFirestore/getMessaging.
     */
    throw error;
  }
};

/* =========================================================
   FIREBASE ADMIN APP
========================================================= */

export const adminApp: App =
  getAdminApp();

/* =========================================================
   FIREBASE ADMIN SERVICES
========================================================= */

export const adminAuth: Auth =
  getAuth(adminApp);

export const adminDb: Firestore =
  getFirestore(adminApp);

export const adminMessaging: Messaging =
  getMessaging(adminApp);

/*
 * Alias giữ tương thích với code cũ:
 *
 * import { db } from "@/lib/firebase-admin";
 */
export const db = adminDb;