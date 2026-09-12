import { initializeApp, getApps, cert, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "nishop-de3c5";
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;

function initAdmin() {
  if (getApps().length > 0) {
    return getApp();
  }

  if (clientEmail && privateKey) {
    // Xử lý xuống dòng cho Private Key
    const formattedPrivateKey = privateKey.replace(/\\n/g, "\n");

    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: formattedPrivateKey,
      }),
      projectId,
    });
  }

  // Fallback nếu thiếu Credentials
  return initializeApp({ projectId });
}

const adminApp = initAdmin();

export const adminDb = getFirestore(adminApp);
export const adminAuth = getAuth(adminApp);
export const db = adminDb;