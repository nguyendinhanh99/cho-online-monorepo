"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  doc,
  getDoc,
} from "firebase/firestore";

import {
  getAuth,
} from "firebase/auth";

import {
  db,
} from "@/lib/firebase";

import {
  useRouter,
} from "next/navigation";

import {
  useCartStore,
} from "@/store/useCartStore";

import {
  isUserLoggedIn,
} from "@/utils/auth-guard";

/**
 * ============================================================
 * TYPES
 * ============================================================
 */

interface Coordinates {
  lat: number;
  lng: number;
}

interface MerchantDistanceState {
  distanceKm: number | null;
  loading: boolean;
}

/**
 * ============================================================
 * HELPERS
 * ============================================================
 */

/**
 * Parse khoảng cách dạng:
 *
 * "785m"
 * "1.2 km"
 * "785 m"
 *
 * thành KM.
 *
 * Không còn mặc định 1km khi không có dữ liệu.
 */
const parseDistanceToKm = (
  distanceStr?: string | null
): number | null => {
  if (!distanceStr) {
    return null;
  }

  const str =
    String(distanceStr)
      .toLowerCase()
      .trim();

  const match =
    str.match(
      /([\d.,]+)/
    );

  if (!match) {
    return null;
  }

  const numericValue =
    Number(
      match[1].replace(
        ",",
        "."
      )
    );

  if (
    !Number.isFinite(
      numericValue
    )
  ) {
    return null;
  }

  if (
    str.includes("m") &&
    !str.includes("km")
  ) {
    return numericValue / 1000;
  }

  return numericValue;
};

/**
 * ============================================================
 * EXTRACT COORDINATES
 * ============================================================
 *
 * Hỗ trợ:
 *
 * {
 *   latitude,
 *   longitude
 * }
 *
 * hoặc:
 *
 * {
 *   lat,
 *   lng
 * }
 *
 * hoặc Firestore GeoPoint.
 */
const extractCoordinates = (
  value: any
): Coordinates | null => {
  if (!value) {
    return null;
  }

  const latCandidates = [
    value.latitude,
    value.lat,
    value._lat,
  ];

  const lngCandidates = [
    value.longitude,
    value.lng,
    value._long,
  ];

  const lat =
    Number(
      latCandidates.find(
        (item) =>
          item !==
            undefined &&
          item !== null &&
          item !== ""
      )
    );

  const lng =
    Number(
      lngCandidates.find(
        (item) =>
          item !==
            undefined &&
          item !== null &&
          item !== ""
      )
    );

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return null;
  }

  if (
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }

  return {
    lat,
    lng,
  };
};

/**
 * ============================================================
 * READ CUSTOMER LOCATION
 * ============================================================
 *
 * Ưu tiên:
 *
 * 1. users/{uid}.location
 * 2. users/{uid}.lat/lng
 * 3. localStorage user_shipping_info
 */
const getCustomerCoordinates =
  async (): Promise<Coordinates | null> => {
    try {
      const auth =
        getAuth();

      const currentUser =
        auth.currentUser;

      if (
        currentUser?.uid
      ) {
        try {
          const userSnap =
            await getDoc(
              doc(
                db,
                "users",
                currentUser.uid
              )
            );

          if (
            userSnap.exists()
          ) {
            const data =
              userSnap.data();

            const fromLocation =
              extractCoordinates(
                data.location
              );

            if (
              fromLocation
            ) {
              return fromLocation;
            }

            const fromUserLatLng =
              extractCoordinates({
                lat: data.lat,
                lng: data.lng,
              });

            if (
              fromUserLatLng
            ) {
              return fromUserLatLng;
            }
          }
        } catch (error) {
          console.warn(
            "⚠️ Không đọc được tọa độ users:",
            error
          );
        }
      }

      /**
       * Fallback:
       * localStorage user_shipping_info
       */
      if (
        typeof window !==
        "undefined"
      ) {
        const raw =
          localStorage.getItem(
            "user_shipping_info"
          );

        if (raw) {
          try {
            const shippingInfo =
              JSON.parse(
                raw
              );

            const fromLocation =
              extractCoordinates(
                shippingInfo.location
              );

            if (
              fromLocation
            ) {
              return fromLocation;
            }

            const direct =
              extractCoordinates(
                shippingInfo
              );

            if (
              direct
            ) {
              return direct;
            }

            const nested =
              extractCoordinates({
                lat:
                  shippingInfo.latitude,
                lng:
                  shippingInfo.longitude,
              });

            if (
              nested
            ) {
              return nested;
            }
          } catch (error) {
            console.warn(
              "⚠️ user_shipping_info không hợp lệ:",
              error
            );
          }
        }
      }
    } catch (error) {
      console.warn(
        "⚠️ Không thể lấy tọa độ khách hàng:",
        error
      );
    }

    return null;
  };

/**
 * ============================================================
 * HAVERSINE
 * ============================================================
 *
 * Khoảng cách đường chim bay → nhân roadFactor 1.1
 * để ước lượng đường đi thực tế.
 *
 * Đây vẫn là Haversine, chỉ điều chỉnh hệ số đường bộ.
 */
const calculateHaversineDistance = (
  customer: Coordinates,
  merchant: Coordinates
): number => {
  const EARTH_RADIUS_KM =
    6371;

  const roadFactor =
    1.1;

  const lat1 =
    (customer.lat *
      Math.PI) /
    180;

  const lat2 =
    (merchant.lat *
      Math.PI) /
    180;

  const deltaLat =
    ((merchant.lat -
      customer.lat) *
      Math.PI) /
    180;

  const deltaLng =
    ((merchant.lng -
      customer.lng) *
      Math.PI) /
    180;

  const a =
    Math.sin(
      deltaLat / 2
    ) **
      2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(
        deltaLng / 2
      ) **
        2;

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  const straightLineKm =
    EARTH_RADIUS_KM *
    c;

  return (
    straightLineKm *
    roadFactor
  );
};

/**
 * ============================================================
 * FORMAT DISTANCE
 * ============================================================
 */

const formatDistance = (
  distanceKm: number | null
): string => {
  if (
    distanceKm === null ||
    !Number.isFinite(
      distanceKm
    )
  ) {
    return "Đang xác định";
  }

  if (
    distanceKm < 1
  ) {
    const meters =
      Math.round(
        distanceKm * 1000
      );

    return `${meters} m`;
  }

  return `${distanceKm.toFixed(
    2
  )} km`;
};

/**
 * ============================================================
 * MERCHANT ID
 * ============================================================
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
  distanceKm: number = 1
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
  distanceKm: number | null,
  orderDate: Date = new Date(),
  totalItemsCount: number = 1
) => {
  /**
   * Không có khoảng cách thực tế:
   * chưa tính cước để tránh báo sai 1km.
   */
  if (
    distanceKm === null ||
    !Number.isFinite(
      distanceKm
    )
  ) {
    return {
      baseFee: 0,
      timeSurcharge: 0,
      bulkSurcharge: 0,
      discount: 0,
      finalFee: 0,
      isSplitOrder: false,
      isDistanceReady: false,
    };
  }

  let baseFee = 0;

  const discount = 0;

  /**
   * =========================================================
   * PHÍ GỐC THEO KHOẢNG CÁCH
   * =========================================================
   *
   * <= 1km   = 14.000
   * <= 2km   = 18.000
   * <= 3km   = 22.000
   * <= 4km   = 26.000
   * <= 5km   = 30.000
   * > 5km    = +5.000 / km
   */

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

  /**
   * =========================================================
   * PHỤ PHÍ THỜI GIAN
   * =========================================================
   */

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
    timeSurcharge =
      2000;
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
    timeSurcharge =
      4000;
  }

  /**
   * >= 20:00
   */
  else if (
    timeInMinutes >=
    20 * 60
  ) {
    timeSurcharge =
      7000;
  }

  /**
   * =========================================================
   * PHỤ PHÍ NHIỀU MÓN
   * =========================================================
   */

  let bulkSurcharge =
    0;

  let isSplitOrder =
    false;

  if (
    totalItemsCount >= 11 &&
    totalItemsCount <= 17
  ) {
    bulkSurcharge =
      10000;
  } else if (
    totalItemsCount >= 18
  ) {
    baseFee =
      baseFee * 2;

    bulkSurcharge =
      15000;

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
    isDistanceReady: true,
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
   * CUSTOMER LOCATION
   * ==========================================================
   */

  const [
    customerCoordinates,
    setCustomerCoordinates,
  ] = useState<Coordinates | null>(
    null
  );

  const [
    locationLoading,
    setLocationLoading,
  ] = useState(false);

  /**
   * ==========================================================
   * MERCHANT DISTANCES
   * ==========================================================
   */

  const [
    merchantDistances,
    setMerchantDistances,
  ] = useState<
    Record<
      string,
      MerchantDistanceState
    >
  >({});

  /**
   * Cache tọa độ merchant để không đọc Firestore
   * liên tục mỗi lần quantity thay đổi.
   */
  const merchantCoordinatesCache =
    useRef<
      Record<
        string,
        Coordinates | null
      >
    >({});

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
    ).format(
      amount || 0
    );
  };

  /**
   * ==========================================================
   * LOAD CUSTOMER + MERCHANT LOCATION
   * ==========================================================
   */

  useEffect(() => {
    if (
      !isOpen ||
      items.length === 0
    ) {
      return;
    }

    let cancelled =
      false;

    const loadDistances =
      async () => {
        setLocationLoading(
          true
        );

        try {
          /**
           * --------------------------------------------------
           * 1. CUSTOMER
           * --------------------------------------------------
           */

          const customer =
            await getCustomerCoordinates();

          if (
            cancelled
          ) {
            return;
          }

          setCustomerCoordinates(
            customer
          );

          /**
           * --------------------------------------------------
           * 2. UNIQUE MERCHANTS
           * --------------------------------------------------
           */

          const merchantIds =
            Array.from(
              new Set(
                items
                  .map(
                    (item) =>
                      getProductMerchantId(
                        item.product
                      )
                  )
                  .filter(
                    (id) =>
                      id &&
                      id !==
                        "unknown_merchant"
                  )
              )
            );

          /**
           * --------------------------------------------------
           * 3. MARK LOADING
           * --------------------------------------------------
           */

          setMerchantDistances(
            (
              current
            ) => {
              const next = {
                ...current,
              };

              merchantIds.forEach(
                (merchantId) => {
                  next[
                    merchantId
                  ] = {
                    distanceKm:
                      current[
                        merchantId
                      ]?.distanceKm ??
                      null,
                    loading:
                      true,
                  };
                }
              );

              return next;
            }
          );

          /**
           * --------------------------------------------------
           * 4. FETCH MERCHANT COORDINATES
           * --------------------------------------------------
           */

          await Promise.all(
            merchantIds.map(
              async (
                merchantId
              ) => {
                try {
                  /**
                   * Cache
                   */
                  if (
                    Object.prototype.hasOwnProperty.call(
                      merchantCoordinatesCache.current,
                      merchantId
                    )
                  ) {
                    return;
                  }

                  const merchantSnap =
                    await getDoc(
                      doc(
                        db,
                        "merchants",
                        merchantId
                      )
                    );

                  if (
                    cancelled
                  ) {
                    return;
                  }

                  if (
                    !merchantSnap.exists()
                  ) {
                    merchantCoordinatesCache.current[
                      merchantId
                    ] = null;

                    return;
                  }

                  const data =
                    merchantSnap.data();

                  /**
                   * Ưu tiên pickupLocation
                   */
                  const pickupLocation =
                    extractCoordinates(
                      data.pickupLocation
                    );

                  if (
                    pickupLocation
                  ) {
                    merchantCoordinatesCache.current[
                      merchantId
                    ] =
                      pickupLocation;

                    return;
                  }

                  /**
                   * Fallback lat/lng
                   */
                  const merchantLatLng =
                    extractCoordinates({
                      lat: data.lat,
                      lng: data.lng,
                    });

                  if (
                    merchantLatLng
                  ) {
                    merchantCoordinatesCache.current[
                      merchantId
                    ] =
                      merchantLatLng;

                    return;
                  }

                  /**
                   * Fallback location
                   */
                  const merchantLocation =
                    extractCoordinates(
                      data.location
                    );

                  merchantCoordinatesCache.current[
                    merchantId
                  ] =
                    merchantLocation;
                } catch (error) {
                  console.error(
                    `❌ Lỗi lấy tọa độ merchant ${merchantId}:`,
                    error
                  );

                  merchantCoordinatesCache.current[
                    merchantId
                  ] =
                    null;
                }
              }
            )
          );

          /**
           * --------------------------------------------------
           * 5. CALCULATE DISTANCE
           * --------------------------------------------------
           */

          if (
            cancelled
          ) {
            return;
          }

          const calculatedDistances: Record<
            string,
            MerchantDistanceState
          > = {};

          merchantIds.forEach(
            (merchantId) => {
              const merchantCoordinates =
                merchantCoordinatesCache
                  .current[
                  merchantId
                ];

              /**
               * Có đủ 2 tọa độ
               */
              if (
                customer &&
                merchantCoordinates
              ) {
                calculatedDistances[
                  merchantId
                ] = {
                  distanceKm:
                    calculateHaversineDistance(
                      customer,
                      merchantCoordinates
                    ),
                  loading:
                    false,
                };

                return;
              }

              /**
               * Không đủ tọa độ
               */
              calculatedDistances[
                merchantId
              ] = {
                distanceKm:
                  null,
                loading:
                  false,
              };
            }
          );

          setMerchantDistances(
            calculatedDistances
          );
        } catch (error) {
          console.error(
            "❌ Lỗi tính khoảng cách:",
            error
          );
        } finally {
          if (
            !cancelled
          ) {
            setLocationLoading(
              false
            );
          }
        }
      };

    void loadDistances();

    return () => {
      cancelled =
        true;
    };
  }, [
    isOpen,
    items,
  ]);

  /**
   * ==========================================================
   * INCREASE
   * ==========================================================
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
          distanceKm: number | null;
          estimatedMinutes: number;
          products: typeof items;
          distanceLoading: boolean;
        }
      > = {};

      items.forEach(
        (item) => {
          const prod =
            item.product;

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
           * --------------------------------------------------
           * DISTANCE
           * --------------------------------------------------
           *
           * Ưu tiên:
           *
           * 1. Tọa độ thật vừa tính
           * 2. distance / distanceStr cũ của product
           * 3. null
           *
           * Không còn fallback 1km.
           */

          const calculatedDistance =
            merchantDistances[
              merchantId
            ]?.distanceKm ??
            null;

          const productDistance =
            parseDistanceToKm(
              (prod as any)
                .distance ||
                (prod as any)
                  .distanceStr ||
                null
            );

          const finalDistanceKm =
            calculatedDistance !==
            null
              ? calculatedDistance
              : productDistance;

          const distanceLoading =
            merchantDistances[
              merchantId
            ]?.loading ??
            false;

          const distanceStr =
            formatDistance(
              finalDistanceKm
            );

          /**
           * --------------------------------------------------
           * ETA
           * --------------------------------------------------
           */

          const prepTime =
            Number(
              (prod as any)
                .prepTime
            ) || 15;

          const deliveryTime =
            calculateETA(
              prepTime,
              finalDistanceKm ??
                0
            );

          if (
            !map[merchantId]
          ) {
            map[merchantId] = {
              merchantId,

              shopName,

              distanceStr,

              distanceKm:
                finalDistanceKm,

              estimatedMinutes:
                deliveryTime,

              products:
                [],

              distanceLoading,
            };
          }

          /**
           * Nếu cùng merchant có nhiều item,
           * vẫn cập nhật distance mới nhất.
           */
          map[
            merchantId
          ].distanceKm =
            finalDistanceKm;

          map[
            merchantId
          ].distanceStr =
            distanceStr;

          map[
            merchantId
          ].distanceLoading =
            distanceLoading;

          map[
            merchantId
          ].estimatedMinutes =
            deliveryTime;

          map[
            merchantId
          ].products.push(
            item
          );
        }
      );

      return map;
    }, [
      items,
      merchantDistances,
    ]);

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
          isDistanceReady: false,
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
              item.product
                .price
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
    }, [
      activeItems,
    ]);

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
        {/* LOCATION STATUS */}
        {/* ================================================== */}

        {items.length >
          0 &&
          (locationLoading ||
            !customerCoordinates) && (
            <div className="px-3 pt-2">

              <div className="rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-2 text-[9px] text-amber-700">

                <div className="flex items-center gap-2">

                  {locationLoading ? (
                    <span className="w-3 h-3 rounded-full border-2 border-amber-500 border-t-transparent animate-spin shrink-0" />
                  ) : (
                    <span className="shrink-0">
                      📍
                    </span>
                  )}

                  <span>
                    {locationLoading
                      ? "Đang xác định khoảng cách giao hàng..."
                      : "Chưa xác định được vị trí giao hàng. Phí ship sẽ được cập nhật khi có tọa độ."}
                  </span>

                </div>
              </div>
            </div>
          )}

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

                const shopItemCount =
                  merchantGroup.products.reduce(
                    (
                      acc,
                      item
                    ) =>
                      acc +
                      item.quantity,
                    0
                  );

                const shopShip =
                  calculateShippingFeeDetails(
                    merchantGroup.distanceKm,
                    new Date(),
                    shopItemCount
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
                            merchantGroup.distanceLoading
                              ? "Đang tính..."
                              : merchantGroup.distanceStr
                          }
                        </span>

                        <span className="text-stone-300">
                          •
                        </span>

                        <span>
                          {shopShip.isDistanceReady
                            ? formatCurrency(
                                shopShip.finalFee
                              )
                            : "—"}
                        </span>

                      </div>
                    </div>

                    {/* ================================================== */}
                    {/* DISTANCE INFO */}
                    {/* ================================================== */}

                    <div className="flex items-center justify-between bg-stone-50 border border-stone-100 px-2.5 py-1.5 rounded-xl text-[10px]">

                      <div className="flex items-center gap-1.5 text-stone-500">

                        <span>
                          🛵
                        </span>

                        <span>
                          Khoảng cách giao hàng
                        </span>

                      </div>

                      <span className="font-bold text-stone-700">
                        {merchantGroup.distanceLoading
                          ? "Đang xác định..."
                          : merchantGroup.distanceKm !==
                            null
                          ? merchantGroup.distanceStr
                          : "Chưa có tọa độ"}
                      </span>

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
                          Thời gian giao dự kiến:
                        </span>

                      </div>

                      <span className="font-extrabold text-orange-600 bg-white px-2 py-0.5 rounded-md shadow-2xs border border-orange-200/60">

                        {merchantGroup.distanceKm !==
                        null ? (
                          <>
                            ~
                            {
                              merchantGroup.estimatedMinutes
                            }{" "}
                            phút
                          </>
                        ) : (
                          "Đang xác định"
                        )}

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

                                {/* DELETE */}

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

                    {shipCalculation.isDistanceReady
                      ? formatCurrency(
                          finalShippingFee
                        )
                      : "Đang xác định..."}

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

                      {shipCalculation.isDistanceReady
                        ? formatCurrency(
                            shipCalculation.baseFee
                          )
                        : "—"}

                    </span>

                  </div>

                  {/* TIME */}

                  {shipCalculation.timeSurcharge >
                    0 && (
                    <div className="flex justify-between text-amber-600">

                      <span>
                        • Phụ phí khung
                        giờ cao điểm:
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
                    Tổng thanh toán:
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

                  {shipCalculation.isDistanceReady
                    ? formatCurrency(
                        finalTotalPrice
                      )
                    : formatCurrency(
                        rawTotalPrice
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