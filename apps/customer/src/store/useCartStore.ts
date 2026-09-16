import { create } from "zustand";
import {
  persist,
  createJSONStorage,
} from "zustand/middleware";
import { Product } from "@cho-online/types";
import { db } from "@/lib/firebase";
import {
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  Unsubscribe,
} from "firebase/firestore";

/**
 * ============================================================
 * PRODUCT WITH PROMOTION
 * ============================================================
 */
export type PromotionProduct = Product & {
  originalPrice?: number;

  maxPerUser?: number;
  discountStock?: number;

  discountStartTime?: string | null;
  discountEndTime?: string | null;

  merchantId?: string;
  merchantCode?: string;
  merchantName?: string;

  shopId?: string;
  shopName?: string;
  storeName?: string;
};

/**
 * ============================================================
 * CART PRODUCT
 * ============================================================
 */
export interface CartProduct
  extends PromotionProduct {}

/**
 * ============================================================
 * CART ITEM
 * ============================================================
 *
 * Một sản phẩm có thể có:
 *
 * lineId = merchant:product:discount
 * lineId = merchant:product:regular
 */
export interface CartItem {
  lineId: string;

  product: CartProduct;

  quantity: number;

  /**
   * Giá thực tế của từng dòng.
   *
   * Ví dụ:
   * 1 x 28.000
   * 2 x 35.000
   */
  unitPrice: number;

  isDiscounted: boolean;
}

/**
 * ============================================================
 * CART STATE
 * ============================================================
 */
interface CartState {
  items: CartItem[];

  isOpen: boolean;

  userId: string | null;

  selectedMerchantId: string | null;

  setUserId: (
    userId: string | null
  ) => void;

  openCart: () => void;

  closeCart: () => void;

  setSelectedMerchantId: (
    merchantId: string | null
  ) => void;

  addItem: (
    product: CartProduct,
    distance?: string,
    quantity?: number
  ) => void;

  removeItem: (
    productId: string
  ) => void;

  updateQuantity: (
    productId: string,
    delta: number
  ) => void;

  clearCart: () => Promise<void>;

  clearMerchantItems: (
    merchantId: string
  ) => Promise<void>;

  getTotalPrice: (
    merchantId?: string
  ) => number;

  getTotalItems: (
    merchantId?: string
  ) => number;

  getItemsByMerchant: () => Record<
    string,
    CartItem[]
  >;
}

/**
 * ============================================================
 * FIRESTORE LISTENER
 * ============================================================
 */
let unsubscribeCartListener:
  | Unsubscribe
  | null = null;

/**
 * ============================================================
 * HELPERS
 * ============================================================
 */

/**
 * Tạo lineId chuẩn.
 */
const createLineId = (
  product: CartProduct,
  isDiscounted: boolean
): string => {
  const merchantId =
    product.merchantId ||
    product.shopId ||
    "unknown";

  const productId =
    product.id || "unknown";

  return `${merchantId}:${productId}:${
    isDiscounted
      ? "discount"
      : "regular"
  }`;
};

/**
 * ============================================================
 * SANITIZE PRODUCT
 * ============================================================
 *
 * Không lưu dữ liệu động vào cart:
 *
 * - distance
 * - GPS
 * - ETA
 * - address
 * - route
 */
const sanitizeCartProduct = (
  product: CartProduct
): CartProduct => {
  const raw =
    product as CartProduct &
      Record<string, any>;

  const {
    distance: _distance,
    distanceKm: _distanceKm,
    distanceStr: _distanceStr,

    eta: _eta,
    estimatedTime: _estimatedTime,
    prepTime: _prepTime,

    address: _address,
    storeAddress: _storeAddress,
    shopAddress: _shopAddress,
    merchantAddress: _merchantAddress,

    lat: _lat,
    lng: _lng,
    latitude: _latitude,
    longitude: _longitude,

    location: _location,
    pickupLocation: _pickupLocation,
    storeLocation: _storeLocation,
    merchantLocation: _merchantLocation,

    routeDistance: _routeDistance,
    routeDistanceKm: _routeDistanceKm,
    routeDuration: _routeDuration,
    etaMinutes: _etaMinutes,

    ...cleanProduct
  } = raw;

  const merchantId =
    cleanProduct.merchantId ||
    cleanProduct.shopId ||
    "";

  return {
    ...cleanProduct,

    merchantId,

    merchantCode:
      cleanProduct.merchantCode || "",

    merchantName:
      cleanProduct.merchantName ||
      cleanProduct.shopName ||
      cleanProduct.storeName ||
      "",
  } as CartProduct;
};

/**
 * ============================================================
 * PROMOTION SCHEDULE
 * ============================================================
 *
 * Có start/end hay không?
 */
const hasPromotionSchedule = (
  product: CartProduct
): boolean => {
  return Boolean(
    product.discountStartTime ||
      product.discountEndTime
  );
};

/**
 * ============================================================
 * DISCOUNT TIME
 * ============================================================
 *
 * Chỉ dùng khi product có start/end.
 */
const isDiscountTimeActive = (
  product: CartProduct
): boolean => {
  const startRaw =
    product.discountStartTime;

  const endRaw =
    product.discountEndTime;

  if (
    !startRaw &&
    !endRaw
  ) {
    return false;
  }

  const now = Date.now();

  const start = startRaw
    ? new Date(startRaw).getTime()
    : -Infinity;

  const end = endRaw
    ? new Date(endRaw).getTime()
    : Infinity;

  if (
    Number.isNaN(start) ||
    Number.isNaN(end)
  ) {
    console.warn(
      "⚠️ [CART] Thời gian khuyến mãi không hợp lệ:",
      {
        startRaw,
        endRaw,
      }
    );

    return false;
  }

  return (
    now >= start &&
    now <= end
  );
};

/**
 * ============================================================
 * PRICE
 * ============================================================
 */
const getPrices = (
  product: CartProduct
) => {
  /**
   * Giá gốc.
   */
  const originalPrice =
    Number(product.originalPrice) ||
    Number(product.price) ||
    0;

  /**
   * Giá hiện tại.
   */
  const currentPrice =
    Number(product.price) ||
    originalPrice;

  return {
    originalPrice,
    currentPrice,
  };
};

/**
 * ============================================================
 * PROMOTION STATE
 * ============================================================
 *
 * Quy tắc:
 *
 * 1. originalPrice > price
 *    => sản phẩm có giá giảm.
 *
 * 2. Không có start/end
 *    => giá giảm luôn có hiệu lực.
 *
 * 3. Có start/end
 *    => chỉ giảm trong khoảng thời gian.
 */
const getPromotionState = (
  product: CartProduct
) => {
  const {
    originalPrice,
    currentPrice,
  } = getPrices(product);

  const hasRealDiscount =
    currentPrice > 0 &&
    originalPrice > currentPrice;

  const hasSchedule =
    hasPromotionSchedule(product);

  const discountTimeActive =
    hasSchedule &&
    isDiscountTimeActive(product);

  /**
   * Không có schedule:
   *
   * price < originalPrice
   * => luôn dùng giá giảm.
   *
   * Có schedule:
   * => phải đúng thời gian.
   */
  const discountEnabled =
    hasRealDiscount &&
    (
      !hasSchedule ||
      discountTimeActive
    );

  return {
    originalPrice,
    currentPrice,

    hasRealDiscount,

    hasSchedule,

    discountTimeActive,

    discountEnabled,
  };
};

/**
 * ============================================================
 * DISCOUNT LIMIT
 * ============================================================
 *
 * Nếu:
 * maxPerUser = 1
 * discountStock = 7
 *
 * => giới hạn = 1
 *
 * Nếu discountStock âm / 0:
 * coi như không áp dụng giới hạn từ field này.
 */
const getDiscountLimit = (
  product: CartProduct
): number => {
  const maxPerUser =
    Number(product.maxPerUser);

  const discountStock =
    Number(product.discountStock);

  const hasMaxPerUser =
    Number.isFinite(maxPerUser) &&
    maxPerUser > 0;

  const hasDiscountStock =
    Number.isFinite(discountStock) &&
    discountStock > 0;

  if (
    hasMaxPerUser &&
    hasDiscountStock
  ) {
    return Math.min(
      maxPerUser,
      discountStock
    );
  }

  if (hasMaxPerUser) {
    return maxPerUser;
  }

  if (hasDiscountStock) {
    return discountStock;
  }

  return Number.MAX_SAFE_INTEGER;
};

/**
 * ============================================================
 * DISCOUNT INFO
 * ============================================================
 */
const getDiscountInfo = (
  product: CartProduct,
  currentDiscountQuantity: number,
  requestedQuantity: number
) => {
  const promotion =
    getPromotionState(product);

  const discountLimit =
    getDiscountLimit(product);

  const remainingDiscountQuantity =
    Math.max(
      0,
      discountLimit -
        currentDiscountQuantity
    );

  const discountQuantityToAdd =
    promotion.discountEnabled
      ? Math.min(
          requestedQuantity,
          remainingDiscountQuantity
        )
      : 0;

  const regularQuantityToAdd =
    Math.max(
      0,
      requestedQuantity -
        discountQuantityToAdd
    );

  console.group(
    "🏷️ [CART] Discount calculation"
  );

  console.log(
    "Product:",
    product.name
  );

  console.log(
    "Original price:",
    promotion.originalPrice
  );

  console.log(
    "Current price:",
    promotion.currentPrice
  );

  console.log(
    "Has real discount:",
    promotion.hasRealDiscount
  );

  console.log(
    "Has promotion schedule:",
    promotion.hasSchedule
  );

  console.log(
    "Discount time active:",
    promotion.discountTimeActive
  );

  console.log(
    "Discount enabled:",
    promotion.discountEnabled
  );

  console.log(
    "maxPerUser:",
    product.maxPerUser
  );

  console.log(
    "discountStock:",
    product.discountStock
  );

  console.log(
    "Current discount quantity:",
    currentDiscountQuantity
  );

  console.log(
    "Discount limit:",
    discountLimit
  );

  console.log(
    "Requested quantity:",
    requestedQuantity
  );

  console.log(
    "Discount quantity:",
    discountQuantityToAdd
  );

  console.log(
    "Regular quantity:",
    regularQuantityToAdd
  );

  console.groupEnd();

  return {
    ...promotion,

    discountPrice:
      promotion.currentPrice,

    discountLimit,

    remainingDiscountQuantity,

    discountQuantityToAdd,

    regularQuantityToAdd,
  };
};

/**
 * ============================================================
 * SANITIZE CART ITEMS
 * ============================================================
 *
 * Đây là phần rất quan trọng.
 *
 * Nó xử lý:
 *
 * - cart cũ
 * - giá cũ
 * - unitPrice cũ
 * - lineId cũ
 * - KM hết hạn
 * - sản phẩm có price < originalPrice nhưng không có schedule
 * - quantity KM vượt giới hạn
 */
const sanitizeCartItems = (
  items: CartItem[] | unknown
): CartItem[] => {
  if (!Array.isArray(items)) {
    return [];
  }

  const result: CartItem[] = [];

  items.forEach(
    (rawItem: any) => {
      if (
        !rawItem ||
        !rawItem.product ||
        !rawItem.product.id
      ) {
        return;
      }

      const product =
        sanitizeCartProduct(
          rawItem.product as CartProduct
        );

      const promotion =
        getPromotionState(product);

      const quantity = Math.max(
        1,
        Number(rawItem.quantity) || 1
      );

      const discountLimit =
        getDiscountLimit(product);

      /**
       * Kiểm tra item cũ có phải dòng KM không.
       */
      const storedIsDiscounted =
        typeof rawItem.isDiscounted ===
        "boolean"
          ? rawItem.isDiscounted
          : undefined;

      /**
       * ======================================================
       * XÁC ĐỊNH TRẠNG THÁI MỚI
       * ======================================================
       */
      let finalIsDiscounted = false;

      /**
       * Trường hợp product có giá giảm hợp lệ.
       */
      if (
        promotion.discountEnabled
      ) {
        /**
         * Không có schedule:
         *
         * price < originalPrice
         * => mọi cart line của sản phẩm
         * đều phải dùng currentPrice.
         *
         * Điều này xử lý Cafe muối:
         *
         * 90.000 -> 81.000
         */
        if (
          !promotion.hasSchedule
        ) {
          finalIsDiscounted =
            true;
        }

        /**
         * Có schedule:
         *
         * giữ đúng vai trò line cũ.
         */
        else {
          finalIsDiscounted =
            storedIsDiscounted ??
            true;
        }
      }

      /**
       * Nếu KM không còn hiệu lực:
       * chuyển về giá gốc.
       */
      else {
        finalIsDiscounted =
          false;
      }

      /**
       * Giá thực tế.
       *
       * KHÔNG lấy unitPrice cũ.
       *
       * Vì unitPrice cũ có thể là:
       *
       * 90.000
       *
       * trong khi product hiện tại:
       *
       * 81.000.
       */
      const finalUnitPrice =
        finalIsDiscounted
          ? promotion.currentPrice
          : promotion.originalPrice;

      const merchantId =
        product.merchantId ||
        product.shopId ||
        "unknown";

      /**
       * ======================================================
       * TÁCH DÒNG KHI VƯỢT GIỚI HẠN KM
       * ======================================================
       */
      if (
        finalIsDiscounted &&
        discountLimit !==
          Number.MAX_SAFE_INTEGER &&
        quantity > discountLimit
      ) {
        /**
         * Phần được KM.
         */
        const discountedQuantity =
          Math.min(
            quantity,
            discountLimit
          );

        /**
         * Phần giá thường.
         */
        const regularQuantity =
          Math.max(
            0,
            quantity -
              discountedQuantity
          );

        result.push({
          lineId:
            createLineId(
              product,
              true
            ),

          product,

          quantity:
            discountedQuantity,

          unitPrice:
            promotion.currentPrice,

          isDiscounted: true,
        });

        if (
          regularQuantity > 0
        ) {
          result.push({
            lineId:
              createLineId(
                product,
                false
              ),

            product,

            quantity:
              regularQuantity,

            unitPrice:
              promotion.originalPrice,

            isDiscounted: false,
          });
        }

        return;
      }

      /**
       * ======================================================
       * ITEM BÌNH THƯỜNG
       * ======================================================
       */
      result.push({
        lineId:
          createLineId(
            product,
            finalIsDiscounted
          ),

        product,

        quantity,

        unitPrice:
          finalUnitPrice,

        isDiscounted:
          finalIsDiscounted,
      });
    }
  );

  /**
   * ========================================================
   * GỘP CÁC DÒNG TRÙNG LINE ID
   * ========================================================
   */
  const mergedMap =
    new Map<
      string,
      CartItem
    >();

  result.forEach(
    (item) => {
      const existing =
        mergedMap.get(
          item.lineId
        );

      if (!existing) {
        mergedMap.set(
          item.lineId,
          {
            ...item,
          }
        );
      } else {
        mergedMap.set(
          item.lineId,
          {
            ...existing,

            quantity:
              existing.quantity +
              item.quantity,

            unitPrice:
              item.unitPrice,

            isDiscounted:
              item.isDiscounted,

            product:
              item.product,
          }
        );
      }
    }
  );

  /**
   * ========================================================
   * FINAL SANITIZE
   * ========================================================
   */
  return Array.from(
    mergedMap.values()
  ).filter(
    (item) =>
      item.quantity > 0
  );
};

/**
 * ============================================================
 * FIREBASE SYNC
 * ============================================================
 */
const syncCartToFirebase =
  async (
    userId: string | null,
    items: CartItem[]
  ) => {
    if (!userId) {
      return;
    }

    const cartRef = doc(
      db,
      "carts",
      userId
    );

    const cleanItems =
      sanitizeCartItems(items);

    try {
      if (
        cleanItems.length === 0
      ) {
        await deleteDoc(
          cartRef
        );

        return;
      }

      await setDoc(
        cartRef,
        {
          items: cleanItems,

          updatedAt:
            new Date().toISOString(),
        },
        {
          merge: true,
        }
      );
    } catch (error) {
      console.error(
        "❌ [CART] Lỗi đồng bộ Firebase:",
        error
      );
    }
  };

/**
 * ============================================================
 * STORE
 * ============================================================
 */
export const useCartStore =
  create<CartState>()(
    persist(
      (set, get) => ({
        items: [],

        isOpen: false,

        userId: null,

        selectedMerchantId:
          null,

        /**
         * ======================================================
         * SET USER
         * ======================================================
         */
        setUserId: (
          userId
        ) => {
          const currentUserId =
            get().userId;

          if (
            currentUserId ===
              userId &&
            unsubscribeCartListener
          ) {
            return;
          }

          /**
           * Hủy listener cũ.
           */
          if (
            unsubscribeCartListener
          ) {
            unsubscribeCartListener();

            unsubscribeCartListener =
              null;
          }

          /**
           * Làm sạch local cart ngay.
           */
          const cleanedLocalItems =
            sanitizeCartItems(
              get().items
            );

          set({
            userId,

            items:
              cleanedLocalItems,
          });

          /**
           * Chưa đăng nhập.
           */
          if (!userId) {
            return;
          }

          console.group(
            "🛒 [CART] Set User ID"
          );

          console.log(
            "User ID:",
            userId
          );

          console.log(
            "Local cart:",
            cleanedLocalItems
          );

          console.groupEnd();

          const cartRef =
            doc(
              db,
              "carts",
              userId
            );

          unsubscribeCartListener =
            onSnapshot(
              cartRef,
              (snapshot) => {
                /**
                 * ==================================================
                 * FIRESTORE CÓ CART
                 * ==================================================
                 */
                if (
                  snapshot.exists()
                ) {
                  const data =
                    snapshot.data();

                  if (
                    data &&
                    Array.isArray(
                      data.items
                    )
                  ) {
                    /**
                     * Firebase cart
                     * cũng phải qua sanitize
                     * để cập nhật giá mới nhất.
                     */
                    const remoteItems =
                      sanitizeCartItems(
                        data.items
                      );

                    const localItems =
                      sanitizeCartItems(
                        get().items
                      );

                    const mergedMap =
                      new Map<
                        string,
                        CartItem
                      >();

                    /**
                     * Remote trước.
                     */
                    remoteItems.forEach(
                      (item) => {
                        mergedMap.set(
                          item.lineId,
                          item
                        );
                      }
                    );

                    /**
                     * Local sau.
                     */
                    localItems.forEach(
                      (localItem) => {
                        const existing =
                          mergedMap.get(
                            localItem.lineId
                          );

                        if (
                          existing
                        ) {
                          mergedMap.set(
                            localItem.lineId,
                            {
                              ...existing,

                              product:
                                sanitizeCartProduct(
                                  existing.product
                                ),

                              quantity:
                                Math.max(
                                  existing.quantity,
                                  localItem.quantity
                                ),

                              /**
                               * Giá của product
                               * hiện tại.
                               */
                              unitPrice:
                                localItem.unitPrice,

                              isDiscounted:
                                localItem.isDiscounted,
                            }
                          );
                        } else {
                          mergedMap.set(
                            localItem.lineId,
                            localItem
                          );
                        }
                      }
                    );

                    const finalItems =
                      sanitizeCartItems(
                        Array.from(
                          mergedMap.values()
                        )
                      );

                    set({
                      items:
                        finalItems,
                    });

                    console.group(
                      "🛒 [CART] Firestore Snapshot"
                    );

                    console.log(
                      "Remote:",
                      remoteItems
                    );

                    console.log(
                      "Local:",
                      localItems
                    );

                    console.log(
                      "Final:",
                      finalItems
                    );

                    console.groupEnd();

                    /**
                     * Luôn đồng bộ lại
                     * nếu cart sau sanitize
                     * khác Firebase.
                     */
                    const before =
                      JSON.stringify(
                        data.items
                      );

                    const after =
                      JSON.stringify(
                        finalItems
                      );

                    if (
                      before !==
                      after
                    ) {
                      console.log(
                        "🧹 [CART] Cập nhật cart Firebase theo giá mới"
                      );

                      void syncCartToFirebase(
                        userId,
                        finalItems
                      );
                    }
                  }
                }

                /**
                 * ==================================================
                 * FIRESTORE CHƯA CÓ CART
                 * ==================================================
                 */
                else {
                  const localItems =
                    sanitizeCartItems(
                      get().items
                    );

                  if (
                    localItems.length > 0
                  ) {
                    void syncCartToFirebase(
                      userId,
                      localItems
                    );
                  }
                }
              },
              (error) => {
                console.error(
                  "❌ [CART] Firestore listener:",
                  error
                );
              }
            );
        },

        /**
         * ======================================================
         * OPEN / CLOSE
         * ======================================================
         */
        openCart: () =>
          set({
            isOpen: true,
          }),

        closeCart: () =>
          set({
            isOpen: false,
          }),

        setSelectedMerchantId:
          (
            merchantId
          ) =>
            set({
              selectedMerchantId:
                merchantId,
            }),

        /**
         * ======================================================
         * ADD ITEM
         * ======================================================
         */
        addItem: (
          product,
          _distance,
          quantity = 1
        ) => {
          /**
           * Luôn sanitize cart trước.
           */
          const currentItems =
            sanitizeCartItems(
              get().items
            );

          /**
           * Sanitize product mới.
           */
          const cleanProduct =
            sanitizeCartProduct(
              product
            );

          const safeQuantity =
            Math.max(
              1,
              Number(quantity) || 1
            );

          const merchantId =
            cleanProduct.merchantId ||
            cleanProduct.shopId ||
            "";

          /**
           * Các line hiện tại của
           * cùng product + merchant.
           */
          const productItems =
            currentItems.filter(
              (item) =>
                item.product.id ===
                  cleanProduct.id &&
                (
                  item.product
                    .merchantId ||
                  item.product.shopId ||
                  ""
                ) === merchantId
            );

          /**
           * Tổng quantity đang hưởng KM.
           */
          const currentDiscountQuantity =
            productItems
              .filter(
                (item) =>
                  item.isDiscounted
              )
              .reduce(
                (
                  sum,
                  item
                ) =>
                  sum +
                  item.quantity,
                0
              );

          /**
           * Tính KM.
           */
          const discountInfo =
            getDiscountInfo(
              cleanProduct,
              currentDiscountQuantity,
              safeQuantity
            );

          let updatedItems = [
            ...currentItems,
          ];

          /**
           * ====================================================
           * ADD DISCOUNT LINE
           * ====================================================
           */
          if (
            discountInfo.discountQuantityToAdd >
            0
          ) {
            const discountLineId =
              createLineId(
                cleanProduct,
                true
              );

            const existingIndex =
              updatedItems.findIndex(
                (item) =>
                  item.lineId ===
                  discountLineId
              );

            if (
              existingIndex >= 0
            ) {
              updatedItems =
                updatedItems.map(
                  (
                    item,
                    index
                  ) => {
                    if (
                      index !==
                      existingIndex
                    ) {
                      return item;
                    }

                    return {
                      ...item,

                      product:
                        cleanProduct,

                      quantity:
                        item.quantity +
                        discountInfo.discountQuantityToAdd,

                      unitPrice:
                        discountInfo.discountPrice,

                      isDiscounted:
                        true,
                    };
                  }
                );
            } else {
              updatedItems.push({
                lineId:
                  discountLineId,

                product:
                  cleanProduct,

                quantity:
                  discountInfo.discountQuantityToAdd,

                unitPrice:
                  discountInfo.discountPrice,

                isDiscounted:
                  true,
              });
            }

            console.log(
              `🏷️ [CART] ${
                discountInfo.discountQuantityToAdd
              } x ${
                discountInfo.discountPrice.toLocaleString(
                  "vi-VN"
                )
              }đ`
            );
          }

          /**
           * ====================================================
           * ADD REGULAR LINE
           * ====================================================
           */
          if (
            discountInfo.regularQuantityToAdd >
            0
          ) {
            const regularLineId =
              createLineId(
                cleanProduct,
                false
              );

            const existingIndex =
              updatedItems.findIndex(
                (item) =>
                  item.lineId ===
                  regularLineId
              );

            if (
              existingIndex >= 0
            ) {
              updatedItems =
                updatedItems.map(
                  (
                    item,
                    index
                  ) => {
                    if (
                      index !==
                      existingIndex
                    ) {
                      return item;
                    }

                    return {
                      ...item,

                      product:
                        cleanProduct,

                      quantity:
                        item.quantity +
                        discountInfo.regularQuantityToAdd,

                      unitPrice:
                        discountInfo.originalPrice,

                      isDiscounted:
                        false,
                    };
                  }
                );
            } else {
              updatedItems.push({
                lineId:
                  regularLineId,

                product:
                  cleanProduct,

                quantity:
                  discountInfo.regularQuantityToAdd,

                unitPrice:
                  discountInfo.originalPrice,

                isDiscounted:
                  false,
              });
            }

            console.log(
              `💰 [CART] ${
                discountInfo.regularQuantityToAdd
              } x ${
                discountInfo.originalPrice.toLocaleString(
                  "vi-VN"
                )
              }đ`
            );
          }

          /**
           * Final sanitize.
           */
          updatedItems =
            sanitizeCartItems(
              updatedItems
            );

          console.group(
            "🛒 [CART] ADD ITEM RESULT"
          );

          console.log(
            "Product:",
            cleanProduct.name
          );

          console.log(
            "Product ID:",
            cleanProduct.id
          );

          console.log(
            "Merchant ID:",
            merchantId
          );

          console.log(
            "Quantity requested:",
            safeQuantity
          );

          console.log(
            "Current discount quantity:",
            currentDiscountQuantity
          );

          console.log(
            "Cart after add:",
            updatedItems
          );

          console.groupEnd();

          set({
            items:
              updatedItems,

            isOpen: true,
          });

          void syncCartToFirebase(
            get().userId,
            updatedItems
          );
        },

        /**
         * ======================================================
         * REMOVE ITEM
         * ======================================================
         *
         * Xóa toàn bộ dòng của product.
         */
        removeItem: (
          productId
        ) => {
          const updatedItems =
            sanitizeCartItems(
              get().items
            ).filter(
              (item) =>
                item.product.id !==
                productId
            );

          set({
            items:
              updatedItems,
          });

          void syncCartToFirebase(
            get().userId,
            updatedItems
          );
        },

        /**
         * ======================================================
         * UPDATE QUANTITY
         * ======================================================
         */
        updateQuantity: (
          productId,
          delta
        ) => {
          if (delta === 0) {
            return;
          }

          const currentItems =
            sanitizeCartItems(
              get().items
            );

          /**
           * ====================================================
           * GIẢM
           * ====================================================
           *
           * Giảm dòng thường trước.
           * Giữ dòng KM lâu nhất.
           */
          if (delta < 0) {
            let remaining =
              Math.abs(delta);

            let updatedItems =
              currentItems.map(
                (item) => ({
                  ...item,
                })
              );

            /**
             * Giảm regular trước.
             */
            for (
              let i =
                updatedItems.length -
                1;
              i >= 0 &&
              remaining > 0;
              i--
            ) {
              const item =
                updatedItems[i];

              if (
                item.product.id !==
                  productId ||
                item.isDiscounted
              ) {
                continue;
              }

              const remove =
                Math.min(
                  item.quantity,
                  remaining
                );

              item.quantity -=
                remove;

              remaining -=
                remove;
            }

            /**
             * Sau đó giảm discount.
             */
            for (
              let i =
                updatedItems.length -
                1;
              i >= 0 &&
              remaining > 0;
              i--
            ) {
              const item =
                updatedItems[i];

              if (
                item.product.id !==
                  productId ||
                !item.isDiscounted
              ) {
                continue;
              }

              const remove =
                Math.min(
                  item.quantity,
                  remaining
                );

              item.quantity -=
                remove;

              remaining -=
                remove;
            }

            updatedItems =
              sanitizeCartItems(
                updatedItems.filter(
                  (item) =>
                    item.quantity >
                    0
                )
              );

            set({
              items:
                updatedItems,
            });

            void syncCartToFirebase(
              get().userId,
              updatedItems
            );

            return;
          }

          /**
           * ====================================================
           * TĂNG
           * ====================================================
           *
           * Không cộng trực tiếp vào line.
           *
           * Gọi lại addItem để kiểm tra
           * promotion hiện tại.
           */
          const targetItem =
            currentItems.find(
              (item) =>
                item.product.id ===
                  productId &&
                item.isDiscounted
            ) ||
            currentItems.find(
              (item) =>
                item.product.id ===
                productId
            );

          if (!targetItem) {
            return;
          }

          get().addItem(
            targetItem.product,
            undefined,
            delta
          );
        },

        /**
         * ======================================================
         * CLEAR CART
         * ======================================================
         */
        clearCart:
          async () => {
            const userId =
              get().userId;

            set({
              items: [],

              selectedMerchantId:
                null,
            });

            if (!userId) {
              return;
            }

            try {
              const cartRef =
                doc(
                  db,
                  "carts",
                  userId
                );

              await deleteDoc(
                cartRef
              );
            } catch (error) {
              console.error(
                "❌ [CART] Lỗi xóa cart:",
                error
              );
            }
          },

        /**
         * ======================================================
         * CLEAR MERCHANT
         * ======================================================
         */
        clearMerchantItems:
          async (
            merchantId
          ) => {
            const updatedItems =
              sanitizeCartItems(
                get().items
              ).filter(
                (item) =>
                  (
                    item.product
                      .merchantId ||
                    item.product.shopId ||
                    ""
                  ) !== merchantId
              );

            set({
              items:
                updatedItems,

              selectedMerchantId:
                get()
                  .selectedMerchantId ===
                merchantId
                  ? null
                  : get()
                      .selectedMerchantId,
            });

            await syncCartToFirebase(
              get().userId,
              updatedItems
            );
          },

        /**
         * ======================================================
         * GROUP BY MERCHANT
         * ======================================================
         */
        getItemsByMerchant:
          () => {
            const items =
              sanitizeCartItems(
                get().items
              );

            return items.reduce(
              (
                acc,
                item
              ) => {
                const merchantId =
                  item.product
                    .merchantId ||
                  item.product.shopId ||
                  "unknown_merchant";

                if (
                  !acc[merchantId]
                ) {
                  acc[merchantId] =
                    [];
                }

                acc[merchantId].push(
                  item
                );

                return acc;
              },
              {} as Record<
                string,
                CartItem[]
              >
            );
          },

        /**
         * ======================================================
         * TOTAL PRICE
         * ======================================================
         */
        getTotalPrice: (
          merchantId
        ) => {
          const items =
            sanitizeCartItems(
              get().items
            );

          const targetItems =
            merchantId
              ? items.filter(
                  (item) =>
                    (
                      item.product
                        .merchantId ||
                      item.product.shopId ||
                      ""
                    ) ===
                    merchantId
                )
              : items;

          return targetItems.reduce(
            (
              sum,
              item
            ) =>
              sum +
              item.unitPrice *
                item.quantity,
            0
          );
        },

        /**
         * ======================================================
         * TOTAL ITEMS
         * ======================================================
         */
        getTotalItems: (
          merchantId
        ) => {
          const items =
            sanitizeCartItems(
              get().items
            );

          const targetItems =
            merchantId
              ? items.filter(
                  (item) =>
                    (
                      item.product
                        .merchantId ||
                      item.product.shopId ||
                      ""
                    ) ===
                    merchantId
                )
              : items;

          return targetItems.reduce(
            (
              sum,
              item
            ) =>
              sum +
              item.quantity,
            0
          );
        },
      }),

      /**
       * ========================================================
       * PERSIST
       * ========================================================
       */
      {
        name:
          "cho-online-cart-storage",

        storage:
          createJSONStorage(
            () => localStorage
          ),

        partialize: (
          state
        ) => ({
          items:
            sanitizeCartItems(
              state.items
            ),

          selectedMerchantId:
            state.selectedMerchantId,
        }),
      }
    )
  );