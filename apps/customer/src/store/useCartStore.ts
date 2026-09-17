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
 * Một sản phẩm có thể có nhiều line:
 *
 * merchant:product:discount
 * merchant:product:regular
 *
 * Ví dụ:
 *
 * MS001:P001:discount
 * MS001:P001:regular
 *
 * Vì vậy mọi thao tác xóa / tăng / giảm
 * phải dùng lineId thay vì productId.
 */
export interface CartItem {
  lineId: string;

  product: CartProduct;

  quantity: number;

  /**
   * Giá thực tế của dòng.
   */
  unitPrice: number;

  /**
   * Dòng này có phải giá khuyến mãi không?
   */
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

  /**
   * Xóa chính xác một dòng cart.
   */
  removeItem: (
    lineId: string
  ) => void;

  /**
   * Tăng / giảm chính xác một dòng cart.
   */
  updateQuantity: (
    lineId: string,
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
 * FIREBASE LISTENER
 * ============================================================
 */
let unsubscribeCartListener:
  | Unsubscribe
  | null = null;

/**
 * ============================================================
 * FIREBASE HYDRATION
 * ============================================================
 *
 * Chỉ merge Local + Firebase ở snapshot đầu tiên.
 *
 * Sau đó Firebase là source of truth.
 *
 * Tránh lỗi:
 *
 * User xóa món
 * ↓
 * Local = không còn món
 * ↓
 * Firebase snapshot cũ về
 * ↓
 * merge local + remote
 * ↓
 * món bị hồi sinh.
 */
let isInitialCartSnapshot = false;

/**
 * ============================================================
 * HELPERS
 * ============================================================
 */

/**
 * Lấy merchant ID thống nhất.
 */
const getProductMerchantId = (
  product: CartProduct
): string => {
  return (
    product.merchantId ||
    product.shopId ||
    ""
  );
};

/**
 * Tạo lineId chuẩn.
 *
 * Không dùng productId đơn thuần.
 */
const createLineId = (
  product: CartProduct,
  isDiscounted: boolean
): string => {
  const merchantId =
    getProductMerchantId(product) ||
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
  const originalPrice =
    Number(product.originalPrice) ||
    Number(product.price) ||
    0;

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

      const quantity = Math.max(
        1,
        Number(rawItem.quantity) || 1
      );

      const discountLimit =
        getDiscountLimit(product);

      const storedIsDiscounted =
        typeof rawItem.isDiscounted ===
        "boolean"
          ? rawItem.isDiscounted
          : undefined;

      let finalIsDiscounted = false;

      /**
       * Có giá giảm hợp lệ.
       */
      if (
        getPromotionState(product)
          .discountEnabled
      ) {
        /**
         * Không có schedule:
         *
         * Giá sale luôn có hiệu lực.
         */
        if (
          !hasPromotionSchedule(
            product
          )
        ) {
          finalIsDiscounted =
            true;
        } else {
          /**
           * Có schedule:
           * giữ trạng thái line.
           */
          finalIsDiscounted =
            storedIsDiscounted ??
            true;
        }
      } else {
        /**
         * KM hết hạn / không hợp lệ.
         */
        finalIsDiscounted =
          false;
      }

      const promotion =
        getPromotionState(product);

      /**
       * Luôn tính lại giá.
       */
      const finalUnitPrice =
        finalIsDiscounted
          ? promotion.currentPrice
          : promotion.originalPrice;

      /**
       * ======================================================
       * TÁCH SALE / REGULAR KHI VƯỢT LIMIT
       * ======================================================
       */
      if (
        finalIsDiscounted &&
        discountLimit !==
          Number.MAX_SAFE_INTEGER &&
        quantity > discountLimit
      ) {
        const discountedQuantity =
          Math.min(
            quantity,
            discountLimit
          );

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
   * MERGE LINE TRÙNG NHAU
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

        return;
      }

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
  );

  /**
   * ========================================================
   * FINAL
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
      /**
       * Cart rỗng:
       * xóa document Firebase.
       */
      if (
        cleanItems.length === 0
      ) {
        await deleteDoc(
          cartRef
        );

        console.log(
          "🗑️ [CART] Firebase cart đã được xóa"
        );

        return;
      }

      await setDoc(
        cartRef,
        {
          items:
            cleanItems,

          updatedAt:
            new Date().toISOString(),
        },
        {
          merge: true,
        }
      );

      console.log(
        "☁️ [CART] Firebase sync:",
        cleanItems
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

          /**
           * Nếu cùng user và listener
           * đang hoạt động thì không tạo lại.
           */
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
           * Snapshot đầu tiên của user mới
           * sẽ được dùng để hydrate.
           */
          isInitialCartSnapshot =
            Boolean(userId);

          /**
           * Làm sạch local cart.
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

          /**
           * ====================================================
           * FIREBASE LISTENER
           * ====================================================
           */
          unsubscribeCartListener =
            onSnapshot(
              cartRef,
              (snapshot) => {
                /**
                 * ==================================================
                 * FIRESTORE CHƯA CÓ CART
                 * ==================================================
                 */
                if (
                  !snapshot.exists()
                ) {
                  const localItems =
                    sanitizeCartItems(
                      get().items
                    );

                  /**
                   * Firebase chưa có cart.
                   *
                   * Chỉ upload local ở lần đầu.
                   */
                  if (
                    isInitialCartSnapshot &&
                    localItems.length > 0
                  ) {
                    console.log(
                      "☁️ [CART] Firebase chưa có cart → upload local"
                    );

                    void syncCartToFirebase(
                      userId,
                      localItems
                    );
                  }

                  set({
                    items:
                      localItems,
                  });

                  isInitialCartSnapshot =
                    false;

                  return;
                }

                const data =
                  snapshot.data();

                const remoteItems =
                  sanitizeCartItems(
                    data?.items
                  );

                /**
                 * ==================================================
                 * SNAPSHOT ĐẦU TIÊN
                 * ==================================================
                 *
                 * Chỉ snapshot đầu tiên mới
                 * merge local + remote.
                 */
                if (
                  isInitialCartSnapshot
                ) {
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
                   * Firebase trước.
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
                        !existing
                      ) {
                        mergedMap.set(
                          localItem.lineId,
                          localItem
                        );

                        return;
                      }

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

                          unitPrice:
                            existing.unitPrice,

                          isDiscounted:
                            existing.isDiscounted,
                        }
                      );
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

                  /**
                   * Đã hydrate xong.
                   */
                  isInitialCartSnapshot =
                    false;

                  console.group(
                    "🛒 [CART] Initial Firebase Hydration"
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
                   * Nếu merge làm thay đổi
                   * Firebase thì cập nhật lại.
                   */
                  const remoteJson =
                    JSON.stringify(
                      remoteItems
                    );

                  const finalJson =
                    JSON.stringify(
                      finalItems
                    );

                  if (
                    remoteJson !==
                    finalJson
                  ) {
                    void syncCartToFirebase(
                      userId,
                      finalItems
                    );
                  }

                  return;
                }

                /**
                 * ==================================================
                 * SNAPSHOT SAU HYDRATION
                 * ==================================================
                 *
                 * Firebase là SOURCE OF TRUTH.
                 *
                 * Không merge local nữa.
                 */
                const finalItems =
                  sanitizeCartItems(
                    remoteItems
                  );

                set({
                  items:
                    finalItems,
                });

                console.group(
                  "☁️ [CART] Firebase Snapshot"
                );

                console.log(
                  "Remote:",
                  remoteItems
                );

                console.log(
                  "Final:",
                  finalItems
                );

                console.groupEnd();

                /**
                 * Nếu sanitize thay đổi dữ liệu
                 * thì đồng bộ lại Firebase.
                 */
                const before =
                  JSON.stringify(
                    data?.items ?? []
                  );

                const after =
                  JSON.stringify(
                    finalItems
                  );

                if (
                  before !==
                  after
                ) {
                  void syncCartToFirebase(
                    userId,
                    finalItems
                  );
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

        /**
         * ======================================================
         * SELECT MERCHANT
         * ======================================================
         */
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
           * Làm sạch cart hiện tại.
           */
          const currentItems =
            sanitizeCartItems(
              get().items
            );

          /**
           * Làm sạch product mới.
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
            getProductMerchantId(
              cleanProduct
            );

          /**
           * Các line của cùng:
           *
           * merchant + product
           */
          const productItems =
            currentItems.filter(
              (item) =>
                item.product.id ===
                  cleanProduct.id &&
                getProductMerchantId(
                  item.product
                ) === merchantId
            );

          /**
           * Tổng số lượng đang sale.
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
           * Tính promotion.
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
           * ADD DISCOUNT
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
          }

          /**
           * ====================================================
           * ADD REGULAR
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
          }

          /**
           * Sanitize lần cuối.
           */
          updatedItems =
            sanitizeCartItems(
              updatedItems
            );

          console.group(
            "🛒 [CART] ADD ITEM"
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
            "Quantity:",
            safeQuantity
          );

          console.log(
            "Before:",
            currentItems
          );

          console.log(
            "After:",
            updatedItems
          );

          console.groupEnd();

          /**
           * Cập nhật UI.
           */
          set({
            items:
              updatedItems,

            isOpen: true,
          });

          /**
           * Đồng bộ Firebase.
           */
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
         * Xóa chính xác một line.
         *
         * KHÔNG dùng productId.
         */
        removeItem: (
          lineId
        ) => {
          const currentItems =
            sanitizeCartItems(
              get().items
            );

          const itemToRemove =
            currentItems.find(
              (item) =>
                item.lineId ===
                lineId
            );

          if (
            !itemToRemove
          ) {
            console.warn(
              "⚠️ [CART] Không tìm thấy lineId:",
              lineId
            );

            return;
          }

          const updatedItems =
            currentItems.filter(
              (item) =>
                item.lineId !==
                lineId
            );

          console.group(
            "🗑️ [CART] REMOVE ITEM"
          );

          console.log(
            "Line ID:",
            lineId
          );

          console.log(
            "Product:",
            itemToRemove.product.name
          );

          console.log(
            "Product ID:",
            itemToRemove.product.id
          );

          console.log(
            "Merchant:",
            itemToRemove.product.merchantName
          );

          console.log(
            "Before:",
            currentItems
          );

          console.log(
            "After:",
            updatedItems
          );

          console.groupEnd();

          /**
           * UI update ngay.
           */
          set({
            items:
              updatedItems,
          });

          /**
           * Firebase update.
           *
           * Nếu empty:
           * syncCartToFirebase sẽ delete document.
           */
          void syncCartToFirebase(
            get().userId,
            updatedItems
          );
        },

        /**
         * ======================================================
         * UPDATE QUANTITY
         * ======================================================
         *
         * Dùng lineId.
         *
         * delta:
         *
         * +1 = tăng
         * -1 = giảm
         */
        updateQuantity: (
          lineId,
          delta
        ) => {
          if (delta === 0) {
            return;
          }

          const currentItems =
            sanitizeCartItems(
              get().items
            );

          const targetIndex =
            currentItems.findIndex(
              (item) =>
                item.lineId ===
                lineId
            );

          if (
            targetIndex < 0
          ) {
            console.warn(
              "⚠️ [CART] Không tìm thấy lineId:",
              lineId
            );

            return;
          }

          const targetItem =
            currentItems[targetIndex];

          /**
           * ====================================================
           * GIẢM
           * ====================================================
           */
          if (delta < 0) {
            const newQuantity =
              targetItem.quantity +
              delta;

            let updatedItems =
              [...currentItems];

            /**
             * Quantity <= 0:
             * xóa chính dòng đó.
             */
            if (
              newQuantity <= 0
            ) {
              updatedItems =
                updatedItems.filter(
                  (_, index) =>
                    index !==
                    targetIndex
                );
            } else {
              updatedItems =
                updatedItems.map(
                  (
                    item,
                    index
                  ) =>
                    index ===
                    targetIndex
                      ? {
                          ...item,

                          quantity:
                            newQuantity,
                        }
                      : item
                );
            }

            updatedItems =
              sanitizeCartItems(
                updatedItems
              );

            console.log(
              "➖ [CART] Giảm quantity:",
              {
                lineId,
                product:
                  targetItem.product.name,
                oldQuantity:
                  targetItem.quantity,
                newQuantity:
                  Math.max(
                    0,
                    newQuantity
                  ),
              }
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
           * Không cộng trực tiếp.
           *
           * Gọi addItem để tính lại
           * promotion.
           */
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

              console.log(
                "🗑️ [CART] Xóa toàn bộ cart Firebase"
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
         * CLEAR MERCHANT ITEMS
         * ======================================================
         */
        clearMerchantItems:
          async (
            merchantId
          ) => {
            const currentItems =
              sanitizeCartItems(
                get().items
              );

            const updatedItems =
              currentItems.filter(
                (item) =>
                  getProductMerchantId(
                    item.product
                  ) !== merchantId
              );

            const selected =
              get()
                .selectedMerchantId;

            set({
              items:
                updatedItems,

              selectedMerchantId:
                selected ===
                merchantId
                  ? null
                  : selected,
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
                  getProductMerchantId(
                    item.product
                  ) ||
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
                    getProductMerchantId(
                      item.product
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
                    getProductMerchantId(
                      item.product
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