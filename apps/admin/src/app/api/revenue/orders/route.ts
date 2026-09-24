import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

/* =========================================================
   HELPERS
========================================================= */

const num = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const parseDate = (value: any): Date => {
  if (!value) {
    return new Date();
  }

  try {
    if (typeof value?.toDate === "function") {
      return value.toDate();
    }

    if (value?.seconds !== undefined) {
      return new Date(num(value.seconds) * 1000);
    }

    if (value?._seconds !== undefined) {
      return new Date(num(value._seconds) * 1000);
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? new Date()
      : date;
  } catch {
    return new Date();
  }
};

/* =========================================================
   VOUCHER
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

  const singleDiscount = num(
    data?.voucherDiscount
  );

  const applyType = String(
    data?.voucherApplyType ??
      data?.applyType ??
      voucher?.applyType ??
      voucher?.type ??
      ""
  )
    .toUpperCase()
    .trim();

  /*
   * Một số order cũ chỉ lưu voucherDiscount.
   * Chỉ đưa sang shippingDiscount nếu biết chắc là voucher ship.
   */
  if (
    singleDiscount > 0 &&
    orderDiscount <= 0 &&
    shippingDiscount <= 0
  ) {
    if (
      applyType === "SHIPPING" ||
      applyType === "SHIP"
    ) {
      shippingDiscount = singleDiscount;
    } else {
      orderDiscount = singleDiscount;
    }
  }

  return {
    voucher,
    voucherCode,
    voucherId,

    orderDiscount:
      Math.max(0, orderDiscount),

    shippingDiscount:
      Math.max(0, shippingDiscount),

    applyType,

    fundingType: String(
      data?.voucherFundingType ??
        data?.fundingType ??
        voucher?.fundingType ??
        ""
    )
      .toUpperCase()
      .trim(),

    platformFundingPercent: num(
      data?.platformFundingPercent ??
        voucher?.platformFundingPercent
    ),

    merchantFundingPercent: num(
      data?.merchantFundingPercent ??
        voucher?.merchantFundingPercent
    ),
  };
};

/* =========================================================
   SHIPPING BEFORE VOUCHER
========================================================= */

const getShippingFeeBeforeVoucher = (
  data: any,
  shippingVoucherDiscount: number
): {
  amount: number;
  source:
    | "DIRECT"
    | "BASE_PLUS_APPLIED"
    | "LEGACY_COMPONENTS"
    | "NO_VOUCHER"
    | "POST_VOUCHER_PLUS_DISCOUNT"
    | "MISSING";
} => {
  /*
   * 1. Field chính xác được lưu trực tiếp.
   */
  const directCandidates = [
    data?.shippingFeeBeforeVoucher,
    data?.shippingFeeBeforeDiscount,
    data?.shippingFeeOriginal,
    data?.initialShippingFee,
    data?.totalShippingBeforeVoucher,
    data?.preVoucherShippingFee,
    data?.originalShippingFee,
  ];

  for (const candidate of directCandidates) {
    const value = num(candidate);

    if (value > 0) {
      return {
        amount: value,
        source: "DIRECT",
      };
    }
  }

  /*
   * 2. Schema checkout hiện tại:
   *
   * baseShippingFee = phí theo khoảng cách
   * appliedFee      = phụ phí
   * shippingFee     = phí khách trả sau voucher
   *
   * Ví dụ:
   * baseShippingFee = 14.000
   * appliedFee      = 3.000
   *
   * => phí trước voucher = 17.000
   */
  const baseShippingFee =
    num(data?.baseShippingFee);

  const appliedFee =
    num(data?.appliedFee);

  const peakHourFee =
    num(data?.peakHourFee);

  const rainFee =
    num(data?.rainFee);

  if (baseShippingFee > 0) {
    const surcharge =
      appliedFee > 0
        ? appliedFee
        : peakHourFee + rainFee;

    return {
      amount:
        baseShippingFee +
        Math.max(0, surcharge),

      source:
        "BASE_PLUS_APPLIED",
    };
  }

  /*
   * 3. Legacy components.
   */
  const legacyShipping =
    num(data?.shippingBaseAmount) +
    num(data?.appliedFee);

  if (legacyShipping > 0) {
    return {
      amount: legacyShipping,
      source:
        "LEGACY_COMPONENTS",
    };
  }

  const customerShippingFee =
    Math.max(
      0,
      num(
        data?.shippingFee ??
          data?.shipFee ??
          data?.deliveryFee
      )
    );

  /*
   * 4. Không có voucher:
   * shippingFee chính là phí gốc.
   */
  if (
    customerShippingFee > 0 &&
    shippingVoucherDiscount <= 0
  ) {
    return {
      amount: customerShippingFee,
      source: "NO_VOUCHER",
    };
  }

  /*
   * 5. Legacy có voucher nhưng không còn baseShippingFee.
   *
   * Chỉ sử dụng khi đã xác định rõ shippingDiscount.
   */
  if (
    customerShippingFee >= 0 &&
    shippingVoucherDiscount > 0
  ) {
    return {
      amount:
        customerShippingFee +
        shippingVoucherDiscount,

      source:
        "POST_VOUCHER_PLUS_DISCOUNT",
    };
  }

  return {
    amount: 0,
    source: "MISSING",
  };
};

/* =========================================================
   ORIGINAL GROSS
========================================================= */

const getOriginalGross = (
  data: any
): number => {
  /*
   * Ưu tiên originalPrice trong item.
   */
  if (Array.isArray(data?.items)) {
    let total = 0;
    let foundOriginalPrice = false;

    for (const item of data.items) {
      const originalPrice = num(
        item?.originalPrice ??
          item?.originalUnitPrice ??
          item?.listPrice ??
          item?.regularPrice
      );

      const quantity =
        Math.max(
          1,
          num(item?.quantity ?? 1)
        );

      if (originalPrice > 0) {
        foundOriginalPrice = true;

        total +=
          originalPrice *
          quantity;
      }
    }

    if (
      foundOriginalPrice &&
      total > 0
    ) {
      return total;
    }
  }

  /*
   * Order-level.
   */
  const directCandidates = [
    data?.originalSubTotalPrice,
    data?.subtotalBeforeDiscount,
    data?.grossBeforeDiscount,
    data?.originalGMV,
    data?.originalTotalPrice,
  ];

  for (const candidate of directCandidates) {
    const value = num(candidate);

    if (value > 0) {
      return value;
    }
  }

  /*
   * Legacy của dữ liệu Anvami hiện tại.
   *
   * Ví dụ:
   * 2 x Trà sữa 45.000
   * => subTotalCostPrice = 90.000
   */
  const legacySubtotal =
    num(
      data?.subTotalCostPrice ??
        data?.costPriceTotal ??
        data?.basePrice
    );

  if (legacySubtotal > 0) {
    return legacySubtotal;
  }

  if (Array.isArray(data?.items)) {
    let total = 0;

    for (const item of data.items) {
      const price = num(
        item?.costPrice ??
          item?.basePrice ??
          item?.price
      );

      const quantity =
        Math.max(
          1,
          num(item?.quantity ?? 1)
        );

      total +=
        price *
        quantity;
    }

    if (total > 0) {
      return total;
    }
  }

  return 0;
};

/* =========================================================
   SALE GROSS
========================================================= */

const getSaleGross = (
  data: any,
  totalPrice: number,
  shippingPaidByCustomer: number
): number => {
  const direct = num(
    data?.subTotalPrice ??
      data?.subtotal ??
      data?.itemsPrice
  );

  if (direct > 0) {
    return direct;
  }

  if (Array.isArray(data?.items)) {
    let total = 0;

    for (const item of data.items) {
      const price =
        num(
          item?.price ??
            item?.salePrice ??
            item?.unitPrice
        );

      const quantity =
        Math.max(
          1,
          num(item?.quantity ?? 1)
        );

      total +=
        price *
        quantity;
    }

    if (total > 0) {
      return total;
    }
  }

  return Math.max(
    0,
    totalPrice -
      shippingPaidByCustomer
  );
};

/* =========================================================
   ORDER TYPE
========================================================= */

interface OrderDocument {
  docId: string;

  paymentCode?: string;
  paymentMethod?: string;
  paymentStatus?: string;

  customerName?: string;
  recipientName?: string;

  customerAddress?: string;
  address?: string;

  storeName?: string;
  shopName?: string;
  storeAddress?: string;

  merchantId?: string;
  merchantCode?: string;

  shipperId?: string;
  shipperName?: string;

  status?: string;

  items?: any[];

  subTotalCostPrice?: number;
  costPriceTotal?: number;

  subTotalPrice?: number;

  shippingFee?: number;
  shipFee?: number;
  deliveryFee?: number;

  shippingFeeBeforeVoucher?: number;
  shippingFeeBeforeDiscount?: number;
  shippingFeeOriginal?: number;

  baseShippingFee?: number;
  appliedFee?: number;
  peakHourFee?: number;
  rainFee?: number;

  distanceKm?: number;
  distance?: number;
  distanceStr?: string;

  totalPrice?: number;
  finalTotal?: number;
  finalPrice?: number;
  paidTotal?: number;

  createdAt?: any;
  createdDate?: Date;

  [key: string]: any;
}

/* =========================================================
   GET
========================================================= */

export async function GET(
  request: Request
) {
  try {
    const { searchParams } =
      new URL(request.url);

    const time =
      searchParams.get("time");

    const timeFrame =
      searchParams.get(
        "timeFrame"
      ) || "DAY";

    const viewType =
      (
        searchParams.get(
          "viewType"
        ) || "PLATFORM"
      )
        .toUpperCase()
        .trim();

    const partnerId =
      String(
        searchParams.get(
          "partnerId"
        ) ?? ""
      ).trim();

    /* =====================================================
       ORDERS
    ===================================================== */

    const ordersSnap =
      await adminDb
        .collection("orders")
        .get();

    if (ordersSnap.empty) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    const filteredOrders:
      OrderDocument[] = [];

    for (
      const orderDoc of
      ordersSnap.docs
    ) {
      const data =
        orderDoc.data() as Record<
          string,
          any
        >;

      const status =
        String(
          data?.status ?? ""
        )
          .toLowerCase()
          .trim();

      if (
        status !== "completed" &&
        status !== "delivered"
      ) {
        continue;
      }

      /* ---------------------------------------------------
         MERCHANT FILTER
      --------------------------------------------------- */

      const orderMerchantIds = [
        data?.merchantId,
        data?.storeId,
        data?.shopId,
        data?.merchantCode,
      ]
        .map((value) =>
          String(
            value ?? ""
          ).trim()
        )
        .filter(Boolean);

      if (
        viewType ===
          "MERCHANT" &&
        partnerId &&
        !orderMerchantIds.includes(
          partnerId
        )
      ) {
        continue;
      }

      /* ---------------------------------------------------
         SHIPPER FILTER
      --------------------------------------------------- */

      const orderShipperIds = [
        data?.shipperId,
        data?.driverId,
        data?.shipperUid,
        data?.driverUid,
        data?.shipper?.id,
        data?.shipper?.uid,
      ]
        .map((value) =>
          String(
            value ?? ""
          ).trim()
        )
        .filter(Boolean);

      if (
        viewType === "SHIPPER" &&
        partnerId &&
        !orderShipperIds.includes(
          partnerId
        )
      ) {
        continue;
      }

      /* ---------------------------------------------------
         DATE
      --------------------------------------------------- */

      const createdDate =
        parseDate(data?.createdAt);

      let key = "Tất cả";

      if (
        timeFrame === "HOUR"
      ) {
        key =
          `${createdDate
            .getHours()
            .toString()
            .padStart(
              2,
              "0"
            )}:00`;
      } else if (
        timeFrame === "DAY"
      ) {
        key =
          `${createdDate
            .getDate()
            .toString()
            .padStart(
              2,
              "0"
            )}/` +
          `${(
            createdDate.getMonth() +
            1
          )
            .toString()
            .padStart(
              2,
              "0"
            )}`;
      } else if (
        timeFrame === "MONTH"
      ) {
        key =
          `Thg ${(
            createdDate.getMonth() +
            1
          )
            .toString()
            .padStart(
              2,
              "0"
            )}/` +
          createdDate.getFullYear();
      } else if (
        timeFrame === "YEAR"
      ) {
        key =
          `Năm ${createdDate.getFullYear()}`;
      }

      if (
        time &&
        time !== "Tất cả" &&
        key !== time
      ) {
        continue;
      }

      filteredOrders.push({
        docId: orderDoc.id,
        ...data,
        createdDate,
      });
    }

    /* =====================================================
       NORMALIZE RESULT
    ===================================================== */

    const resultData =
      filteredOrders.map(
        (order) => {
          /* -----------------------------------------------
             VOUCHER
          ----------------------------------------------- */

          const voucherInfo =
            getVoucherInfo(
              order
            );

          /* -----------------------------------------------
             SHIPPING
          ----------------------------------------------- */

          const shippingPaidByCustomer =
            Math.max(
              0,
              num(
                order?.shippingFee ??
                  order?.shipFee ??
                  order?.deliveryFee
              )
            );

          const shippingBefore =
            getShippingFeeBeforeVoucher(
              order,
              voucherInfo.shippingDiscount
            );

          const shippingFeeBeforeVoucher =
            shippingBefore.amount;

          /* -----------------------------------------------
             CUSTOMER PAID
          ----------------------------------------------- */

          const totalPrice =
            Math.max(
              0,
              num(
                order?.finalTotal ??
                  order?.finalPrice ??
                  order?.paidTotal ??
                  order?.totalPrice ??
                  order?.total ??
                  order?.amount ??
                  order?.finalAmount
              )
            );

          /* -----------------------------------------------
             PRODUCT VALUES
          ----------------------------------------------- */

          const originalGross =
            getOriginalGross(
              order
            );

          const saleGross =
            getSaleGross(
              order,
              totalPrice,
              shippingPaidByCustomer
            );

          /* -----------------------------------------------
             SHIPPING COMPONENTS
          ----------------------------------------------- */

          const baseShippingFee =
            num(
              order?.baseShippingFee
            );

          const appliedFee =
            num(
              order?.appliedFee
            );

          const peakHourFee =
            num(
              order?.peakHourFee
            );

          const rainFee =
            num(
              order?.rainFee
            );

          /* -----------------------------------------------
             RETURN
          ----------------------------------------------- */

          return {
            /*
             * ID
             */
            id: order.docId,

            paymentCode:
              order?.paymentCode ??
              order.docId,

            /*
             * PAYMENT
             */
            paymentMethod:
              order?.paymentMethod ??
              "banking",

            paymentStatus:
              order?.paymentStatus ??
              "paid",

            /*
             * CUSTOMER
             */
            customerName:
              order?.customerName ??
              order?.recipientName ??
              "Khách hàng",

            recipientName:
              order?.recipientName,

            customerAddress:
              order?.customerAddress ??
              order?.address,

            address:
              order?.address,

            customerPhone:
              order?.customerPhone ??
              order?.phone,

            /*
             * MERCHANT
             */
            storeName:
              order?.storeName ??
              order?.shopName ??
              "Gian hàng",

            shopName:
              order?.shopName ??
              order?.storeName,

            storeAddress:
              order?.storeAddress,

            merchantId:
              order?.merchantId ??
              order?.storeId ??
              order?.shopId,

            merchantCode:
              order?.merchantCode,

            /*
             * SHIPPER
             */
            shipperId:
              order?.shipperId ??
              order?.driverId ??
              order?.shipperUid ??
              order?.driverUid,

            shipperName:
              order?.shipperName ??
              order?.driverName,

            shipperNote:
              order?.shipperNote,

            /*
             * ITEMS
             *
             * QUAN TRỌNG:
             * trước đây API không trả items.
             */
            items:
              Array.isArray(
                order?.items
              )
                ? order.items
                : [],

            /*
             * PRODUCT / GMV
             */
            originalSubTotalPrice:
              num(
                order
                  ?.originalSubTotalPrice
              ) ||
              originalGross,

            subtotalBeforeDiscount:
              num(
                order
                  ?.subtotalBeforeDiscount
              ),

            grossBeforeDiscount:
              num(
                order
                  ?.grossBeforeDiscount
              ),

            originalGMV:
              num(
                order
                  ?.originalGMV
              ),

            originalTotalPrice:
              num(
                order
                  ?.originalTotalPrice
              ),

            subTotalCostPrice:
              originalGross,

            costPriceTotal:
              num(
                order?.costPriceTotal
              ),

            subTotalPrice:
              saleGross,

            subtotal:
              saleGross,

            /*
             * SHIPPING
             *
             * shippingFee:
             * khách thực trả sau voucher.
             *
             * shippingFeeBeforeVoucher:
             * base dùng để tính Shipper.
             */
            shippingFee:
              shippingPaidByCustomer,

            shippingFeeBeforeVoucher,

            shippingFeeBeforeDiscount:
              shippingFeeBeforeVoucher,

            shippingFeeOriginal:
              shippingFeeBeforeVoucher,

            /*
             * Không được thay baseShippingFee bằng
             * shippingFeeBeforeVoucher.
             *
             * baseShippingFee vẫn là phí khoảng cách.
             */
            baseShippingFee,

            appliedFee,

            peakHourFee,

            rainFee,

            distanceKm:
              num(
                order?.distanceKm ??
                  order?.distance
              ),

            distanceStr:
              order?.distanceStr,

            /*
             * VOUCHER
             */
            voucher:
              voucherInfo.voucher,

            voucherCode:
              voucherInfo.voucherCode,

            voucherId:
              voucherInfo.voucherId,

            voucherApplyType:
              voucherInfo.applyType,

            applyType:
              voucherInfo.applyType,

            orderVoucherDiscount:
              voucherInfo.orderDiscount,

            shippingVoucherDiscount:
              voucherInfo.shippingDiscount,

            voucherDiscount:
              voucherInfo.applyType ===
                "SHIPPING" ||
              voucherInfo.applyType ===
                "SHIP"
                ? voucherInfo.shippingDiscount
                : voucherInfo.orderDiscount,

            voucherFundingType:
              voucherInfo.fundingType,

            fundingType:
              voucherInfo.fundingType,

            platformFundingPercent:
              voucherInfo.platformFundingPercent,

            merchantFundingPercent:
              voucherInfo.merchantFundingPercent,

            /*
             * SHOP VOUCHER
             */
            shopVoucherCode:
              order?.shopVoucherCode ??
              null,

            shopVoucherDiscount:
              num(
                order
                  ?.shopVoucherDiscount
              ),

            /*
             * TOTAL
             */
            totalPrice,

            finalTotal:
              totalPrice,

            paidTotal:
              totalPrice,

            /*
             * STATUS / TIME
             */
            status:
              order?.status ??
              "completed",

            createdAt:
              order.createdDate
                ? order.createdDate.toISOString()
                : order?.createdAt,

            /*
             * DEBUG
             *
             * Giữ lại để nhìn ngay API đang lấy phí
             * trước voucher từ nguồn nào.
             */
            shippingDebug: {
              source:
                shippingBefore.source,

              shippingFeeBeforeVoucher,

              shippingPaidByCustomer,

              shippingVoucherDiscount:
                voucherInfo.shippingDiscount,

              baseShippingFee,

              appliedFee,

              peakHourFee,

              rainFee,
            },
          };
        }
      );

    return NextResponse.json({
      success: true,
      count: resultData.length,
      data: resultData,
    });
  } catch (error: any) {
    console.error(
      "Lỗi khi truy vấn đơn hàng chi tiết từ Firestore:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ??
          "Lỗi Firestore",
      },
      {
        status: 500,
      }
    );
  }
}