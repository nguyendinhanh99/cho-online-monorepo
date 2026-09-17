import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging"; // 1. Import thêm getMessaging

if (!getApps().length) {
  try {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey: process.env.FIREBASE_PRIVATE_KEY
          ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
          : undefined,
      }),
    });
  } catch (error) {
    console.error("Lỗi khởi tạo Firebase Admin SDK:", error);
  }
}

export const adminAuth = getAuth();
export const adminDb = getFirestore();
export const adminMessaging = getMessaging(); // 2. Đổi thành getMessaging()
export const db = adminDb;