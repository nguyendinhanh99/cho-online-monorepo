import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";

/* =========================================================
   CONSTANTS
========================================================= */

const VN_TIME_ZONE = "Asia/Ho_Chi_Minh";
const SETTLEMENT_COLLECTION = "accounting_settlements";

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

/* =========================================================
   HELPERS
========================================================= */

const num = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const parseDate = (value: any): Date => {
  if (!value) return new Date(0);

  try {
    if (typeof value?.toDate === "function") return value.toDate();
    if (value?.seconds !== undefined) return new Date(num(value.seconds) * 1000);
    if (value?._seconds !== undefined) return new Date(num(value._seconds) * 1000);

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? new Date(0) : date;
  } catch {
    return new Date(0);
  }
};

const formatDateKeyVN = (value: any): string => {
  const date = value instanceof Date ? value : parseDate(value);

  if (date.getTime() <= 0) return "";

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: VN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
};

const getTodayVN = (): string => formatDateKeyVN(new Date());

const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const normalizeDateKey = (value: unknown): string => {
  const dateKey = String(value ?? "").trim();
  return DATE_KEY_REGEX.test(dateKey) ? dateKey : "";
};

const isDateInRange = (
  dateKey: string,
  fromDate?: string | null,
  toDate?: string | null
): boolean => {
  if (fromDate && dateKey < fromDate) return false;
  if (toDate && dateKey > toDate) return false;
  return true;
};

const getSettlementId = (
  settlementDate: string,
  role: "MERCHANT" | "SHIPPER",
  partnerId: string
): string => {
  const safePartnerId = String(partnerId).replaceAll("/", "_");
  return `${settlementDate}__${role}__${safePartnerId}`;
};

const normalizeRole = (value: unknown): "ALL" | "MERCHANT" | "SHIPPER" => {
  const role = String(value ?? "ALL").toUpperCase().trim();
  if (role === "MERCHANT" || role === "SHIPPER") return role;
  return "ALL";
};

const isCompletedOrder = (status: unknown): boolean => {
  const value = String(status ?? "").toLowerCase().trim();
  return value === "completed" || value === "delivered" || value === "hoan_thanh";
};

const getShippingShareByDistance = (
  distanceValue: unknown,
  fallbackPlatformPercent = 60
) => {
  const parsedDistance = Number(distanceValue);

  if (!Number.isFinite(parsedDistance) || parsedDistance < 0) {
    const platformPercent = clamp(num(fallbackPlatformPercent), 0, 100);

    return {
      distanceKm: 0,
      shipperPercent: 100 - platformPercent,
      platformPercent,
      tierLabel: "Thiếu khoảng cách (fallback)",
      isFallback: true,
    };
  }

  const distanceKm = Math.max(0, parsedDistance);
  const rule =
    SHIPPING_DISTANCE_RULES.find((item) => distanceKm <= item.maxKm) ??
    SHIPPING_DISTANCE_RULES[SHIPPING_DISTANCE_RULES.length - 1];

  return {
    distanceKm,
    shipperPercent: rule.shipperPercent,
    platformPercent: rule.platformPercent,
    tierLabel: rule.label,
    isFallback: false,
  };
};

/* =========================================================
   VOUCHER
========================================================= */

const getVoucherInfo = (data: any) => {
  const voucher = data?.voucher ?? data?.appliedVoucher ?? data?.voucherInfo ?? {};

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
    data?.voucherApplyType ?? data?.applyType ?? voucher?.applyType ?? voucher?.type ?? ""
  )
    .toUpperCase()
    .trim();

  if (singleDiscount > 0 && orderDiscount <= 0 && shippingDiscount <= 0) {
    if (applyType === "SHIPPING" || applyType === "SHIP") {
      shippingDiscount = singleDiscount;
    } else {
      orderDiscount = singleDiscount;
    }
  }

  return {
    orderDiscount: Math.max(0, orderDiscount),
    shippingDiscount: Math.max(0, shippingDiscount),
  };
};

/* =========================================================
   ORIGINAL / SALE GROSS
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

const getOriginalGross = (data: any): number => {
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

    if (found && total > 0) return total;
  }

  for (const value of [
    data?.originalSubTotalPrice,
    data?.subtotalBeforeDiscount,
    data?.grossBeforeDiscount,
    data?.originalGMV,
    data?.originalTotalPrice,
  ]) {
    const amount = num(value);
    if (amount > 0) return amount;
  }

  const legacySubtotal = num(data?.subTotalCostPrice ?? data?.costPriceTotal);
  if (legacySubtotal > 0) return legacySubtotal;

  if (Array.isArray(data?.items)) {
    let total = 0;

    for (const item of data.items) {
      const price = num(item?.costPrice ?? item?.basePrice ?? item?.price);
      const quantity = Math.max(1, num(item?.quantity ?? 1));
      if (price > 0) total += price * quantity;
    }

    if (total > 0) return total;
  }

  return 0;
};

const getSaleGross = (
  data: any,
  totalPrice: number,
  shippingPaidByCustomer: number,
  shippingVoucherDiscount: number
): number => {
  const direct = num(data?.subTotalPrice ?? data?.subtotal ?? data?.itemsPrice);
  if (direct > 0) return direct;

  if (Array.isArray(data?.items)) {
    let total = 0;

    for (const item of data.items) {
      const price = num(item?.price ?? item?.salePrice ?? item?.unitPrice);
      const quantity = Math.max(1, num(item?.quantity ?? 1));
      total += price * quantity;
    }

    if (total > 0) return total;
  }

  return Math.max(
    0,
    totalPrice - shippingPaidByCustomer + Math.max(0, shippingVoucherDiscount)
  );
};

/* =========================================================
   SHIPPING BEFORE VOUCHER
========================================================= */

const getShippingInfo = (data: any, shippingVoucherDiscount: number) => {
  const customerShippingFee = Math.max(
    0,
    num(data?.shippingFee ?? data?.shipFee ?? data?.deliveryFee)
  );

  const directCandidates = [
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

  for (const value of directCandidates) {
    const amount = num(value);

    if (amount > 0) {
      return {
        baseShippingFee: amount,
        shippingPaidByCustomer: Math.min(amount, customerShippingFee),
        source: "DIRECT_PRE_VOUCHER",
      };
    }
  }

  const baseShippingFee = num(data?.baseShippingFee);
  const appliedFee = num(data?.appliedFee);
  const peakHourFee = num(data?.peakHourFee);
  const rainFee = num(data?.rainFee);

  if (baseShippingFee > 0) {
    const surcharge = appliedFee > 0 ? appliedFee : peakHourFee + rainFee;
    const preVoucher = baseShippingFee + Math.max(0, surcharge);

    return {
      baseShippingFee: preVoucher,
      shippingPaidByCustomer: Math.min(preVoucher, customerShippingFee),
      source: "BASE_PLUS_APPLIED",
    };
  }

  const legacyComponents = num(data?.shippingBaseAmount) + num(data?.appliedFee);

  if (legacyComponents > 0) {
    return {
      baseShippingFee: legacyComponents,
      shippingPaidByCustomer: Math.min(legacyComponents, customerShippingFee),
      source: "LEGACY_COMPONENTS",
    };
  }

  if (customerShippingFee > 0 && shippingVoucherDiscount <= 0) {
    return {
      baseShippingFee: customerShippingFee,
      shippingPaidByCustomer: customerShippingFee,
      source: "NO_VOUCHER",
    };
  }

  if (shippingVoucherDiscount > 0) {
    return {
      baseShippingFee: customerShippingFee + shippingVoucherDiscount,
      shippingPaidByCustomer: customerShippingFee,
      source: "POST_VOUCHER_PLUS_DISCOUNT",
    };
  }

  return {
    baseShippingFee: 0,
    shippingPaidByCustomer: customerShippingFee,
    source: "MISSING",
  };
};

/* =========================================================
   ORDER COMMISSION BASE
========================================================= */

const getItemSaleGross = (data: any): number => {
  if (!Array.isArray(data?.items)) return 0;

  let total = 0;

  for (const item of data.items) {
    const price = num(item?.price ?? item?.salePrice ?? item?.unitPrice);
    const quantity = Math.max(1, num(item?.quantity ?? 1));
    if (price > 0) total += price * quantity;
  }

  return total;
};

const getShipperOrderCommissionBase = (
  data: any,
  originalGross: number,
  saleGross: number
): number => {
  if (originalGross > 0) return originalGross;

  const candidates = [
    data?.originalSubTotalPrice,
    data?.subtotalBeforeDiscount,
    data?.grossBeforeDiscount,
    data?.originalGMV,
    data?.originalTotalPrice,
    data?.subTotalPrice,
    getItemSaleGross(data),
    saleGross,
  ]
    .map(num)
    .filter((value) => value > 0);

  return Math.max(0, candidates[0] ?? saleGross);
};

/* =========================================================
   TYPES
========================================================= */

type SettlementRole = "MERCHANT" | "SHIPPER";
type RoleFilter = "ALL" | SettlementRole;

interface FinanceConfig {
  platformFeePercent: number;
  shipperOrderCommissionPercent: number;
  shippingRetainedPercent: number;
  shipperShippingCommissionPercent: number;
}

interface AccountingSourceData {
  config: FinanceConfig;
  merchants: Map<string, any>;
  merchantCommissionMap: Map<string, number>;
  shippers: Map<string, any>;
  ordersByDate: Map<string, any[]>;
  settlementsByDate: Map<string, Map<string, any>>;
  availableDates: string[];
}

interface SettlementRow {
  id: string;
  settlementId: string;
  partnerId: string;
  role: SettlementRole;
  settlementDate: string;
  name: string;
  phone: string;
  bankAccount: {
    bankName: string;
    accountNumber: string;
    accountHolder: string;
  };
  orderCount: number;
  basisAmount: number;
  platformRetention: number;
  extraEarning: number;
  unpaidAmount: number;
  totalGMV: number;
  platformFee: number;
  merchant?: {
    saleGross: number;
    originalGross: number;
    commissionAmount: number;
    netAmount: number;
  };
  shipper?: {
    shippingBaseFee: number;
    shippingPaidByCustomer: number;
    shippingRetained: number;
    shippingBaseEarning: number;
    shippingBonus: number;
    orderCommission: number;
    totalEarning: number;
  };
  isPaid: boolean;
  t1Status: "PENDING_T" | "READY_T1" | "PAID_T1" | "ERROR";
  paidAt: any;
  accountantNote: string;
  isLockedSnapshot: boolean;
}

/* =========================================================
   LOAD CONFIG + DATA
========================================================= */

const loadFinanceConfig = async (): Promise<FinanceConfig> => {
  const settingsDoc = await adminDb.collection("settings").doc("commission").get();
  const settings = settingsDoc.exists ? settingsDoc.data() || {} : {};

  return {
    platformFeePercent: clamp(num(settings.platformFeePercent ?? 10), 0, 100),
    shipperOrderCommissionPercent: clamp(
      num(settings.shipperOrderCommissionPercent ?? settings.orderCommissionPercent ?? 4),
      0,
      100
    ),
    shippingRetainedPercent: clamp(num(settings.shippingRetainedPercent ?? 60), 0, 100),
    shipperShippingCommissionPercent: clamp(
      num(settings.shipperShippingCommissionPercent ?? 0),
      0,
      100
    ),
  };
};

const loadAccountingSource = async (): Promise<AccountingSourceData> => {
  const config = await loadFinanceConfig();

  const [ordersSnap, merchantsSnap, shippersSnap, settlementSnap] = await Promise.all([
    adminDb.collection("orders").get(),
    adminDb.collection("merchants").get(),
    adminDb.collection("shippers").get(),
    adminDb.collection(SETTLEMENT_COLLECTION).get(),
  ]);

  const merchants = new Map<string, any>();
  const merchantCommissionMap = new Map<string, number>();

  merchantsSnap.docs.forEach((doc) => {
    const data = doc.data();

    merchants.set(doc.id, {
      id: doc.id,
      ...data,
    });

    const percent = clamp(
      num(
        data?.commissionPercent ??
          data?.merchantCommissionPercent ??
          config.platformFeePercent
      ),
      0,
      100
    );

    merchantCommissionMap.set(doc.id, percent);

    if (data?.merchantCode) {
      merchantCommissionMap.set(String(data.merchantCode), percent);
    }
  });

  const shippers = new Map<string, any>();

  shippersSnap.docs.forEach((doc) => {
    shippers.set(doc.id, {
      id: doc.id,
      ...doc.data(),
    });
  });

  const ordersByDate = new Map<string, any[]>();

  ordersSnap.docs.forEach((doc) => {
    const order = {
      id: doc.id,
      ...doc.data(),
    } as any;

    if (!isCompletedOrder(order?.status)) return;

    const dateKey = formatDateKeyVN(order?.createdAt);
    if (!dateKey) return;

    if (!ordersByDate.has(dateKey)) {
      ordersByDate.set(dateKey, []);
    }

    ordersByDate.get(dateKey)!.push(order);
  });

  const settlementsByDate = new Map<string, Map<string, any>>();

  settlementSnap.docs.forEach((doc) => {
    const data = doc.data();
    const settlementDate = normalizeDateKey(data?.settlementDate);

    if (!settlementDate) return;

    if (!settlementsByDate.has(settlementDate)) {
      settlementsByDate.set(settlementDate, new Map<string, any>());
    }

    settlementsByDate.get(settlementDate)!.set(doc.id, {
      id: doc.id,
      ...data,
    });
  });

  const dateSet = new Set<string>();

  ordersByDate.forEach((_orders, dateKey) => {
    dateSet.add(dateKey);
  });

  settlementsByDate.forEach((_settlements, dateKey) => {
    dateSet.add(dateKey);
  });

  const availableDates = Array.from(dateSet).sort((a, b) => b.localeCompare(a));

  return {
    config,
    merchants,
    merchantCommissionMap,
    shippers,
    ordersByDate,
    settlementsByDate,
    availableDates,
  };
};

const buildSettlementRowsForDate = (
  settlementDate: string,
  roleFilter: RoleFilter,
  source: AccountingSourceData
): SettlementRow[] => {
  const {
    config,
    merchants,
    merchantCommissionMap,
    shippers,
    ordersByDate,
    settlementsByDate,
  } = source;

  const completedOrders = ordersByDate.get(settlementDate) ?? [];
  const settlementMap =
    settlementsByDate.get(settlementDate) ?? new Map<string, any>();

  const merchantOrdersMap = new Map<string, any[]>();
  const shipperOrdersMap = new Map<string, any[]>();

  for (const order of completedOrders) {
    const merchantIds = [
      order?.merchantId,
      order?.storeId,
      order?.shopId,
      order?.sellerId,
    ]
      .map((value) => String(value ?? "").trim())
      .filter(Boolean);

    const shipperIds = [
      order?.shipperId,
      order?.driverId,
      order?.shipperUid,
      order?.driverUid,
      order?.shipper?.id,
      order?.shipper?.uid,
    ]
      .map((value) => String(value ?? "").trim())
      .filter(Boolean);

    for (const id of merchantIds) {
      if (!merchantOrdersMap.has(id)) merchantOrdersMap.set(id, []);
      merchantOrdersMap.get(id)!.push(order);
    }

    for (const id of shipperIds) {
      if (!shipperOrdersMap.has(id)) shipperOrdersMap.set(id, []);
      shipperOrdersMap.get(id)!.push(order);
    }
  }

  const result: SettlementRow[] = [];

  /* -------------------------------------------------------
     MERCHANT
  ------------------------------------------------------- */

  if (roleFilter === "ALL" || roleFilter === "MERCHANT") {
    for (const [merchantId, merchant] of merchants.entries()) {
      const orders = merchantOrdersMap.get(merchantId) ?? [];
      const settlementId = getSettlementId(settlementDate, "MERCHANT", merchantId);
      const saved = settlementMap.get(settlementId);

      if (orders.length === 0 && !saved) continue;

      let originalGross = 0;
      let saleGross = 0;
      let commissionAmount = 0;
      let netAmount = 0;

      for (const order of orders) {
        const voucherInfo = getVoucherInfo(order);
        const shippingInfo = getShippingInfo(order, voucherInfo.shippingDiscount);

        const customerPaid = Math.max(
          0,
          num(
            order?.finalTotal ??
              order?.finalPrice ??
              order?.paidTotal ??
              order?.totalPrice ??
              order?.total ??
              order?.amount
          )
        );

        const orderSaleGross = getSaleGross(
          order,
          customerPaid,
          shippingInfo.shippingPaidByCustomer,
          voucherInfo.shippingDiscount
        );

        const orderOriginalGross = getOriginalGross(order) || orderSaleGross;

        const merchantKey = String(
          order?.merchantId ?? order?.storeId ?? order?.shopId ?? merchantId
        );

        const merchantPercent = clamp(
          num(
            order?.financial?.merchant?.commissionPercent ??
              order?.merchantCommissionPercent ??
              merchantCommissionMap.get(merchantKey) ??
              merchantCommissionMap.get(String(order?.merchantCode ?? "")) ??
              config.platformFeePercent
          ),
          0,
          100
        );

        const orderCommission = Math.round((orderOriginalGross * merchantPercent) / 100);
        const orderNet = Math.max(0, orderSaleGross - orderCommission);

        originalGross += orderOriginalGross;
        saleGross += orderSaleGross;
        commissionAmount += orderCommission;
        netAmount += orderNet;
      }

      const status = String(saved?.t1Status ?? "PENDING_T") as SettlementRow["t1Status"];
      const locked = status === "READY_T1" || status === "PAID_T1";

      const finalSaleGross = locked && num(saved?.basisAmount) > 0 ? num(saved.basisAmount) : saleGross;
      const finalCommission =
        locked && num(saved?.platformRetention) >= 0
          ? num(saved.platformRetention)
          : commissionAmount;
      const finalNet = locked && num(saved?.amountDue) >= 0 ? num(saved.amountDue) : netAmount;

      result.push({
        id: settlementId,
        settlementId,
        partnerId: merchantId,
        role: "MERCHANT",
        settlementDate,
        name:
          merchant?.fullName ??
          merchant?.ownerName ??
          merchant?.name ??
          merchant?.storeName ??
          merchant?.shopName ??
          "Chưa đặt tên Store",
        phone: merchant?.phone ?? merchant?.phoneNumber ?? "---",
        bankAccount: {
          bankName: merchant?.bankAccount?.bankName ?? merchant?.bankName ?? "Chưa cập nhật",
          accountNumber:
            merchant?.bankAccount?.accountNumber ?? merchant?.accountNumber ?? "---",
          accountHolder:
            merchant?.bankAccount?.accountHolder ??
            merchant?.accountHolder ??
            merchant?.bankOwner ??
            "---",
        },
        orderCount: locked && num(saved?.orderCount) > 0 ? num(saved.orderCount) : orders.length,
        basisAmount: finalSaleGross,
        platformRetention: finalCommission,
        extraEarning: 0,
        unpaidAmount: finalNet,
        totalGMV: finalSaleGross,
        platformFee: finalCommission,
        merchant: {
          saleGross: finalSaleGross,
          originalGross:
            locked && num(saved?.breakdown?.merchant?.originalGross) > 0
              ? num(saved.breakdown.merchant.originalGross)
              : originalGross,
          commissionAmount: finalCommission,
          netAmount: finalNet,
        },
        isPaid: status === "PAID_T1",
        t1Status: status,
        paidAt: saved?.paidAt ?? null,
        accountantNote: String(saved?.accountantNote ?? ""),
        isLockedSnapshot: locked,
      });
    }
  }

  /* -------------------------------------------------------
     SHIPPER
  ------------------------------------------------------- */

  if (roleFilter === "ALL" || roleFilter === "SHIPPER") {
    for (const [shipperId, shipper] of shippers.entries()) {
      const orders = shipperOrdersMap.get(shipperId) ?? [];
      const settlementId = getSettlementId(settlementDate, "SHIPPER", shipperId);
      const saved = settlementMap.get(settlementId);

      if (orders.length === 0 && !saved) continue;

      let shippingBaseFee = 0;
      let shippingPaidByCustomer = 0;
      let shippingRetained = 0;
      let shippingBaseEarning = 0;
      let shippingBonus = 0;
      let orderCommission = 0;
      let totalEarning = 0;

      for (const order of orders) {
        const voucherInfo = getVoucherInfo(order);
        const shippingInfo = getShippingInfo(order, voucherInfo.shippingDiscount);

        const customerPaid = Math.max(
          0,
          num(
            order?.finalTotal ??
              order?.finalPrice ??
              order?.paidTotal ??
              order?.totalPrice ??
              order?.total ??
              order?.amount
          )
        );

        const saleGross = getSaleGross(
          order,
          customerPaid,
          shippingInfo.shippingPaidByCustomer,
          voucherInfo.shippingDiscount
        );

        const originalGross = getOriginalGross(order) || saleGross;

        const share = getShippingShareByDistance(
          order?.distanceKm ?? order?.distance ?? order?.deliveryDistanceKm,
          config.shippingRetainedPercent
        );

        const orderBaseShippingEarning = Math.max(
          0,
          Math.round((shippingInfo.baseShippingFee * share.shipperPercent) / 100)
        );

        const orderShippingRetained = Math.max(
          0,
          shippingInfo.baseShippingFee - orderBaseShippingEarning
        );

        const orderShippingBonus = Math.round(
          (shippingInfo.baseShippingFee * config.shipperShippingCommissionPercent) / 100
        );

        const orderCommissionBase = getShipperOrderCommissionBase(
          order,
          originalGross,
          saleGross
        );

        const orderOrderCommission = Math.round(
          (orderCommissionBase * config.shipperOrderCommissionPercent) / 100
        );

        const orderTotalEarning =
          orderBaseShippingEarning + orderShippingBonus + orderOrderCommission;

        shippingBaseFee += shippingInfo.baseShippingFee;
        shippingPaidByCustomer += shippingInfo.shippingPaidByCustomer;
        shippingRetained += orderShippingRetained;
        shippingBaseEarning += orderBaseShippingEarning;
        shippingBonus += orderShippingBonus;
        orderCommission += orderOrderCommission;
        totalEarning += orderTotalEarning;
      }

      const status = String(saved?.t1Status ?? "PENDING_T") as SettlementRow["t1Status"];
      const locked = status === "READY_T1" || status === "PAID_T1";

      const finalBase = locked && num(saved?.basisAmount) > 0 ? num(saved.basisAmount) : shippingBaseFee;
      const finalRetention =
        locked && num(saved?.platformRetention) >= 0
          ? num(saved.platformRetention)
          : shippingRetained;
      const finalExtra =
        locked && num(saved?.extraEarning) >= 0
          ? num(saved.extraEarning)
          : shippingBonus + orderCommission;
      const finalAmountDue =
        locked && num(saved?.amountDue) >= 0 ? num(saved.amountDue) : totalEarning;

      result.push({
        id: settlementId,
        settlementId,
        partnerId: shipperId,
        role: "SHIPPER",
        settlementDate,
        name: shipper?.fullName ?? shipper?.name ?? shipper?.driverName ?? "Chưa đặt tên Shipper",
        phone: shipper?.phone ?? shipper?.phoneNumber ?? "---",
        bankAccount: {
          bankName: shipper?.bankAccount?.bankName ?? shipper?.bankName ?? "Chưa cập nhật",
          accountNumber:
            shipper?.bankAccount?.accountNumber ?? shipper?.accountNumber ?? "---",
          accountHolder:
            shipper?.bankAccount?.accountHolder ??
            shipper?.accountHolder ??
            shipper?.bankOwner ??
            "---",
        },
        orderCount: locked && num(saved?.orderCount) > 0 ? num(saved.orderCount) : orders.length,
        basisAmount: finalBase,
        platformRetention: finalRetention,
        extraEarning: finalExtra,
        unpaidAmount: finalAmountDue,
        totalGMV: finalBase,
        platformFee: finalRetention,
        shipper: {
          shippingBaseFee: finalBase,
          shippingPaidByCustomer:
            locked && num(saved?.breakdown?.shipper?.shippingPaidByCustomer) >= 0
              ? num(saved.breakdown.shipper.shippingPaidByCustomer)
              : shippingPaidByCustomer,
          shippingRetained: finalRetention,
          shippingBaseEarning:
            locked && num(saved?.breakdown?.shipper?.shippingBaseEarning) >= 0
              ? num(saved.breakdown.shipper.shippingBaseEarning)
              : shippingBaseEarning,
          shippingBonus:
            locked && num(saved?.breakdown?.shipper?.shippingBonus) >= 0
              ? num(saved.breakdown.shipper.shippingBonus)
              : shippingBonus,
          orderCommission:
            locked && num(saved?.breakdown?.shipper?.orderCommission) >= 0
              ? num(saved.breakdown.shipper.orderCommission)
              : orderCommission,
          totalEarning: finalAmountDue,
        },
        isPaid: status === "PAID_T1",
        t1Status: status,
        paidAt: saved?.paidAt ?? null,
        accountantNote: String(saved?.accountantNote ?? ""),
        isLockedSnapshot: locked,
      });
    }
  }


  const priority: Record<string, number> = {
    ERROR: 0,
    PENDING_T: 1,
    READY_T1: 2,
    PAID_T1: 3,
  };

  return result.sort((a, b) => {
    if (a.t1Status !== b.t1Status) {
      return (priority[a.t1Status] ?? 9) - (priority[b.t1Status] ?? 9);
    }

    return b.unpaidAmount - a.unpaidAmount;
  });
};

const sortSettlementRows = (rows: SettlementRow[]): SettlementRow[] => {
  const priority: Record<string, number> = {
    ERROR: 0,
    PENDING_T: 1,
    READY_T1: 2,
    PAID_T1: 3,
  };

  return rows.sort((a, b) => {
    if (a.settlementDate !== b.settlementDate) {
      return b.settlementDate.localeCompare(a.settlementDate);
    }

    if (a.t1Status !== b.t1Status) {
      return (priority[a.t1Status] ?? 9) - (priority[b.t1Status] ?? 9);
    }

    return b.unpaidAmount - a.unpaidAmount;
  });
};

/* =========================================================
   GET
========================================================= */

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const role = normalizeRole(searchParams.get("role"));
    const date = normalizeDateKey(searchParams.get("date"));
    const fromDate = normalizeDateKey(searchParams.get("fromDate"));
    const toDate = normalizeDateKey(searchParams.get("toDate"));
    const all = searchParams.get("all") === "true";

    if (fromDate && toDate && fromDate > toDate) {
      return NextResponse.json(
        {
          success: false,
          message: "Khoảng ngày không hợp lệ: fromDate phải nhỏ hơn hoặc bằng toDate",
        },
        { status: 400 }
      );
    }

    const source = await loadAccountingSource();
    const today = getTodayVN();

    let settlementDates: string[] = [];

    if (date) {
      settlementDates = [date];
    } else if (all) {
      settlementDates = source.availableDates;
    } else if (fromDate || toDate) {
      const rangeFrom = fromDate || toDate;
      const rangeTo = toDate || fromDate;

      settlementDates = source.availableDates.filter((dateKey) =>
        isDateInRange(dateKey, rangeFrom, rangeTo)
      );
    } else {
      settlementDates = [today];
    }

    settlementDates = Array.from(new Set(settlementDates))
      .filter((dateKey) => dateKey <= today)
      .sort((a, b) => b.localeCompare(a));

    const partnersData = sortSettlementRows(
      settlementDates.flatMap((settlementDate) =>
        buildSettlementRowsForDate(settlementDate, role, source)
      )
    );

    const merchantIds = new Set<string>();
    const shipperIds = new Set<string>();

    const summary = partnersData.reduce(
      (acc, row) => {
        acc.totalRows += 1;
        acc.totalOrders += row.orderCount;
        acc.totalPayable += row.unpaidAmount;
        acc.totalPlatformRetention += row.platformRetention;

        if (row.role === "MERCHANT") {
          merchantIds.add(row.partnerId);
          acc.merchantPayable += row.unpaidAmount;
        } else {
          shipperIds.add(row.partnerId);
          acc.shipperPayable += row.unpaidAmount;
        }

        if (row.t1Status === "PAID_T1") {
          acc.paidAmount += row.unpaidAmount;
          acc.paidCount += 1;
        } else {
          acc.unpaidAmount += row.unpaidAmount;
          acc.unpaidCount += 1;
        }

        if (row.t1Status === "READY_T1") acc.readyCount += 1;
        if (row.t1Status === "ERROR") acc.errorCount += 1;

        return acc;
      },
      {
        totalRows: 0,
        totalPartners: 0,
        totalOrders: 0,
        totalPayable: 0,
        merchantPayable: 0,
        shipperPayable: 0,
        totalPlatformRetention: 0,
        paidAmount: 0,
        unpaidAmount: 0,
        merchantCount: 0,
        shipperCount: 0,
        paidCount: 0,
        unpaidCount: 0,
        readyCount: 0,
        errorCount: 0,
      }
    );

    summary.merchantCount = merchantIds.size;
    summary.shipperCount = shipperIds.size;
    summary.totalPartners = merchantIds.size + shipperIds.size;

    return NextResponse.json({
      success: true,
      data: partnersData,
      summary,
      meta: {
        role,
        timeZone: VN_TIME_ZONE,
        mode: all ? "ALL" : date ? "SINGLE_DATE" : "DATE_RANGE",
        date: date || null,
        fromDate: all ? null : fromDate || date || null,
        toDate: all ? null : toDate || date || null,
        settlementDateCount: settlementDates.length,
        settlementDates,
        earliestDate:
          settlementDates.length > 0
            ? settlementDates[settlementDates.length - 1]
            : null,
        latestDate: settlementDates.length > 0 ? settlementDates[0] : null,
      },
    });
  } catch (error: any) {
    console.error("Lỗi API Accounting GET:", error);

    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Lỗi truy xuất dữ liệu đối soát",
      },
      { status: 500 }
    );
  }
}

/* =========================================================
   PATCH
========================================================= */

export async function PATCH(request: Request) {
  try {
    const body = await request.json();

    const rows = Array.isArray(body?.settlements) ? body.settlements : [];
    const fallbackDate = normalizeDateKey(body?.date);

    const t1Status = body?.t1Status
      ? String(body.t1Status).toUpperCase().trim()
      : undefined;

    const accountantNote =
      body?.accountantNote !== undefined
        ? String(body.accountantNote)
        : undefined;

    if (rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Danh sách đối soát không hợp lệ",
        },
        { status: 400 }
      );
    }

    const allowedStatuses = ["PENDING_T", "READY_T1", "PAID_T1", "ERROR"];

    if (t1Status && !allowedStatuses.includes(t1Status)) {
      return NextResponse.json(
        {
          success: false,
          message: "Trạng thái T+1 không hợp lệ",
        },
        { status: 400 }
      );
    }

    if (!t1Status && accountantNote === undefined) {
      return NextResponse.json(
        {
          success: false,
          message: "Không có dữ liệu cần cập nhật",
        },
        { status: 400 }
      );
    }

    const requestedDates: string[] = Array.from(
      new Set<string>(
        rows
          .map(
            (row: any): string =>
              normalizeDateKey(row?.settlementDate) || fallbackDate
          )
          .filter((dateKey: string) => dateKey.length > 0)
      )
    );

    if (requestedDates.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Không xác định được ngày đối soát",
        },
        { status: 400 }
      );
    }

    const source = await loadAccountingSource();

    const currentRows = requestedDates.flatMap((settlementDate) =>
      buildSettlementRowsForDate(settlementDate, "ALL", source)
    );

    const currentMap = new Map(
      currentRows.map((row) => [row.settlementId, row])
    );

    const writes: Array<{
      ref: any;
      data: Record<string, any>;
    }> = [];

    for (const selected of rows) {
      const settlementId = String(
        selected?.settlementId ?? selected?.id ?? ""
      ).trim();

      if (!settlementId) continue;

      const current = currentMap.get(settlementId);
      if (!current) continue;

      const ref = adminDb
        .collection(SETTLEMENT_COLLECTION)
        .doc(settlementId);

      const updateData: Record<string, any> = {
        settlementId,
        settlementDate: current.settlementDate,
        partnerId: current.partnerId,
        role: current.role,
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (accountantNote !== undefined) {
        updateData.accountantNote = accountantNote;
      }

      if (t1Status) {
        updateData.t1Status = t1Status;
        updateData.isPaid = t1Status === "PAID_T1";

        /*
         * READY_T1 = khóa snapshot số tiền chuẩn bị chi.
         * PAID_T1  = tiếp tục dùng snapshot đã khóa.
         *
         * buildSettlementRowsForDate() đã ưu tiên snapshot nếu bản ghi
         * hiện tại đang READY_T1 / PAID_T1, nên chuyển READY_T1 -> PAID_T1
         * không làm thay đổi số tiền lịch sử.
         */
        if (t1Status === "READY_T1" || t1Status === "PAID_T1") {
          updateData.orderCount = current.orderCount;
          updateData.basisAmount = current.basisAmount;
          updateData.platformRetention = current.platformRetention;
          updateData.extraEarning = current.extraEarning;
          updateData.amountDue = current.unpaidAmount;
          updateData.breakdown = {
            merchant: current.merchant ?? null,
            shipper: current.shipper ?? null,
          };
          updateData.snapshotAt = FieldValue.serverTimestamp();
        }

        if (t1Status === "PAID_T1") {
          updateData.paidAt = FieldValue.serverTimestamp();
        } else {
          updateData.paidAt = null;
        }
      }

      writes.push({
        ref,
        data: updateData,
      });
    }

    if (writes.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Không tìm thấy bản ghi đối soát hợp lệ",
        },
        { status: 404 }
      );
    }

    /*
     * Firestore batch giới hạn số write trong một commit.
     * Chia nhỏ để thao tác "Tất cả thời gian" vẫn an toàn.
     */
    const BATCH_SIZE = 400;

    for (let index = 0; index < writes.length; index += BATCH_SIZE) {
      const batch = adminDb.batch();
      const chunk = writes.slice(index, index + BATCH_SIZE);

      chunk.forEach(({ ref, data }) => {
        batch.set(ref, data, { merge: true });
      });

      await batch.commit();
    }

    return NextResponse.json({
      success: true,
      message: `Đã cập nhật ${writes.length} bản ghi đối soát.`,
      updatedCount: writes.length,
      settlementDateCount: requestedDates.length,
    });
  } catch (error: any) {
    console.error("Lỗi API Accounting PATCH:", error);

    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Lỗi cập nhật đối soát",
      },
      { status: 500 }
    );
  }
}
