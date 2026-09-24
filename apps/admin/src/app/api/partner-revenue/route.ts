import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/* =========================================================
   HELPERS
========================================================= */

const num = (value: unknown): number => {
  const n = Number(value);

  return Number.isFinite(n)
    ? n
    : 0;
};

const clamp = (
  value: number,
  min: number,
  max: number
): number => {
  return Math.max(
    min,
    Math.min(max, value)
  );
};

const isCodPayment = (
  method: unknown
): boolean => {
  const value = String(
    method ?? ""
  )
    .toLowerCase()
    .trim();

  return (
    value === "cod" ||
    value === "cash"
  );
};

/* =========================================================
   DATE
========================================================= */

const parseDate = (
  value: any
): Date => {
  if (!value) {
    return new Date();
  }

  try {
    if (
      typeof value.toDate ===
      "function"
    ) {
      return value.toDate();
    }

    if (
      value.seconds !== undefined
    ) {
      return new Date(
        num(value.seconds) * 1000
      );
    }

    if (
      value._seconds !== undefined
    ) {
      return new Date(
        num(value._seconds) * 1000
      );
    }

    const date = new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return new Date();
    }

    return date;
  } catch {
    return new Date();
  }
};

/* =========================================================
   ORIGINAL PRICE
========================================================= */

const getItemOriginalPrice = (
  item: any
): number => {
  const candidates = [
    item?.originalPrice,
    item?.originalUnitPrice,
    item?.listPrice,
    item?.regularPrice,
  ];

  for (
    const value of candidates
  ) {
    const price = num(value);

    if (price > 0) {
      return price;
    }
  }

  return 0;
};

/* =========================================================
   ORIGINAL GROSS
========================================================= */

const getOrderOriginalGross = (
  data: any
): {
  amount: number;
  source:
    | "ITEM_ORIGINAL_PRICE"
    | "ORDER_ORIGINAL_PRICE"
    | "FINANCIAL_SNAPSHOT"
    | "LEGACY_SUBTOTAL_COST_PRICE"
    | "LEGACY_ITEM_COST_PRICE"
    | "NONE";
} => {
  /* -------------------------------------------------------
     1. ITEMS[].originalPrice
  ------------------------------------------------------- */

  if (
    Array.isArray(
      data?.items
    )
  ) {
    let total = 0;
    let found = false;

    for (
      const item of
        data.items
    ) {
      const originalPrice =
        getItemOriginalPrice(
          item
        );

      const quantity =
        Math.max(
          1,
          num(
            item?.quantity ??
              1
          )
        );

      if (
        originalPrice >
        0
      ) {
        found = true;

        total +=
          originalPrice *
          quantity;
      }
    }

    if (
      found &&
      total > 0
    ) {
      return {
        amount: total,
        source:
          "ITEM_ORIGINAL_PRICE",
      };
    }
  }

  /* -------------------------------------------------------
     2. ORDER LEVEL
  ------------------------------------------------------- */

  const orderLevelCandidates = [
    data?.originalSubTotalPrice,
    data?.subtotalBeforeDiscount,
    data?.grossBeforeDiscount,
    data?.originalGMV,
    data?.originalTotalPrice,
  ];

  for (
    const value of
      orderLevelCandidates
  ) {
    const amount =
      num(value);

    if (
      amount > 0
    ) {
      return {
        amount,
        source:
          "ORDER_ORIGINAL_PRICE",
      };
    }
  }

  /* -------------------------------------------------------
     3. FINANCIAL SNAPSHOT
  ------------------------------------------------------- */

  const financialOriginalGross =
    num(
      data?.financial
        ?.merchant
        ?.originalGross
    );

  if (
    financialOriginalGross >
    0
  ) {
    return {
      amount:
        financialOriginalGross,
      source:
        "FINANCIAL_SNAPSHOT",
    };
  }

  /* -------------------------------------------------------
     4. LEGACY SUBTOTAL COST
  ------------------------------------------------------- */

  const legacySubTotal =
    num(
      data?.subTotalCostPrice ??
        data?.costPriceTotal
    );

  if (
    legacySubTotal >
    0
  ) {
    return {
      amount:
        legacySubTotal,
      source:
        "LEGACY_SUBTOTAL_COST_PRICE",
    };
  }

  /* -------------------------------------------------------
     5. LEGACY ITEMS COST
  ------------------------------------------------------- */

  if (
    Array.isArray(
      data?.items
    )
  ) {
    let total = 0;

    for (
      const item of
        data.items
    ) {
      const costPrice =
        num(
          item?.costPrice
        );

      const quantity =
        Math.max(
          1,
          num(
            item?.quantity ??
              1
          )
        );

      if (
        costPrice >
        0
      ) {
        total +=
          costPrice *
          quantity;
      }
    }

    if (
      total > 0
    ) {
      return {
        amount:
          total,
        source:
          "LEGACY_ITEM_COST_PRICE",
      };
    }
  }

  return {
    amount: 0,
    source: "NONE",
  };
};

/* =========================================================
   SALE GROSS
========================================================= */

const getOrderSaleGross = (
  data: any
): number => {
  const direct =
    num(
      data?.subTotalPrice
    );

  if (
    direct > 0
  ) {
    return direct;
  }

  if (
    Array.isArray(
      data?.items
    )
  ) {
    let total = 0;

    for (
      const item of
        data.items
    ) {
      const price =
        num(
          item?.price
        );

      const quantity =
        Math.max(
          1,
          num(
            item?.quantity ??
              1
          )
        );

      total +=
        price *
        quantity;
    }

    if (
      total > 0
    ) {
      return total;
    }
  }

  return 0;
};

/* =========================================================
   GET MERCHANT COMMISSION %
========================================================= */

const getMerchantCommissionPercent =
  async (
    data: any,
    merchantMap: Record<
      string,
      number
    >,
    platformFeePercent: number
  ): Promise<number> => {
    const financialCommission =
      data?.financial?.merchant
        ?.commissionPercent;

    if (
      financialCommission !==
        undefined &&
      financialCommission !==
        null
    ) {
      return clamp(
        num(
          financialCommission
        ),
        0,
        100
      );
    }

    const orderCommission =
      data?.merchantCommissionPercent;

    if (
      orderCommission !==
        undefined &&
      orderCommission !==
        null
    ) {
      return clamp(
        num(
          orderCommission
        ),
        0,
        100
      );
    }

    const merchantId =
      String(
        data?.merchantId ??
          data?.storeId ??
          data?.shopId ??
          ""
      ).trim();

    const merchantCode =
      String(
        data?.merchantCode ??
          ""
      ).trim();

    if (
      merchantId &&
      merchantMap[
        merchantId
      ] !== undefined
    ) {
      return merchantMap[
        merchantId
      ];
    }

    if (
      merchantCode &&
      merchantMap[
        merchantCode
      ] !== undefined
    ) {
      return merchantMap[
        merchantCode
      ];
    }

    /*
     * Cố gắng đọc merchant trực tiếp
     * nếu map không có.
     */

    if (merchantId) {
      const merchantDoc =
        await adminDb
          .collection(
            "merchants"
          )
          .doc(
            merchantId
          )
          .get();

      if (
        merchantDoc.exists
      ) {
        const merchant =
          merchantDoc.data();

        if (
          merchant?.commissionPercent !==
            undefined &&
          merchant?.commissionPercent !==
            null
        ) {
          return clamp(
            num(
              merchant.commissionPercent
            ),
            0,
            100
          );
        }
      }

      /*
       * Fallback users.
       */
      const userDoc =
        await adminDb
          .collection(
            "users"
          )
          .doc(
            merchantId
          )
          .get();

      if (
        userDoc.exists
      ) {
        const user =
          userDoc.data();

        if (
          user?.commissionPercent !==
            undefined &&
          user?.commissionPercent !==
            null
        ) {
          return clamp(
            num(
              user.commissionPercent
            ),
            0,
            100
          );
        }
      }
    }

    return clamp(
      platformFeePercent,
      0,
      100
    );
  };

/* =========================================================
   SHIPPER CALCULATION

   QUY TẮC:

   shippingFee
      ↓
   Sàn giữ X%
      ↓
   Shipper cơ bản = 100% - X%
      ↓
   HH thêm = phần Shipper cơ bản × Y%
      ↓
   Shipper nhận phí ship

   Đồng thời:

   Giá trị đơn
      ↓
   HH đơn = Giá trị đơn × Z%

   Tổng Shipper nhận
      =
   HH đơn
   + phí ship Shipper
========================================================= */

const calculateShipperFinance = (
  orderBase: number,
  shippingCollected: number,
  orderCommissionPercent: number,
  shippingRetainedPercent: number,
  shippingCommissionPercent: number
) => {
  const normalizedOrderBase =
    Math.max(
      0,
      num(orderBase)
    );

  const normalizedShipping =
    Math.max(
      0,
      num(
        shippingCollected
      )
    );

  const orderPercent =
    clamp(
      num(
        orderCommissionPercent
      ),
      0,
      100
    );

  const retainedPercent =
    clamp(
      num(
        shippingRetainedPercent
      ),
      0,
      100
    );

  const extraShippingPercent =
    clamp(
      num(
        shippingCommissionPercent
      ),
      0,
      100
    );

  /* -------------------------------------------------------
     HH ĐƠN
  ------------------------------------------------------- */

  const orderCommission =
    Math.round(
      (normalizedOrderBase *
        orderPercent) /
        100
    );

  /* -------------------------------------------------------
     PHẦN SHIPPER HƯỞNG CƠ BẢN
  ------------------------------------------------------- */

  const shipperBasePercent =
    Math.max(
      0,
      100 -
        retainedPercent
    );

  const baseShippingEarning =
    Math.round(
      (normalizedShipping *
        shipperBasePercent) /
        100
    );

  /* -------------------------------------------------------
     SÀN GIỮ
  ------------------------------------------------------- */

  const shippingRetained =
    Math.min(
      normalizedShipping,
      Math.max(
        0,
        normalizedShipping -
          baseShippingEarning
      )
    );

  /* -------------------------------------------------------
     HH THÊM PHÍ SHIP
  ------------------------------------------------------- */

  const shippingCommission =
    Math.round(
      (baseShippingEarning *
        extraShippingPercent) /
        100
    );

  /* -------------------------------------------------------
     TỔNG TIỀN PHÍ SHIP SHIPPER NHẬN
  ------------------------------------------------------- */

  const shipperShippingAmount =
    baseShippingEarning +
    shippingCommission;

  /* -------------------------------------------------------
     TỔNG THU NHẬP SHIPPER
  ------------------------------------------------------- */

  const totalShipperEarning =
    orderCommission +
    shipperShippingAmount;

  /*
   * Tổng chi phí Shipper của Sàn.
   *
   * Đây KHÔNG phải shippingFee.
   * Đây là:
   *
   * HH đơn
   * + phí ship Shipper
   */
  const totalShipperCost =
    totalShipperEarning;

  return {
    orderBase:
      normalizedOrderBase,

    orderCommissionPercent:
      orderPercent,

    orderCommission,

    shippingCollected:
      normalizedShipping,

    shippingRetainedPercent:
      retainedPercent,

    shipperBasePercent,

    baseShippingEarning,

    shippingRetained,

    shippingCommissionPercent:
      extraShippingPercent,

    shippingCommission,

    shipperShippingAmount,

    totalShipperEarning,

    totalShipperCost,
  };
};

/* =========================================================
   GET
========================================================= */

export async function GET(
  request: Request
) {
  try {
    const {
      searchParams,
    } = new URL(
      request.url
    );

    const type = (
      searchParams.get(
        "type"
      ) || "MERCHANT"
    )
      .toUpperCase()
      .trim();

    const targetId =
      searchParams.get(
        "id"
      );

    const timeFrame = (
      searchParams.get(
        "timeFrame"
      ) || "DAY"
    )
      .toUpperCase()
      .trim();

    if (
      !targetId
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Thiếu ID đối tác",
        },
        {
          status: 400,
        }
      );
    }

    if (
      type !==
        "MERCHANT" &&
      type !==
        "SHIPPER"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Loại đối tác không hợp lệ",
        },
        {
          status: 400,
        }
      );
    }

    /* =====================================================
       SETTINGS
    ===================================================== */

    const configDoc =
      await adminDb
        .collection(
          "settings"
        )
        .doc(
          "commission"
        )
        .get();

    const config =
      configDoc.exists
        ? configDoc.data() || {}
        : {};

    const platformFeePercent =
      clamp(
        num(
          config.platformFeePercent ??
            10
        ),
        0,
        100
      );

    /*
     * HH Shipper trên giá đơn
     */
    const shipperOrderCommissionPercent =
      clamp(
        num(
          config
            .shipperOrderCommissionPercent ??
            config.orderCommissionPercent ??
            3
        ),
        0,
        100
      );

    /*
     * Sàn giữ phí ship
     */
    const shippingRetainedPercent =
      clamp(
        num(
          config.shippingRetainedPercent ??
            30
        ),
        0,
        100
      );

    /*
     * HH thêm trên phần phí ship
     * Shipper được hưởng.
     */
    const shipperShippingCommissionPercent =
      clamp(
        num(
          config
            .shipperShippingCommissionPercent ??
            2
        ),
        0,
        100
      );

    /*
     * Field cũ.
     */
    const shippingFeePercent =
      num(
        config.shippingFeePercent ??
          20
      );

    /* =====================================================
       MERCHANT MAP
    ===================================================== */

    const merchantMap: Record<
      string,
      number
    > = {};

    const merchantsSnap =
      await adminDb
        .collection(
          "merchants"
        )
        .get();

    for (
      const merchantDoc of
        merchantsSnap.docs
    ) {
      const merchant =
        merchantDoc.data();

      const commission =
        clamp(
          num(
            merchant.commissionPercent ??
              platformFeePercent
          ),
          0,
          100
        );

      merchantMap[
        merchantDoc.id
      ] = commission;

      if (
        merchant.merchantCode
      ) {
        merchantMap[
          String(
            merchant.merchantCode
          )
        ] = commission;
      }
    }

    /* =====================================================
       ORDERS
    ===================================================== */

    const ordersSnap =
      await adminDb
        .collection(
          "orders"
        )
        .get();

    /* =====================================================
       SUMMARY
    ===================================================== */

    /* CHUNG */

    let totalCustomerPaid = 0;

    let totalCodAmount = 0;

    let totalBankAmount = 0;

    let totalOrders = 0;

    /* GIÁ ĐƠN */

    let totalOriginalGMV = 0;

    let totalGMV = 0;

    let totalMerchantOriginalGross = 0;

    let totalMerchantSaleGross = 0;

    /* MERCHANT */

    let totalMerchantCommissionRevenue = 0;

    let totalMerchantNet = 0;

    /* SHIP */

    let totalShippingCollected = 0;

    let totalShippingRetained = 0;

    let totalShipperBaseShipping = 0;

    let totalShipperShippingAmount = 0;

    let totalShipperShippingCommission = 0;

    /* SHIPPER */

    let totalShipperOrderCommissionBase = 0;

    let totalShipperOrderCommission = 0;

    let totalShipperTotalEarning = 0;

    /* PLATFORM */

    let totalPlatformRevenue = 0;

    let totalPlatformNetRevenue = 0;

    /* DATA QUALITY */

    let originalGrossLegacyOrderCount = 0;

    let missingOriginalGrossOrderCount = 0;

    /* LEGACY */

    let totalGrossRevenue = 0;

    let totalPlatformCut = 0;

    let totalNetRevenue = 0;

    let totalSubTotalCostPrice = 0;

    let totalSubTotalPrice = 0;

    /* =====================================================
       CHART
    ===================================================== */

    const chartDataMap: Record<
      string,
      any
    > = {};

    const now =
      new Date();

    /* =====================================================
       LOOP
    ===================================================== */

    for (
      const orderDoc of
        ordersSnap.docs
    ) {
      const data =
        orderDoc.data();

      /* ---------------------------------------------------
         STATUS
      --------------------------------------------------- */

      const status =
        String(
          data.status ??
            ""
        )
          .toLowerCase()
          .trim();

      if (
        status !==
          "completed" &&
        status !==
          "delivered"
      ) {
        continue;
      }

      /* ---------------------------------------------------
         PARTNER FILTER
      --------------------------------------------------- */

      if (
        type ===
        "MERCHANT"
      ) {
        const merchantId =
          String(
            data.merchantId ??
              data.storeId ??
              data.shopId ??
              ""
          ).trim();

        if (
          merchantId !==
          String(
            targetId
          )
        ) {
          continue;
        }
      }

      if (
        type ===
        "SHIPPER"
      ) {
        const shipperId =
          String(
            data.shipperId ??
              data.driverId ??
              data.assignedShipperId ??
              ""
          ).trim();

        if (
          shipperId !==
          String(
            targetId
          )
        ) {
          continue;
        }
      }

      /* ---------------------------------------------------
         DATE
      --------------------------------------------------- */

      const createdAt =
        parseDate(
          data.createdAt
        );

      /* ---------------------------------------------------
         TIME FILTER
      --------------------------------------------------- */

      if (
        timeFrame ===
        "HOUR"
      ) {
        if (
          createdAt.toDateString() !==
          now.toDateString()
        ) {
          continue;
        }
      }

      if (
        timeFrame ===
        "DAY"
      ) {
        if (
          createdAt.getMonth() !==
            now.getMonth() ||
          createdAt.getFullYear() !==
            now.getFullYear()
        ) {
          continue;
        }
      }

      if (
        timeFrame ===
        "MONTH"
      ) {
        if (
          createdAt.getFullYear() !==
          now.getFullYear()
        ) {
          continue;
        }
      }

      /* ---------------------------------------------------
         CUSTOMER PAYMENT
      --------------------------------------------------- */

      const totalPrice =
        Math.max(
          0,
          num(
            data.finalTotal ??
              data.finalPrice ??
              data.paidTotal ??
              data.totalPrice ??
              data.total ??
              data.amount
          )
        );

      const shippingFee =
        Math.max(
          0,
          num(
            data.shippingFee ??
              data.shipFee ??
              data.deliveryFee
          )
        );

      const subTotalPrice =
        getOrderSaleGross(
          data
        );

      const originalResult =
        getOrderOriginalGross(
          data
        );

      const originalGross =
        originalResult.amount;

      /* ---------------------------------------------------
         PAYMENT
      --------------------------------------------------- */

      const cod =
        isCodPayment(
          data.paymentMethod
        );

      const codAmount =
        cod
          ? totalPrice
          : 0;

      const bankAmount =
        cod
          ? 0
          : totalPrice;

      /* ===================================================
         MERCHANT FINANCE
      =================================================== */

      const commissionPercent =
        await getMerchantCommissionPercent(
          data,
          merchantMap,
          platformFeePercent
        );

      const merchantCommission =
        originalGross >
        0
          ? Math.round(
              (originalGross *
                commissionPercent) /
                100
            )
          : 0;

      const merchantNet =
        subTotalPrice -
        merchantCommission;

      /* ---------------------------------------------------
         DATA QUALITY
      --------------------------------------------------- */

      if (
        originalResult.source ===
          "LEGACY_SUBTOTAL_COST_PRICE" ||
        originalResult.source ===
          "LEGACY_ITEM_COST_PRICE"
      ) {
        originalGrossLegacyOrderCount +=
          1;
      }

      if (
        originalGross <=
        0
      ) {
        missingOriginalGrossOrderCount +=
          1;
      }

      /* ===================================================
         SHIPPER FINANCE
      =================================================== */

      /*
       * Cơ sở HH đơn:
       *
       * 1. financial.shipper.orderCommissionBase
       * 2. order.shipperOrderCommissionBase
       * 3. giá bán sau giảm
       */
      const shipperOrderBase =
        Math.max(
          0,
          num(
            data
              ?.financial
              ?.shipper
              ?.orderCommissionBase ??
              data.shipperOrderCommissionBase ??
              subTotalPrice
          )
        );

      const shipperFinance =
        calculateShipperFinance(
          shipperOrderBase,
          shippingFee,
          shipperOrderCommissionPercent,
          shippingRetainedPercent,
          shipperShippingCommissionPercent
        );

      /* ===================================================
         PLATFORM
      =================================================== */

      /*
       * Sàn thu:
       *
       * CK quán
       * +
       * phần sàn giữ phí ship
       */
      const platformRevenue =
        merchantCommission +
        shipperFinance.shippingRetained;

      /*
       * Sàn còn:
       *
       * Sàn thu
       * -
       * HH đơn
       * -
       * HH thêm phí ship
       *
       * Không trừ baseShippingEarning
       * vì đó không phải doanh thu sàn.
       */
      const platformNetRevenue =
        platformRevenue -
        shipperFinance.orderCommission -
        shipperFinance.shippingCommission;

      /* ===================================================
         SUMMARY ACCUMULATE
      =================================================== */

      totalCustomerPaid +=
        totalPrice;

      totalCodAmount +=
        codAmount;

      totalBankAmount +=
        bankAmount;

      totalOrders += 1;

      /* GIÁ */

      totalOriginalGMV +=
        originalGross;

      totalGMV +=
        subTotalPrice;

      totalMerchantOriginalGross +=
        originalGross;

      totalMerchantSaleGross +=
        subTotalPrice;

      /* MERCHANT */

      totalMerchantCommissionRevenue +=
        merchantCommission;

      totalMerchantNet +=
        merchantNet;

      /* SHIPPING */

      totalShippingCollected +=
        shippingFee;

      totalShippingRetained +=
        shipperFinance.shippingRetained;

      totalShipperBaseShipping +=
        shipperFinance.baseShippingEarning;

      totalShipperShippingAmount +=
        shipperFinance.shipperShippingAmount;

      totalShipperShippingCommission +=
        shipperFinance.shippingCommission;

      /* SHIPPER */

      totalShipperOrderCommissionBase +=
        shipperFinance.orderBase;

      totalShipperOrderCommission +=
        shipperFinance.orderCommission;

      totalShipperTotalEarning +=
        shipperFinance.totalShipperEarning;

      /* PLATFORM */

      totalPlatformRevenue +=
        platformRevenue;

      totalPlatformNetRevenue +=
        platformNetRevenue;

      /* LEGACY */

      if (
        type ===
        "SHIPPER"
      ) {
        totalGrossRevenue +=
          shipperFinance.orderBase;

        totalPlatformCut +=
          shipperFinance.orderCommission;

        totalNetRevenue +=
          shipperFinance.totalShipperEarning;
      } else {
        totalGrossRevenue +=
          subTotalPrice;

        totalPlatformCut +=
          merchantCommission;

        totalNetRevenue +=
          merchantNet;
      }

      totalSubTotalCostPrice +=
        num(
          data.subTotalCostPrice ??
            data.costPriceTotal ??
            0
        );

      totalSubTotalPrice +=
        subTotalPrice;

      /* ===================================================
         CHART KEY
      =================================================== */

      let key =
        "Tất cả";

      if (
        timeFrame ===
        "HOUR"
      ) {
        key =
          `${String(
            createdAt.getHours()
          ).padStart(
            2,
            "0"
          )}:00`;
      }

      if (
        timeFrame ===
        "DAY"
      ) {
        key =
          `${String(
            createdAt.getDate()
          ).padStart(
            2,
            "0"
          )}/${String(
            createdAt.getMonth() +
              1
          ).padStart(
            2,
            "0"
          )}`;
      }

      if (
        timeFrame ===
        "MONTH"
      ) {
        key =
          `Thg ${String(
            createdAt.getMonth() +
              1
          ).padStart(
            2,
            "0"
          )}/${createdAt.getFullYear()}`;
      }

      if (
        timeFrame ===
        "YEAR"
      ) {
        key =
          `Năm ${createdAt.getFullYear()}`;
      }

      /* ===================================================
         CHART INIT
      =================================================== */

      if (
        !chartDataMap[key]
      ) {
        chartDataMap[key] = {
          time: key,

          count: 0,

          /* CUSTOMER */

          customerPaid: 0,

          codAmount: 0,

          bankAmount: 0,

          /* VALUE */

          originalGMV: 0,

          gmv: 0,

          merchantOriginalGross: 0,

          merchantSaleGross: 0,

          /* MERCHANT */

          merchantCommissionRevenue: 0,

          merchantNet: 0,

          /* SHIPPING */

          shippingCollected: 0,

          shippingRetained: 0,

          baseShippingEarning: 0,

          shippingEarning: 0,

          shippingCommission: 0,

          /* SHIPPER */

          orderCommissionBase: 0,

          shipperOrderCommissionBase: 0,

          orderCommission: 0,

          shipperOrderCommission: 0,

          shipperTotalEarning: 0,

          /* PLATFORM */

          platformTotalRevenue: 0,

          platformNetRevenue: 0,

          platformNet: 0,

          shippingNet: 0,

          /* LEGACY */

          gross: 0,

          platformCut: 0,

          net: 0,
        };
      }

      const row =
        chartDataMap[key];

      /* ===================================================
         CHART VALUES
      =================================================== */

      row.count += 1;

      row.customerPaid +=
        totalPrice;

      row.codAmount +=
        codAmount;

      row.bankAmount +=
        bankAmount;

      /* VALUE */

      row.originalGMV +=
        originalGross;

      row.gmv +=
        subTotalPrice;

      row.merchantOriginalGross +=
        originalGross;

      row.merchantSaleGross +=
        subTotalPrice;

      /* MERCHANT */

      row.merchantCommissionRevenue +=
        merchantCommission;

      row.merchantNet +=
        merchantNet;

      /* SHIPPING */

      row.shippingCollected +=
        shippingFee;

      row.shippingRetained +=
        shipperFinance.shippingRetained;

      row.baseShippingEarning +=
        shipperFinance.baseShippingEarning;

      row.shippingEarning +=
        shipperFinance.shipperShippingAmount;

      row.shippingCommission +=
        shipperFinance.shippingCommission;

      /* SHIPPER */

      row.orderCommissionBase +=
        shipperFinance.orderBase;

      row.shipperOrderCommissionBase +=
        shipperFinance.orderBase;

      row.orderCommission +=
        shipperFinance.orderCommission;

      row.shipperOrderCommission +=
        shipperFinance.orderCommission;

      row.shipperTotalEarning +=
        shipperFinance.totalShipperEarning;

      /* PLATFORM */

      row.platformTotalRevenue +=
        platformRevenue;

      row.platformNetRevenue +=
        platformNetRevenue;

      row.platformNet +=
        merchantCommission;

      row.shippingNet +=
        shipperFinance.shippingRetained;

      /* LEGACY VIEW */

      if (
        type ===
        "SHIPPER"
      ) {
        row.gross +=
          shipperFinance.orderBase;

        row.platformCut +=
          shipperFinance.orderCommission;

        row.net +=
          shipperFinance.totalShipperEarning;
      } else {
        row.gross +=
          subTotalPrice;

        row.platformCut +=
          merchantCommission;

        row.net +=
          merchantNet;
      }
    }

    /* =====================================================
       CHART ARRAY
    ===================================================== */

    const chartData =
      Object.values(
        chartDataMap
      );

    /* =====================================================
       SUMMARY
    ===================================================== */

    const summary = {
      /* -----------------------------------------------
         CHUNG
      ----------------------------------------------- */

      totalOrders,

      completedCount:
        totalOrders,

      totalCustomerPaid,

      totalCodAmount,

      totalBankAmount,

      /* -----------------------------------------------
         GIÁ GỐC / GIÁ SAU GIẢM
      ----------------------------------------------- */

      totalOriginalGMV,

      totalGMV,

      totalMerchantOriginalGross,

      totalMerchantSaleGross,

      /* -----------------------------------------------
         MERCHANT
      ----------------------------------------------- */

      totalMerchantCommissionRevenue,

      totalMerchantNet,

      /* -----------------------------------------------
         SHIPPING
      ----------------------------------------------- */

      totalShippingCollected,

      totalShippingRetained,

      totalShippingRevenue:
        totalShippingRetained,

      totalShipperBaseShipping,

      totalShipperShippingAmount,

      totalShipperShippingCommission,

      /* -----------------------------------------------
         SHIPPER
      ----------------------------------------------- */

      totalShipperOrderCommissionBase,

      totalShipperOrderCommission,

      totalShipperTotalEarning,

      /* -----------------------------------------------
         PLATFORM
      ----------------------------------------------- */

      totalPlatformRevenue,

      totalPlatformNetRevenue,

      netTotalRevenue:
        totalPlatformNetRevenue,

      /* -----------------------------------------------
         DATA QUALITY
      ----------------------------------------------- */

      originalGrossLegacyOrderCount,

      missingOriginalGrossOrderCount,

      /* -----------------------------------------------
         LEGACY
      ----------------------------------------------- */

      totalGrossRevenue,

      totalPlatformCut,

      totalNetRevenue,

      totalSubTotalCostPrice,

      totalSubTotalPrice,

      /* -----------------------------------------------
         CONFIG
      ----------------------------------------------- */

      appliedCommissionPercent:
        type ===
        "MERCHANT"
          ? platformFeePercent
          : shipperOrderCommissionPercent,

      platformFeePercent,

      shipperOrderCommissionPercent,

      shippingRetainedPercent,

      shipperShippingCommissionPercent,

      /* -----------------------------------------------
         PARTNER
      ----------------------------------------------- */

      partnerId:
        targetId,

      type,
    };

    /* =====================================================
       RESPONSE
    ===================================================== */

    return NextResponse.json({
      success: true,

      data: {
        config: {
          platformFeePercent,

          shippingFeePercent,

          shipperOrderCommissionPercent,

          shippingRetainedPercent,

          shipperShippingCommissionPercent,
        },

        summary,

        chartData,
      },
    });
  } catch (
    error: any
  ) {
    console.error(
      "Lỗi API Doanh Thu Đối Tác:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Lỗi API Doanh Thu Đối Tác",
      },
      {
        status: 500,
      }
    );
  }
}