import { randomInt } from "crypto";
import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RewardTier =
  | "SMALL"
  | "MEDIUM"
  | "LARGE"
  | "VERY_LARGE";

type RewardDefinition = {
  id: string;
  type: "POINTS";
  value: number;
  label: string;
};

const REWARDS: RewardDefinition[] = [
  {
    id: "P50",
    type: "POINTS",
    value: 50,
    label: "+50 điểm",
  },
  {
    id: "P100",
    type: "POINTS",
    value: 100,
    label: "+100 điểm",
  },
  {
    id: "P200",
    type: "POINTS",
    value: 200,
    label: "+200 điểm",
  },
  {
    id: "P500",
    type: "POINTS",
    value: 500,
    label: "+500 điểm",
  },
  {
    id: "P750",
    type: "POINTS",
    value: 750,
    label: "+750 điểm",
  },
  {
    id: "P1000",
    type: "POINTS",
    value: 1000,
    label: "+1.000 điểm",
  },
  {
    id: "P2000",
    type: "POINTS",
    value: 2000,
    label: "+2.000 điểm",
  },
];

/**
 * Xác suất dùng basis points (10.000 = 100%).
 *
 * Chi phí kỳ vọng khi 1 điểm = 10đ:
 * SMALL      ≈ 1.235đ / lượt
 * MEDIUM     ≈ 1.418đ / lượt
 * LARGE      ≈ 1.600đ / lượt
 * VERY_LARGE ≈ 1.783đ / lượt
 *
 * Giải lớn tăng nhẹ theo độ lớn đơn nhưng luôn có trần.
 */
const TIER_WEIGHTS: Record<
  RewardTier,
  Record<string, number>
> = {
  SMALL: {
    P50: 5500,
    P100: 2700,
    P200: 1100,
    P500: 400,
    P750: 200,
    P1000: 80,
    P2000: 20,
  },

  MEDIUM: {
    P50: 5000,
    P100: 2800,
    P200: 1300,
    P500: 500,
    P750: 250,
    P1000: 110,
    P2000: 40,
  },

  LARGE: {
    P50: 4500,
    P100: 2900,
    P200: 1500,
    P500: 600,
    P750: 300,
    P1000: 140,
    P2000: 60,
  },

  VERY_LARGE: {
    P50: 4000,
    P100: 3000,
    P200: 1700,
    P500: 700,
    P750: 350,
    P1000: 170,
    P2000: 80,
  },
};

const COMPLETED_STATUSES = new Set([
  "completed",
  "delivered",
]);

const normalizeTier = (
  value: unknown
): RewardTier => {
  const normalized = String(
    value ?? "SMALL"
  )
    .trim()
    .toUpperCase();

  if (
    normalized === "MEDIUM" ||
    normalized === "LARGE" ||
    normalized === "VERY_LARGE"
  ) {
    return normalized;
  }

  return "SMALL";
};

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

const pickReward = (
  tier: RewardTier
): RewardDefinition => {
  const weights =
    TIER_WEIGHTS[tier];

  const totalWeight =
    REWARDS.reduce(
      (sum, reward) =>
        sum +
        Number(
          weights[
            reward.id
          ] || 0
        ),
      0
    );

  if (totalWeight <= 0) {
    return REWARDS[0];
  }

  /**
   * randomInt là random phía server,
   * không cho client tự quyết định kết quả.
   */
  const roll = randomInt(
    1,
    totalWeight + 1
  );

  let cursor = 0;

  for (const reward of REWARDS) {
    cursor += Number(
      weights[
        reward.id
      ] || 0
    );

    if (roll <= cursor) {
      return reward;
    }
  }

  return REWARDS[0];
};

export async function POST(
  request: Request
) {
  try {
    const idToken =
      getBearerToken(
        request
      );

    if (!idToken) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Bạn chưa đăng nhập.",
        },
        { status: 401 }
      );
    }

    let uid = "";

    try {
      const decodedToken =
        await getAuth().verifyIdToken(
          idToken
        );

      uid = decodedToken.uid;
    } catch (error) {
      console.warn(
        "[REWARD SPIN] Invalid token:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Phiên đăng nhập không hợp lệ.",
        },
        { status: 401 }
      );
    }

    const body =
      await request.json();

    const orderId = String(
      body?.orderId || ""
    ).trim();

    if (!orderId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Thiếu mã đơn hàng.",
        },
        { status: 400 }
      );
    }

    const orderRef =
      adminDb
        .collection("orders")
        .doc(orderId);

    const userRef =
      adminDb
        .collection("users")
        .doc(uid);

    const result =
      await adminDb.runTransaction(
        async (transaction) => {
          const orderSnap =
            await transaction.get(
              orderRef
            );

          if (!orderSnap.exists) {
            throw new Error(
              "ORDER_NOT_FOUND"
            );
          }

          const order =
            orderSnap.data() || {};

          if (
            String(
              order.userId || ""
            ) !== uid
          ) {
            throw new Error(
              "ORDER_FORBIDDEN"
            );
          }

          const status = String(
            order.status || ""
          )
            .trim()
            .toLowerCase();

          if (
            !COMPLETED_STATUSES.has(
              status
            )
          ) {
            throw new Error(
              "ORDER_NOT_COMPLETED"
            );
          }

          const rewardSpin =
            order.rewardSpin;

          if (
            !rewardSpin ||
            rewardSpin.eligible !== true
          ) {
            throw new Error(
              "SPIN_NOT_ELIGIBLE"
            );
          }

          /**
           * Idempotent:
           * nếu nút bị bấm lại hoặc mạng retry,
           * trả kết quả cũ, không phát thưởng lần hai.
           */
          if (
            rewardSpin.used === true &&
            rewardSpin.result
          ) {
            return {
              reward:
                rewardSpin.result,
              tier:
                normalizeTier(
                  rewardSpin.tier
                ),
              alreadyUsed: true,
            };
          }

          const tier =
            normalizeTier(
              rewardSpin.tier
            );

          const reward =
            pickReward(tier);

          transaction.set(
            userRef,
            {
              points:
                FieldValue.increment(
                  reward.value
                ),
              pointsUpdatedAt:
                FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          transaction.update(
            orderRef,
            {
              "rewardSpin.used": true,
              "rewardSpin.usedAt":
                FieldValue.serverTimestamp(),
              "rewardSpin.result": {
                ...reward,
              },
            }
          );

          return {
            reward,
            tier,
            alreadyUsed: false,
          };
        }
      );

    return NextResponse.json(
      {
        success: true,
        ...result,
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "UNKNOWN";

    const map: Record<
      string,
      {
        status: number;
        message: string;
      }
    > = {
      ORDER_NOT_FOUND: {
        status: 404,
        message:
          "Không tìm thấy đơn hàng.",
      },
      ORDER_FORBIDDEN: {
        status: 403,
        message:
          "Bạn không có quyền quay thưởng cho đơn này.",
      },
      ORDER_NOT_COMPLETED: {
        status: 409,
        message:
          "Đơn hàng chưa hoàn thành. Hãy quay sau khi giao hàng thành công.",
      },
      SPIN_NOT_ELIGIBLE: {
        status: 409,
        message:
          "Đơn hàng này không có lượt quay thưởng.",
      },
    };

    const mapped =
      map[message];

    if (mapped) {
      return NextResponse.json(
        {
          success: false,
          message:
            mapped.message,
        },
        {
          status:
            mapped.status,
          headers: {
            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    console.error(
      "[REWARD SPIN] Error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Không thể quay thưởng lúc này. Vui lòng thử lại.",
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
