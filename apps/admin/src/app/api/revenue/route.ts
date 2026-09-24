import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

/* =========================================================
   HELPERS
========================================================= */

const num = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

/* =========================================================
   SHIPPING SHARE BY DISTANCE
========================================================= */

const SHIPPING_DISTANCE_RULES = [
  { label: "≤ 2 km", maxKm: 2, shipperPercent: 40, platformPercent: 60 },
  { label: "2–4 km", maxKm: 4, shipperPercent: 45, platformPercent: 55 },
  { label: "4–6 km", maxKm: 6, shipperPercent: 50, platformPercent: 50 },
  { label: "6–8 km", maxKm: 8, shipperPercent: 60, platformPercent: 40 },
  {
    label: "> 8 km",
    maxKm: Number.POSITIVE_INFINITY,
    shipperPercent: 65,
    platformPercent: 35,
  },
] as const;

const getShippingShareByDistance = (
  distanceValue: unknown,
  fallbackPlatformPercent = 60
) => {
  const parsedDistance = Number(distanceValue);

  /*
   * Đơn legacy thiếu distanceKm dùng cấu hình cũ làm fallback.
   * Đơn có khoảng cách luôn dùng bảng tỷ lệ động.
   */
  if (!Number.isFinite(parsedDistance) || parsedDistance < 0) {
    const platformPercent = clamp(
      num(fallbackPlatformPercent),
      0,
      100
    );

    return {
      distanceKm: 0,
      shipperPercent: Math.max(0, 100 - platformPercent),
      platformPercent,
      tierLabel: "Thiếu khoảng cách (fallback)",
      isFallback: true,
    };
  }

  const distanceKm = Math.max(0, parsedDistance);

  const rule =
    SHIPPING_DISTANCE_RULES.find(
      (item) => distanceKm <= item.maxKm
    ) ?? SHIPPING_DISTANCE_RULES[SHIPPING_DISTANCE_RULES.length - 1];

  return {
    distanceKm,
    shipperPercent: rule.shipperPercent,
    platformPercent: rule.platformPercent,
    tierLabel: rule.label,
    isFallback: false,
  };
};

const isCodPayment = (method: unknown): boolean => {
  const value = String(method ?? "").toLowerCase().trim();
  return value === "cod" || value === "cash";
};

const parseDate = (value: any): Date => {
  if (!value) return new Date();
  try {
    if (typeof value.toDate === "function") return value.toDate();
    if (value.seconds !== undefined) return new Date(num(value.seconds) * 1000);
    if (value._seconds !== undefined) return new Date(num(value._seconds) * 1000);
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? new Date() : date;
  } catch {
    return new Date();
  }
};

/* =========================================================
   VOUCHER / LEGACY MAPPING
========================================================= */

const getVoucherInfo = (data: any) => {
  const voucher =
    data?.voucher ??
    data?.appliedVoucher ??
    data?.voucherInfo ??
    {};

  const voucherCode = String(
    data?.voucherCode ??
      data?.appliedVoucherCode ??
      data?.shippingVoucherCode ??
      data?.appliedShippingVoucherCode ??
      data?.voucherCampaignCode ??
      voucher?.code ??
      voucher?.voucherCode ??
      voucher?.shippingVoucherCode ??
      voucher?.campaignCode ??
      ""
  ).trim();

  const voucherId = String(
    data?.voucherId ??
      data?.appliedVoucherId ??
      data?.shippingVoucherId ??
      voucher?.id ??
      ""
  ).trim();

  let orderDiscount = num(
    data?.orderVoucherDiscount ??
      data?.voucherOrderDiscount ??
      data?.productVoucherDiscount ??
      data?.voucherDiscountOrder ??
      voucher?.orderDiscount ??
      voucher?.productDiscount
  );

  let shippingDiscount = num(
    data?.shippingVoucherDiscount ??
      data?.voucherShippingDiscount ??
      data?.shippingDiscount ??
      data?.voucherDiscountShipping ??
      voucher?.shippingDiscount ??
      voucher?.shippingDiscountAmount
  );

  const singleDiscount = num(data?.voucherDiscount);

  const applyType = String(
    data?.voucherApplyType ??
      data?.applyType ??
      voucher?.applyType ??
      voucher?.type ??
      ""
  ).toUpperCase().trim();

  if (singleDiscount > 0 && orderDiscount <= 0 && shippingDiscount <= 0) {
    if (applyType === "SHIPPING" || applyType === "SHIP") {
      shippingDiscount = singleDiscount;
    } else {
      orderDiscount = singleDiscount;
    }
  }

  orderDiscount = Math.max(0, orderDiscount);
  shippingDiscount = Math.max(0, shippingDiscount);

  const fundingType = String(
    data?.voucherFundingType ??
      data?.fundingType ??
      voucher?.fundingType ??
      ""
  ).toUpperCase().trim();

  const platformFundingPercent = clamp(
    num(
      data?.platformFundingPercent ??
        voucher?.platformFundingPercent
    ),
    0,
    100
  );

  const merchantFundingPercent = clamp(
    num(
      data?.merchantFundingPercent ??
        voucher?.merchantFundingPercent
    ),
    0,
    100
  );

  /*
   * Xác định phần VOUCHER PHÍ SHIP do SÀN thực sự tài trợ.
   *
   * Không được mặc định mọi voucher legacy là Sàn tài trợ, vì
   * dữ liệu thiếu fundingType có thể khiến Dashboard tự trừ
   * một khoản chi phí mà Sàn chưa chắc phải chịu.
   *
   * Quy tắc:
   * - PLATFORM: dùng platformFundingPercent; nếu không có % thì 100%.
   * - MERCHANT: chỉ có phần platform nếu platformFundingPercent > 0.
   * - Không có funding metadata: KHÔNG tự trừ khỏi Sàn.
   */
  let platformFundedShippingDiscount = 0;

  if (shippingDiscount > 0) {
    if (fundingType === "PLATFORM") {
      const percent =
        platformFundingPercent > 0
          ? platformFundingPercent
          : 100;

      platformFundedShippingDiscount = Math.min(
        shippingDiscount,
        Math.max(
          0,
          Math.round(
            (shippingDiscount * percent) / 100
          )
        )
      );
    } else if (fundingType === "MERCHANT") {
      platformFundedShippingDiscount = Math.min(
        shippingDiscount,
        Math.max(
          0,
          Math.round(
            (shippingDiscount * platformFundingPercent) /
              100
          )
        )
      );
    } else if (platformFundingPercent > 0) {
      platformFundedShippingDiscount = Math.min(
        shippingDiscount,
        Math.max(
          0,
          Math.round(
            (shippingDiscount * platformFundingPercent) /
              100
          )
        )
      );
    }
  }

  const isPlatformFundedShipping =
    platformFundedShippingDiscount > 0;

  return {
    hasVoucher:
      Boolean(
        voucherCode ||
          voucherId ||
          orderDiscount > 0 ||
          shippingDiscount > 0
      ),
    voucherCode,
    voucherId,
    orderDiscount,
    shippingDiscount,
    totalDiscount:
      orderDiscount + shippingDiscount,
    fundingType,
    platformFundingPercent,
    merchantFundingPercent,
    isPlatformFundedShipping,
    platformFundedShippingDiscount,
  };
};

/* =========================================================
   ORIGINAL GROSS
========================================================= */

const getItemOriginalPrice = (item: any): number => {
  for (const value of [
    item?.originalPrice,
    item?.originalUnitPrice,
    item?.listPrice,
    item?.regularPrice,
  ]) {
    const price = num(value);
    if (price > 0) return price;
  }
  return 0;
};

const getOriginalGross = (data: any): {
  amount: number;
  source:
    | "ITEM_ORIGINAL_PRICE"
    | "ORDER_ORIGINAL_PRICE"
    | "FINANCIAL_SNAPSHOT"
    | "LEGACY_SUBTOTAL_COST_PRICE"
    | "LEGACY_ITEM_COST_PRICE"
    | "NONE";
} => {
  if (Array.isArray(data?.items)) {
    let total = 0;
    let found = false;

    for (const item of data.items) {
      const originalPrice = getItemOriginalPrice(item);
      const quantity = Math.max(1, num(item?.quantity ?? 1));
      if (originalPrice > 0) {
        found = true;
        total += originalPrice * quantity;
      }
    }

    if (found && total > 0) {
      return {
        amount: total,
        source: "ITEM_ORIGINAL_PRICE",
      };
    }
  }

  for (const value of [
    data?.originalSubTotalPrice,
    data?.subtotalBeforeDiscount,
    data?.grossBeforeDiscount,
    data?.originalGMV,
    data?.originalTotalPrice,
  ]) {
    const amount = num(value);
    if (amount > 0) {
      return {
        amount,
        source: "ORDER_ORIGINAL_PRICE",
      };
    }
  }

  const snapshot = num(
    data?.financial?.merchant?.originalGross
  );

  if (snapshot > 0) {
    return {
      amount: snapshot,
      source: "FINANCIAL_SNAPSHOT",
    };
  }

  /*
   * Legacy: một số đơn không có originalPrice nhưng vẫn lưu
   * subtotal/costPrice cũ. Dùng đúng fallback này để API và Modal
   * không cho ra hai cơ sở tính CK khác nhau.
   */
  const legacySubTotal = num(
    data?.subTotalCostPrice ??
      data?.costPriceTotal
  );

  if (legacySubTotal > 0) {
    return {
      amount: legacySubTotal,
      source: "LEGACY_SUBTOTAL_COST_PRICE",
    };
  }

  if (Array.isArray(data?.items)) {
    let total = 0;

    for (const item of data.items) {
      const costPrice = num(item?.costPrice);
      const quantity = Math.max(
        1,
        num(item?.quantity ?? 1)
      );

      if (costPrice > 0) {
        total += costPrice * quantity;
      }
    }

    if (total > 0) {
      return {
        amount: total,
        source: "LEGACY_ITEM_COST_PRICE",
      };
    }
  }

  return {
    amount: 0,
    source: "NONE",
  };
};

const getSaleGross = (
  data: any,
  totalPrice: number,
  shippingPaidByCustomer: number,
  shippingVoucherDiscount: number
): number => {
  const direct = num(data?.subTotalPrice);
  if (direct > 0) return direct;

  if (Array.isArray(data?.items)) {
    let total = 0;
    for (const item of data.items) {
      const price = num(item?.price);
      const quantity = Math.max(1, num(item?.quantity ?? 1));
      total += price * quantity;
    }
    if (total > 0) return total;
  }

  return Math.max(
    0,
    totalPrice -
      shippingPaidByCustomer +
      shippingVoucherDiscount
  );
};

/* =========================================================
   SHIPPER ORDER COMMISSION BASE
========================================================= */

const getItemSaleGross = (data: any): number => {
  if (!Array.isArray(data?.items)) return 0;

  let total = 0;

  for (const item of data.items) {
    const price = num(
      item?.price ??
        item?.salePrice ??
        item?.unitPrice
    );

    const quantity = Math.max(
      1,
      num(item?.quantity ?? 1)
    );

    if (price > 0) {
      total += price * quantity;
    }
  }

  return total;
};

/**
 * Cơ sở HH Shipper trên giá đơn.
 *
 * SOURCE OF TRUTH là GIÁ TRỊ ĐƠN GỐC hiện tại.
 * Không dùng lại snapshot financial.shipper.orderCommissionBase hoặc
 * shipperOrderCommissionBase vì dữ liệu legacy có thể làm sai base.
 */
const getShipperOrderCommissionBase = (
  data: any,
  originalGross: number,
  saleGross: number
): number => {
  if (originalGross > 0) {
    return Math.max(0, originalGross);
  }

  const canonicalCandidates = [
    data?.originalSubTotalPrice,
    data?.subtotalBeforeDiscount,
    data?.grossBeforeDiscount,
    data?.originalGMV,
    data?.originalTotalPrice,
    data?.subTotalPrice,
    getItemSaleGross(data),
    saleGross,
  ].map(num).filter((value) => value > 0);

  return Math.max(
    0,
    canonicalCandidates[0] ?? saleGross
  );
};


/* =========================================================
   SHIPPING
========================================================= */

const getShippingInfo = (
  data: any,
  shippingVoucherDiscount: number
) => {
  const customerShippingFee = Math.max(
    0,
    num(
      data?.shippingFee ??
        data?.shipFee ??
        data?.deliveryFee
    )
  );

  /*
   * =======================================================
   * SOURCE OF TRUTH: PHÍ SHIP TRƯỚC VOUCHER
   * =======================================================
   *
   * Ưu tiên field lưu TOÀN BỘ phí ship trước voucher.
   */
  const directPreVoucherCandidates = [
    data?.shippingFeeBeforeVoucher,
    data?.shippingFeeBeforeDiscount,
    data?.shippingFeeOriginal,
    data?.initialShippingFee,
    data?.totalShippingBeforeVoucher,
    data?.preVoucherShippingFee,
    data?.originalShippingFee,
    data?.financial?.shipper?.shippingFeeBeforeVoucher,
    data?.financial?.platform?.shippingCollectedBeforeVoucher,
    data?.financial?.platform?.shippingFeeBeforeVoucher,
  ];

  for (const value of directPreVoucherCandidates) {
    const amount = num(value);

    if (amount > 0) {
      return {
        baseShippingFee: amount,
        shippingPaidByCustomer: Math.min(
          amount,
          customerShippingFee
        ),
        shippingVoucherDiscount: Math.min(
          amount,
          Math.max(0, shippingVoucherDiscount)
        ),
        source: "DIRECT_PRE_VOUCHER",
      } as const;
    }
  }

  /*
   * =======================================================
   * CHECKOUT SCHEMA HIỆN TẠI
   * =======================================================
   *
   * Checkout đang lưu:
   *
   *   baseShippingFee = phí cơ bản theo khoảng cách
   *   appliedFee      = rainFee + peakHourFee
   *   shippingFee     = phí sau voucher
   *
   * Vì vậy phí ship TRƯỚC voucher phải là:
   *
   *   baseShippingFee + appliedFee
   *
   * KHÔNG được lấy riêng baseShippingFee.
   */
  const checkoutBaseShippingFee = num(
    data?.baseShippingFee
  );

  const checkoutAppliedFee = num(
    data?.appliedFee
  );

  const checkoutPeakHourFee = num(
    data?.peakHourFee
  );

  const checkoutRainFee = num(
    data?.rainFee
  );

  if (checkoutBaseShippingFee > 0) {
    const surcharge =
      checkoutAppliedFee > 0
        ? checkoutAppliedFee
        : checkoutPeakHourFee +
          checkoutRainFee;

    const checkoutPreVoucherFee =
      checkoutBaseShippingFee +
      Math.max(0, surcharge);

    return {
      baseShippingFee: checkoutPreVoucherFee,
      shippingPaidByCustomer: Math.min(
        checkoutPreVoucherFee,
        customerShippingFee
      ),
      shippingVoucherDiscount: Math.min(
        checkoutPreVoucherFee,
        Math.max(0, shippingVoucherDiscount)
      ),
      source: "CHECKOUT_BASE_PLUS_APPLIED_FEE",
    } as const;
  }

  /*
   * Một số legacy record chỉ còn các phụ phí mà không còn
   * baseShippingFee. Khi đó chỉ có thể dùng phần được lưu rõ ràng.
   */
  const legacyComponentShipping =
    num(data?.shippingBaseAmount) +
    num(data?.appliedFee);

  if (legacyComponentShipping > 0) {
    return {
      baseShippingFee: legacyComponentShipping,
      shippingPaidByCustomer: Math.min(
        legacyComponentShipping,
        customerShippingFee
      ),
      shippingVoucherDiscount: Math.min(
        legacyComponentShipping,
        Math.max(0, shippingVoucherDiscount)
      ),
      source: "LEGACY_PRE_VOUCHER_COMPONENTS",
    } as const;
  }

  /*
   * Legacy KHÔNG có voucher:
   * shippingFee chính là phí ship gốc.
   *
   * Nếu có voucher nhưng thiếu dữ liệu trước voucher,
   * tuyệt đối KHÔNG lấy shippingFee sau voucher để làm base.
   */
  if (
    customerShippingFee > 0 &&
    shippingVoucherDiscount <= 0
  ) {
    return {
      baseShippingFee: customerShippingFee,
      shippingPaidByCustomer: customerShippingFee,
      shippingVoucherDiscount: 0,
      source: "LEGACY_NO_VOUCHER",
    } as const;
  }

  return {
    baseShippingFee: 0,
    shippingPaidByCustomer: Math.max(
      0,
      customerShippingFee
    ),
    shippingVoucherDiscount: 0,
    source: "MISSING_PRE_VOUCHER_SOURCE",
  } as const;
};

/* =========================================================
   GET
========================================================= */

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    const timeFrame =
      url.searchParams.get("timeFrame") || "ALL";

    const type = (
      url.searchParams.get("type") || "PLATFORM"
    ).toUpperCase().trim();

    const partnerId =
      url.searchParams.get("id") ||
      url.searchParams.get("partnerId") ||
      "";

    /* =====================================================
       CONFIG
    ===================================================== */

    const settingsSnap = await adminDb
      .collection("settings")
      .doc("commission")
      .get();

    const settings = settingsSnap.exists
      ? settingsSnap.data() || {}
      : {};

    const platformFeePercent = clamp(
      num(settings.platformFeePercent ?? 10),
      0,
      100
    );

    const shipperOrderCommissionPercent = clamp(
      num(
        settings.shipperOrderCommissionPercent ??
          settings.orderCommissionPercent ??
          3
      ),
      0,
      100
    );

    const shippingRetainedPercent = clamp(
      num(settings.shippingRetainedPercent ?? 30),
      0,
      100
    );

    const shipperShippingCommissionPercent = clamp(
      num(
        settings.shipperShippingCommissionPercent ?? 2
      ),
      0,
      100
    );

    const shippingFeePercent = num(
      settings.shippingFeePercent ?? 20
    );

    /* =====================================================
       MERCHANT CONFIG
    ===================================================== */

    const merchantSnap = await adminDb
      .collection("merchants")
      .get();

    const merchantMap: Record<string, number> = {};

    merchantSnap.docs.forEach((merchantDoc) => {
      const merchant = merchantDoc.data();
      const percent = clamp(
        num(
          merchant.commissionPercent ??
            merchant.merchantCommissionPercent ??
            platformFeePercent
        ),
        0,
        100
      );

      merchantMap[merchantDoc.id] = percent;

      if (merchant.merchantCode) {
        merchantMap[String(merchant.merchantCode)] = percent;
      }
    });

    /* =====================================================
       SUMMARY
    ===================================================== */

    let totalCustomerPaid = 0;
    let totalCustomerPaidBeforeVoucher = 0;
    let totalGMV = 0;
    let totalOriginalGMV = 0;

    let totalCodGMV = 0;
    let totalBankGMV = 0;

    let totalMerchantOriginalGross = 0;
    let totalMerchantSaleGross = 0;
    let totalMerchantCommissionRevenue = 0;
    let totalMerchantNet = 0;

    let totalShippingBaseFee = 0;
    let totalShippingPaidByCustomer = 0;
    let totalShippingVoucherDiscount = 0;
    let totalShippingRetained = 0;
    let totalShipperShippingAmount = 0;
    let totalShipperShippingCommission = 0;

    let totalShipperOrderCommissionBase = 0;
    let totalShipperOrderCommission = 0;
    let totalShipperTotalEarning = 0;

    let totalPlatformRevenue = 0;
    let totalPlatformNetRevenue = 0;
    let totalPlatformFundedVoucher = 0;

    let totalVoucherOrders = 0;
    let totalVoucherDiscount = 0;
    let totalOrderVoucherDiscount = 0;

    let totalGrossRevenue = 0;
    let totalPlatformCut = 0;
    let totalNetRevenue = 0;

    let totalSubTotalCostPrice = 0;
    let totalSubTotalPrice = 0;
    let totalOrders = 0;

    let originalGrossLegacyOrderCount = 0;
    let missingOriginalGrossOrderCount = 0;

    const voucherUsageMap: Record<string, any> = {};
    const chartDataMap: Record<string, any> = {};

    const now = new Date();

    /* =====================================================
       ORDERS
    ===================================================== */

    const ordersSnap = await adminDb
      .collection("orders")
      .get();

    for (const orderDoc of ordersSnap.docs) {
      const data = orderDoc.data();

      const status = String(data.status ?? "")
        .toLowerCase()
        .trim();

      if (status !== "completed" && status !== "delivered") {
        continue;
      }

      const orderMerchantId = String(
        data.merchantId ??
          data.storeId ??
          data.shopId ??
          ""
      );

      const shipperIds = [
        data.shipperId,
        data.driverId,
        data.shipperUid,
        data.driverUid,
        data?.shipper?.id,
        data?.shipper?.uid,
      ]
        .map((value) => String(value ?? "").trim())
        .filter(Boolean);

      const orderShipperId =
        shipperIds[0] ?? "";

      if (
        type === "MERCHANT" &&
        partnerId &&
        orderMerchantId !== String(partnerId)
      ) {
        continue;
      }

      if (
        type === "SHIPPER" &&
        partnerId &&
        !shipperIds.includes(String(partnerId).trim())
      ) {
        continue;
      }

      const createdAt = parseDate(data.createdAt);

      if (timeFrame === "HOUR") {
        if (createdAt.toDateString() !== now.toDateString()) continue;
      }

      if (timeFrame === "DAY") {
        if (
          createdAt.getMonth() !== now.getMonth() ||
          createdAt.getFullYear() !== now.getFullYear()
        ) continue;
      }

      if (timeFrame === "MONTH") {
        if (createdAt.getFullYear() !== now.getFullYear()) continue;
      }

      /* ---------------------------------------------------
         CUSTOMER PAID
      --------------------------------------------------- */

      const customerPaid = Math.max(
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

      /* ---------------------------------------------------
         VOUCHER
      --------------------------------------------------- */

      const voucherInfo = getVoucherInfo(data);

      /* ---------------------------------------------------
         SHIPPING
      --------------------------------------------------- */

      const shippingInfo = getShippingInfo(
        data,
        voucherInfo.shippingDiscount
      );

      const baseShippingFee =
        shippingInfo.baseShippingFee;

      const shippingPaidByCustomer =
        shippingInfo.shippingPaidByCustomer;

      const shippingVoucherDiscount =
        shippingInfo.shippingVoucherDiscount;

      /* ---------------------------------------------------
         SALE GROSS
      --------------------------------------------------- */

      const saleGross = getSaleGross(
        data,
        customerPaid,
        shippingPaidByCustomer,
        shippingVoucherDiscount
      );

      /* ---------------------------------------------------
         ORIGINAL GROSS
      --------------------------------------------------- */

      const originalResult = getOriginalGross(data);

      /*
       * Với đơn cũ không có originalPrice:
       * dùng saleGross làm cơ sở tính HH thay vì lấy
       * một snapshot sai/lỗi như 201.600đ.
       */
      const originalGross =
        originalResult.amount > 0
          ? originalResult.amount
          : saleGross;

      if (originalResult.amount <= 0) {
        missingOriginalGrossOrderCount += 1;
      }

      if (
        originalResult.source ===
          "LEGACY_SUBTOTAL_COST_PRICE" ||
        originalResult.source ===
          "LEGACY_ITEM_COST_PRICE"
      ) {
        originalGrossLegacyOrderCount += 1;
      }

      totalOriginalGMV += originalGross;

      /* ---------------------------------------------------
         MERCHANT
      --------------------------------------------------- */

      const financial = data.financial || {};
      const financialMerchant = financial.merchant || {};

      const merchantCommissionPercent = clamp(
        num(
          financialMerchant.commissionPercent ??
            data.merchantCommissionPercent ??
            merchantMap[orderMerchantId] ??
            platformFeePercent
        ),
        0,
        100
      );

      /*
       * HH quán tính trên giá gốc.
       */
      const merchantCommission = Math.round(
        (originalGross * merchantCommissionPercent) / 100
      );

      const merchantNet = Math.max(
        0,
        saleGross - merchantCommission
      );

      /* ---------------------------------------------------
         SHIPPER - SHIPPING
      --------------------------------------------------- */

      /*
       * Tỷ lệ phí ship theo khoảng cách:
       * ≤ 2 km : Shipper 40% / Sàn 60%
       * 2–4 km : Shipper 45% / Sàn 55%
       * 4–6 km : Shipper 50% / Sàn 50%
       * 6–8 km : Shipper 60% / Sàn 40%
       * > 8 km : Shipper 65% / Sàn 35%
       *
       * Tính trên phí ship GỐC trước voucher.
       */
      const shippingShare = getShippingShareByDistance(
        data?.distanceKm ??
          data?.distance ??
          data?.deliveryDistanceKm,
        shippingRetainedPercent
      );

      const baseShipperShipping = Math.max(
        0,
        Math.round(
          (baseShippingFee * shippingShare.shipperPercent) / 100
        )
      );

      /*
       * Dùng phần còn lại để tránh lệch 1đ do làm tròn.
       */
      const shippingRetained = Math.max(
        0,
        baseShippingFee - baseShipperShipping
      );

      /*
       * HH/THƯỞNG thêm cho Shipper tính trên TOÀN BỘ phí ship gốc
       * trước voucher, không tính trên phần phí ship sau khi Sàn giữ lại.
       */
      const shipperShippingCommission = Math.round(
        (baseShippingFee *
          shipperShippingCommissionPercent) /
          100
      );

      const shipperShippingAmount =
        baseShipperShipping +
        shipperShippingCommission;

      /* ---------------------------------------------------
         SHIPPER - ORDER COMMISSION
      --------------------------------------------------- */

      const shipperOrderCommissionBase =
        getShipperOrderCommissionBase(
          data,
          originalGross,
          saleGross
        );

      const shipperOrderCommission = Math.round(
        (shipperOrderCommissionBase *
          shipperOrderCommissionPercent) /
          100
      );

      const shipperTotalEarning =
        shipperOrderCommission +
        shipperShippingAmount;

      /* ---------------------------------------------------
         PLATFORM GROSS
      --------------------------------------------------- */

      const platformRevenue =
        merchantCommission +
        shippingRetained;

      /* ---------------------------------------------------
         PLATFORM ACTUAL CASH FLOW
      --------------------------------------------------- */

      const platformFundedVoucher =
        voucherInfo.platformFundedShippingDiscount;

      /*
       * SÀN NHẬN THỰC = dòng tiền thực tế:
       *
       *   Khách thực trả - Quán nhận - Shipper nhận
       *
       * customerPaid đã là số tiền sau voucher, vì vậy voucher do Sàn
       * tài trợ KHÔNG được trừ thêm lần nữa. platformFundedVoucher vẫn
       * được giữ riêng để báo cáo chi phí voucher/marketing.
       */
      const platformNetRevenue =
        customerPaid -
        merchantNet -
        shipperTotalEarning;

      /* ---------------------------------------------------
         PAYMENT
      --------------------------------------------------- */

      const isCod = isCodPayment(data.paymentMethod);

      const codAmount = isCod ? customerPaid : 0;
      const bankAmount = isCod ? 0 : customerPaid;

      /* ---------------------------------------------------
         COST
      --------------------------------------------------- */

      let costPriceTotal = num(
        data.subTotalCostPrice ??
          data.costPriceTotal
      );

      if (
        costPriceTotal <= 0 &&
        Array.isArray(data.items)
      ) {
        for (const item of data.items) {
          costPriceTotal +=
            num(
              item?.costPrice ??
                item?.basePrice
            ) *
            Math.max(1, num(item?.quantity ?? 1));
        }
      }

      /* ---------------------------------------------------
         VOUCHER SUMMARY
      --------------------------------------------------- */

      if (voucherInfo.hasVoucher) {
        totalVoucherOrders += 1;

        const key =
          voucherInfo.voucherId ||
          voucherInfo.voucherCode ||
          `LEGACY_${orderDoc.id}`;

        if (!voucherUsageMap[key]) {
          voucherUsageMap[key] = {
            voucherId: voucherInfo.voucherId,
            voucherCode:
              voucherInfo.voucherCode ||
              (voucherInfo.shippingDiscount > 0
                ? "VOUCHER GIẢM PHÍ SHIP"
                : "VOUCHER GIẢM TIỀN HÀNG"),
            usageCount: 0,
            totalDiscount: 0,
            orderDiscount: 0,
            shippingDiscount: 0,
            platformFundedShippingDiscount: 0,
          };
        }

        voucherUsageMap[key].usageCount += 1;
        voucherUsageMap[key].totalDiscount +=
          voucherInfo.totalDiscount;
        voucherUsageMap[key].orderDiscount +=
          voucherInfo.orderDiscount;
        voucherUsageMap[key].shippingDiscount +=
          shippingVoucherDiscount;
        voucherUsageMap[key].platformFundedShippingDiscount +=
          platformFundedVoucher;
      }

      totalVoucherDiscount += voucherInfo.totalDiscount;
      totalOrderVoucherDiscount += voucherInfo.orderDiscount;
      totalShippingVoucherDiscount +=
        shippingVoucherDiscount;
      totalPlatformFundedVoucher +=
        platformFundedVoucher;

      /* ---------------------------------------------------
         TOTALS
      --------------------------------------------------- */

      totalCustomerPaid += customerPaid;
      totalCustomerPaidBeforeVoucher +=
        customerPaid + voucherInfo.totalDiscount;

      totalGMV += saleGross;
      totalCodGMV += codAmount;
      totalBankGMV += bankAmount;

      totalMerchantOriginalGross += originalGross;
      totalMerchantSaleGross += saleGross;
      totalMerchantCommissionRevenue += merchantCommission;
      totalMerchantNet += merchantNet;

      totalShippingBaseFee += baseShippingFee;
      totalShippingPaidByCustomer +=
        shippingPaidByCustomer;
      totalShippingRetained += shippingRetained;
      totalShipperShippingAmount +=
        shipperShippingAmount;
      totalShipperShippingCommission +=
        shipperShippingCommission;

      totalShipperOrderCommissionBase +=
        shipperOrderCommissionBase;
      totalShipperOrderCommission +=
        shipperOrderCommission;
      totalShipperTotalEarning +=
        shipperTotalEarning;

      totalPlatformRevenue += platformRevenue;
      totalPlatformNetRevenue +=
        platformNetRevenue;

      if (type === "SHIPPER") {
        totalGrossRevenue +=
          shipperOrderCommissionBase;
        totalPlatformCut +=
          shipperOrderCommission;
        totalNetRevenue +=
          shipperTotalEarning;
      } else {
        totalGrossRevenue += saleGross;
        totalPlatformCut += merchantCommission;
        totalNetRevenue += platformNetRevenue;
      }

      totalSubTotalCostPrice += costPriceTotal;
      totalSubTotalPrice += saleGross;
      totalOrders += 1;

      /* ---------------------------------------------------
         CHART KEY
      --------------------------------------------------- */

      let key = "Tất cả";

      if (timeFrame === "HOUR") {
        key = `${String(createdAt.getHours()).padStart(2, "0")}:00`;
      } else if (timeFrame === "DAY") {
        key = `${String(createdAt.getDate()).padStart(2, "0")}/${String(
          createdAt.getMonth() + 1
        ).padStart(2, "0")}`;
      } else if (timeFrame === "MONTH") {
        key = `Thg ${String(createdAt.getMonth() + 1).padStart(2, "0")}/${createdAt.getFullYear()}`;
      } else if (timeFrame === "YEAR") {
        key = `Năm ${createdAt.getFullYear()}`;
      }

      if (!chartDataMap[key]) {
        chartDataMap[key] = {
          time: key,
          count: 0,
          customerPaid: 0,
          customerPaidBeforeVoucher: 0,
          originalGMV: 0,
          gmv: 0,
          codAmount: 0,
          bankAmount: 0,
          gross: 0,
          platformCut: 0,
          net: 0,
          subTotalCostPrice: 0,
          subTotalPrice: 0,
          merchantOriginalGross: 0,
          merchantSaleGross: 0,
          merchantCommissionRevenue: 0,
          merchantNet: 0,
          shippingBaseFee: 0,
          shippingCollected: 0,
          shippingPaidByCustomer: 0,
          shippingVoucherDiscount: 0,
          shippingRetained: 0,
          shippingEarning: 0,
          shippingCommission: 0,
          orderCommissionBase: 0,
          shipperOrderCommissionBase: 0,
          orderCommission: 0,
          shipperOrderCommission: 0,
          shipperTotalEarning: 0,
          platformTotalRevenue: 0,
          platformNetRevenue: 0,
          platformFundedVoucher: 0,
          platformNetAfterVoucher: 0,
          voucherOrders: 0,
          voucherDiscount: 0,
          orderVoucherDiscount: 0,
          voucherShippingDiscount: 0,
          shippingVoucherFunding: 0,
        };
      }

      const row = chartDataMap[key];

      row.count += 1;
      row.customerPaid += customerPaid;
      row.customerPaidBeforeVoucher +=
        customerPaid + voucherInfo.totalDiscount;
      row.originalGMV += originalGross;
      row.gmv += saleGross;
      row.codAmount += codAmount;
      row.bankAmount += bankAmount;
      row.subTotalCostPrice += costPriceTotal;
      row.subTotalPrice += saleGross;
      row.merchantOriginalGross += originalGross;
      row.merchantSaleGross += saleGross;
      row.merchantCommissionRevenue += merchantCommission;
      row.merchantNet += merchantNet;
      row.shippingBaseFee += baseShippingFee;
      row.shippingCollected += baseShippingFee;
      row.shippingPaidByCustomer += shippingPaidByCustomer;
      row.shippingVoucherDiscount += shippingVoucherDiscount;
      row.shippingRetained += shippingRetained;
      row.shippingEarning += shipperShippingAmount;
      row.shippingCommission += shipperShippingCommission;
      row.orderCommissionBase += shipperOrderCommissionBase;
      row.shipperOrderCommissionBase += shipperOrderCommissionBase;
      row.orderCommission += shipperOrderCommission;
      row.shipperOrderCommission += shipperOrderCommission;
      row.shipperTotalEarning += shipperTotalEarning;
      row.platformTotalRevenue += platformRevenue;
      row.platformNetRevenue += platformNetRevenue;
      row.platformFundedVoucher += platformFundedVoucher;
      row.platformNetAfterVoucher += platformNetRevenue;

      if (voucherInfo.hasVoucher) row.voucherOrders += 1;
      row.voucherDiscount += voucherInfo.totalDiscount;
      row.orderVoucherDiscount += voucherInfo.orderDiscount;
      row.voucherShippingDiscount += shippingVoucherDiscount;
      row.shippingVoucherFunding += platformFundedVoucher;

      if (type === "SHIPPER") {
        row.gross += shipperOrderCommissionBase;
        row.platformCut += shipperOrderCommission;
        row.net += shipperTotalEarning;
      } else {
        row.gross += saleGross;
        row.platformCut += merchantCommission;
        row.net += platformNetRevenue;
      }
    }

    const chartData = Object.values(chartDataMap);

    /* =====================================================
       SUMMARY
    ===================================================== */

    const summary = {
      totalCustomerPaid,
      totalCustomerPaidBeforeVoucher,
      totalGMV,
      totalOriginalGMV,
      totalCodGMV,
      totalBankGMV,

      totalMerchantOriginalGross,
      totalMerchantSaleGross,
      totalMerchantCommissionRevenue,
      totalMerchantNet,

      /* Phí ship */
      totalShippingBaseFee,
      totalShippingCollected: totalShippingBaseFee,
      totalShippingPaidByCustomer,
      totalShippingVoucherDiscount,
      totalShippingRetained,
      totalShippingRevenue: totalShippingRetained,

      /* Shipper */
      totalShipperOrderCommissionBase,
      totalShipperOrderCommission,
      totalShipperShippingAmount,
      totalShipperShippingCommission,
      totalShipperTotalEarning,
      totalShipperEarning: totalShipperTotalEarning,

      /* Voucher */
      totalVoucherOrders,
      totalVoucherUsage: totalVoucherOrders,
      voucherUniqueCount: Object.keys(voucherUsageMap).length,
      totalVoucherDiscount,
      totalOrderVoucherDiscount,
      totalPlatformFundedVoucher,

      /* Sàn */
      totalPlatformRevenue,
      totalPlatformNetRevenue,
      platformNetAfterVoucher: totalPlatformNetRevenue,
      netTotalRevenue: totalPlatformNetRevenue,

      /* Legacy */
      totalGrossRevenue,
      totalPlatformCut,
      totalNetRevenue,
      totalSubTotalCostPrice,
      totalSubTotalPrice,

      /* Data quality */
      originalGrossLegacyOrderCount,
      missingOriginalGrossOrderCount,

      /* Config */
      appliedCommissionPercent:
        type === "SHIPPER"
          ? shipperOrderCommissionPercent
          : platformFeePercent,
      appliedOrderCommissionPercent:
        shipperOrderCommissionPercent,
      appliedShippingPercent:
        shipperShippingCommissionPercent,
      shippingRetainedPercent, // fallback legacy
      shipperShippingCommissionPercent,
      shippingShareMode: "DISTANCE_TIER",
      shippingDistanceRules: SHIPPING_DISTANCE_RULES.map((rule) => ({
        label: rule.label,
        maxKm: Number.isFinite(rule.maxKm) ? rule.maxKm : null,
        shipperPercent: rule.shipperPercent,
        platformPercent: rule.platformPercent,
      })),

      totalOrders,
    };

    return NextResponse.json({
      success: true,
      data: {
        config: {
          platformFeePercent,
          shippingFeePercent,
          shipperOrderCommissionPercent,
          shippingRetainedPercent, // chỉ fallback cho đơn thiếu khoảng cách
          shipperShippingCommissionPercent,
          shippingShareMode: "DISTANCE_TIER",
          shippingDistanceRules: SHIPPING_DISTANCE_RULES.map((rule) => ({
            label: rule.label,
            maxKm: Number.isFinite(rule.maxKm) ? rule.maxKm : null,
            shipperPercent: rule.shipperPercent,
            platformPercent: rule.platformPercent,
          })),
        },
        summary,
        chartData,
        voucherUsage: Object.values(voucherUsageMap).sort(
          (a, b) => b.usageCount - a.usageCount
        ),
      },
    });
  } catch (error: any) {
    console.error("Lỗi Revenue API:", error);

    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Lỗi Revenue API",
      },
      { status: 500 }
    );
  }
}

/* =========================================================
   POST - COMMISSION CONFIG
========================================================= */

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      platformFeePercent,
      shippingFeePercent,
      shipperOrderCommissionPercent,
      shipperShippingCommissionPercent,
      shippingRetainedPercent,
      orderCommissionPercent,
    } = body;

    const updateData: Record<string, unknown> = {};

    if (platformFeePercent !== undefined) {
      updateData.platformFeePercent = clamp(
        num(platformFeePercent),
        0,
        100
      );
    }

    if (shippingFeePercent !== undefined) {
      updateData.shippingFeePercent = clamp(
        num(shippingFeePercent),
        0,
        100
      );
    }

    const finalOrderCommissionPercent =
      shipperOrderCommissionPercent ??
      orderCommissionPercent;

    if (finalOrderCommissionPercent !== undefined) {
      updateData.shipperOrderCommissionPercent = clamp(
        num(finalOrderCommissionPercent),
        0,
        100
      );
    }

    if (shippingRetainedPercent !== undefined) {
      updateData.shippingRetainedPercent = clamp(
        num(shippingRetainedPercent),
        0,
        100
      );
    }

    if (shipperShippingCommissionPercent !== undefined) {
      updateData.shipperShippingCommissionPercent = clamp(
        num(shipperShippingCommissionPercent),
        0,
        100
      );
    }

    updateData.updatedAt = new Date();

    await adminDb
      .collection("settings")
      .doc("commission")
      .set(updateData, { merge: true });

    return NextResponse.json({
      success: true,
      message: "Đã cập nhật cấu hình doanh thu!",
    });
  } catch (error: any) {
    console.error("Lỗi cập nhật commission:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Không thể cập nhật cấu hình",
      },
      { status: 500 }
    );
  }
}
