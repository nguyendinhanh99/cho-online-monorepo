import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { Product } from "@cho-online/types";
import { db } from "@/lib/firebase";
import { doc, setDoc, deleteDoc, onSnapshot, Unsubscribe } from "firebase/firestore";

export interface CartProduct extends Product {
  distance?: string;
  merchantId?: string;       // ID Cửa hàng
  merchantCode?: string;     // Mã Cửa hàng
  merchantName?: string;     // Tên Cửa hàng
}

export interface CartItem {
  product: CartProduct;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  userId: string | null;
  selectedMerchantId: string | null;

  // Actions quản lý State & Sync
  setUserId: (userId: string | null) => void;
  openCart: () => void;
  closeCart: () => void;
  setSelectedMerchantId: (merchantId: string | null) => void;

  // Actions thao tác với Giỏ hàng
  addItem: (product: CartProduct, distance?: string) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, delta: number) => void;
  clearCart: () => Promise<void>;
  clearMerchantItems: (merchantId: string) => Promise<void>;

  // Utility Functions
  getTotalPrice: (merchantId?: string) => number;
  getTotalItems: (merchantId?: string) => number;
  getItemsByMerchant: () => Record<string, CartItem[]>;
}

// Biến lưu trữ hàm unsubscribe của Firestore Realtime listener ngoài store
let unsubscribeCartListener: Unsubscribe | null = null;

// Hàm bổ trợ: Đồng bộ dữ liệu lên Firebase Firestore theo User ID
const syncCartToFirebase = async (userId: string | null, items: CartItem[]) => {
  if (!userId) return;
  const cartRef = doc(db, "carts", userId);
  
  try {
    if (items.length === 0) {
      // Nếu giỏ hàng rỗng -> Xóa document giỏ hàng khỏi Firestore
      await deleteDoc(cartRef);
    } else {
      // Ngược lại -> Ghi đè/cập nhật danh sách items
      await setDoc(cartRef, { items, updatedAt: new Date().toISOString() }, { merge: true });
    }
  } catch (error) {
    console.error("Lỗi khi đồng bộ giỏ hàng lên Firebase:", error);
  }
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      userId: null,
      selectedMerchantId: null,

      // 1. Lắng nghe và đồng bộ giỏ hàng Real-time từ Firebase khi có User đăng nhập
      setUserId: (userId) => {
        const currentUserId = get().userId;
        if (currentUserId === userId && unsubscribeCartListener) return;

        // Hủy đăng ký listener cũ nếu có
        if (unsubscribeCartListener) {
          unsubscribeCartListener();
          unsubscribeCartListener = null;
        }

        set({ userId });

        if (!userId) return;

        // Subscribe nhận dữ liệu tự động từ Firestore
        const cartRef = doc(db, "carts", userId);
        unsubscribeCartListener = onSnapshot(
          cartRef,
          (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.data();
              if (data && Array.isArray(data.items)) {
                const remoteItems: CartItem[] = data.items;
                const localItems = get().items;

                // 🔀 Gộp dữ liệu từ Firestore và LocalStorage (đặc biệt hữu ích khi vừa đăng nhập thiết bị mới)
                const mergedMap = new Map<string, CartItem>();

                remoteItems.forEach((item) => {
                  mergedMap.set(item.product.id, item);
                });

                localItems.forEach((localItem) => {
                  if (mergedMap.has(localItem.product.id)) {
                    const existing = mergedMap.get(localItem.product.id)!;
                    mergedMap.set(localItem.product.id, {
                      ...existing,
                      quantity: Math.max(existing.quantity, localItem.quantity),
                    });
                  } else {
                    mergedMap.set(localItem.product.id, localItem);
                  }
                });

                const finalItems = Array.from(mergedMap.values());
                set({ items: finalItems });
              }
            } else {
              // Nếu Firestore chưa có dữ liệu, đẩy giỏ hàng hiện tại (nếu có) từ Local lên Firestore
              if (get().items.length > 0) {
                syncCartToFirebase(userId, get().items);
              }
            }
          },
          (error) => {
            console.error("Lỗi Realtime Cart Snapshot:", error);
          }
        );
      },

      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),

      setSelectedMerchantId: (merchantId) => set({ selectedMerchantId: merchantId }),

      // 2. Thêm món vào giỏ
      addItem: (product, distance) => {
        const currentItems = get().items;
        const merchantId = product.merchantId || "default_merchant";

        const productWithDetails: CartProduct = {
          ...product,
          distance: distance || product.distance || "1.0 km",
          merchantId,
          merchantCode: product.merchantCode || "",
        };

        const existingIndex = currentItems.findIndex(
          (item) => item.product.id === productWithDetails.id
        );

        let updatedItems: CartItem[] = [];

        if (existingIndex > -1) {
          updatedItems = currentItems.map((item, idx) =>
            idx === existingIndex ? { ...item, quantity: item.quantity + 1 } : item
          );
        } else {
          updatedItems = [...currentItems, { product: productWithDetails, quantity: 1 }];
        }

        set({ items: updatedItems, isOpen: true });
        syncCartToFirebase(get().userId, updatedItems);
      },

      // 3. Xóa món lẻ
      removeItem: (productId) => {
        const updatedItems = get().items.filter((item) => item.product.id !== productId);
        set({ items: updatedItems });
        syncCartToFirebase(get().userId, updatedItems);
      },

      // 4. Cập nhật số lượng
      updateQuantity: (productId, delta) => {
        const currentItems = get().items;
        const itemIndex = currentItems.findIndex((i) => i.product.id === productId);

        if (itemIndex === -1) return;

        const currentItem = currentItems[itemIndex];
        const newQuantity = currentItem.quantity + delta;

        if (newQuantity <= 0) {
          get().removeItem(productId);
          return;
        }

        const updatedItems = currentItems.map((item) =>
          item.product.id === productId ? { ...item, quantity: newQuantity } : item
        );

        set({ items: updatedItems });
        syncCartToFirebase(get().userId, updatedItems);
      },

      // 5. Xóa sạch toàn bộ giỏ hàng
      clearCart: async () => {
        const userId = get().userId;
        set({ items: [], selectedMerchantId: null });

        if (userId) {
          try {
            const cartRef = doc(db, "carts", userId);
            await deleteDoc(cartRef);
          } catch (error) {
            console.error("Lỗi khi xóa giỏ hàng khỏi Firebase:", error);
          }
        }
      },

      // 6. Xóa món của một shop nhất định
      clearMerchantItems: async (merchantId) => {
        const updatedItems = get().items.filter(
          (item) => item.product.merchantId !== merchantId
        );

        set({
          items: updatedItems,
          selectedMerchantId: get().selectedMerchantId === merchantId ? null : get().selectedMerchantId,
        });

        await syncCartToFirebase(get().userId, updatedItems);
      },

      // 7. Gom nhóm danh sách mặt hàng theo Merchant ID
      getItemsByMerchant: () => {
        const items = get().items;
        return items.reduce((acc, item) => {
          const mId = item.product.merchantId || "unknown_merchant";
          if (!acc[mId]) {
            acc[mId] = [];
          }
          acc[mId].push(item);
          return acc;
        }, {} as Record<string, CartItem[]>);
      },

      // 8. Tính tổng tiền
      getTotalPrice: (merchantId) => {
        const items = get().items;
        const targetItems = merchantId
          ? items.filter((item) => item.product.merchantId === merchantId)
          : items;

        return targetItems.reduce(
          (sum, item) => sum + item.product.price * item.quantity,
          0
        );
      },

      // 9. Tính tổng số lượng món
      getTotalItems: (merchantId) => {
        const items = get().items;
        const targetItems = merchantId
          ? items.filter((item) => item.product.merchantId === merchantId)
          : items;

        return targetItems.reduce((sum, item) => sum + item.quantity, 0);
      },
    }),
    {
      name: "cho-online-cart-storage", // Tên key lưu trữ trong localStorage
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        items: state.items,
        selectedMerchantId: state.selectedMerchantId,
      }), // Chỉ lưu danh sách items và shop đang chọn vào localStorage
    }
  )
);