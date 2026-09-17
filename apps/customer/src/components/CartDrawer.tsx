"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/store/useCartStore";
import { isUserLoggedIn } from "@/utils/auth-guard";

/**
 * ============================================================
 * HELPERS
 * ============================================================
 */

/**
 * Chuyển chuỗi khoảng cách:
 *
 * "785m"
 * "1.2 km"
 * "785 m"
 *
 * thành KM.
 */
const parseDistanceToKm = (
  distanceStr: string = "1.0 km"
): number => {
  if (!distanceStr) {
    return 1.0;
  }

  const str =
    distanceStr
      .toLowerCase()
      .trim();

  const numericValue =
    parseFloat(
      str.replace(
        /[^0-9.]/g,
        ""
      )
    ) || 1.0;

  if (
    str.includes("m") &&
    !str.includes("km")
  ) {
    return numericValue / 1000;
  }

  return numericValue;
};

/**
 * Lấy merchant ID thống nhất.
 */
const getProductMerchantId = (
  product: {
    merchantId?: string;
    shopId?: string;
  }
): string => {
  return (
    product.merchantId ||
    product.shopId ||
    "unknown_merchant"
  );
};

/**
 * ============================================================
 * ETA
 * ============================================================
 */
const calculateETA = (
  prepTimeMinutes: number = 15,
  distanceKm: number = 1.0
): number => {
  const travelTimeMinutes =
    Math.round(
      distanceKm * 3 + 5
    );

  return (
    prepTimeMinutes +
    travelTimeMinutes
  );
};

/**
 * ============================================================
 * SHIPPING FEE
 * ============================================================
 */
const calculateShippingFeeDetails = (
  distanceKm: number = 1,
  orderDate: Date = new Date(),
  totalItemsCount: number = 1
) => {
  let baseFee = 0;

  const discount = 0;

  if (
    distanceKm <= 1
  ) {
    baseFee = 14000;
  } else if (
    distanceKm <= 2
  ) {
    baseFee = 18000;
  } else if (
    distanceKm <= 3
  ) {
    baseFee = 22000;
  } else if (
    distanceKm <= 4
  ) {
    baseFee = 26000;
  } else if (
    distanceKm <= 5
  ) {
    baseFee = 30000;
  } else {
    const extraKm =
      Math.ceil(
        distanceKm - 5
      );

    baseFee =
      30000 +
      extraKm * 5000;
  }

  const hours =
    orderDate.getHours();

  const minutes =
    orderDate.getMinutes();

  const timeInMinutes =
    hours * 60 + minutes;

  let timeSurcharge = 0;

  /**
   * 11:00 - 12:30
   */
  if (
    timeInMinutes >=
      11 * 60 &&
    timeInMinutes <=
      12 * 60 + 30
  ) {
    timeSurcharge = 2000;
  }

  /**
   * 18:00 - 19:59
   */
  else if (
    timeInMinutes >=
      18 * 60 &&
    timeInMinutes <=
      19 * 60 + 59
  ) {
    timeSurcharge = 4000;
  }

  /**
   * >= 20:00
   */
  else if (
    timeInMinutes >=
    20 * 60
  ) {
    timeSurcharge = 7000;
  }

  let bulkSurcharge = 0;

  let isSplitOrder =
    false;

  if (
    totalItemsCount >= 11 &&
    totalItemsCount <= 17
  ) {
    bulkSurcharge = 10000;
  } else if (
    totalItemsCount >= 18
  ) {
    baseFee =
      baseFee * 2;

    bulkSurcharge = 15000;

    isSplitOrder =
      true;
  }

  const finalFee =
    Math.max(
      0,
      baseFee +
        timeSurcharge +
        bulkSurcharge -
        discount
    );

  return {
    baseFee,
    timeSurcharge,
    bulkSurcharge,
    discount,
    finalFee,
    isSplitOrder,
  };
};

/**
 * ============================================================
 * CART DRAWER
 * ============================================================
 */
export function CartDrawer() {
  const router =
    useRouter();

  const {
    items,
    isOpen,
    closeCart,
    updateQuantity,
    removeItem,
    clearCart,
    selectedMerchantId,
    setSelectedMerchantId,
    getTotalPrice,
    getTotalItems,
  } = useCartStore();

  /**
   * ==========================================================
   * FORMAT CURRENCY
   * ==========================================================
   */
  const formatCurrency = (
    amount: number
  ) => {
    return new Intl.NumberFormat(
      "vi-VN",
      {
        style:
          "currency",
        currency:
          "VND",
      }
    ).format(amount);
  };

  /**
   * ==========================================================
   * INCREASE
   * ==========================================================
   *
   * QUAN TRỌNG:
   * Dùng lineId.
   */
  const handleIncreaseQuantity = (
    item: (typeof items)[number]
  ) => {
    updateQuantity(
      item.lineId,
      1
    );
  };

  /**
   * ==========================================================
   * DECREASE
   * ==========================================================
   */
  const handleDecreaseQuantity = (
    item: (typeof items)[number]
  ) => {
    updateQuantity(
      item.lineId,
      -1
    );
  };

  /**
   * ==========================================================
   * GROUP MERCHANT
   * ==========================================================
   */
  const groupedMerchants =
    useMemo(() => {
      const map: Record<
        string,
        {
          merchantId: string;
          shopName: string;
          distanceStr: string;
          distanceKm: number;
          estimatedMinutes: number;
          products: typeof items;
        }
      > = {};

      items.forEach(
        (item) => {
          const prod =
            item.product;

          /**
           * Merchant ID thống nhất:
           *
           * merchantId
           * ↓
           * shopId
           */
          const merchantId =
            getProductMerchantId(
              prod
            );

          const shopName =
            prod.merchantName ||
            prod.shopName ||
            prod.storeName ||
            "Cửa hàng";

          /**
           * Cart không lưu distance động.
           *
           * Tạm dùng 1km.
           *
           * Checkout sẽ tính lại
           * khoảng cách thật.
           */
          const rawDistance =
            (prod as any)
              .distance ||
            (prod as any)
              .distanceStr ||
            "1.0 km";

          const parsedDistance =
            parseDistanceToKm(
              rawDistance
            );

          const prepTime =
            Number(
              (prod as any)
                .prepTime
            ) || 15;

          const deliveryTime =
            calculateETA(
              prepTime,
              parsedDistance
            );

          if (
            !map[merchantId]
          ) {
            map[merchantId] = {
              merchantId,

              shopName,

              distanceStr:
                rawDistance,

              distanceKm:
                parsedDistance,

              estimatedMinutes:
                deliveryTime,

              products: [],
            };
          }

          map[
            merchantId
          ].products.push(
            item
          );
        }
      );

      return map;
    }, [items]);

  const merchantList =
    Object.values(
      groupedMerchants
    );

  /**
   * ==========================================================
   * ACTIVE MERCHANT
   * ==========================================================
   */
  const activeMerchantId =
    useMemo(() => {
      if (
        merchantList.length ===
        0
      ) {
        return null;
      }

      if (
        selectedMerchantId &&
        groupedMerchants[
          selectedMerchantId
        ]
      ) {
        return selectedMerchantId;
      }

      return merchantList[0]
        .merchantId;
    }, [
      selectedMerchantId,
      groupedMerchants,
      merchantList,
    ]);

  const activeMerchantData =
    activeMerchantId
      ? groupedMerchants[
          activeMerchantId
        ]
      : null;

  const activeItems =
    activeMerchantData
      ?.products ?? [];

  /**
   * ==========================================================
   * TOTAL PRICE
   * ==========================================================
   */
  const rawTotalPrice =
    useMemo(() => {
      if (
        !activeMerchantId
      ) {
        return 0;
      }

      return getTotalPrice(
        activeMerchantId
      );
    }, [
      activeMerchantId,
      getTotalPrice,
      items,
    ]);

  /**
   * ==========================================================
   * TOTAL ITEMS
   * ==========================================================
   */
  const activeItemsCount =
    useMemo(() => {
      if (
        !activeMerchantId
      ) {
        return 0;
      }

      return getTotalItems(
        activeMerchantId
      );
    }, [
      activeMerchantId,
      getTotalItems,
      items,
    ]);

  /**
   * ==========================================================
   * SHIPPING
   * ==========================================================
   */
  const shipCalculation =
    useMemo(() => {
      if (
        !activeMerchantData
      ) {
        return {
          baseFee: 0,
          timeSurcharge: 0,
          bulkSurcharge: 0,
          discount: 0,
          finalFee: 0,
          isSplitOrder: false,
        };
      }

      return calculateShippingFeeDetails(
        activeMerchantData.distanceKm,
        new Date(),
        activeItemsCount
      );
    }, [
      activeMerchantData,
      activeItemsCount,
    ]);

  const finalShippingFee =
    shipCalculation.finalFee;

  const finalTotalPrice =
    Math.max(
      0,
      rawTotalPrice +
        finalShippingFee
    );

  /**
   * ==========================================================
   * SAVINGS
   * ==========================================================
   */
  const totalSavings =
    useMemo(() => {
      return activeItems.reduce(
        (
          sum,
          item
        ) => {
          if (
            !item.isDiscounted
          ) {
            return sum;
          }

          const originalPrice =
            Number(
              item.product
                .originalPrice
            ) ||
            Number(
              item.product.price
            ) ||
            0;

          const unitPrice =
            Number(
              item.unitPrice
            ) || 0;

          const savingPerUnit =
            Math.max(
              0,
              originalPrice -
                unitPrice
            );

          return (
            sum +
            savingPerUnit *
              item.quantity
          );
        },
        0
      );
    }, [activeItems]);

  /**
   * ==========================================================
   * CHECKOUT
   * ==========================================================
   */
  const handleCheckout =
    () => {
      if (
        !activeMerchantId
      ) {
        return;
      }

      setSelectedMerchantId(
        activeMerchantId
      );

      closeCart();

      if (
        !isUserLoggedIn()
      ) {
        router.push(
          "/login?redirectTo=/checkout"
        );
      } else {
        router.push(
          "/checkout"
        );
      }
    };

  /**
   * ==========================================================
   * CLOSED
   * ==========================================================
   */
  if (!isOpen) {
    return null;
  }

  /**
   * ==========================================================
   * RENDER
   * ==========================================================
   */
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity duration-300">
      {/* ================================================== */}
      {/* OVERLAY */}
      {/* ================================================== */}

      <div
        className="absolute inset-0"
        onClick={closeCart}
      />

      {/* ================================================== */}
      {/* DRAWER */}
      {/* ================================================== */}

      <div className="relative z-10 w-full max-w-md bg-stone-50 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
        {/* ================================================== */}
        {/* HEADER */}
        {/* ================================================== */}

        <div className="p-3.5 bg-white border-b border-stone-200/80 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-orange-500 to-amber-400 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              🛒
            </div>

            <div>
              <h3 className="font-extrabold text-stone-900 text-xs">
                Giỏ hàng của bạn
              </h3>

              <p className="text-[10px] text-stone-500 font-medium">
                {items.reduce(
                  (
                    acc,
                    item
                  ) =>
                    acc +
                    item.quantity,
                  0
                )}{" "}
                món trong giỏ (
                {
                  merchantList.length
                }{" "}
                quán)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {items.length >
              0 && (
              <button
                type="button"
                onClick={
                  clearCart
                }
                className="text-[10px] font-semibold text-stone-400 hover:text-red-500 px-2 py-1 rounded-full hover:bg-red-50 transition cursor-pointer"
              >
                Xóa tất cả
              </button>
            )}

            <button
              type="button"
              onClick={
                closeCart
              }
              aria-label="Đóng giỏ hàng"
              className="w-7 h-7 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500 font-bold active:scale-90 transition cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* ================================================== */}
        {/* LIST */}
        {/* ================================================== */}

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {items.length ===
          0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div className="w-20 h-20 rounded-full bg-orange-50 flex items-center justify-center text-4xl shadow-inner">
                🧺
              </div>

              <div>
                <h4 className="text-sm font-bold text-stone-800">
                  Giỏ hàng chưa có
                  món nào
                </h4>

                <p className="text-xs text-stone-400 mt-1">
                  Hãy chọn vài món
                  ngon để lấp đầy
                  cái bụng đói nhé!
                </p>
              </div>

              <button
                type="button"
                onClick={
                  closeCart
                }
                className="mt-2 px-5 py-2.5 bg-[#ee4d2d] text-white text-xs font-bold rounded-full shadow-md active:scale-95 transition cursor-pointer"
              >
                Khám phá món ngon
                ngay
              </button>
            </div>
          ) : (
            merchantList.map(
              (
                merchantGroup
              ) => {
                const isSelected =
                  merchantGroup.merchantId ===
                  activeMerchantId;

                const shopShip =
                  calculateShippingFeeDetails(
                    merchantGroup.distanceKm,
                    new Date(),
                    merchantGroup.products.reduce(
                      (
                        acc,
                        item
                      ) =>
                        acc +
                        item.quantity,
                      0
                    )
                  );

                return (
                  <div
                    key={
                      merchantGroup.merchantId
                    }
                    className={`bg-white rounded-2xl border p-3 shadow-xs space-y-2.5 transition-all ${
                      isSelected
                        ? "border-orange-500 ring-2 ring-orange-100"
                        : "border-stone-200/70 opacity-75 hover:opacity-100"
                    }`}
                  >
                    {/* ================================================== */}
                    {/* SHOP HEADER */}
                    {/* ================================================== */}

                    <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                      <label className="flex items-center gap-2 min-w-0 cursor-pointer">
                        <input
                          type="radio"
                          name="selectedMerchant"
                          checked={
                            isSelected
                          }
                          onChange={() =>
                            setSelectedMerchantId(
                              merchantGroup.merchantId
                            )
                          }
                          className="w-4 h-4 accent-[#ee4d2d] cursor-pointer"
                        />

                        <span className="text-xs">
                          🏪
                        </span>

                        <span className="text-xs font-extrabold text-stone-900 truncate">
                          {
                            merchantGroup.shopName
                          }
                        </span>
                      </label>

                      <div className="text-[10px] font-semibold text-stone-600 bg-stone-100 px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1">
                        <span>
                          📍{" "}
                          {
                            merchantGroup.distanceStr
                          }
                        </span>

                        <span className="text-stone-300">
                          •
                        </span>

                        <span>
                          {formatCurrency(
                            shopShip.finalFee
                          )}
                        </span>
                      </div>
                    </div>

                    {/* ================================================== */}
                    {/* ETA */}
                    {/* ================================================== */}

                    <div className="flex items-center justify-between bg-orange-50/70 border border-orange-100 px-2.5 py-1.5 rounded-xl text-[11px]">
                      <div className="flex items-center gap-1.5 text-stone-700">
                        <span>
                          ⏱️
                        </span>

                        <span className="font-semibold">
                          Thời gian giao dự
                          kiến:
                        </span>
                      </div>

                      <span className="font-extrabold text-orange-600 bg-white px-2 py-0.5 rounded-md shadow-2xs border border-orange-200/60">
                        ~
                        {
                          merchantGroup.estimatedMinutes
                        }{" "}
                        phút
                      </span>
                    </div>

                    {/* ================================================== */}
                    {/* PRODUCTS */}
                    {/* ================================================== */}

                    <div className="space-y-2.5">
                      {merchantGroup.products.map(
                        (
                          item
                        ) => {
                          const prod =
                            item.product;

                          /**
                           * lineId là key duy nhất.
                           */
                          const hasDiscount =
                            item.isDiscounted;

                          const unitPrice =
                            Number(
                              item.unitPrice
                            ) || 0;

                          const originalPrice =
                            Number(
                              prod.originalPrice
                            ) ||
                            Number(
                              prod.price
                            ) ||
                            unitPrice;

                          return (
                            <div
                              key={
                                item.lineId
                              }
                              className="flex gap-2.5 items-center"
                            >
                              {/* ================================================= */}
                              {/* IMAGE */}
                              {/* ================================================= */}

                              <div className="relative shrink-0">
                                <img
                                  src={
                                    prod.imageUrl
                                  }
                                  alt={
                                    prod.name
                                  }
                                  className="w-12 h-12 rounded-xl object-cover border border-stone-100"
                                />

                                {hasDiscount && (
                                  <span className="absolute -top-1 -left-1 bg-red-500 text-white text-[8px] font-black px-1 py-0.2 rounded-full shadow-xs">
                                    SALE
                                  </span>
                                )}
                              </div>

                              {/* ================================================= */}
                              {/* INFO */}
                              {/* ================================================= */}

                              <div className="flex-1 min-w-0 space-y-0.5">
                                <h4 className="text-xs font-bold text-stone-800 truncate">
                                  {
                                    prod.name
                                  }
                                </h4>

                                <div className="flex items-baseline gap-1.5">
                                  <span
                                    className={`text-xs font-extrabold ${
                                      hasDiscount
                                        ? "text-[#ee4d2d]"
                                        : "text-stone-800"
                                    }`}
                                  >
                                    {formatCurrency(
                                      unitPrice
                                    )}
                                  </span>

                                  {hasDiscount && (
                                    <span className="text-[10px] text-stone-400 line-through font-medium">
                                      {formatCurrency(
                                        originalPrice
                                      )}
                                    </span>
                                  )}
                                </div>

                                {!hasDiscount &&
                                  originalPrice >
                                    unitPrice && (
                                    <span className="text-[9px] text-stone-400">
                                      Giá thường
                                    </span>
                                  )}
                              </div>

                              {/* ================================================= */}
                              {/* QUANTITY */}
                              {/* ================================================= */}

                              <div className="flex items-center gap-2">
                                <div className="flex items-center bg-stone-100 rounded-lg p-0.5 border border-stone-200">
                                  {/* MINUS */}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleDecreaseQuantity(
                                        item
                                      )
                                    }
                                    className="w-5 h-5 flex items-center justify-center font-bold text-stone-600 hover:text-red-500 rounded-md active:bg-white transition cursor-pointer text-xs"
                                  >
                                    -
                                  </button>

                                  <span className="text-xs font-bold text-stone-800 w-5 text-center">
                                    {
                                      item.quantity
                                    }
                                  </span>

                                  {/* PLUS */}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleIncreaseQuantity(
                                        item
                                      )
                                    }
                                    className="w-5 h-5 flex items-center justify-center font-bold text-[#ee4d2d] rounded-md active:bg-white transition cursor-pointer text-xs"
                                  >
                                    +
                                  </button>
                                </div>

                                {/* ================================================= */}
                                {/* DELETE */}
                                {/* ================================================= */}

                                <button
                                  type="button"
                                  onClick={() =>
                                    removeItem(
                                      item.lineId
                                    )
                                  }
                                  className="text-stone-300 hover:text-red-500 p-1 text-xs transition cursor-pointer"
                                  title="Xóa món này"
                                  aria-label="Xóa món này"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          );
                        }
                      )}
                    </div>
                  </div>
                );
              }
            )
          )}
        </div>

        {/* ================================================== */}
        {/* FOOTER */}
        {/* ================================================== */}

        {items.length >
          0 &&
          activeMerchantData && (
            <div className="p-3 bg-white border-t border-stone-200/80 space-y-2.5 shadow-2xl">
              {/* ================================================== */}
              {/* PROMOTION */}
              {/* ================================================== */}

              <div
                onClick={
                  handleCheckout
                }
                className="flex items-center justify-between bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 px-3 py-2 rounded-xl text-white shadow-sm cursor-pointer transition-transform active:scale-[0.99] hover:opacity-95"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm shrink-0">
                    🎁
                  </span>

                  <div className="truncate">
                    <p className="text-[11px] font-extrabold tracking-tight truncate leading-tight">
                      Kho ưu đãi &
                      Miễn phí vận
                      chuyển sẵn
                      sàng
                    </p>

                    <p className="text-[10px] text-amber-100 font-medium truncate leading-tight">
                      Nhấn để chọn mã
                      giảm giá tốt
                      nhất cho đơn
                      hàng
                    </p>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-1 bg-white text-orange-600 text-[10px] font-extrabold px-2 py-1 rounded-lg shadow-2xs">
                  <span>
                    Chọn mã
                  </span>

                  <span>
                    ➔
                  </span>
                </div>
              </div>

              {/* ================================================== */}
              {/* SUMMARY */}
              {/* ================================================== */}

              <div className="space-y-1">
                {/* SUBTOTAL */}

                <div className="flex justify-between items-center text-[11px] text-stone-500">
                  <span>
                    Tạm tính (
                    {
                      activeItemsCount
                    }{" "}
                    món):
                  </span>

                  <span className="font-semibold text-stone-700">
                    {formatCurrency(
                      rawTotalPrice
                    )}
                  </span>
                </div>

                {/* SHIPPING */}

                <div className="space-y-0.5 pt-1 border-t border-dashed border-stone-200">
                  <div className="flex justify-between items-center text-[11px] text-stone-600 font-semibold">
                    <span>
                      🛵 Phí giao hàng
                      TMĐT:
                    </span>

                    <span className="text-stone-800">
                      {formatCurrency(
                        finalShippingFee
                      )}
                    </span>
                  </div>

                  <div className="pl-2 space-y-0.5 text-[10px] text-stone-400 border-l border-stone-200">
                    {/* BASE */}

                    <div className="flex justify-between">
                      <span>
                        • Phí gốc (
                        {
                          activeMerchantData.distanceStr
                        }
                        ):
                      </span>

                      <span>
                        {formatCurrency(
                          shipCalculation.baseFee
                        )}
                      </span>
                    </div>

                    {/* TIME */}

                    {shipCalculation.timeSurcharge >
                      0 && (
                      <div className="flex justify-between text-amber-600">
                        <span>
                          • Phụ phí khung
                          giờ cao
                          điểm:
                        </span>

                        <span>
                          +
                          {formatCurrency(
                            shipCalculation.timeSurcharge
                          )}
                        </span>
                      </div>
                    )}

                    {/* BULK */}

                    {shipCalculation.bulkSurcharge >
                      0 && (
                      <div className="flex justify-between text-amber-600">
                        <span>
                          • Phụ phí cồng
                          kềnh:
                        </span>

                        <span>
                          +
                          {formatCurrency(
                            shipCalculation.bulkSurcharge
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* ================================================= */}
                {/* TOTAL */}
                {/* ================================================= */}

                <div className="flex justify-between items-baseline pt-1.5 border-t border-stone-200">
                  <div>
                    <span className="text-xs font-bold text-stone-800">
                      Tổng thanh
                      toán:
                    </span>

                    {totalSavings >
                      0 && (
                      <p className="text-[10px] text-emerald-600 font-semibold leading-none mt-0.5">
                        Đã tiết kiệm{" "}
                        {formatCurrency(
                          totalSavings
                        )}
                      </p>
                    )}
                  </div>

                  <span className="text-lg font-black text-[#ee4d2d]">
                    {formatCurrency(
                      finalTotalPrice
                    )}
                  </span>
                </div>
              </div>

              {/* ================================================== */}
              {/* CHECKOUT */}
              {/* ================================================== */}

              <button
                type="button"
                onClick={
                  handleCheckout
                }
                className="w-full font-extrabold py-3 rounded-xl shadow-md transition flex items-center justify-center gap-2 text-xs uppercase tracking-wider cursor-pointer bg-gradient-to-r from-orange-500 to-[#ee4d2d] hover:opacity-95 text-white shadow-orange-500/25 active:scale-[0.98]"
              >
                <span>
                  Thanh toán đơn{" "}
                  {
                    activeMerchantData.shopName
                  }
                </span>

                <span>
                  ➔
                </span>
              </button>
            </div>
          )}
      </div>
    </div>
  );
}