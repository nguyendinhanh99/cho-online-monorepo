import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const env = {
      projectId: !!process.env.FIREBASE_PROJECT_ID,
      clientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: !!process.env.FIREBASE_PRIVATE_KEY,
    };

    const { adminDb, adminAuth } =
      await import("@/lib/firebase-admin");

    const ordersSnapshot =
      await adminDb
        .collection("orders")
        .limit(1)
        .get();

    const usersResult =
      await adminAuth.listUsers(1);

    return NextResponse.json({
      success: true,
      message: "Firebase Admin OK",
      env,
      projectId:
        process.env.FIREBASE_PROJECT_ID ?? null,
      firestore: {
        count: ordersSnapshot.size,
        firstId:
          ordersSnapshot.docs[0]?.id ?? null,
      },
      auth: {
        count: usersResult.users.length,
        firstUid:
          usersResult.users[0]?.uid ?? null,
      },
    });
  } catch (error: any) {
    console.error(
      "[FIREBASE TEST ERROR]",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ??
          "Unknown Firebase error",
        code:
          error?.code ?? null,
        name:
          error?.name ?? null,
        env: {
          projectId:
            !!process.env.FIREBASE_PROJECT_ID,
          clientEmail:
            !!process.env.FIREBASE_CLIENT_EMAIL,
          privateKey:
            !!process.env.FIREBASE_PRIVATE_KEY,
        },
      },
      {
        status: 500,
      }
    );
  }
}