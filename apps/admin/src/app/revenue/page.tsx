"use client";

import {
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";

import type {
  ReactNode,
  ComponentType,
} from "react";

import { db } from "@cho-online/firebase";

import {
  collection,
  getDocs,
} from "firebase/firestore";

/* =========================================================
   ICONS
========================================================= */

const Icon = ({
  children,
  className = "w-4 h-4",
}: {
  children: ReactNode;
  className?: string;
}) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const TrendingUp = ({
  className,
}: {
  className?: string;
}) => (
  <Icon className={className}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 17l6-6 4 4 8-9"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 6h6v6"
    />
  </Icon>
);

const Store = ({
  className,
}: {
  className?: string;
}) => (
  <Icon className={className}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 10h18M5 10v10h14V10M4 10l2-6h12l2 6M9 20v-6h6v6"
    />
  </Icon>
);

const Bike = ({
  className,
}: {
  className?: string;
}) => (
  <Icon className={className}>
    <circle
      cx="6"
      cy="17"
      r="3"
      strokeWidth={2}
    />
    <circle
      cx="18"
      cy="17"
      r="3"
      strokeWidth={2}
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6 17l4-8h4l4 8M10 9l-2-3M10 9h5"
    />
  </Icon>
);

const Wallet = ({
  className,
}: {
  className?: string;
}) => (
  <Icon className={className}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 7h15a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h12"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M16 13h4"
    />
  </Icon>
);

const Receipt = ({
  className,
}: {
  className?: string;
}) => (
  <Icon className={className}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 8h6M9 12h6M9 16h3"
    />
  </Icon>
);

const Refresh = ({
  className,
}: {
  className?: string;
}) => (
  <Icon className={className}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M20 11a8 8 0 00-15-3M4 5v4h4M4 13a8 8 0 0015 3m1 3v-4h-4"
    />
  </Icon>
);

const ChevronRight = ({
  className,
}: {
  className?: string;
}) => (
  <Icon className={className}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 5l7 7-7 7"
    />
  </Icon>
);

const ChevronDown = ({
  className,
}: {
  className?: string;
}) => (
  <Icon className={className}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6 9l6 6 6-6"
    />
  </Icon>
);

const ChevronUp = ({
  className,
}: {
  className?: string;
}) => (
  <Icon className={className}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M18 15l-6-6-6 6"
    />
  </Icon>
);

const X = ({
  className,
}: {
  className?: string;
}) => (
  <Icon className={className}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6 18L18 6M6 6l12 12"
    />
  </Icon>
);

const Settings = ({
  className,
}: {
  className?: string;
}) => (
  <Icon className={className}>
    <circle
      cx="12"
      cy="12"
      r="3"
      strokeWidth={2}
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.6v.2h-2.5V20a1.7 1.7 0 00-1-1.6 1.7 1.7 0 00-1.9.3l-.1.1-1.8-1.8.1-.1A1.7 1.7 0 008 15a1.7 1.7 0 00-1.6-1H6v-2.5h.2a1.7 1.7 0 001.6-1 1.7 1.7 0 00-.3-1.9l-.1-.1 1.8-1.8.1.1a1.7 1.7 0 001.9.3 1.7 1.7 0 001-1.6V5h2.5v.2a1.7 1.7 0 001 1.6 1.7 1.7 0 001.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 00-.3 1.9 1.7 1.7 0 001.6 1h.2V14h-.2a1.7 1.7 0 00-1.6 1z"
    />
  </Icon>
);

const AlertTriangle = ({
  className,
}: {
  className?: string;
}) => (
  <Icon className={className}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 9v4m0 4h.01M10.3 3.8L2.7 17a2 2 0 001.7 3h15.2a2 2 0 001.7-3L13.7 3.8a2 2 0 00-3.4 0z"
    />
  </Icon>
);

/* =========================================================
   HELPERS
========================================================= */

const num = (
  value: unknown
): number => {
  const n = Number(value);

  return Number.isFinite(n)
    ? n
    : 0;
};

const money = (
  value: unknown
): string =>
  `${Math.round(
    num(value)
  ).toLocaleString(
    "vi-VN"
  )}đ`;

const pct = (
  value: unknown
): string =>
  `${num(
    value
  ).toLocaleString(
    "vi-VN"
  )} %`;

const clampPercent = (
  value: unknown
): number =>
  Math.max(
    0,
    Math.min(
      100,
      num(value)
    )
  );

/* =========================================================
   SHIPPING SHARE BY DISTANCE
========================================================= */

const SHIPPING_DISTANCE_RULES = [
  {
    label: "≤ 2 km",
    maxKm: 2,
    shipperPercent: 40,
    platformPercent: 60,
  },
  {
    label: "2–4 km",
    maxKm: 4,
    shipperPercent: 45,
    platformPercent: 55,
  },
  {
    label: "4–6 km",
    maxKm: 6,
    shipperPercent: 50,
    platformPercent: 50,
  },
  {
    label: "6–8 km",
    maxKm: 8,
    shipperPercent: 60,
    platformPercent: 40,
  },
  {
    label: "> 8 km",
    maxKm: Number.POSITIVE_INFINITY,
    shipperPercent: 65,
    platformPercent: 35,
  },
] as const;

function getShippingShareByDistance(
  distanceValue: unknown,
  fallbackPlatformPercent = 60
) {
  const parsedDistance = Number(
    distanceValue
  );

  /*
   * Đơn legacy thiếu distanceKm: giữ cấu hình cũ làm fallback.
   * Đơn có khoảng cách luôn dùng bảng tỷ lệ phía trên.
   */
  if (
    !Number.isFinite(
      parsedDistance
    ) ||
    parsedDistance < 0
  ) {
    const platformPercent =
      clampPercent(
        fallbackPlatformPercent
      );

    return {
      distanceKm: 0,
      shipperPercent:
        Math.max(
          0,
          100 -
            platformPercent
        ),
      platformPercent,
      tierLabel:
        "Thiếu khoảng cách (fallback)",
      isFallback: true,
    };
  }

  const distanceKm =
    Math.max(
      0,
      parsedDistance
    );

  const rule =
    SHIPPING_DISTANCE_RULES.find(
      (item) =>
        distanceKm <=
        item.maxKm
    ) ??
    SHIPPING_DISTANCE_RULES[
      SHIPPING_DISTANCE_RULES.length -
        1
    ];

  return {
    distanceKm,
    shipperPercent:
      rule.shipperPercent,
    platformPercent:
      rule.platformPercent,
    tierLabel: rule.label,
    isFallback: false,
  };
}

const averageMoney = (
  total: unknown,
  count: unknown
): number => {
  const totalValue =
    num(total);

  const countValue =
    num(count);

  if (
    countValue <= 0
  ) {
    return 0;
  }

  return Math.round(
    totalValue /
      countValue
  );
};

const isCod = (
  method?: string
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
      value.seconds !==
      undefined
    ) {
      return new Date(
        num(
          value.seconds
        ) * 1000
      );
    }

    if (
      value._seconds !==
      undefined
    ) {
      return new Date(
        num(
          value._seconds
        ) * 1000
      );
    }

    const date =
      new Date(value);

    return Number.isNaN(
      date.getTime()
    )
      ? new Date()
      : date;
  } catch {
    return new Date();
  }
};

const formatDateTime = (
  value: any
): string => {
  const date =
    parseDate(value);

  return date.toLocaleString(
    "vi-VN",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
};

/* =========================================================
   ORIGINAL PRICE
========================================================= */

function getItemOriginalPrice(
  item: any
): number {
  const candidates = [
    item?.originalPrice,
    item?.originalUnitPrice,
    item?.listPrice,
    item?.regularPrice,
  ];

  for (
    const candidate of
      candidates
  ) {
    const price =
      num(candidate);

    if (
      price > 0
    ) {
      return price;
    }
  }

  return 0;
}

function getOrderOriginalGross(
  order: any
): {
  amount: number;
  source:
    | "ITEM_ORIGINAL_PRICE"
    | "ORDER_ORIGINAL_PRICE"
    | "FINANCIAL_SNAPSHOT"
    | "LEGACY_SUBTOTAL_COST_PRICE"
    | "LEGACY_ITEM_COST_PRICE"
    | "NONE";
} {
  /* -------------------------------------------------------
     ITEMS
  ------------------------------------------------------- */

  if (
    Array.isArray(
      order?.items
    )
  ) {
    let total = 0;
    let found =
      false;

    for (
      const item of
        order.items
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
        amount:
          total,
        source:
          "ITEM_ORIGINAL_PRICE",
      };
    }
  }

  /* -------------------------------------------------------
     ORDER LEVEL
  ------------------------------------------------------- */

  const orderCandidates = [
    order?.originalSubTotalPrice,
    order?.subtotalBeforeDiscount,
    order?.grossBeforeDiscount,
    order?.originalGMV,
    order?.originalTotalPrice,
  ];

  for (
    const candidate of
      orderCandidates
  ) {
    const amount =
      num(candidate);

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
     FINANCIAL
  ------------------------------------------------------- */

  const financialOriginalGross =
    num(
      order?.financial
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
     LEGACY
  ------------------------------------------------------- */

  const legacySubTotal =
    num(
      order?.subTotalCostPrice ??
        order?.costPriceTotal
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

  if (
    Array.isArray(
      order?.items
    )
  ) {
    let total = 0;

    for (
      const item of
        order.items
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
}

/* =========================================================
   SALE GROSS
========================================================= */

function getOrderSaleGross(
  order: any
): number {
  const direct =
    num(
      order?.subTotalPrice
    );

  if (
    direct > 0
  ) {
    return direct;
  }

  if (
    Array.isArray(
      order?.items
    )
  ) {
    let total = 0;

    for (
      const item of
        order.items
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

  const totalPrice =
    num(
      order?.finalTotal ??
        order?.finalPrice ??
        order?.paidTotal ??
        order?.totalPrice
    );

  const shippingFee =
    num(
      order?.shippingFee ??
        order?.shipFee ??
        order?.deliveryFee
    );

  const shippingVoucher =
    num(
      order?.shippingVoucherDiscount
    );

  if (
    totalPrice > 0
  ) {
    return Math.max(
      0,
      totalPrice -
        shippingFee +
        shippingVoucher
    );
  }

  return 0;
}

/* =========================================================
   VOUCHER
========================================================= */

function getOrderVoucherInfo(
  order: any
) {
  const voucher =
    order?.voucher ??
    order?.appliedVoucher ??
    order?.voucherInfo ??
    {};

  const code =
    String(
      order?.voucherCode ??
        order?.appliedVoucherCode ??
        order?.shippingVoucherCode ??
        order?.appliedShippingVoucherCode ??
        order?.voucherCampaignCode ??
        voucher?.code ??
        voucher?.voucherCode ??
        voucher?.shippingVoucherCode ??
        voucher?.campaignCode ??
        ""
    ).trim();

  const voucherId =
    String(
      order?.voucherId ??
        order?.appliedVoucherId ??
        voucher?.id ??
        ""
    ).trim();

  let orderDiscount =
    num(
      order?.orderVoucherDiscount ??
        order?.voucherOrderDiscount ??
        order?.productVoucherDiscount ??
        order?.voucherDiscountOrder ??
        voucher?.orderDiscount ??
        voucher?.productDiscount ??
        voucher?.discountAmount
    );

  let shippingDiscount =
    num(
      order?.shippingVoucherDiscount ??
        order?.voucherShippingDiscount ??
        order?.shippingDiscount ??
        order?.voucherDiscountShipping ??
        voucher?.shippingDiscount ??
        voucher?.shippingDiscountAmount
    );

  const singleDiscount =
    num(
      order?.voucherDiscount
    );

  const applyType =
    String(
      order?.voucherApplyType ??
        order?.applyType ??
        voucher?.applyType ??
        voucher?.type ??
        ""
    )
      .toUpperCase()
      .trim();

  if (
    singleDiscount > 0 &&
    orderDiscount <= 0 &&
    shippingDiscount <= 0
  ) {
    if (
      applyType ===
        "SHIPPING" ||
      applyType === "SHIP"
    ) {
      shippingDiscount =
        singleDiscount;
    } else {
      orderDiscount =
        singleDiscount;
    }
  }

  orderDiscount =
    Math.max(
      0,
      orderDiscount
    );

  shippingDiscount =
    Math.max(
      0,
      shippingDiscount
    );

  /*
   * Legacy order: vẫn có voucherDiscount/shippingVoucherDiscount
   * nhưng không lưu code. Không được hiển thị KHÔNG CÓ MÃ.
   * Nếu xác định đây là voucher ship, dùng nhãn legacy rõ ràng.
   */
  const normalizedCode =
    code ||
    (shippingDiscount > 0
      ? "VOUCHER GIẢM PHÍ SHIP"
      : orderDiscount > 0
        ? "VOUCHER GIẢM TIỀN HÀNG"
        : "");

  const fundingType =
    String(
      order?.voucherFundingType ??
        order?.fundingType ??
        voucher?.fundingType ??
        ""
    )
      .toUpperCase()
      .trim();

  const platformFundingPercent =
    clampPercent(
      order?.platformFundingPercent ??
        voucher?.platformFundingPercent ??
        0
    );

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
            (shippingDiscount * percent) /
              100
          )
        )
      );
    } else if (
      fundingType !== "MERCHANT" &&
      platformFundingPercent > 0
    ) {
      platformFundedShippingDiscount = Math.min(
        shippingDiscount,
        Math.max(
          0,
          Math.round(
            (shippingDiscount *
              platformFundingPercent) /
              100
          )
        )
      );
    }
  }

  return {
    code: normalizedCode,
    voucherId,

    hasVoucher:
      Boolean(
        normalizedCode ||
          voucherId ||
          orderDiscount +
            shippingDiscount >
            0
      ),

    orderDiscount,
    shippingDiscount,

    totalDiscount:
      orderDiscount +
      shippingDiscount,

    fundingType,
    platformFundingPercent,
    platformFundedShippingDiscount,
  };
}

/* =========================================================
   TYPES
========================================================= */

interface MerchantConfig {
  id: string;
  merchantCode?: string;
  shopName?: string;
  storeName?: string;
  commissionPercent?: number;
}

interface FinancialMerchant {
  commissionPercent?: number;
  commissionBase?: number;
  commissionAmount?: number;
  originalGross?: number;
  productAmountBeforeCommission?: number;
  productAmountAfterDiscount?: number;
  netAmount?: number;
}

interface FinancialShipper {
  orderCommissionPercent?: number;
  orderCommissionBase?: number;
  orderCommissionAmount?: number;
  shippingPercent?: number;
  shippingBase?: number;
  shippingAmount?: number;
  shippingCommissionPercent?: number;
  shippingCommissionAmount?: number;
  totalEarning?: number;
}

interface FinancialPlatform {
  merchantCommissionRevenue?: number;
  shippingCollected?: number;
  shippingToShipper?: number;
  shippingRetained?: number;
  totalRevenue?: number;
}

interface FinancialSnapshot {
  version?: number;
  capturedAt?: string;
  merchant?: FinancialMerchant;
  shipper?: FinancialShipper;
  platform?: FinancialPlatform;
}

interface OrderItem {
  id?: string;
  name?: string;
  imageUrl?: string;

  originalPrice?: number;
  originalUnitPrice?: number;
  listPrice?: number;
  regularPrice?: number;

  price?: number;
  costPrice?: number;

  quantity?: number;

  merchantId?: string;
  merchantCode?: string;
}

interface OrderData {
  id?: string;

  paymentCode?: string;
  paymentMethod?: string;

  customerName?: string;
  recipientName?: string;

  customerAddress?: string;
  address?: string;

  shopName?: string;
  storeName?: string;
  storeAddress?: string;

  merchantId?: string;
  merchantCode?: string;

  shipperId?: string;
  shipperName?: string;
  shipperNote?: string;

  status?: string;

  originalSubTotalPrice?: number;
  subtotalBeforeDiscount?: number;
  grossBeforeDiscount?: number;
  originalGMV?: number;
  originalTotalPrice?: number;

  subTotalPrice?: number;
  subTotalCostPrice?: number;
  costPriceTotal?: number;

  shippingFee?: number;
  /** Phí ship GỐC trước khi áp mã giảm phí ship. */
  shippingFeeBeforeVoucher?: number;
  shippingFeeBeforeDiscount?: number;
  shippingFeeOriginal?: number;
  baseShippingFee?: number;
  appliedFee?: number;
  peakHourFee?: number;
  rainFee?: number;

  distanceKm?: number;
  distanceStr?: string;

  totalPrice?: number;
  finalTotal?: number;
  finalPrice?: number;
  paidTotal?: number;

  shopVoucherCode?: string | null;
  shopVoucherDiscount?: number;

  voucherCode?: string;
  voucherId?: string;
  voucherDiscount?: number;
  orderVoucherDiscount?: number;
  shippingVoucherDiscount?: number;

  financial?: FinancialSnapshot;

  items?: OrderItem[];

  merchantCommissionPercent?: number;
  merchantCommissionAmount?: number;

  shipperOrderCommissionPercent?: number;
  shipperOrderCommissionBase?: number;
  shipperOrderCommission?: number;

  shippingRetained?: number;
  shippingCut?: number;
  shippingNet?: number;

  createdAt?: any;
}

interface VoucherUsageRow {
  voucherId?: string;
  voucherCode?: string;
  usageCount?: number;
  totalDiscount?: number;
  orderDiscount?: number;
  shippingDiscount?: number;
}

/* =========================================================
   FINANCE CONFIG
========================================================= */

interface FinanceConfig {
  platformFeePercent: number;
  shipperOrderCommissionPercent: number;
  shippingRetainedPercent: number;
  shipperShippingCommissionPercent: number;
}

/* =========================================================
   SHIPPING BEFORE VOUCHER
========================================================= */

function getShippingFeeBeforeVoucher(
  order: OrderData
): number {
  /*
   * =======================================================
   * SOURCE OF TRUTH: PHÍ SHIP TRƯỚC VOUCHER
   * =======================================================
   *
   * Ưu tiên field lưu TOÀN BỘ phí ship trước voucher.
   */
  const directCandidates = [
    order.shippingFeeBeforeVoucher,
    order.shippingFeeBeforeDiscount,
    order.shippingFeeOriginal,
    (order as any).initialShippingFee,
    (order as any).totalShippingBeforeVoucher,
    (order as any).preVoucherShippingFee,
    (order as any).originalShippingFee,
    (order as any).financial?.shipper?.shippingFeeBeforeVoucher,
    (order as any).financial?.platform?.shippingCollectedBeforeVoucher,
    (order as any).financial?.platform?.shippingFeeBeforeVoucher,
  ];

  for (const candidate of directCandidates) {
    const value = num(candidate);

    if (value > 0) {
      return value;
    }
  }

  /*
   * =======================================================
   * CHECKOUT SCHEMA HIỆN TẠI
   * =======================================================
   *
   * Checkout lưu:
   *   baseShippingFee = phí cơ bản theo khoảng cách
   *   appliedFee      = rainFee + peakHourFee
   *   shippingFee     = phí sau voucher
   *
   * Vì vậy phí ship TRƯỚC voucher là:
   *
   *   baseShippingFee + appliedFee
   *
   * Đây là phần trước voucher dùng cho HH Shipper/Sàn.
   */
  const checkoutBaseShippingFee = num(
    order.baseShippingFee
  );

  const checkoutAppliedFee = num(
    order.appliedFee
  );

  const checkoutPeakHourFee = num(
    order.peakHourFee
  );

  const checkoutRainFee = num(
    order.rainFee
  );

  if (checkoutBaseShippingFee > 0) {
    const surcharge =
      checkoutAppliedFee > 0
        ? checkoutAppliedFee
        : checkoutPeakHourFee +
          checkoutRainFee;

    return (
      checkoutBaseShippingFee +
      Math.max(0, surcharge)
    );
  }

  /*
   * Legacy record có thể chỉ còn các thành phần trước voucher.
   */
  const legacyComponentShipping =
    num((order as any).shippingBaseAmount) +
    num(order.appliedFee);

  if (legacyComponentShipping > 0) {
    return legacyComponentShipping;
  }

  /*
   * Legacy KHÔNG có voucher:
   * shippingFee chính là phí gốc.
   *
   * Có voucher mà mất phí gốc => không đoán từ shippingFee sau voucher.
   */
  const shippingFee = Math.max(
    0,
    num(
      order.shippingFee ??
        (order as any).shipFee ??
        (order as any).deliveryFee
    )
  );

  const shippingVoucherDiscount =
    getOrderVoucherInfo(order).shippingDiscount;

  if (
    shippingFee > 0 &&
    shippingVoucherDiscount <= 0
  ) {
    return shippingFee;
  }

  return 0;
}

/* =========================================================
   SHIPPER ORDER COMMISSION BASE
========================================================= */

function getItemSaleGross(
  order: OrderData
): number {
  if (!Array.isArray(order?.items)) return 0;

  let total = 0;

  for (const item of order.items) {
    const price = num(item?.price);
    const quantity = Math.max(
      1,
      num(item?.quantity ?? 1)
    );

    if (price > 0) {
      total += price * quantity;
    }
  }

  return total;
}

function getShipperOrderCommissionBase(
  order: OrderData,
  originalGross: number,
  saleGross: number
): number {
  /*
   * SOURCE OF TRUTH CHO HH SHIPPER TRÊN GIÁ ĐƠN:
   * luôn ưu tiên GIÁ TRỊ ĐƠN GỐC hiện tại.
   *
   * Không dùng lại snapshot:
   *   financial.shipper.orderCommissionBase
   *   shipperOrderCommissionBase
   *
   * vì snapshot cũ có thể thuộc công thức legacy và làm cùng một %
   * nhưng mỗi đơn lại có một cơ sở tính khác nhau.
   */
  if (originalGross > 0) {
    return Math.max(0, originalGross);
  }

  const canonicalCandidates = [
    order.originalSubTotalPrice,
    order.subtotalBeforeDiscount,
    order.grossBeforeDiscount,
    order.originalGMV,
    order.originalTotalPrice,
    order.subTotalPrice,
    getItemSaleGross(order),
    saleGross,
  ]
    .map(num)
    .filter((value) => value > 0);

  return Math.max(
    0,
    canonicalCandidates[0] ?? saleGross
  );
}

/* =========================================================
   ORDER FINANCE RESOLVER
========================================================= */

function resolveFinance(
  order: OrderData,
  merchantConfigs: Record<
    string,
    MerchantConfig
  >,
  config: FinanceConfig
) {
  const financial =
    order.financial;

  const merchant =
    financial?.merchant;

  const shipper =
    financial?.shipper;

  /* -------------------------------------------------------
     ORIGINAL
  ------------------------------------------------------- */

  const originalResult =
    getOrderOriginalGross(
      order
    );

  const originalGross =
    originalResult.amount;

  /* -------------------------------------------------------
     SALE
  ------------------------------------------------------- */

  const saleGross =
    getOrderSaleGross(
      order
    );

  /* -------------------------------------------------------
     MERCHANT CONFIG
  ------------------------------------------------------- */

  const merchantKeys = [
    order.merchantId,
    order.merchantCode,
  ]
    .map(
      (value) =>
        String(
          value ?? ""
        ).trim()
    )
    .filter(Boolean);

  const merchantConfig =
    merchantKeys
      .map(
        (key) =>
          merchantConfigs[
            key
          ]
      )
      .find(Boolean);

  const merchantPercent =
    clampPercent(
      merchant?.commissionPercent ??
        order.merchantCommissionPercent ??
        merchantConfig?.commissionPercent ??
        config.platformFeePercent
    );

  /*
   * LUÔN TÍNH CK QUÁN TRÊN GIÁ GỐC.
   *
   * Không dùng saleGross.
   */
  const merchantCommission =
    originalGross > 0
      ? Math.round(
          (originalGross *
            merchantPercent) /
            100
        )
      : 0;

  const merchantNet = Math.max(
    0,
    saleGross -
      merchantCommission
  );

  /* -------------------------------------------------------
     SHIPPING
  ------------------------------------------------------- */

  /*
   * QUAN TRỌNG:
   *
   * Phí ship dùng để tính % Shipper phải là PHÍ SHIP GỐC,
   * trước khi áp mã giảm phí vận chuyển.
   *
   * Ví dụ:
   *   Phí ship gốc       = 30.000đ
   *   Voucher giảm ship  = 30.000đ
   *   Khách thực trả     = 0đ
   *
   * Shipper vẫn được tính % trên 30.000đ.
   */
  const shippingFeeBeforeVoucher =
    getShippingFeeBeforeVoucher(
      order
    );

  const voucherInfo =
    getOrderVoucherInfo(order);

  const shippingVoucherDiscount =
    voucherInfo.shippingDiscount;

  /*
   * Nếu shippingFee tồn tại trong order thì đây là số khách thực trả.
   * Không lấy nó làm cơ sở tính tiền Shipper.
   */
  const rawCustomerShippingFee =
    num(order.shippingFee);

  const hasCustomerShippingFee =
    order.shippingFee !== undefined &&
    order.shippingFee !== null;

  const shippingPaidByCustomer =
    hasCustomerShippingFee
      ? Math.min(
          shippingFeeBeforeVoucher,
          Math.max(
            0,
            rawCustomerShippingFee
          )
        )
      : Math.max(
          0,
          shippingFeeBeforeVoucher -
            shippingVoucherDiscount
        );

  /*
   * GIỮ NGUYÊN PHÍ SHIP GỐC CHO SHIPPER.
   *
   * shippingCollected = phí ship gốc trước voucher.
   * shippingPaidByCustomer = phí ship khách thực trả sau voucher.
   */
  const shippingCollected =
    shippingFeeBeforeVoucher;

  /*
   * TỶ LỆ PHÍ SHIP THEO KHOẢNG CÁCH:
   *
   * ≤ 2 km : Shipper 40% / Sàn 60%
   * 2–4 km : Shipper 45% / Sàn 55%
   * 4–6 km : Shipper 50% / Sàn 50%
   * 6–8 km : Shipper 60% / Sàn 40%
   * > 8 km : Shipper 65% / Sàn 35%
   *
   * Voucher KHÔNG làm thay đổi base này.
   */
  const shippingShare =
    getShippingShareByDistance(
      order.distanceKm ??
        (order as any).distance,
      config.shippingRetainedPercent
    );

  const shipperBasePercent =
    shippingShare.shipperPercent;

  const baseShipperShipping =
    Math.round(
      (shippingFeeBeforeVoucher *
        shipperBasePercent) /
        100
    );

  /*
   * HH/THƯỞNG thêm cho Shipper trên PHÍ SHIP GỐC trước voucher.
   *
   * Ví dụ phí ship gốc 10.000đ, thưởng 2% => 200đ.
   * Không tính 2% trên phần 70% mà Shipper đã được hưởng,
   * vì như vậy "2% phí ship" thực tế chỉ còn 1,4% phí ship gốc.
   */
  const shippingCommission =
    Math.round(
      (shippingFeeBeforeVoucher *
        clampPercent(
          config.shipperShippingCommissionPercent
        )) /
        100
    );

  const shipperShippingAmount =
    baseShipperShipping +
    shippingCommission;

  /*
   * Sàn giữ phần phí ship cơ bản.
   * Không cộng HH thêm 2% vào khoản này vì HH thêm là chi phí Sàn.
   */
  const platformShippingRetained =
    Math.max(
      0,
      shippingFeeBeforeVoucher -
        baseShipperShipping
    );

  /* -------------------------------------------------------
     SHIPPER ORDER COMMISSION
  ------------------------------------------------------- */

  /*
   * HH trên giá đơn phải tính theo GIÁ TRỊ ĐƠN GỐC.
   * Không dùng financial.shipper.orderCommissionBase cũ nếu nó
   * lớn hơn giá trị đơn thực tế (đây là nguyên nhân ví dụ
   * 201.600 x 5% = 10.080đ).
   */
  const shipperOrderBase =
    getShipperOrderCommissionBase(
      order,
      originalGross,
      saleGross
    );

  const shipperOrderCommission =
    Math.round(
      (shipperOrderBase *
        config.shipperOrderCommissionPercent) /
        100
    );

  /* -------------------------------------------------------
     SHIPPER TOTAL
  ------------------------------------------------------- */

  const shipperTotal =
    shipperOrderCommission +
    shipperShippingAmount;

  /* -------------------------------------------------------
     PLATFORM
  ------------------------------------------------------- */

  const platformRevenue =
    merchantCommission +
    platformShippingRetained;

  /*
   * Voucher Sàn tài trợ vẫn được lưu riêng để báo cáo chi phí marketing.
   *
   * LƯU Ý: customerPaid đã là số tiền khách THỰC TRẢ sau voucher,
   * nên KHÔNG trừ platformFundedVoucher lần thứ hai khi tính cashflow.
   */
  const platformFundedVoucher =
    num(
      voucherInfo.platformFundedShippingDiscount
    );

  const rawCustomerPaid =
    num(
      order.finalTotal ??
        order.finalPrice ??
        order.paidTotal ??
        order.totalPrice
    );

  const customerPaid =
    rawCustomerPaid > 0
      ? rawCustomerPaid
      : Math.max(
          0,
          saleGross +
            shippingPaidByCustomer
        );

  const platformNet =
    customerPaid -
    merchantNet -
    shipperTotal;

  return {
    originalGross,

    originalGrossSource:
      originalResult.source,

    saleGross,

    merchantPercent,

    merchantCommission,

    merchantNet,

    shippingCollected,

    shippingFeeBeforeVoucher,

    shippingVoucherDiscount,

    shippingPaidByCustomer,

    baseShipperShipping,

    shipperShippingPercent:
      shippingShare.shipperPercent,

    platformShippingPercent:
      shippingShare.platformPercent,

    shippingDistanceTier:
      shippingShare.tierLabel,

    shippingDistanceKm:
      shippingShare.distanceKm,

    shippingShareFallback:
      shippingShare.isFallback,

    shippingCommission,

    shipperShippingAmount,

    shipperOrderBase,

    shipperOrderCommission,

    shipperTotal,

    platformShippingRetained,

    platformRevenue,

    platformFundedVoucher,

    customerPaid,

    platformNet,
  };
}

/* =========================================================
   KPI CARD
========================================================= */

function KpiCard({
  title,
  value,
  description,
  icon,
  valueClass = "text-white",
  large = false,
}: {
  title: string;
  value: string;
  description?: string;
  icon?: ReactNode;
  valueClass?: string;
  large?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-800 bg-slate-900/70 p-5 ${
        large
          ? "ring-1 ring-indigo-500/20"
          : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">

        <div className="min-w-0">

          <div className="text-[10px] font-bold tracking-wide text-slate-500">
            {title}
          </div>

          <div
            className={`mt-2 font-black tracking-tight ${
              large
                ? "text-3xl"
                : "text-2xl"
            } ${valueClass}`}
          >
            {value}
          </div>

          {description && (
            <div className="mt-2 text-[10px] leading-relaxed text-slate-500">
              {description}
            </div>
          )}

        </div>

        {icon && (
          <div className="shrink-0 rounded-xl bg-slate-800 p-2.5 text-slate-400">
            {icon}
          </div>
        )}

      </div>
    </div>
  );
}

/* =========================================================
   MONEY FLOW
========================================================= */

function MoneyFlow({
  orders,
  customerPaid,
  merchantNet,
  shipperTotal,
  platformRevenue,
  platformNet,
  merchantCommission,
  shippingCollected,
  shippingToShipper,
  shippingRetained,
  shipperOrderCommission,
  shipperShippingCommission,
  averagePlatformNet,
  averageShipper,
  merchantOriginalGross,
  merchantSaleGross,
}: {
  orders: number;

  customerPaid: number;

  merchantNet: number;

  shipperTotal: number;

  platformRevenue: number;

  platformNet: number;

  merchantCommission: number;

  shippingCollected: number;

  shippingToShipper: number;

  shippingRetained: number;

  shipperOrderCommission: number;

  shipperShippingCommission: number;

  averagePlatformNet: number;

  averageShipper: number;

  merchantOriginalGross: number;

  merchantSaleGross: number;
}) {
  const shopDiscount =
    Math.max(
      0,
      merchantOriginalGross -
        merchantSaleGross
    );

  return (
    <div className="space-y-4">

      {/* ===================================================
          PRIMARY KPIs
      =================================================== */}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">

        {/* SÀN THỰC */}

        <div className="rounded-2xl border border-indigo-500/25 bg-indigo-500/10 p-5 ring-1 ring-indigo-500/10">

          <div className="flex items-start justify-between gap-3">

            <div>

              <div className="text-[10px] font-black text-indigo-300">
                SÀN NHẬN THỰC
              </div>

              <div
                className={`mt-2 text-3xl font-black ${
                  platformNet >= 0
                    ? "text-indigo-400"
                    : "text-rose-400"
                }`}
              >
                {money(
                  platformNet
                )}
              </div>

              <div className="mt-2 text-[10px] text-slate-500">
                Khách trả − Quán nhận − Shipper nhận − Voucher Sàn tài trợ
              </div>

            </div>

            <div className="rounded-xl bg-indigo-500/10 p-2.5 text-indigo-400">
              <Wallet className="w-5 h-5" />
            </div>

          </div>

        </div>

        {/* TB / ĐƠN */}

        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5">

          <div className="flex items-start justify-between gap-3">

            <div>

              <div className="text-[10px] font-black text-emerald-300">
                SÀN NHẬN THỰC TB / ĐƠN
              </div>

              <div className="mt-2 text-3xl font-black text-emerald-400">
                {money(
                  averagePlatformNet
                )}
              </div>

              <div className="mt-2 text-[10px] text-slate-500">
                {orders.toLocaleString(
                  "vi-VN"
                )}{" "}
                đơn hoàn tất
              </div>

            </div>

            <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-400">
              <Receipt className="w-5 h-5" />
            </div>

          </div>

        </div>

        {/* SHIPPER */}

        <div className="rounded-2xl border border-sky-500/25 bg-sky-500/10 p-5">

          <div className="flex items-start justify-between gap-3">

            <div>

              <div className="text-[10px] font-black text-sky-300">
                SHIPPER NHẬN
              </div>

              <div className="mt-2 text-3xl font-black text-sky-400">
                {money(
                  shipperTotal
                )}
              </div>

              <div className="mt-2 text-[10px] text-slate-500">
                Tổng thu nhập Shipper
              </div>

            </div>

            <div className="rounded-xl bg-sky-500/10 p-2.5 text-sky-400">
              <Bike className="w-5 h-5" />
            </div>

          </div>

        </div>

        {/* SHIPPER TB */}

        <div className="rounded-2xl border border-violet-500/25 bg-violet-500/10 p-5">

          <div className="flex items-start justify-between gap-3">

            <div>

              <div className="text-[10px] font-black text-violet-300">
                SHIPPER NHẬN TB / ĐƠN
              </div>

              <div className="mt-2 text-3xl font-black text-violet-400">
                {money(
                  averageShipper
                )}
              </div>

              <div className="mt-2 text-[10px] text-slate-500">
                HH đơn + phí ship + HH thêm
              </div>

            </div>

            <div className="rounded-xl bg-violet-500/10 p-2.5 text-violet-400">
              <Bike className="w-5 h-5" />
            </div>

          </div>

        </div>

      </div>

      {/* ===================================================
          SECONDARY MONEY FLOW
      =================================================== */}

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 overflow-hidden">

        <div className="p-5 border-b border-slate-800">

          <div className="text-sm font-bold text-white">
            Dòng tiền
          </div>

          <div className="text-[10px] text-slate-500 mt-1">
            Phần này dùng để kiểm tra vì sao Sàn còn lại bao nhiêu.
          </div>

        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">

          {/* CUSTOMER */}

          <div className="p-5 border-b lg:border-b-0 lg:border-r border-slate-800">

            <div className="text-[10px] font-bold text-slate-500">
              KHÁCH THANH TOÁN
            </div>

            <div className="mt-2 text-2xl font-black text-white">
              {money(
                customerPaid
              )}
            </div>

            <div className="mt-4 space-y-1">

              <div className="flex justify-between text-[10px]">

                <span className="text-slate-500">
                  Tiền hàng sau KM
                </span>

                <span className="text-white font-bold">
                  {money(
                    merchantSaleGross
                  )}
                </span>

              </div>

              <div className="flex justify-between text-[10px]">

                <span className="text-slate-500">
                  Phí ship gốc tính HH
                </span>

                <span className="text-sky-400 font-bold">
                  {money(
                    shippingCollected
                  )}
                </span>

              </div>

            </div>

          </div>

          {/* QUÁN */}

          <div className="p-5 border-b lg:border-b-0 lg:border-r border-slate-800">

            <div className="text-[10px] font-bold text-slate-500">
              QUÁN
            </div>

            <div className="mt-2 text-2xl font-black text-emerald-400">
              {money(
                merchantNet
              )}
            </div>

            <div className="mt-4 space-y-1">

              <div className="flex justify-between text-[10px]">

                <span className="text-slate-500">
                  Giá gốc
                </span>

                <span className="text-white font-bold">
                  {money(
                    merchantOriginalGross
                  )}
                </span>

              </div>

              <div className="flex justify-between text-[10px]">

                <span className="text-slate-500">
                  Quán giảm
                </span>

                <span className="text-rose-400 font-bold">
                  -{money(
                    shopDiscount
                  )}
                </span>

              </div>

              <div className="flex justify-between text-[10px]">

                <span className="text-slate-500">
                  CK Sàn
                </span>

                <span className="text-violet-400 font-bold">
                  {money(
                    merchantCommission
                  )}
                </span>

              </div>

            </div>

          </div>

          {/* SÀN */}

          <div className="p-5">

            <div className="text-[10px] font-bold text-slate-500">
              SÀN
            </div>

            <div className="mt-2 text-2xl font-black text-indigo-400">
              {money(
                platformNet
              )}
            </div>

            <div className="mt-4 space-y-1">

              <div className="flex justify-between text-[10px]">

                <span className="text-slate-500">
                  Sàn thu
                </span>

                <span className="text-amber-400 font-bold">
                  {money(
                    platformRevenue
                  )}
                </span>

              </div>

              <div className="flex justify-between text-[10px]">

                <span className="text-slate-500">
                  Trả HH đơn
                </span>

                <span className="text-violet-400 font-bold">
                  -{money(
                    shipperOrderCommission
                  )}
                </span>

              </div>

              <div className="flex justify-between text-[10px]">

                <span className="text-slate-500">
                  Trả HH thêm ship
                </span>

                <span className="text-violet-400 font-bold">
                  -{money(
                    shipperShippingCommission
                  )}
                </span>

              </div>

              <div className="flex justify-between text-[10px]">

                <span className="text-slate-500">
                  Sàn giữ phí ship
                </span>

                <span className="text-indigo-400 font-bold">
                  {money(
                    shippingRetained
                  )}
                </span>

              </div>

            </div>

          </div>

        </div>

      </div>

      {/* ===================================================
          SHIPPER FLOW
      =================================================== */}

      <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-5">

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

          <div>

            <div className="text-[10px] font-black text-sky-300">
              DÒNG TIỀN SHIPPER
            </div>

            <div className="mt-1 text-[10px] text-slate-500">
              % Shipper được tính trên phí ship gốc, không trừ mã giảm phí ship.
            </div>

          </div>

          <div className="text-2xl font-black text-sky-400">
            {money(
              shipperTotal
            )}
          </div>

        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">

          <div className="rounded-xl bg-slate-950/40 border border-slate-800 p-4">

            <div className="text-[9px] text-slate-600">
              PHÍ SHIP GỐC
            </div>

            <div className="mt-1 font-black text-sky-400">
              {money(
                shippingCollected
              )}
            </div>

          </div>

          <div className="rounded-xl bg-slate-950/40 border border-slate-800 p-4">

            <div className="text-[9px] text-slate-600">
              SHIPPER HƯỞNG TỪ PHÍ SHIP
            </div>

            <div className="mt-1 font-black text-emerald-400">
              {money(
                shippingToShipper
              )}
            </div>

          </div>

          <div className="rounded-xl bg-slate-950/40 border border-slate-800 p-4">

            <div className="text-[9px] text-slate-600">
              SÀN GIỮ TỪ PHÍ SHIP
            </div>

            <div className="mt-1 font-black text-indigo-400">
              {money(
                shippingRetained
              )}
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}

/* =========================================================
   VOUCHER SUMMARY
========================================================= */

function VoucherSummaryTable({
  voucherOrders,
  voucherUniqueCount,
  totalVoucherUsage,
  customerPaidBeforeVoucher,
  orderVoucherDiscount,
  shippingVoucherDiscount,
  voucherDiscount,
  customerPaidAfterVoucher,
  voucherUsage,
}: {
  voucherOrders: number;
  voucherUniqueCount: number;
  totalVoucherUsage: number;
  customerPaidBeforeVoucher: number;
  orderVoucherDiscount: number;
  shippingVoucherDiscount: number;
  voucherDiscount: number;
  customerPaidAfterVoucher: number;
  voucherUsage: VoucherUsageRow[];
}) {
  return (
    <div className="rounded-2xl border border-violet-500/20 bg-slate-900/70 overflow-hidden">

      <div className="p-5 border-b border-slate-800">

        <div className="text-sm font-bold text-white">
          Voucher
        </div>

        <div className="text-[10px] text-slate-500 mt-1">
          Thống kê các đơn đã sử dụng voucher.
        </div>

      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-5">

        <KpiCard
          title="ĐƠN CÓ VOUCHER"
          value={String(
            voucherOrders
          )}
          description="Số đơn"
          valueClass="text-violet-400"
        />

        <KpiCard
          title="LƯỢT SỬ DỤNG"
          value={String(
            totalVoucherUsage
          )}
          description="Tổng lượt"
          valueClass="text-sky-400"
        />

        <KpiCard
          title="TỔNG GIẢM"
          value={money(
            voucherDiscount
          )}
          description="Giá trị voucher"
          valueClass="text-rose-400"
        />

        <KpiCard
          title="KHÁCH THỰC TRẢ"
          value={money(
            customerPaidAfterVoucher
          )}
          description="Sau voucher"
          valueClass="text-emerald-400"
        />

      </div>

      <div className="border-t border-slate-800 overflow-x-auto">

        <table className="w-full text-xs">

          <thead>

            <tr className="bg-slate-950/80 text-[9px] uppercase text-slate-500">

              <th className="p-4 text-left">
                Chỉ số
              </th>

              <th className="p-4 text-right">
                Giá trị
              </th>

              <th className="p-4 text-left">
                Giải thích
              </th>

            </tr>

          </thead>

          <tbody className="divide-y divide-slate-800">

            <tr>

              <td className="p-4 font-semibold text-white">
                Mã voucher khác nhau
              </td>

              <td className="p-4 text-right font-black text-emerald-400">
                {voucherUniqueCount}
              </td>

              <td className="p-4 text-[10px] text-slate-500">
                Số mã khác nhau
              </td>

            </tr>

            <tr>

              <td className="p-4 font-semibold text-white">
                Trước voucher
              </td>

              <td className="p-4 text-right font-black text-white">
                {money(
                  customerPaidBeforeVoucher
                )}
              </td>

              <td className="p-4 text-[10px] text-slate-500">
                Số tiền trước giảm
              </td>

            </tr>

            <tr>

              <td className="p-4 font-semibold text-white">
                Giảm tiền hàng
              </td>

              <td className="p-4 text-right font-black text-rose-400">
                -{money(
                  orderVoucherDiscount
                )}
              </td>

              <td className="p-4 text-[10px] text-slate-500">
                Voucher tiền hàng
              </td>

            </tr>

            <tr>

              <td className="p-4 font-semibold text-white">
                Giảm phí ship
              </td>

              <td className="p-4 text-right font-black text-sky-400">
                -{money(
                  shippingVoucherDiscount
                )}
              </td>

              <td className="p-4 text-[10px] text-slate-500">
                Voucher phí ship
              </td>

            </tr>

          </tbody>

        </table>

      </div>

      {voucherUsage.length >
        0 && (
        <div className="p-5 border-t border-slate-800 overflow-x-auto">

          <div className="text-[10px] font-bold text-slate-400 mb-3">
            CHI TIẾT TỪNG MÃ
          </div>

          <table className="w-full text-xs">

            <thead>

              <tr className="bg-slate-950/80 text-[9px] uppercase text-slate-500">

                <th className="p-3 text-left">
                  Mã
                </th>

                <th className="p-3 text-right">
                  Lượt dùng
                </th>

                <th className="p-3 text-right">
                  Giảm hàng
                </th>

                <th className="p-3 text-right">
                  Giảm ship
                </th>

                <th className="p-3 text-right">
                  Tổng giảm
                </th>

              </tr>

            </thead>

            <tbody className="divide-y divide-slate-800">

              {voucherUsage.map(
                (
                  item,
                  index
                ) => (
                  <tr
                    key={`${item.voucherId || item.voucherCode || "unknown"}-${index}`}
                  >

                    <td className="p-3 font-bold text-violet-400">
                      {item.voucherCode ||
                        "KHÔNG CÓ MÃ"}
                    </td>

                    <td className="p-3 text-right font-black text-sky-400">
                      {num(
                        item.usageCount
                      )}
                    </td>

                    <td className="p-3 text-right text-rose-400">
                      {money(
                        item.orderDiscount
                      )}
                    </td>

                    <td className="p-3 text-right text-sky-400">
                      {money(
                        item.shippingDiscount
                      )}
                    </td>

                    <td className="p-3 text-right font-black text-violet-400">
                      {money(
                        item.totalDiscount
                      )}
                    </td>

                  </tr>
                )
              )}

            </tbody>

          </table>

        </div>
      )}

    </div>
  );
}

/* =========================================================
   SHIPPER CONFIG
========================================================= */

function ShipperConfigBox({
  orderPercent,
  shippingRetainedPercent,
  shippingCommissionPercent,
  setOrderPercent,
  setShippingRetainedPercent,
  setShippingCommissionPercent,
  onSave,
  saving,
  saved,
}: {
  orderPercent: number;
  shippingRetainedPercent: number;
  shippingCommissionPercent: number;

  setOrderPercent: (
    value: number
  ) => void;

  setShippingRetainedPercent: (
    value: number
  ) => void;

  setShippingCommissionPercent: (
    value: number
  ) => void;

  onSave: () => void;

  saving: boolean;

  saved: boolean;
}) {
  const shipperBasePercent =
    Math.max(
      0,
      100 -
        shippingRetainedPercent
    );

  return (
    <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5">

      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">

        <div>

          <div className="flex items-center gap-2">

            <Settings className="w-4 h-4 text-violet-400" />

            <h3 className="text-sm font-bold text-white">
              Cấu hình Shipper
            </h3>

          </div>

          <p className="text-[10px] text-slate-500 mt-1">
            Cấu hình dùng chung với backend báo cáo doanh thu.
          </p>

        </div>

        <div className="flex items-center gap-2">

          {saved && (
            <span className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400">
              Đã lưu
            </span>
          )}

          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition disabled:opacity-50"
          >
            {saving
              ? "Đang lưu..."
              : "Lưu cấu hình"}
          </button>

        </div>

      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">

        {/* HH ĐƠN */}

        <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-4">

          <label className="text-[10px] font-bold text-slate-400">
            HH trên giá đơn
          </label>

          <div className="relative mt-2">

            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={
                orderPercent
              }
              onChange={(e) =>
                setOrderPercent(
                  clampPercent(
                    e.target.value
                  )
                )
              }
              className="w-full h-11 rounded-xl border border-slate-700 bg-slate-900 px-3 pr-10 text-lg font-black text-violet-300 outline-none focus:border-violet-500"
            />

            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500">
              %
            </span>

          </div>

          <div className="mt-2 text-[9px] text-slate-600">
            Giá trị đơn × tỷ lệ
          </div>

        </div>

        {/* FALLBACK CHO ĐƠN THIẾU KHOẢNG CÁCH */}

        <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-4">

          <label className="text-[10px] font-bold text-slate-400">
            Sàn giữ fallback
          </label>

          <div className="relative mt-2">

            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={
                shippingRetainedPercent
              }
              onChange={(e) =>
                setShippingRetainedPercent(
                  clampPercent(
                    e.target.value
                  )
                )
              }
              className="w-full h-11 rounded-xl border border-slate-700 bg-slate-900 px-3 pr-10 text-lg font-black text-indigo-300 outline-none focus:border-indigo-500"
            />

            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500">
              %
            </span>

          </div>

          <div className="mt-2 text-[9px] text-slate-600">
            Chỉ dùng cho đơn legacy thiếu distanceKm. Shipper fallback hưởng{" "}
            {pct(
              shipperBasePercent
            )}
          </div>

        </div>

        {/* HH SHIP */}

        <div className="rounded-xl bg-slate-950/70 border border-emerald-500/20 p-4">

          <label className="text-[10px] font-bold text-emerald-300">
            HH thêm phí ship
          </label>

          <div className="relative mt-2">

            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={
                shippingCommissionPercent
              }
              onChange={(e) =>
                setShippingCommissionPercent(
                  clampPercent(
                    e.target.value
                  )
                )
              }
              className="w-full h-11 rounded-xl border border-emerald-500/30 bg-slate-900 px-3 pr-10 text-lg font-black text-emerald-300 outline-none focus:border-emerald-500"
            />

            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500">
              %
            </span>

          </div>

          <div className="mt-2 text-[9px] text-slate-600">
            Tính trên toàn bộ phí ship gốc trước voucher
          </div>

        </div>

      </div>

      <div className="mt-4 rounded-xl border border-sky-500/20 bg-sky-500/5 overflow-hidden">

        <div className="px-4 py-3 border-b border-sky-500/10">
          <div className="text-[10px] font-black text-sky-300">
            TỶ LỆ PHÍ SHIP THEO KHOẢNG CÁCH
          </div>
          <div className="text-[9px] text-slate-500 mt-1">
            Áp dụng trên phí ship gốc trước voucher. Đơn càng xa, tỷ lệ dành cho Shipper càng cao.
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[10px]">
            <thead className="bg-slate-950/40 text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left font-bold">Khoảng cách</th>
                <th className="px-4 py-2 text-right font-bold">Shipper hưởng</th>
                <th className="px-4 py-2 text-right font-bold">Sàn giữ</th>
              </tr>
            </thead>
            <tbody>
              {SHIPPING_DISTANCE_RULES.map((rule) => (
                <tr
                  key={rule.label}
                  className="border-t border-slate-800/70"
                >
                  <td className="px-4 py-2.5 font-bold text-slate-300">
                    {rule.label}
                  </td>
                  <td className="px-4 py-2.5 text-right font-black text-emerald-400">
                    {pct(rule.shipperPercent)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-black text-indigo-400">
                    {pct(rule.platformPercent)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">

        <div className="rounded-xl bg-slate-950/50 border border-slate-800 p-3">

          <div className="text-[9px] text-slate-500">
            SHIPPER FALLBACK
          </div>

          <div className="mt-1 text-lg font-black text-emerald-400">
            {pct(
              shipperBasePercent
            )}
          </div>

        </div>

        <div className="rounded-xl bg-slate-950/50 border border-slate-800 p-3">

          <div className="text-[9px] text-slate-500">
            SÀN GIỮ FALLBACK
          </div>

          <div className="mt-1 text-lg font-black text-indigo-400">
            {pct(
              shippingRetainedPercent
            )}
          </div>

        </div>

        <div className="rounded-xl bg-slate-950/50 border border-slate-800 p-3">

          <div className="text-[9px] text-slate-500">
            HH THÊM SHIP
          </div>

          <div className="mt-1 text-lg font-black text-violet-400">
            {pct(
              shippingCommissionPercent
            )}
          </div>

        </div>

      </div>

    </div>
  );
}

/* =========================================================
   ORDER DETAIL MODAL
========================================================= */

function OrderDetailModal({
  orders,
  timeLabel,
  config,
  merchantConfigs,
  onClose,
}: {
  orders: OrderData[];
  timeLabel: string;
  config: FinanceConfig;
  merchantConfigs: Record<
    string,
    MerchantConfig
  >;
  onClose: () => void;
}) {
  const [
    expandedOrderId,
    setExpandedOrderId,
  ] = useState<string | null>(
    orders[0]?.id ??
      null
  );

  const rows =
    useMemo(
      () =>
        orders.map(
          (
            order,
            index
          ) => ({
            order,
            finance:
              resolveFinance(
                order,
                merchantConfigs,
                config
              ),
            voucher:
              getOrderVoucherInfo(
                order
              ),
            index,
          })
        ),
      [
        orders,
        merchantConfigs,
        config,
      ]
    );

  const summary =
    useMemo(() => {
      let customerPaid = 0;
      let shipperTotal = 0;
      let platformNet = 0;

      for (
        const row of
          rows
      ) {
        customerPaid +=
          num(
            row.order.finalTotal ??
              row.order.finalPrice ??
              row.order.paidTotal ??
              row.order.totalPrice
          );

        shipperTotal +=
          row.finance.shipperTotal;

        platformNet +=
          row.finance.platformNet;
      }

      return {
        customerPaid,
        shipperTotal,
        platformNet,
        averagePlatformNet:
          averageMoney(
            platformNet,
            rows.length
          ),
      };
    }, [rows]);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">

      <div className="w-full max-w-[1450px] h-[94vh] bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col">

        {/* HEADER */}

        <div className="p-5 border-b border-slate-800 shrink-0">

          <div className="flex items-start justify-between gap-4">

            <div className="flex items-start gap-3">

              <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400">

                <Receipt className="w-5 h-5" />

              </div>

              <div>

                <h3 className="text-lg font-black text-white">
                  Chi tiết đơn hàng
                </h3>

                <div className="mt-1 text-[10px] text-slate-500">
                  {timeLabel} ·{" "}
                  {orders.length} đơn
                </div>

              </div>

            </div>

            <button
              onClick={
                onClose
              }
              className="p-2.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

          </div>

          {/* SUMMARY */}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">

              <div className="text-[9px] text-slate-600">
                SỐ ĐƠN
              </div>

              <div className="mt-1 text-xl font-black text-white">
                {orders.length}
              </div>

            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">

              <div className="text-[9px] text-slate-600">
                KHÁCH THANH TOÁN
              </div>

              <div className="mt-1 text-xl font-black text-white">
                {money(
                  summary.customerPaid
                )}
              </div>

            </div>

            <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">

              <div className="text-[9px] text-sky-300">
                SHIPPER NHẬN
              </div>

              <div className="mt-1 text-xl font-black text-sky-400">
                {money(
                  summary.shipperTotal
                )}
              </div>

            </div>

            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">

              <div className="text-[9px] text-indigo-300">
                SÀN NHẬN THỰC
              </div>

              <div className="mt-1 text-xl font-black text-indigo-400">
                {money(
                  summary.platformNet
                )}
              </div>

              <div className="mt-1 text-[8px] text-slate-600">
                TB {money(
                  summary.averagePlatformNet
                )} / đơn
              </div>

            </div>

          </div>

        </div>

        {/* BODY */}

        <div className="flex-1 overflow-auto p-4 sm:p-5">

          {rows.length ===
          0 ? (
            <div className="py-20 text-center text-slate-500">
              Không có đơn hàng.
            </div>
          ) : (
            <div className="space-y-3">

              {rows.map(
                ({
                  order,
                  finance,
                  voucher,
                  index,
                }) => {
                  const orderId =
                    String(
                      order.id ??
                        index
                    );

                  const expanded =
                    expandedOrderId ===
                    orderId;

                  const customerPaid =
                    num(
                      order.finalTotal ??
                        order.finalPrice ??
                        order.paidTotal ??
                        order.totalPrice
                    );

                  const shopDiscount =
                    Math.max(
                      0,
                      finance.originalGross -
                        finance.saleGross
                    );

                  const sourceLabel =
                    finance.originalGrossSource ===
                    "ITEM_ORIGINAL_PRICE"
                      ? "originalPrice"
                      : finance.originalGrossSource ===
                          "ORDER_ORIGINAL_PRICE"
                        ? "order snapshot"
                        : finance.originalGrossSource ===
                            "FINANCIAL_SNAPSHOT"
                          ? "financial snapshot"
                          : finance.originalGrossSource ===
                              "LEGACY_SUBTOTAL_COST_PRICE"
                            ? "legacy subtotalCost"
                            : finance.originalGrossSource ===
                                "LEGACY_ITEM_COST_PRICE"
                              ? "legacy costPrice"
                              : "chưa có";

                  const beforeVoucher =
                    customerPaid +
                    voucher.totalDiscount;

                  return (
                    <div
                      key={
                        orderId
                      }
                      className="rounded-2xl border border-slate-800 bg-slate-950/40 overflow-hidden"
                    >

                      {/* =================================================
                          ORDER SUMMARY
                      ================================================= */}

                      <button
                        type="button"
                        onClick={() =>
                          setExpandedOrderId(
                            expanded
                              ? null
                              : orderId
                          )
                        }
                        className="w-full text-left p-4 hover:bg-slate-900/70 transition"
                      >

                        <div className="flex flex-col xl:flex-row xl:items-center gap-4">

                          <div className="min-w-[220px]">

                            <div className="flex flex-wrap items-center gap-2">

                              <span className="font-mono text-[11px] font-black text-indigo-400">
                                #
                                {order.paymentCode ||
                                  order.id?.slice(
                                    0,
                                    10
                                  ) ||
                                  "N/A"}
                              </span>

                              {isCod(
                                order.paymentMethod
                              ) ? (
                                <span className="px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400 text-[8px] font-black">
                                  COD
                                </span>
                              ) : (
                                <span className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-[8px] font-black">
                                  CHUYỂN KHOẢN
                                </span>
                              )}

                            </div>

                            <div className="mt-1 text-[10px] text-slate-500">
                              {formatDateTime(
                                order.createdAt
                              )}
                            </div>

                          </div>

                          <div className="flex-1 min-w-0">

                            <div className="text-xs font-bold text-white truncate">
                              {order.shopName ||
                                order.storeName ||
                                "Gian hàng"}
                            </div>

                            <div className="mt-1 text-[9px] text-slate-600 truncate">
                              {order.customerName ||
                                order.recipientName ||
                                "Khách hàng"}
                            </div>

                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 xl:min-w-[700px]">

                            <div>
                              <div className="text-[8px] text-slate-600">
                                KHÁCH TRẢ
                              </div>
                              <div className="mt-1 text-xs font-black text-white">
                                {money(
                                  customerPaid
                                )}
                              </div>
                            </div>

                            <div>
                              <div className="text-[8px] text-slate-600">
                                QUÁN NHẬN
                              </div>
                              <div className="mt-1 text-xs font-black text-emerald-400">
                                {money(
                                  finance.merchantNet
                                )}
                              </div>
                            </div>

                            <div>
                              <div className="text-[8px] text-slate-600">
                                SHIPPER NHẬN
                              </div>
                              <div className="mt-1 text-xs font-black text-sky-400">
                                {money(
                                  finance.shipperTotal
                                )}
                              </div>
                            </div>

                            <div>
                              <div className="text-[8px] text-slate-600">
                                SÀN NHẬN THỰC
                              </div>
                              <div
                                className={`mt-1 text-xs font-black ${
                                  finance.platformNet >=
                                  0
                                    ? "text-indigo-400"
                                    : "text-rose-400"
                                }`}
                              >
                                {money(
                                  finance.platformNet
                                )}
                              </div>
                            </div>

                          </div>

                          <div className="shrink-0 text-slate-500">

                            {expanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}

                          </div>

                        </div>

                      </button>

                      {/* =================================================
                          DETAIL
                      ================================================= */}

                      {expanded && (
                        <div className="border-t border-slate-800 p-4">

                          {/* =================================================
                              FINANCIAL GRID
                          ================================================= */}

                          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

                            {/* ORDER */}

                            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">

                              <div className="text-[10px] font-black text-slate-400 mb-2">
                                THÔNG TIN ĐƠN
                              </div>

                              <div className="space-y-3">

                                <div>
                                  <div className="text-[8px] text-slate-600">
                                    THỜI GIAN
                                  </div>
                                  <div className="mt-1 text-[10px] text-white font-semibold">
                                    {formatDateTime(
                                      order.createdAt
                                    )}
                                  </div>
                                </div>

                                <div>
                                  <div className="text-[8px] text-slate-600">
                                    KHÁCH HÀNG
                                  </div>
                                  <div className="mt-1 text-[10px] text-white font-semibold">
                                    {order.customerName ||
                                      order.recipientName ||
                                      "—"}
                                  </div>
                                </div>

                                <div>
                                  <div className="text-[8px] text-slate-600">
                                    THANH TOÁN
                                  </div>
                                  <div className="mt-1">
                                    {isCod(
                                      order.paymentMethod
                                    ) ? (
                                      <span className="inline-flex px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400 text-[9px] font-bold">
                                        COD
                                      </span>
                                    ) : (
                                      <span className="inline-flex px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-[9px] font-bold">
                                        CHUYỂN KHOẢN
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div>
                                  <div className="text-[8px] text-slate-600">
                                    ĐỊA CHỈ
                                  </div>
                                  <div className="mt-1 text-[10px] text-slate-300 leading-relaxed">
                                    {order.customerAddress ||
                                      order.address ||
                                      "—"}
                                  </div>
                                </div>

                                <div>
                                  <div className="text-[8px] text-slate-600">
                                    TRẠNG THÁI
                                  </div>
                                  <div className="mt-1 text-[10px] font-bold text-emerald-400">
                                    {order.status ||
                                      "completed"}
                                  </div>
                                </div>

                              </div>

                            </div>

                            {/* MONEY */}

                            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">

                              <div className="text-[10px] font-black text-slate-400 mb-2">
                                TIỀN HÀNG & VOUCHER
                              </div>

                              <div className="space-y-3">

                                <div className="flex justify-between gap-4">

                                  <span className="text-[10px] text-slate-500">
                                    Giá gốc
                                  </span>

                                  <span className="text-[10px] font-black text-white text-right">
                                    {finance.originalGross >
                                    0
                                      ? money(
                                          finance.originalGross
                                        )
                                      : "Chưa có"}
                                  </span>

                                </div>

                                <div className="flex justify-between gap-4">

                                  <span className="text-[10px] text-slate-500">
                                    Nguồn giá gốc
                                  </span>

                                  <span className="text-[9px] text-slate-600 text-right">
                                    {sourceLabel}
                                  </span>

                                </div>

                                <div className="flex justify-between gap-4">

                                  <span className="text-[10px] text-slate-500">
                                    Giá sau KM
                                  </span>

                                  <span className="text-[10px] font-black text-white">
                                    {money(
                                      finance.saleGross
                                    )}
                                  </span>

                                </div>

                                <div className="flex justify-between gap-4">

                                  <span className="text-[10px] text-slate-500">
                                    Quán giảm
                                  </span>

                                  <span className="text-[10px] font-black text-rose-400">
                                    -{money(
                                      shopDiscount
                                    )}
                                  </span>

                                </div>

                                <div className="flex justify-between gap-4">

                                  <span className="text-[10px] text-slate-500">
                                    CK quán
                                  </span>

                                  <span className="text-[10px] font-black text-emerald-400">
                                    {money(
                                      finance.merchantCommission
                                    )}
                                  </span>

                                </div>

                                <div className="flex justify-between gap-4">

                                  <span className="text-[10px] text-slate-500">
                                    Voucher
                                  </span>

                                  <span className="text-[10px] font-black text-violet-400">
                                    {voucher.hasVoucher
                                      ? `-${money(
                                          voucher.totalDiscount
                                        )}`
                                      : "Không"}
                                  </span>

                                </div>

                                {voucher.hasVoucher && (
                                  <div className="rounded-lg bg-violet-500/5 border border-violet-500/10 p-3">

                                    <div className="text-[9px] font-bold text-violet-300">
                                      {voucher.code ||
                                        "VOUCHER GIẢM PHÍ SHIP"}
                                    </div>

                                    <div className="mt-2 space-y-1">

                                      <div className="flex justify-between text-[9px]">

                                        <span className="text-slate-600">
                                          Giảm tiền hàng
                                        </span>

                                        <span className="text-rose-400 font-bold">
                                          -{money(
                                            voucher.orderDiscount
                                          )}
                                        </span>

                                      </div>

                                      <div className="flex justify-between text-[9px]">

                                        <span className="text-slate-600">
                                          Giảm phí ship
                                        </span>

                                        <span className="text-sky-400 font-bold">
                                          -{money(
                                            voucher.shippingDiscount
                                          )}
                                        </span>

                                      </div>

                                      <div className="flex justify-between text-[9px]">

                                        <span className="text-slate-600">
                                          Trước voucher
                                        </span>

                                        <span className="text-white font-bold">
                                          {money(
                                            beforeVoucher
                                          )}
                                        </span>

                                      </div>

                                    </div>

                                  </div>
                                )}

                              </div>

                            </div>

                            {/* SHIPPING + PLATFORM */}

                            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">

                              <div className="text-[10px] font-black text-indigo-300 mb-2">
                                SHIPPER & SÀN
                              </div>

                              <div className="space-y-3">

                                <div className="flex justify-between gap-4">

                                  <span className="text-[10px] text-slate-500">
                                    Phí ship gốc tính HH Shipper
                                  </span>

                                  <span className="text-[10px] font-black text-sky-400">
                                    {money(
                                      finance.shippingFeeBeforeVoucher
                                    )}
                                  </span>

                                </div>

                                <div className="flex justify-between gap-4">

                                  <span className="text-[10px] text-slate-500">
                                    Khách thực trả phí ship
                                  </span>

                                  <span className="text-[10px] font-black text-emerald-400">
                                    {money(
                                      finance.shippingPaidByCustomer
                                    )}
                                  </span>

                                </div>

                                <div className="flex justify-between gap-4">

                                  <span className="text-[10px] text-slate-500">
                                    Tỷ lệ theo khoảng cách
                                  </span>

                                  <span className="text-[10px] font-black text-sky-300">
                                    {finance.shippingDistanceTier} · Shipper {pct(finance.shipperShippingPercent)} / Sàn {pct(finance.platformShippingPercent)}
                                  </span>

                                </div>

                                <div className="flex justify-between gap-4">

                                  <span className="text-[10px] text-slate-500">
                                    Phí ship Shipper cơ bản ({pct(finance.shipperShippingPercent)})
                                  </span>

                                  <span className="text-[10px] font-black text-emerald-400">
                                    {money(
                                      finance.baseShipperShipping
                                    )}
                                  </span>

                                </div>

                                <div className="flex justify-between gap-4">

                                  <span className="text-[10px] text-slate-500">
                                    HH trên đơn
                                  </span>

                                  <span className="text-[10px] font-black text-violet-400">
                                    {money(
                                      finance.shipperOrderCommission
                                    )}
                                  </span>

                                </div>

                                <div className="flex justify-between gap-4">

                                  <span className="text-[10px] text-slate-500">
                                    HH thêm phí ship
                                  </span>

                                  <span className="text-[10px] font-black text-violet-400">
                                    {money(
                                      finance.shippingCommission
                                    )}
                                  </span>

                                </div>

                                <div className="rounded-xl bg-sky-500/5 border border-sky-500/10 p-3">

                                  <div className="text-[9px] text-sky-300">
                                    SHIPPER NHẬN
                                  </div>

                                  <div className="mt-1 text-xl font-black text-sky-400">
                                    {money(
                                      finance.shipperTotal
                                    )}
                                  </div>

                                </div>

                                <div className="flex justify-between gap-4">

                                  <span className="text-[10px] text-slate-500">
                                    Sàn giữ phí ship ({pct(finance.platformShippingPercent)})
                                  </span>

                                  <span className="text-[10px] font-black text-indigo-400">
                                    {money(
                                      finance.platformShippingRetained
                                    )}
                                  </span>

                                </div>

                                <div className="flex justify-between gap-4">

                                  <span className="text-[10px] text-slate-500">
                                    Sàn thu
                                  </span>

                                  <span className="text-[10px] font-black text-amber-400">
                                    {money(
                                      finance.platformRevenue
                                    )}
                                  </span>

                                </div>

                                <div className="rounded-xl bg-indigo-500/10 border border-indigo-500/20 p-3">

                                  <div className="text-[9px] text-indigo-300">
                                    SÀN NHẬN THỰC
                                  </div>

                                  <div
                                    className={`mt-1 text-2xl font-black ${
                                      finance.platformNet >=
                                      0
                                        ? "text-indigo-400"
                                        : "text-rose-400"
                                    }`}
                                  >
                                    {money(
                                      finance.platformNet
                                    )}
                                  </div>

                                  <div className="mt-1 text-[8px] text-slate-600">
                                    Sàn thu − HH đơn − HH thêm phí ship
                                  </div>

                                </div>

                              </div>

                            </div>

                          </div>

                          {/* =================================================
                              SHIPPING INFO
                          ================================================= */}

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">

                            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">

                              <div className="text-[8px] text-slate-600">
                                PHÍ SHIP GỐC
                              </div>

                              <div className="mt-1 text-[11px] font-black text-white">
                                {money(
                                  order.baseShippingFee
                                )}
                              </div>

                            </div>

                            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">

                              <div className="text-[8px] text-slate-600">
                                PHỤ PHÍ
                              </div>

                              <div className="mt-1 text-[11px] font-black text-white">
                                {money(
                                  order.appliedFee
                                )}
                              </div>

                            </div>

                            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">

                              <div className="text-[8px] text-slate-600">
                                CAO ĐIỂM
                              </div>

                              <div className="mt-1 text-[11px] font-black text-amber-400">
                                {money(
                                  order.peakHourFee
                                )}
                              </div>

                            </div>

                            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">

                              <div className="text-[8px] text-slate-600">
                                KHOẢNG CÁCH
                              </div>

                              <div className="mt-1 text-[11px] font-black text-sky-400">
                                {order.distanceStr ||
                                  (num(
                                    order.distanceKm
                                  ) > 0
                                    ? `${num(
                                        order.distanceKm
                                      ).toFixed(
                                        2
                                      )} km`
                                    : "—")}
                              </div>

                            </div>

                          </div>

                          {/* =================================================
                              ITEMS
                          ================================================= */}

                          {Array.isArray(
                            order.items
                          ) &&
                            order.items.length >
                              0 && (
                              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/70 overflow-hidden">

                                <div className="p-4 border-b border-slate-800">

                                  <div className="text-[10px] font-black text-slate-400">
                                    SẢN PHẨM
                                  </div>

                                </div>

                                <div className="overflow-x-auto">

                                  <table className="w-full text-xs">

                                    <thead>

                                      <tr className="bg-slate-950 text-[9px] uppercase text-slate-500">

                                        <th className="p-3 text-left">
                                          Sản phẩm
                                        </th>

                                        <th className="p-3 text-right">
                                          SL
                                        </th>

                                        <th className="p-3 text-right">
                                          Giá gốc
                                        </th>

                                        <th className="p-3 text-right">
                                          Giá bán
                                        </th>

                                        <th className="p-3 text-right">
                                          Thành tiền
                                        </th>

                                      </tr>

                                    </thead>

                                    <tbody className="divide-y divide-slate-800">

                                      {order.items.map(
                                        (
                                          item,
                                          itemIndex
                                        ) => {
                                          const originalPrice =
                                            getItemOriginalPrice(
                                              item
                                            );

                                          const salePrice =
                                            num(
                                              item.price
                                            );

                                          const quantity =
                                            Math.max(
                                              1,
                                              num(
                                                item.quantity ??
                                                  1
                                              )
                                            );

                                          return (
                                            <tr
                                              key={
                                                item.id ??
                                                itemIndex
                                              }
                                              className="hover:bg-slate-800/40"
                                            >

                                              <td className="p-3">

                                                <div className="font-semibold text-white">
                                                  {item.name ||
                                                    "Sản phẩm"}
                                                </div>

                                              </td>

                                              <td className="p-3 text-right text-slate-300">
                                                {quantity}
                                              </td>

                                              <td className="p-3 text-right text-slate-300">
                                                {originalPrice >
                                                0
                                                  ? money(
                                                      originalPrice
                                                    )
                                                  : "—"}
                                              </td>

                                              <td className="p-3 text-right text-white">
                                                {money(
                                                  salePrice
                                                )}
                                              </td>

                                              <td className="p-3 text-right font-black text-emerald-400">
                                                {money(
                                                  salePrice *
                                                    quantity
                                                )}
                                              </td>

                                            </tr>
                                          );
                                        }
                                      )}

                                    </tbody>

                                  </table>

                                </div>

                              </div>
                            )}

                          {/* =================================================
                              STORE / SHIPPER
                          ================================================= */}

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">

                            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">

                              <div className="text-[8px] text-slate-600">
                                QUÁN
                              </div>

                              <div className="mt-1 text-[10px] font-bold text-white">
                                {order.shopName ||
                                  order.storeName ||
                                  "—"}
                              </div>

                              <div className="mt-1 text-[9px] text-slate-600">
                                {order.storeAddress ||
                                  "—"}
                              </div>

                            </div>

                            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">

                              <div className="text-[8px] text-slate-600">
                                SHIPPER
                              </div>

                              <div className="mt-1 text-[10px] font-bold text-white">
                                {order.shipperName ||
                                  "—"}
                              </div>

                              {order.shipperNote && (
                                <div className="mt-1 text-[9px] text-slate-600">
                                  Ghi chú:{" "}
                                  {order.shipperNote}
                                </div>
                              )}

                            </div>

                            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">

                              <div className="text-[8px] text-slate-600">
                                KHÁCH
                              </div>

                              <div className="mt-1 text-[10px] font-bold text-white">
                                {order.customerName ||
                                  order.recipientName ||
                                  "—"}
                              </div>

                              <div className="mt-1 text-[9px] text-slate-600">
                                {order.customerAddress ||
                                  order.address ||
                                  "—"}
                              </div>

                            </div>

                          </div>

                        </div>
                      )}

                    </div>
                  );
                }
              )}

            </div>
          )}

        </div>
      </div>
    </div>
  );
}

/* =========================================================
   MAIN PAGE
========================================================= */

type ViewType =
  | "PLATFORM"
  | "MERCHANT"
  | "SHIPPER";

type TimeFrame =
  | "HOUR"
  | "DAY"
  | "MONTH"
  | "YEAR";

interface RevenueTab {
  id: ViewType;
  label: string;
  icon: ComponentType<{
    className?: string;
  }>;
}

export default function RevenuePage() {
  const [
    viewType,
    setViewType,
  ] = useState<ViewType>(
    "PLATFORM"
  );

  const [
    timeFrame,
    setTimeFrame,
  ] = useState<TimeFrame>(
    "DAY"
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    data,
    setData,
  ] = useState<any>(null);

  const [
    partners,
    setPartners,
  ] = useState<any[]>([]);

  const [
    selectedPartnerId,
    setSelectedPartnerId,
  ] = useState("");

  const [
    merchantConfigs,
    setMerchantConfigs,
  ] = useState<
    Record<
      string,
      MerchantConfig
    >
  >({});

  const [
    selectedTimeRow,
    setSelectedTimeRow,
  ] = useState<string | null>(
    null
  );

  const [
    ordersDetail,
    setOrdersDetail,
  ] = useState<OrderData[]>(
    []
  );

  const [
    loadingOrders,
    setLoadingOrders,
  ] = useState(false);

  /* =======================================================
     SHIPPER SETTINGS
  ======================================================= */

  const [
    shipperOrderPercent,
    setShipperOrderPercent,
  ] = useState(3);

  const [
    shippingRetainedPercent,
    setShippingRetainedPercent,
  ] = useState(30);

  const [
    shipperShippingCommissionPercent,
    setShipperShippingCommissionPercent,
  ] = useState(2);

  const [
    savingShipperConfig,
    setSavingShipperConfig,
  ] = useState(false);

  const [
    shipperConfigSaved,
    setShipperConfigSaved,
  ] = useState(false);

  /* =======================================================
     LOAD MERCHANT CONFIG
  ======================================================= */

  useEffect(() => {
    const load =
      async () => {
        try {
          const snap =
            await getDocs(
              collection(
                db,
                "merchants"
              )
            );

          const map: Record<
            string,
            MerchantConfig
          > = {};

          snap.forEach(
            (docSnap) => {
              const raw =
                docSnap.data() as any;

              const config: MerchantConfig =
                {
                  id:
                    docSnap.id,

                  merchantCode:
                    String(
                      raw.merchantCode ??
                        ""
                    ),

                  shopName:
                    String(
                      raw.shopName ??
                        raw.storeName ??
                        ""
                    ),

                  storeName:
                    String(
                      raw.storeName ??
                        raw.shopName ??
                        ""
                    ),

                  commissionPercent:
                    num(
                      raw.commissionPercent
                    ),
                };

              map[
                docSnap.id
              ] = config;

              if (
                config.merchantCode
              ) {
                map[
                  config.merchantCode
                ] =
                  config;
              }
            }
          );

          setMerchantConfigs(
            map
          );
        } catch (error) {
          console.warn(
            "Không thể tải merchant config:",
            error
          );
        }
      };

    load();
  }, []);

  /* =======================================================
     LOAD PARTNERS
  ======================================================= */

  useEffect(() => {
    if (
      viewType ===
      "PLATFORM"
    ) {
      setPartners([]);
      setSelectedPartnerId(
        ""
      );
      return;
    }

    const load =
      async () => {
        try {
          const response =
            await fetch(
              `/api/users?role=${viewType}`,
              {
                cache:
                  "no-store",
              }
            );

          const json =
            await response.json();

          if (
            !json.success
          ) {
            setPartners([]);
            setSelectedPartnerId(
              ""
            );
            return;
          }

          const list =
            Array.isArray(
              json.data
            )
              ? json.data
              : [];

          setPartners(
            list
          );

          setSelectedPartnerId(
            list.length > 0
              ? String(
                  list[0].id
                )
              : ""
          );
        } catch (error) {
          console.error(
            "Không thể tải danh sách đối tác:",
            error
          );

          setPartners([]);
          setSelectedPartnerId(
            ""
          );
        }
      };

    load();
  }, [viewType]);

  /* =======================================================
     FETCH REVENUE
  ======================================================= */

  const fetchRevenue =
    useCallback(
      async () => {
        if (
          viewType !==
            "PLATFORM" &&
          !selectedPartnerId
        ) {
          setData(null);
          setLoading(false);
          return;
        }

        setLoading(true);

        try {
          const params = new URLSearchParams();

          params.set("timeFrame", timeFrame);

          if (viewType !== "PLATFORM") {
            params.set("type", viewType);

            if (selectedPartnerId) {
              params.set(
                "id",
                String(selectedPartnerId)
              );
            }
          }

          const url = `/api/revenue?${params.toString()}`;

          const response =
            await fetch(
              url,
              {
                cache:
                  "no-store",
              }
            );

          const json =
            await response.json();

          if (
            !response.ok ||
            !json.success
          ) {
            setData(null);
            return;
          }

          const nextData =
            json.data ??
            {};

          setData(
            nextData
          );

          /*
           * Backend là nguồn chính của config.
           */
          const config =
            nextData?.config;

          if (
            config?.shipperOrderCommissionPercent !==
            undefined
          ) {
            setShipperOrderPercent(
              clampPercent(
                config.shipperOrderCommissionPercent
              )
            );
          }

          if (
            config?.shippingRetainedPercent !==
            undefined
          ) {
            setShippingRetainedPercent(
              clampPercent(
                config.shippingRetainedPercent
              )
            );
          }

          if (
            config?.shipperShippingCommissionPercent !==
            undefined
          ) {
            setShipperShippingCommissionPercent(
              clampPercent(
                config.shipperShippingCommissionPercent
              )
            );
          }

          if (
            config
          ) {
            setShipperConfigSaved(
              true
            );
          }
        } catch (error) {
          console.error(
            "Không thể tải báo cáo:",
            error
          );

          setData(null);
        } finally {
          setLoading(false);
        }
      },
      [
        viewType,
        selectedPartnerId,
        timeFrame,
      ]
    );

  useEffect(() => {
    fetchRevenue();
  }, [
    fetchRevenue,
  ]);

  /* =======================================================
     SAVE SHIPPER CONFIG
  ======================================================= */

  const saveShipperConfig =
    useCallback(
      async () => {
        setSavingShipperConfig(
          true
        );

        try {
          const response =
            await fetch(
              "/api/revenue",
              {
                method:
                  "POST",

                headers: {
                  "Content-Type":
                    "application/json",
                },

                body: JSON.stringify(
                  {
                    shipperOrderCommissionPercent:
                      clampPercent(
                        shipperOrderPercent
                      ),

                    shippingRetainedPercent:
                      clampPercent(
                        shippingRetainedPercent
                      ),

                    shipperShippingCommissionPercent:
                      clampPercent(
                        shipperShippingCommissionPercent
                      ),
                  }
                ),
              }
            );

          const json =
            await response.json();

          if (
            !response.ok ||
            !json.success
          ) {
            throw new Error(
              json?.message ||
                "Không thể lưu cấu hình"
            );
          }

          setShipperConfigSaved(
            true
          );

          await fetchRevenue();
        } catch (error) {
          console.error(
            "Không thể lưu cấu hình Shipper:",
            error
          );

          alert(
            error instanceof Error
              ? error.message
              : "Không thể lưu cấu hình Shipper."
          );
        } finally {
          setSavingShipperConfig(
            false
          );
        }
      },
      [
        shipperOrderPercent,
        shippingRetainedPercent,
        shipperShippingCommissionPercent,
        fetchRevenue,
      ]
    );

  /* =======================================================
     SUMMARY
  ======================================================= */

  const summary =
    data?.summary ??
    {};

  const apiConfig =
    data?.config ??
    {};

  /* =======================================================
     PLATFORM
  ======================================================= */

  const platformSummary =
    useMemo(() => {
      const orders =
        num(
          summary.totalOrders
        );

      const shipperOrderCommission =
        num(
          summary.totalShipperOrderCommission
        );

      const shipperShipping =
        num(
          summary.totalShipperShippingAmount
        );

      const shipperTotal =
        shipperOrderCommission +
        shipperShipping;

      const merchantOriginalGross =
        num(
          summary.totalMerchantOriginalGross ??
            summary.totalOriginalGMV
        );

      const merchantSaleGross =
        num(
          summary.totalMerchantSaleGross ??
            summary.totalGMV
        );

      const customerPaid =
        num(
          summary.totalCustomerPaid
        );

      const merchantNet =
        num(
          summary.totalMerchantNet
        );

      const platformFundedVoucher =
        num(
          summary.totalPlatformFundedVoucher
        );

      const platformNet =
        customerPaid -
        merchantNet -
        shipperTotal;

      return {
        orders,

        customerPaid,

        merchantOriginalGross,

        merchantSaleGross,

        merchantCommission:
          num(
            summary.totalMerchantCommissionRevenue
          ),

        merchantNet:
          num(
            summary.totalMerchantNet
          ),

        shippingCollected:
          num(
            summary.totalShippingBaseFee ??
              summary.totalShippingCollected
          ),

        shippingRetained:
          num(
            summary.totalShippingRetained
          ),

        shippingToShipper:
          num(
            summary.totalShipperShippingAmount
          ),

        shipperOrderCommission:
          num(
            summary.totalShipperOrderCommission
          ),

        shipperShippingCommission:
          num(
            summary.totalShipperShippingCommission
          ),

        shipperTotal,

        platformFundedVoucher,

        platformRevenue:
          num(
            summary.totalPlatformRevenue
          ),

        platformNet,

        averagePlatformNet:
          averageMoney(
            platformNet,
            orders
          ),

        averageShipper:
          averageMoney(
            shipperTotal,
            orders
          ),

        averageOrderValue:
          averageMoney(
            merchantSaleGross,
            orders
          ),

        voucherOrders:
          num(
            summary.totalVoucherOrders
          ),

        voucherUniqueCount:
          num(
            summary.voucherUniqueCount
          ),

        totalVoucherUsage:
          num(
            summary.totalVoucherUsage
          ),

        customerPaidBeforeVoucher:
          num(
            summary.totalCustomerPaidBeforeVoucher
          ),

        orderVoucherDiscount:
          num(
            summary.totalOrderVoucherDiscount
          ),

        shippingVoucherDiscount:
          num(
            summary.totalShippingVoucherDiscount
          ),

        voucherDiscount:
          num(
            summary.totalVoucherDiscount
          ),

        voucherUsage:
          Array.isArray(
            data?.voucherUsage
          )
            ? data.voucherUsage
            : [],

        legacyOrderCount:
          num(
            summary.originalGrossLegacyOrderCount
          ),

        missingOriginalGross:
          num(
            summary.missingOriginalGrossOrderCount
          ),
      };
    }, [
      summary,
      data?.voucherUsage,
    ]);

  /* =======================================================
     SHIPPER
  ======================================================= */

  const shipperSummary =
    useMemo(() => {
      const orders =
        num(
          summary.totalOrders
        );

      const orderCommission =
        num(
          summary.totalShipperOrderCommission
        );

      const shippingEarning =
        num(
          summary.totalShipperShippingAmount
        );

      const totalEarning =
        orderCommission +
        shippingEarning;

      return {
        orders,

        orderBase:
          num(
            summary.totalShipperOrderCommissionBase
          ),

        orderCommission:
          num(
            summary.totalShipperOrderCommission
          ),

        shippingCollected:
          num(
            summary.totalShippingBaseFee ??
              summary.totalShippingCollected
          ),

        shippingRetained:
          num(
            summary.totalShippingRetained
          ),

        baseShipping:
          Math.max(
            0,
            num(
              summary.totalShipperShippingAmount
            ) -
              num(
                summary.totalShipperShippingCommission
              )
          ),

        shippingCommission:
          num(
            summary.totalShipperShippingCommission
          ),

        shippingEarning:
          num(
            summary.totalShipperShippingAmount
          ),

        totalEarning,

        averageEarning:
          averageMoney(
            totalEarning,
            orders
          ),

        orderPercent:
          clampPercent(
            apiConfig.shipperOrderCommissionPercent ??
              shipperOrderPercent
          ),

        retainedPercent:
          clampPercent(
            apiConfig.shippingRetainedPercent ??
              shippingRetainedPercent
          ),

        shippingCommissionPercent:
          clampPercent(
            apiConfig.shipperShippingCommissionPercent ??
              shipperShippingCommissionPercent
          ),
      };
    }, [
      summary,
      apiConfig,
      shipperOrderPercent,
      shippingRetainedPercent,
      shipperShippingCommissionPercent,
    ]);

  /* =======================================================
     MERCHANT
  ======================================================= */

  const selectedMerchant =
    merchantConfigs[
      selectedPartnerId
    ];

  const merchantSummary =
    useMemo(() => {
      const originalGross =
        num(
          summary.totalMerchantOriginalGross ??
            summary.totalOriginalGMV
        );

      const saleGross =
        num(
          summary.totalMerchantSaleGross ??
            summary.totalGMV ??
            summary.totalGrossRevenue
        );

      const commissionPercent =
        clampPercent(
          summary.appliedCommissionPercent ??
            selectedMerchant?.commissionPercent ??
            0
        );

      const commission =
        num(
          summary.totalMerchantCommissionRevenue ??
            summary.totalPlatformCut
        );

      const net =
        num(
          summary.totalMerchantNet
        );

      return {
        originalGross,

        saleGross,

        commissionPercent,

        commission,

        net,

        orders:
          num(
            summary.totalOrders
          ),

        averageNet:
          averageMoney(
            net,
            summary.totalOrders
          ),
      };
    }, [
      summary,
      selectedMerchant,
    ]);

  /* =======================================================
     CHART
  ======================================================= */

  const chartData =
    useMemo(() => {
      const rows =
        Array.isArray(
          data?.chartData
        )
          ? data.chartData
          : [];

      return rows.map(
        (
          row: any
        ) => ({
          ...row,

          originalGMV:
            num(
              row.originalGMV ??
                row.merchantOriginalGross
            ),

          gmv:
            num(
              row.gmv ??
                row.merchantSaleGross ??
                row.subTotalPrice
            ),

          customerPaid:
            num(
              row.customerPaid
            ),

          codAmount:
            num(
              row.codAmount
            ),

          bankAmount:
            num(
              row.bankAmount
            ),

          merchantCommissionRevenue:
            num(
              row.merchantCommissionRevenue
            ),

          merchantNet:
            num(
              row.merchantNet
            ),

          // Backend mới trả shippingCollected = phí ship gốc trước voucher.
          shippingCollected:
            num(
              row.shippingCollected ??
                row.baseShippingFee
            ),

          shippingPaidByCustomer:
            num(
              row.shippingPaidByCustomer ??
                row.shippingFee
            ),

          shippingRetained:
            num(
              row.shippingRetained
            ),

          shippingEarning:
            num(
              row.shippingEarning
            ),

          shippingCommission:
            num(
              row.shippingCommission
            ),

          shipperOrderCommissionBase:
            num(
              row.shipperOrderCommissionBase ??
                row.orderCommissionBase
            ),

          shipperOrderCommission:
            num(
              row.shipperOrderCommission ??
                row.orderCommission
            ),

          shipperTotalEarning:
            num(
              row.shipperTotalEarning
            ),

          platformTotalRevenue:
            num(
              row.platformTotalRevenue
            ),

          platformFundedVoucher:
            num(
              row.platformFundedVoucher ??
                row.shippingVoucherFunding
            ),

          platformNetRevenue:
            num(row.customerPaid) -
            num(row.merchantNet) -
            num(row.shipperTotalEarning),
        })
      );
    }, [
      data?.chartData,
    ]);

  /* =======================================================
     OPEN ORDERS
  ======================================================= */

  const openOrders =
    async (
      time: string
    ) => {
      setSelectedTimeRow(
        time
      );

      setLoadingOrders(
        true
      );

      setOrdersDetail([]);

      try {
        let url =
          `/api/revenue/orders?` +
          `timeFrame=${timeFrame}` +
          `&time=${encodeURIComponent(
            time
          )}` +
          `&viewType=${viewType}`;

        if (
          viewType !==
            "PLATFORM" &&
          selectedPartnerId
        ) {
          url +=
            `&partnerId=${encodeURIComponent(
              selectedPartnerId
            )}`;
        }

        const response =
          await fetch(
            url,
            {
              cache:
                "no-store",
            }
          );

        const json =
          await response.json();

        if (
          !response.ok ||
          !json.success
        ) {
          setOrdersDetail([]);
          return;
        }

        setOrdersDetail(
          Array.isArray(
            json.data
          )
            ? json.data
            : []
        );
      } catch (error) {
        console.error(
          "Không thể tải Order:",
          error
        );

        setOrdersDetail([]);
      } finally {
        setLoadingOrders(
          false
        );
      }
    };

  /* =======================================================
     DETAIL CONFIG
  ======================================================= */

  const currentFinanceConfig =
    useMemo<FinanceConfig>(
      () => ({
        platformFeePercent:
          clampPercent(
            apiConfig.platformFeePercent ??
              10
          ),

        shipperOrderCommissionPercent:
          clampPercent(
            apiConfig.shipperOrderCommissionPercent ??
              shipperOrderPercent
          ),

        shippingRetainedPercent:
          clampPercent(
            apiConfig.shippingRetainedPercent ??
              shippingRetainedPercent
          ),

        shipperShippingCommissionPercent:
          clampPercent(
            apiConfig.shipperShippingCommissionPercent ??
              shipperShippingCommissionPercent
          ),
      }),
      [
        apiConfig,
        shipperOrderPercent,
        shippingRetainedPercent,
        shipperShippingCommissionPercent,
      ]
    );

  /* =======================================================
     TABS
  ======================================================= */

  const tabs: RevenueTab[] = [
    {
      id: "PLATFORM",
      label: "Tổng quan sàn",
      icon: TrendingUp,
    },

    {
      id: "MERCHANT",
      label: "Gian hàng",
      icon: Store,
    },

    {
      id: "SHIPPER",
      label: "Shipper",
      icon: Bike,
    },
  ];

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">

      {/* ===================================================
          HEADER
      =================================================== */}

      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5 mb-6">

        <div>

          <div className="flex items-center gap-3">

            <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">

              <TrendingUp className="w-6 h-6" />

            </div>

            <div>

              <h1 className="text-2xl font-black text-white">
                Tài chính & Doanh thu
              </h1>

              <p className="text-xs text-slate-500 mt-1">
                Tiền thực nhận · Shipper · Quán · Sàn
              </p>

            </div>

          </div>

        </div>

        <div className="flex items-center gap-2 flex-wrap">

          {(
            [
              [
                "HOUR",
                "Giờ",
              ],
              [
                "DAY",
                "Ngày",
              ],
              [
                "MONTH",
                "Tháng",
              ],
              [
                "YEAR",
                "Năm",
              ],
            ] as const
          ).map(
            (
              [
                id,
                label,
              ]
            ) => (
              <button
                key={id}
                onClick={() =>
                  setTimeFrame(
                    id
                  )
                }
                className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                  timeFrame ===
                  id
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-900 text-slate-400 hover:text-white"
                }`}
              >
                {label}
              </button>
            )
          )}

          <button
            onClick={
              fetchRevenue
            }
            disabled={
              loading
            }
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white disabled:opacity-50"
            title="Làm mới"
          >

            <Refresh
              className={`w-4 h-4 ${
                loading
                  ? "animate-spin"
                  : ""
              }`}
            />

          </button>

        </div>

      </div>

      {/* ===================================================
          TABS
      =================================================== */}

      <div className="flex flex-col lg:flex-row gap-3 mb-6">

        <div className="flex bg-slate-900 border border-slate-800 rounded-2xl p-1 overflow-x-auto">

          {tabs.map(
            (
              tab
            ) => {
              const TabIcon =
                tab.icon;

              return (
                <button
                  key={
                    tab.id
                  }
                  onClick={() =>
                    setViewType(
                      tab.id
                    )
                  }
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                    viewType ===
                    tab.id
                      ? "bg-indigo-600 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >

                  <TabIcon className="w-4 h-4" />

                  {tab.label}

                </button>
              );
            }
          )}

        </div>

        {viewType !==
          "PLATFORM" && (
          <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-2xl px-4 py-2">

            {viewType ===
            "MERCHANT" ? (
              <Store className="w-4 h-4 text-indigo-400" />
            ) : (
              <Bike className="w-4 h-4 text-indigo-400" />
            )}

            <span className="text-[11px] text-slate-500">

              {viewType ===
              "MERCHANT"
                ? "Gian hàng"
                : "Shipper"}

            </span>

            <select
              value={
                selectedPartnerId
              }
              onChange={(e) =>
                setSelectedPartnerId(
                  e.target.value
                )
              }
              className="bg-transparent text-xs font-bold text-white outline-none min-w-[180px]"
            >

              {partners.length ===
                0 && (
                <option value="">
                  Chưa có dữ liệu
                </option>
              )}

              {partners.map(
                (
                  partner
                ) => (
                  <option
                    key={
                      partner.id
                    }
                    value={
                      partner.id
                    }
                    className="bg-slate-900"
                  >
                    {partner.shopName ||
                      partner.fullName ||
                      partner.name ||
                      partner.id}
                  </option>
                )
              )}

            </select>

          </div>
        )}

      </div>

      {/* ===================================================
          LOADING
      =================================================== */}

      {loading && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-12 text-center">

          <Refresh className="w-6 h-6 mx-auto text-indigo-400 animate-spin" />

          <div className="mt-3 text-xs text-slate-500">
            Đang tải báo cáo doanh thu...
          </div>

        </div>
      )}

      {/* ===================================================
          PLATFORM
      =================================================== */}

      {!loading &&
        viewType ===
          "PLATFORM" && (
          <div className="space-y-6">

            <div>

              <div className="mb-4">

                <div className="text-sm font-bold text-white">
                  Tổng quan sàn
                </div>

                <div className="text-[10px] text-slate-500 mt-1">
                  Tập trung vào khoản tiền Sàn thực sự còn lại.
                </div>

              </div>

              <MoneyFlow

                orders={
                  platformSummary.orders
                }

                customerPaid={
                  platformSummary.customerPaid
                }

                merchantNet={
                  platformSummary.merchantNet
                }

                shipperTotal={
                  platformSummary.shipperTotal
                }

                platformRevenue={
                  platformSummary.platformRevenue
                }

                platformNet={
                  platformSummary.platformNet
                }

                merchantCommission={
                  platformSummary.merchantCommission
                }

                shippingCollected={
                  platformSummary.shippingCollected
                }

                shippingToShipper={
                  platformSummary.shippingToShipper
                }

                shippingRetained={
                  platformSummary.shippingRetained
                }

                shipperOrderCommission={
                  platformSummary.shipperOrderCommission
                }

                shipperShippingCommission={
                  platformSummary.shipperShippingCommission
                }

                averagePlatformNet={
                  platformSummary.averagePlatformNet
                }

                averageShipper={
                  platformSummary.averageShipper
                }

                merchantOriginalGross={
                  platformSummary.merchantOriginalGross
                }

                merchantSaleGross={
                  platformSummary.merchantSaleGross
                }

              />

            </div>

            {/* DATA QUALITY */}

            {platformSummary.legacyOrderCount >
              0 && (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">

                <div className="flex items-start gap-3">

                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />

                  <div>

                    <div className="text-xs font-bold text-amber-300">
                      Đơn cũ đang dùng dữ liệu giá gốc legacy
                    </div>

                    <div className="mt-1 text-[10px] text-slate-500">
                      {platformSummary.legacyOrderCount}{" "}
                      đơn chưa có{" "}
                      <code>
                        originalPrice
                      </code>
                      .
                    </div>

                  </div>

                </div>

              </div>
            )}

            {platformSummary.missingOriginalGross >
              0 && (
              <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4">

                <div className="flex items-start gap-3">

                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />

                  <div>

                    <div className="text-xs font-bold text-rose-300">
                      Có đơn chưa có giá gốc
                    </div>

                    <div className="mt-1 text-[10px] text-slate-500">
                      {platformSummary.missingOriginalGross}{" "}
                      đơn chưa đủ dữ liệu để tính CK quán trên giá gốc.
                    </div>

                  </div>

                </div>

              </div>
            )}

            {/* VOUCHER */}

            <VoucherSummaryTable

              voucherOrders={
                platformSummary.voucherOrders
              }

              voucherUniqueCount={
                platformSummary.voucherUniqueCount
              }

              totalVoucherUsage={
                platformSummary.totalVoucherUsage
              }

              customerPaidBeforeVoucher={
                platformSummary.customerPaidBeforeVoucher
              }

              orderVoucherDiscount={
                platformSummary.orderVoucherDiscount
              }

              shippingVoucherDiscount={
                platformSummary.shippingVoucherDiscount
              }

              voucherDiscount={
                platformSummary.voucherDiscount
              }

              customerPaidAfterVoucher={
                platformSummary.customerPaid
              }

              voucherUsage={
                platformSummary.voucherUsage
              }

            />

          </div>
        )}

      {/* ===================================================
          MERCHANT
      =================================================== */}

      {!loading &&
        viewType ===
          "MERCHANT" && (
          <div className="space-y-6">

            <div>

              <div className="mb-4">

                <div className="text-sm font-bold text-white">
                  Doanh thu gian hàng
                </div>

                <div className="text-[10px] text-slate-500 mt-1">
                  Chiết khấu được tính trên giá gốc trước khuyến mãi.
                </div>

              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">

                <KpiCard
                  title="GIÁ GỐC"
                  value={money(
                    merchantSummary.originalGross
                  )}
                  description="Cơ sở tính CK"
                  large
                />

                <KpiCard
                  title="GIÁ SAU KHUYẾN MÃI"
                  value={money(
                    merchantSummary.saleGross
                  )}
                  description="Tiền hàng thực tế"
                />

                <KpiCard
                  title="SÀN THU"
                  value={money(
                    merchantSummary.commission
                  )}
                  description={`CK ${pct(
                    merchantSummary.commissionPercent
                  )} trên giá gốc`}
                  valueClass="text-rose-400"
                />

                <KpiCard
                  title="QUÁN THỰC NHẬN"
                  value={money(
                    merchantSummary.net
                  )}
                  description="Sau CK quán"
                  valueClass="text-emerald-400"
                  large
                />

                <KpiCard
                  title="TB QUÁN / ĐƠN"
                  value={money(
                    merchantSummary.averageNet
                  )}
                  description={`${merchantSummary.orders} đơn`}
                  valueClass="text-sky-400"
                />

              </div>

            </div>

          </div>
        )}

      {/* ===================================================
          SHIPPER
      =================================================== */}

      {!loading &&
        viewType ===
          "SHIPPER" && (
          <div className="space-y-6">

            <ShipperConfigBox

              orderPercent={
                shipperOrderPercent
              }

              shippingRetainedPercent={
                shippingRetainedPercent
              }

              shippingCommissionPercent={
                shipperShippingCommissionPercent
              }

              setOrderPercent={(
                value
              ) => {
                setShipperOrderPercent(
                  value
                );

                setShipperConfigSaved(
                  false
                );
              }}

              setShippingRetainedPercent={(
                value
              ) => {
                setShippingRetainedPercent(
                  value
                );

                setShipperConfigSaved(
                  false
                );
              }}

              setShippingCommissionPercent={(
                value
              ) => {
                setShipperShippingCommissionPercent(
                  value
                );

                setShipperConfigSaved(
                  false
                );
              }}

              onSave={
                saveShipperConfig
              }

              saving={
                savingShipperConfig
              }

              saved={
                shipperConfigSaved
              }

            />

            <div>

              <div className="mb-4">

                <div className="text-sm font-bold text-white">
                  Thu nhập Shipper
                </div>

                <div className="text-[10px] text-slate-500 mt-1">
                  % Shipper được tính trên phí ship gốc, không trừ mã giảm phí ship.
                </div>

              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">

                <KpiCard
                  title="SHIPPER NHẬN"
                  value={money(
                    shipperSummary.totalEarning
                  )}
                  description={`TB ${money(
                    shipperSummary.averageEarning
                  )} / đơn`}
                  icon={
                    <Bike className="w-4 h-4" />
                  }
                  valueClass="text-emerald-400"
                  large
                />

                <KpiCard
                  title="HH TRÊN ĐƠN"
                  value={money(
                    shipperSummary.orderCommission
                  )}
                  description={`Tỷ lệ ${pct(
                    shipperSummary.orderPercent
                  )}`}
                  valueClass="text-violet-400"
                />

                <KpiCard
                  title="PHÍ SHIP TÍNH HH"
                  value={money(
                    shipperSummary.shippingCollected
                  )}
                  description="Phí ship gốc, chưa trừ voucher"
                  valueClass="text-sky-400"
                />

                <KpiCard
                  title="PHÍ SHIP SHIPPER"
                  value={money(
                    shipperSummary.shippingEarning
                  )}
                  description="Phí ship cơ bản + HH thêm"
                  valueClass="text-sky-400"
                />

                <KpiCard
                  title="HH THÊM PHÍ SHIP"
                  value={money(
                    shipperSummary.shippingCommission
                  )}
                  description={`Tỷ lệ ${pct(
                    shipperSummary.shippingCommissionPercent
                  )}`}
                  valueClass="text-violet-400"
                />

              </div>

            </div>

          </div>
        )}

      {/* ===================================================
          TIME TABLE
      =================================================== */}

      {!loading && (
        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/70 overflow-hidden">

          <div className="p-5 border-b border-slate-800">

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

              <div>

                <h2 className="text-sm font-bold text-white">
                  Phân tích theo thời gian
                </h2>

                <p className="text-[10px] text-slate-500 mt-1">
                  Nhấn vào từng dòng để xem toàn bộ đơn.
                </p>

              </div>

              <div className="text-[10px] text-slate-500">
                {timeFrame ===
                "HOUR"
                  ? "Theo giờ"
                  : timeFrame ===
                    "DAY"
                  ? "Theo ngày"
                  : timeFrame ===
                    "MONTH"
                  ? "Theo tháng"
                  : "Theo năm"}
              </div>

            </div>

          </div>

          <div className="overflow-x-auto">

            <table className="w-full text-xs">

              <thead>

                <tr className="bg-slate-950/80 text-[9px] uppercase text-slate-500">

                  <th className="p-4 text-left">
                    Thời gian
                  </th>

                  <th className="p-4 text-center">
                    Đơn
                  </th>

                  <th className="p-4 text-right">
                    Khách trả
                  </th>

                  {viewType ===
                    "PLATFORM" && (
                    <>
                      <th className="p-4 text-right">
                        Giá gốc
                      </th>

                      <th className="p-4 text-right">
                        Sau KM
                      </th>

                      <th className="p-4 text-right">
                        CK quán
                      </th>

                      <th className="p-4 text-right">
                        Phí ship gốc
                      </th>

                      <th className="p-4 text-right">
                        Shipper nhận
                      </th>

                      <th className="p-4 text-right">
                        Sàn thu
                      </th>

                      <th className="p-4 text-right">
                        <span className="text-indigo-300">
                          Sàn thực nhận
                        </span>
                      </th>
                    </>
                  )}

                  {viewType ===
                    "MERCHANT" && (
                    <>
                      <th className="p-4 text-right">
                        Giá gốc
                      </th>

                      <th className="p-4 text-right">
                        Sau KM
                      </th>

                      <th className="p-4 text-right">
                        CK quán
                      </th>

                      <th className="p-4 text-right">
                        Quán nhận
                      </th>
                    </>
                  )}

                  {viewType ===
                    "SHIPPER" && (
                    <>
                      <th className="p-4 text-right">
                        Giá trị đơn
                      </th>

                      <th className="p-4 text-right">
                        HH đơn
                      </th>

                      <th className="p-4 text-right">
                        Phí ship gốc
                      </th>

                      <th className="p-4 text-right">
                        HH ship
                      </th>

                      <th className="p-4 text-right">
                        Shipper nhận
                      </th>
                    </>
                  )}

                  <th className="p-4" />

                </tr>

              </thead>

              <tbody className="divide-y divide-slate-800/70">

                {chartData.length ===
                0 ? (
                  <tr>

                    <td
                      colSpan={24}
                      className="p-12 text-center text-slate-500"
                    >
                      Không có dữ liệu.
                    </td>

                  </tr>
                ) : (
                  chartData.map(
                    (
                      row: any,
                      index: number
                    ) => (
                      <tr
                        key={
                          row.time ??
                          index
                        }
                        onClick={() =>
                          openOrders(
                            row.time
                          )
                        }
                        className="hover:bg-indigo-500/5 cursor-pointer transition"
                      >

                        <td className="p-4 font-bold text-white">
                          {row.time}
                        </td>

                        <td className="p-4 text-center">

                          <span className="px-2 py-1 rounded-lg bg-slate-800 text-slate-300 text-[10px] font-bold">
                            {num(
                              row.count
                            )}
                          </span>

                        </td>

                        <td className="p-4 text-right text-white font-semibold">
                          {money(
                            row.customerPaid
                          )}
                        </td>

                        {/* PLATFORM */}

                        {viewType ===
                          "PLATFORM" && (
                          <>
                            <td className="p-4 text-right text-white font-semibold">
                              {money(
                                row.originalGMV
                              )}
                            </td>

                            <td className="p-4 text-right text-white font-semibold">
                              {money(
                                row.gmv
                              )}
                            </td>

                            <td className="p-4 text-right text-emerald-400 font-semibold">
                              {money(
                                row.merchantCommissionRevenue
                              )}
                            </td>

                            <td className="p-4 text-right text-sky-400 font-semibold">
                              {money(
                                row.shippingCollected
                              )}
                            </td>

                            <td className="p-4 text-right text-sky-400 font-semibold">
                              {money(
                                row.shipperTotalEarning
                              )}
                            </td>

                            <td className="p-4 text-right text-amber-400 font-semibold">
                              {money(
                                row.platformTotalRevenue
                              )}
                            </td>

                            <td
                              className={`p-4 text-right font-black ${
                                num(
                                  row.platformNetRevenue
                                ) >=
                                0
                                  ? "text-indigo-400"
                                  : "text-rose-400"
                              }`}
                            >
                              {money(
                                row.platformNetRevenue
                              )}
                            </td>
                          </>
                        )}

                        {/* MERCHANT */}

                        {viewType ===
                          "MERCHANT" && (
                          <>
                            <td className="p-4 text-right text-white font-semibold">
                              {money(
                                row.originalGMV ??
                                  row.merchantOriginalGross ??
                                  0
                              )}
                            </td>

                            <td className="p-4 text-right text-white font-semibold">
                              {money(
                                row.gmv ??
                                  row.merchantSaleGross ??
                                  0
                              )}
                            </td>

                            <td className="p-4 text-right text-rose-400 font-bold">
                              {money(
                                row.merchantCommissionRevenue ??
                                  row.platformCut
                              )}
                            </td>

                            <td className="p-4 text-right text-emerald-400 font-black">
                              {money(
                                row.merchantNet ??
                                  row.net
                              )}
                            </td>
                          </>
                        )}

                        {/* SHIPPER */}

                        {viewType ===
                          "SHIPPER" && (
                          <>
                            <td className="p-4 text-right text-white font-semibold">
                              {money(
                                row.shipperOrderCommissionBase ??
                                  row.orderCommissionBase ??
                                  row.gmv
                              )}
                            </td>

                            <td className="p-4 text-right text-violet-400 font-bold">
                              {money(
                                row.shipperOrderCommission ??
                                  row.orderCommission
                              )}
                            </td>

                            <td className="p-4 text-right text-sky-400">
                              {money(
                                row.shippingCollected
                              )}
                            </td>

                            <td className="p-4 text-right text-violet-400 font-bold">
                              {money(
                                row.shippingCommission
                              )}
                            </td>

                            <td className="p-4 text-right text-emerald-400 font-black">
                              {money(
                                row.shipperTotalEarning
                              )}
                            </td>
                          </>
                        )}

                        <td className="p-4 text-right text-slate-600">

                          <ChevronRight className="w-4 h-4 ml-auto" />

                        </td>

                      </tr>
                    )
                  )
                )}

              </tbody>

            </table>

          </div>

        </div>
      )}

      {/* ===================================================
          ORDER DETAIL MODAL
      =================================================== */}

      {selectedTimeRow &&
        !loadingOrders && (
          <OrderDetailModal

            orders={
              ordersDetail
            }

            timeLabel={
              selectedTimeRow
            }

            config={
              currentFinanceConfig
            }

            merchantConfigs={
              merchantConfigs
            }

            onClose={() =>
              setSelectedTimeRow(
                null
              )
            }

          />
        )}

      {selectedTimeRow &&
        loadingOrders && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">

              <Refresh className="w-6 h-6 mx-auto text-indigo-400 animate-spin" />

              <div className="mt-3 text-xs text-slate-500">
                Đang tải chi tiết đơn...
              </div>

            </div>

          </div>
        )}

    </div>
  );
}