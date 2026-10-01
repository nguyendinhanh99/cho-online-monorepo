"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  onAuthStateChanged,
} from "firebase/auth";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

import {
  auth,
  db,
} from "@cho-online/firebase";

import MerchantHeader from "@/components/merchant/MerchantHeader";

import NavigationTabs, {
  TabType,
} from "@/components/merchant/NavigationTabs";

import OverviewTab from "@/components/merchant/OverviewTab";

import OrdersTab, {
  Order,
} from "@/components/merchant/OrdersTab";

import ProductsTab, {
  Product,
} from "@/components/merchant/ProductsTab";

import SettingsTab from "@/components/merchant/SettingsTab";

import AccountTab from "@/components/merchant/AccountTab";

import GlobalNotification from "@/components/GlobalNotification";


// ============================================================
// TYPES
// ============================================================

interface MerchantIdentity {
  merchantId: string;
  merchantCode: string;
}


// ============================================================
// HELPERS
// ============================================================

const normalizeStatus = (
  value: unknown
): string => {
  return String(
    value ?? ""
  )
    .trim()
    .toLowerCase();
};


/**
 * Lấy thời gian đơn hàng để sort
 * đơn mới nhất lên trước.
 */
const getOrderTimestamp = (
  order: any
): number => {
  const value =
    order?.createdAt;

  if (!value) {
    return 0;
  }

  /**
   * Firestore Timestamp
   */
  if (
    typeof value?.toMillis ===
    "function"
  ) {
    return value.toMillis();
  }

  if (
    typeof value?.toDate ===
    "function"
  ) {
    return value
      .toDate()
      .getTime();
  }

  if (
    typeof value ===
    "string" ||
    typeof value ===
    "number"
  ) {
    const time =
      new Date(
        value
      ).getTime();

    return Number.isNaN(
      time
    )
      ? 0
      : time;
  }

  return 0;
};


/**
 * ============================================================
 * TÌM THÔNG TIN MERCHANT
 * ============================================================
 *
 * Mục đích:
 *
 * Firebase Auth UID
 *      ↓
 * Merchant document
 *      ↓
 * merchantId + merchantCode
 *
 * Sau đó listener orders sẽ bắt cả:
 *
 * merchantId
 * merchantCode
 *
 * để hỗ trợ dữ liệu cũ + mới.
 */
const resolveMerchantIdentity =
  async (
    uid: string
  ): Promise<MerchantIdentity> => {
    let merchantId =
      uid;

    let merchantCode =
      "";

    try {
      /**
       * ------------------------------------------------------
       * 1. Ưu tiên merchants/{uid}
       * ------------------------------------------------------
       */
      const merchantRef =
        doc(
          db,
          "merchants",
          uid
        );

      const merchantSnap =
        await getDoc(
          merchantRef
        );

      if (
        merchantSnap.exists()
      ) {
        const data =
          merchantSnap.data();

        merchantId =
          merchantSnap.id;

        merchantCode =
          String(
            data?.merchantCode ||
              ""
          ).trim();

        return {
          merchantId,
          merchantCode,
        };
      }


      /**
       * ------------------------------------------------------
       * 2. Một số Merchant có field uid
       * nhưng document id khác Auth UID
       * ------------------------------------------------------
       */
      const merchantQuery =
        query(
          collection(
            db,
            "merchants"
          ),
          where(
            "uid",
            "==",
            uid
          ),
          limit(1)
        );

      const merchantResult =
        await getDocs(
          merchantQuery
        );

      if (
        !merchantResult.empty
      ) {
        const merchantDoc =
          merchantResult.docs[0];

        const data =
          merchantDoc.data();

        merchantId =
          merchantDoc.id;

        merchantCode =
          String(
            data?.merchantCode ||
              ""
          ).trim();

        return {
          merchantId,
          merchantCode,
        };
      }


      /**
       * ------------------------------------------------------
       * 3. Fallback users/{uid}
       * ------------------------------------------------------
       */
      const userRef =
        doc(
          db,
          "users",
          uid
        );

      const userSnap =
        await getDoc(
          userRef
        );

      if (
        userSnap.exists()
      ) {
        const data =
          userSnap.data();

        merchantCode =
          String(
            data?.merchantCode ||
              ""
          ).trim();
      }
    } catch (error) {
      console.error(
        "❌ Không lấy được thông tin Merchant:",
        error
      );
    }

    return {
      merchantId,
      merchantCode,
    };
  };


// ============================================================
// COMPONENT
// ============================================================

export default function MerchantDashboard() {
  const [
    activeTab,
    setActiveTab,
  ] =
    useState<TabType>(
      "overview"
    );

  const [
    isOpenShop,
    setIsOpenShop,
  ] =
    useState<boolean>(
      true
    );


  // ============================================================
  // DATA
  // ============================================================

  const [
    orders,
    setOrders,
  ] =
    useState<Order[]>(
      []
    );

  const [
    products,
    setProducts,
  ] =
    useState<Product[]>(
      []
    );


  // ============================================================
  // REALTIME ORDERS
  // ============================================================

  useEffect(() => {
    /**
     * Các listener order hiện tại.
     */
    let orderUnsubscribes:
      Array<
        () => void
      > = [];


    /**
     * Chống race-condition nếu Auth thay đổi
     * trong lúc đang resolve Merchant.
     */
    let generation =
      0;


    const clearOrderListeners =
      () => {
        orderUnsubscribes.forEach(
          (
            unsubscribe
          ) => {
            try {
              unsubscribe();
            } catch {
              // ignore
            }
          }
        );

        orderUnsubscribes =
          [];
      };


    const authUnsubscribe =
      onAuthStateChanged(
        auth,

        async (
          currentUser
        ) => {
          /**
           * Auth đổi user:
           * hủy listener cũ trước.
           */
          clearOrderListeners();

          setOrders([]);

          const currentGeneration =
            ++generation;


          if (
            !currentUser
          ) {
            return;
          }


          // ================================================
          // 1. TÌM MERCHANT
          // ================================================

          const {
            merchantId,
            merchantCode,
          } =
            await resolveMerchantIdentity(
              currentUser.uid
            );


          /**
           * Trong lúc await nếu user đã đổi
           * thì bỏ kết quả cũ.
           */
          if (
            currentGeneration !==
            generation
          ) {
            return;
          }


          console.log(
            "🏪 Merchant realtime:",
            {
              authUid:
                currentUser.uid,

              merchantId,

              merchantCode,
            }
          );


          // ================================================
          // 2. TẠO CÁC NGUỒN LISTENER
          // ================================================

          const sources:
            Array<{
              key: string;
              field:
                | "merchantId"
                | "merchantCode";
              value: string;
            }> = [];


          /**
           * Query theo merchantId
           */
          if (
            merchantId
          ) {
            sources.push({
              key:
                `merchantId:${merchantId}`,

              field:
                "merchantId",

              value:
                merchantId,
            });
          }


          /**
           * Query theo Auth UID nữa,
           * phòng trường hợp đơn cũ lưu UID
           * thay vì merchant document id.
           */
          if (
            currentUser.uid &&
            currentUser.uid !==
              merchantId
          ) {
            sources.push({
              key:
                `merchantId:${currentUser.uid}`,

              field:
                "merchantId",

              value:
                currentUser.uid,
            });
          }


          /**
           * Query theo merchantCode
           */
          if (
            merchantCode
          ) {
            sources.push({
              key:
                `merchantCode:${merchantCode}`,

              field:
                "merchantCode",

              value:
                merchantCode,
            });
          }


          // ================================================
          // 3. MỖI QUERY CÓ MỘT MAP RIÊNG
          // ================================================

          const sourceOrders =
            new Map<
              string,
              Map<
                string,
                Order
              >
            >();


          /**
           * Gộp các query theo order document ID.
           *
           * Nếu cùng 1 order xuất hiện ở:
           *
           * merchantId
           * +
           * merchantCode
           *
           * vẫn chỉ được tính 1 lần.
           */
          const recomputeOrders =
            () => {
              const merged =
                new Map<
                  string,
                  Order
                >();


              sourceOrders.forEach(
                (
                  orderMap
                ) => {
                  orderMap.forEach(
                    (
                      order,
                      orderId
                    ) => {
                      merged.set(
                        orderId,
                        order
                      );
                    }
                  );
                }
              );


              const nextOrders =
                Array.from(
                  merged.values()
                ).sort(
                  (
                    a,
                    b
                  ) =>
                    getOrderTimestamp(
                      b
                    ) -
                    getOrderTimestamp(
                      a
                    )
                );


              setOrders(
                nextOrders
              );
            };


          // ================================================
          // 4. FIRESTORE REALTIME LISTENER
          // ================================================

          sources.forEach(
            (
              source
            ) => {
              const ordersQuery =
                query(
                  collection(
                    db,
                    "orders"
                  ),

                  where(
                    source.field,
                    "==",
                    source.value
                  )
                );


              const unsubscribe =
                onSnapshot(
                  ordersQuery,

                  (
                    snapshot
                  ) => {
                    const map =
                      new Map<
                        string,
                        Order
                      >();


                    snapshot.docs.forEach(
                      (
                        orderDoc
                      ) => {
                        const data =
                          orderDoc.data();


                        map.set(
                          orderDoc.id,

                          {
                            id:
                              orderDoc.id,

                            ...data,
                          } as Order
                        );
                      }
                    );


                    sourceOrders.set(
                      source.key,
                      map
                    );


                    /**
                     * Firestore thay đổi
                     * → cập nhật orders
                     * → pendingCount đổi
                     * → NavigationTabs render badge.
                     */
                    recomputeOrders();
                  },

                  (
                    error
                  ) => {
                    console.error(
                      `❌ Lỗi realtime orders (${source.field}=${source.value}):`,
                      error
                    );
                  }
                );


              orderUnsubscribes.push(
                unsubscribe
              );
            }
          );
        }
      );


    return () => {
      generation += 1;

      authUnsubscribe();

      clearOrderListeners();
    };
  }, []);


  // ============================================================
  // BADGE ĐƠN MỚI
  // ============================================================

  const pendingCount =
    useMemo(() => {
      return orders.filter(
        (
          order
        ) => {
          const status =
            normalizeStatus(
              order.status
            );


          /**
           * Chỉ những đơn đang chờ quán xác nhận
           * mới được tính là "đơn mới".
           */
          return (
            status ===
            "pending"
          );
        }
      ).length;
    }, [
      orders,
    ]);


  // ============================================================
  // BROWSER TITLE
  // ============================================================

  useEffect(() => {
    if (
      pendingCount > 0
    ) {
      document.title =
        `(${pendingCount}) Đơn mới • Anvami`;
    } else {
      document.title =
        "Anvami Merchant";
    }

    return () => {
      document.title =
        "Anvami Merchant";
    };
  }, [
    pendingCount,
  ]);


  // ============================================================
  // FORMAT
  // ============================================================

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


  // ============================================================
  // ORDER STATUS
  // ============================================================

  const handleUpdateOrderStatus =
    (
      orderId: string,
      nextStatus: any
    ) => {
      /**
       * Update UI ngay lập tức.
       *
       * Sau đó onSnapshot Firestore sẽ
       * đồng bộ lại dữ liệu thật.
       */
      setOrders(
        (
          prev
        ) =>
          prev.map(
            (
              order
            ) =>
              order.id ===
              orderId
                ? {
                    ...order,
                    status:
                      nextStatus,
                  }
                : order
          )
      );
    };


  // ============================================================
  // PRODUCT STOCK
  // ============================================================

  const toggleProductStock =
    (
      productId: string
    ) => {
      setProducts(
        (
          prev
        ) =>
          prev.map(
            (
              product
            ) =>
              product.id ===
              productId
                ? {
                    ...product,

                    isAvailable:
                      !product.isAvailable,
                  }
                : product
          )
      );
    };


  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="min-h-screen bg-[#f4f5f7] pb-12 font-sans text-stone-800">
      {/* ====================================================
          GLOBAL NOTIFICATION

          Giữ nguyên component này.
          Nó tiếp tục chịu trách nhiệm chuông / notification.

          MerchantDashboard mới chỉ chịu trách nhiệm:
          - realtime orders
          - badge
          - danh sách orders
      ==================================================== */}

      <GlobalNotification />


      {/* ====================================================
          HEADER
      ==================================================== */}

      <MerchantHeader
        isOpenShop={
          isOpenShop
        }
        onToggleOpen={() =>
          setIsOpenShop(
            (
              current
            ) =>
              !current
          )
        }
      />


      <div className="mx-auto max-w-md space-y-4 p-3">

        {/* ==================================================
            NAVIGATION

            pendingCount được cập nhật REALTIME
            kể cả activeTab đang là "overview".
        ================================================== */}

        <NavigationTabs
          activeTab={
            activeTab
          }
          setActiveTab={
            setActiveTab
          }
          pendingCount={
            pendingCount
          }
        />


        {/* ==================================================
            OVERVIEW
        ================================================== */}

        {activeTab ===
          "overview" && (
          <OverviewTab
            formatCurrency={
              formatCurrency
            }
            onNavigateToTab={(
              tab: string
            ) =>
              setActiveTab(
                tab as TabType
              )
            }
          />
        )}


        {/* ==================================================
            ORDERS

            Khi bấm vào đây thì orders ĐÃ CÓ SẴN.
            Không cần đợi OrdersTab load.
        ================================================== */}

        {activeTab ===
          "orders" && (
          <OrdersTab
            {...({
              orders,

              onUpdateStatus:
                handleUpdateOrderStatus,

              formatCurrency,
            } as any)}
          />
        )}


        {/* ==================================================
            PRODUCTS
        ================================================== */}

        {activeTab ===
          "products" && (
          <ProductsTab
            {...({
              products,

              onToggleStock:
                toggleProductStock,

              formatCurrency,
            } as any)}
          />
        )}


        {/* ==================================================
            SETTINGS
        ================================================== */}

        {activeTab ===
          "settings" && (
          <SettingsTab />
        )}


        {/* ==================================================
            ACCOUNT
        ================================================== */}

        {activeTab ===
          "account" && (
          <AccountTab />
        )}
      </div>
    </div>
  );
}