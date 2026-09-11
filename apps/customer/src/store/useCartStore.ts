import { create } from "zustand";
import { Product } from "@cho-online/types";

export interface CartProduct extends Product {
  distance?: string;
  merchantId?: string;       // ID Cửa hàng
  merchantCode?: string;     // Mã Cửa hàng
}

export interface CartItem {
  product: CartProduct;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addItem: (product: CartProduct, distance?: string) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, delta: number) => void;
  clearCart: () => void;
  getTotalPrice: () => number;
  getTotalItems: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  isOpen: false,

  openCart: () => set({ isOpen: true }),
  closeCart: () => set({ isOpen: false }),

  addItem: (product, distance) => {
    const currentItems = get().items;

    // 1. Kiểm tra đơn hàng khác quán (Merchant Validation)
    if (currentItems.length > 0 && product.merchantId) {
      const currentMerchantId = currentItems[0].product.merchantId;

      if (currentMerchantId && currentMerchantId !== product.merchantId) {
        const confirmClear = window.confirm(
          "Giỏ hàng của bạn đang có món từ quán khác. Bạn có muốn xóa giỏ hàng cũ để thêm món từ quán này không?"
        );

        if (confirmClear) {
          get().clearCart();
          set({
            items: [
              {
                product: {
                  ...product,
                  distance: distance || product.distance || "1.0 km",
                },
                quantity: 1,
              },
            ],
            isOpen: true,
          });
          return;
        } else {
          return; // Hủy thao tác thêm món
        }
      }
    }

    const productWithDetails: CartProduct = {
      ...product,
      distance: distance || product.distance || "1.0 km",
      merchantId: product.merchantId || "",
      merchantCode: product.merchantCode || "",
    };

    // 2. Thêm món vào giỏ (chỉ nhận giá niêm yết chuẩn, không xử lý giảm giá món)
    const existingIndex = currentItems.findIndex(
      (item) => item.product.id === productWithDetails.id
    );

    if (existingIndex > -1) {
      const updated = currentItems.map((item, idx) =>
        idx === existingIndex ? { ...item, quantity: item.quantity + 1 } : item
      );
      set({ items: updated, isOpen: true });
    } else {
      set({
        items: [...currentItems, { product: productWithDetails, quantity: 1 }],
        isOpen: true,
      });
    }
  },

  removeItem: (productId) => {
    set({
      items: get().items.filter((item) => item.product.id !== productId),
    });
  },

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

    set({
      items: currentItems.map((item) =>
        item.product.id === productId
          ? { ...item, quantity: newQuantity }
          : item
      ),
    });
  },

  clearCart: () => set({ items: [] }),

  getTotalPrice: () => {
    return get().items.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0
    );
  },

  getTotalItems: () => {
    return get().items.reduce((sum, item) => sum + item.quantity, 0);
  },
}));