"use client";

import { useState, useMemo, useCallback } from "react";

interface Review {
  id: string;
  userName: string;
  avatar: string;
  rating: number;
  date: string;
  comment: string;
}

interface Product {
  id: string;
  shopId: string;
  merchantId: string;
  merchantCode: string;
  shopName: string;
  isFavorite?: boolean;
  name: string;
  description: string;
  price: number;
  originalPrice: number;
  discountStock?: number | null;
  discountStartTime?: string | null;
  discountEndTime?: string | null;
  limitPerUser?: number; // Giới hạn số lượng mua mỗi người (Mặc định = 1 cho item sale)
  imageUrl: string;
  imageUrls: string[];
  soldCount: number;
  discountBadge?: string;
  stockProgress?: number;
  category: string;
  reviews: Review[];
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface Shop {
  id: string;
  merchantCode?: string;
  name: string;
  avatar: string;
  rating: number;
  reviewCount: number;
  distance: string;
  location: string;
  lat?: number | null;
  lng?: number | null;
  isMall?: boolean;
  products?: Product[];
}

interface ShopDetailModalProps {
  shop: Shop | null;
  distanceStr: string;
  products?: Product[];
  cartItems?: CartItem[]; // Truyền danh sách món đang có trong giỏ để check giới hạn
  onClose: () => void;
  onAddToCart?: (product: Product) => void;
  onProductClick?: (product: Product) => void;
  formatCurrency: (amount: number) => string;
}

type FilterType = "all" | "discount" | "bestseller" | "price_asc" | "price_desc";

export default function ShopDetailModal({
  shop,
  distanceStr,
  products = [],
  cartItems = [],
  onClose,
  onAddToCart,
  onProductClick,
  formatCurrency,
}: ShopDetailModalProps) {
  // 1. HOOKS
  const [activeTab, setActiveTab] = useState<"menu" | "info">("menu");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [filterType, setFilterType] = useState<FilterType>("all");

  // Kiểm tra trạng thái giảm giá thực tế (Số lượng + Thời gian)
  const checkDiscountStatus = useCallback((product: Product) => {
    const hasOriginal = product.originalPrice && product.originalPrice > product.price;
    if (!hasOriginal) {
      return { isDiscountActive: false, isUpcoming: false, currentPrice: product.price, discountPercent: 0 };
    }

    const now = new Date();
    const startTime = product.discountStartTime ? new Date(product.discountStartTime) : null;
    const endTime = product.discountEndTime ? new Date(product.discountEndTime) : null;

    // Sắp mở bán
    if (startTime && now < startTime) {
      return {
        isDiscountActive: false,
        isUpcoming: true,
        currentPrice: product.originalPrice,
        discountPercent: Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100),
      };
    }

    // Đã hết hạn sale
    if (endTime && now > endTime) {
      return { isDiscountActive: false, isUpcoming: false, currentPrice: product.originalPrice, discountPercent: 0 };
    }

    // Đã hết suất sale
    if (product.discountStock !== undefined && product.discountStock !== null && product.discountStock <= 0) {
      return { isDiscountActive: false, isUpcoming: false, currentPrice: product.originalPrice, discountPercent: 0 };
    }

    const discountPercent = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
    return { isDiscountActive: true, isUpcoming: false, currentPrice: product.price, discountPercent };
  }, []);

  // Kiểm tra xem người dùng đã chọn mua món sale này trong giỏ chưa (Giới hạn 1 món/người)
  const isLimitReached = useCallback(
    (product: Product) => {
      const { isDiscountActive } = checkDiscountStatus(product);
      if (!isDiscountActive) return false;

      const itemInCart = cartItems.find((ci) => ci.product.id === product.id);
      const limit = product.limitPerUser ?? 1; // Mặc định mỗi người mua tối đa 1 sản phẩm giảm giá

      return itemInCart ? itemInCart.quantity >= limit : false;
    },
    [cartItems, checkDiscountStatus]
  );

  // Format thời gian hiển thị (HH:mm)
  const formatTimeStr = (dateStr?: string | null) => {
    if (!dateStr) return "";
    try {
      return new Date(dateStr).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    } catch (e) {
      return "";
    }
  };

  // Danh sách sản phẩm thuộc Shop
  const shopProducts = useMemo(() => {
    if (!shop) return [];
    return (
      shop.products ||
      products.filter((p) => p.shopId === shop.id || p.shopName === shop.name)
    );
  }, [shop, products]);

  // Danh sách món đang có DEAL HOT hoặc SẮP MỞ BÁN
  const saleProducts = useMemo(() => {
    return shopProducts.filter((p) => {
      const status = checkDiscountStatus(p);
      return status.isDiscountActive || status.isUpcoming;
    });
  }, [shopProducts, checkDiscountStatus]);

  // Danh sách danh mục (Category)
  const categories = useMemo(() => {
    const cats = Array.from(new Set(shopProducts.map((p) => p.category).filter(Boolean)));
    return ["all", ...cats];
  }, [shopProducts]);

  // Xử lý Lọc & Tìm kiếm sản phẩm
  const filteredProducts = useMemo(() => {
    let result = [...shopProducts];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q))
      );
    }

    if (selectedCategory !== "all") {
      result = result.filter((p) => p.category === selectedCategory);
    }

    if (filterType === "discount") {
      result = result.filter((p) => checkDiscountStatus(p).isDiscountActive);
      result.sort((a, b) => {
        const discA = checkDiscountStatus(a).discountPercent;
        const discB = checkDiscountStatus(b).discountPercent;
        return discB - discA;
      });
    } else if (filterType === "bestseller") {
      result.sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0));
    } else if (filterType === "price_asc") {
      result.sort((a, b) => checkDiscountStatus(a).currentPrice - checkDiscountStatus(b).currentPrice);
    } else if (filterType === "price_desc") {
      result.sort((a, b) => checkDiscountStatus(b).currentPrice - checkDiscountStatus(a).currentPrice);
    }

    return result;
  }, [shopProducts, searchQuery, selectedCategory, filterType, checkDiscountStatus]);

  if (!shop) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      <div className="bg-stone-100 w-full max-w-lg h-[90vh] sm:h-[85vh] rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl relative flex flex-col">
        
        {/* COVER HEADER */}
        <div className="h-28 bg-gradient-to-r from-[#ff4500] via-[#ee4d2d] to-[#d0011b] relative p-4 shrink-0">
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center backdrop-blur-md transition active:scale-90 text-sm font-bold z-20 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* SHOP INFO CARD */}
        <div className="bg-white px-4 pb-3 shrink-0 relative shadow-2xs border-b border-stone-200/60">
          <div className="flex items-start gap-3 -mt-10 relative z-10">
            <div className="relative shrink-0">
              <img
                src={shop.avatar}
                alt={shop.name}
                className="w-18 h-18 rounded-2xl object-cover border-2 border-white shadow-md bg-white"
              />
              {shop.isMall && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-[#d0011b] text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border border-white shadow-xs">
                  Mall
                </span>
              )}
            </div>

            <div className="flex-1 min-w-0 pt-10">
              <h2 className="text-base font-extrabold text-stone-900 truncate leading-tight">
                {shop.name}
              </h2>
              <p className="text-[11px] text-stone-500 truncate flex items-center gap-1 mt-0.5 font-medium">
                <span>📍</span>
                <span className="truncate">{shop.location || "Chưa cập nhật địa chỉ"}</span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-stone-100 text-xs text-stone-600 text-center items-center">
            <div className="flex items-center justify-center gap-1">
              <span className="text-amber-500 font-black">★ {(shop.rating || 5.0).toFixed(1)}</span>
              <span className="text-stone-400 text-[10px] font-medium">({shop.reviewCount || 0}+ đánh giá)</span>
            </div>
            
            <div className="border-l border-stone-200/80 text-emerald-600 font-bold text-[11px] truncate px-1 flex items-center justify-center gap-1">
              <span>🚀 Giao đến:</span>
              <span>{distanceStr}</span>
            </div>
          </div>
        </div>

        {/* TABS NAVIGATION */}
        <div className="flex border-b border-stone-200 bg-white shrink-0 px-4 gap-6 text-xs font-bold">
          <button
            onClick={() => setActiveTab("menu")}
            className={`py-3 relative transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === "menu" ? "text-[#ee4d2d]" : "text-stone-500 hover:text-stone-800"
            }`}
          >
            <span>Thực đơn</span>
            <span className="bg-stone-100 text-stone-600 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
              {filteredProducts.length}
            </span>
            {activeTab === "menu" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ee4d2d] rounded-full" />
            )}
          </button>
          
          <button
            onClick={() => setActiveTab("info")}
            className={`py-3 relative transition cursor-pointer ${
              activeTab === "info" ? "text-[#ee4d2d]" : "text-stone-500 hover:text-stone-800"
            }`}
          >
            Thông tin Shop
            {activeTab === "info" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ee4d2d] rounded-full" />
            )}
          </button>
        </div>

        {/* SEARCH & FILTERS */}
        {activeTab === "menu" && (
          <div className="bg-white border-b border-stone-200/80 p-2.5 space-y-2 shrink-0">
            <div className="relative flex items-center">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Tìm món trong ${shop.name}...`}
                className="w-full bg-stone-100 text-stone-800 text-xs py-2 pl-8 pr-7 rounded-xl outline-none focus:ring-1 focus:ring-[#ee4d2d] font-medium transition"
              />
              <span className="absolute left-2.5 text-stone-400 text-xs">🔍</span>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 text-stone-400 hover:text-stone-600 text-xs font-bold p-1 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
              {[
                { id: "all", label: "Tất cả món" },
                { id: "discount", label: "🔥 Đang giảm giá" },
                { id: "bestseller", label: "👑 Bán chạy" },
                { id: "price_asc", label: "💵 Giá thấp -> cao" },
                { id: "price_desc", label: "💎 Giá cao -> thấp" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilterType(f.id as FilterType)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition cursor-pointer shrink-0 border ${
                    filterType === f.id
                      ? "bg-orange-50 text-[#ee4d2d] border-[#ee4d2d] shadow-2xs"
                      : "bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {categories.length > 2 && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar border-t border-stone-100 pt-1.5">
                <span className="text-[10px] font-bold text-stone-400 shrink-0">Danh mục:</span>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition shrink-0 cursor-pointer ${
                      selectedCategory === cat
                        ? "bg-stone-900 text-white font-bold"
                        : "bg-stone-100 text-stone-600 hover:text-stone-900"
                    }`}
                  >
                    {cat === "all" ? "Tất cả" : cat}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CONTENT BODY */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {activeTab === "menu" ? (
            <>
              {/* 🔥 KHU VỰC DEAL HOT TỪ CỬA HÀNG (CAROUSEL SLIDER) 🔥 */}
              {!searchQuery && selectedCategory === "all" && filterType === "all" && saleProducts.length > 0 && (
                <div className="bg-gradient-to-r from-orange-500/10 via-rose-500/5 to-transparent border border-orange-200/80 rounded-2xl p-2.5 space-y-2">
                  <div className="flex items-center justify-between px-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="bg-gradient-to-r from-red-600 to-[#ee4d2d] text-white text-[10px] font-black px-2 py-0.5 rounded-md italic shadow-2xs">
                        ⚡ FLASH SALE QUÁN
                      </span>
                      <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded">
                        👤 Mỗi người mua tối đa 1 suất
                      </span>
                    </div>

                    <span className="text-[10px] font-bold text-stone-500">
                      Ưu đãi có hạn
                    </span>
                  </div>

                  {/* Horizontal Scroll Sale Items */}
                  <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
                    {saleProducts.map((p) => {
                      const { isDiscountActive, isUpcoming, currentPrice, discountPercent } = checkDiscountStatus(p);
                      const startTimeFormatted = formatTimeStr(p.discountStartTime);
                      const endTimeFormatted = formatTimeStr(p.discountEndTime);
                      const reachedLimit = isLimitReached(p);

                      return (
                        <div
                          key={`sale-${p.id}`}
                          onClick={() => onProductClick && onProductClick(p)}
                          className="min-w-[140px] max-w-[140px] bg-white border border-stone-200/90 rounded-xl p-2 flex flex-col justify-between shadow-2xs cursor-pointer hover:border-[#ee4d2d] transition group shrink-0"
                        >
                          <div className="space-y-1.5">
                            <div className="relative aspect-square bg-stone-100 rounded-lg overflow-hidden">
                              <img
                                src={p.imageUrl}
                                alt={p.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                              />
                              {discountPercent > 0 && (
                                <span className="absolute top-0 right-0 bg-[#ee4d2d] text-white text-[9px] font-black px-1.5 py-0.5 rounded-bl-lg shadow-2xs">
                                  -{discountPercent}%
                                </span>
                              )}
                              <span className="absolute top-0 left-0 bg-stone-900/80 text-white text-[7px] font-bold px-1 py-0.5 rounded-br-md">
                                GH 1 suất
                              </span>
                            </div>
                            <h4 className="text-[11px] font-bold text-stone-800 line-clamp-1 group-hover:text-[#ee4d2d] transition">
                              {p.name}
                            </h4>
                          </div>

                          <div className="pt-1.5 space-y-1.5 border-t border-stone-100 mt-1">
                            <div>
                              <div className="text-xs font-black text-[#ee4d2d]">
                                {formatCurrency(isDiscountActive ? currentPrice : p.price)}
                              </div>
                              {p.originalPrice > (isDiscountActive ? currentPrice : p.price) && (
                                <div className="text-[9px] text-stone-400 line-through">
                                  {formatCurrency(p.originalPrice)}
                                </div>
                              )}
                            </div>

                            {/* Số lượng suất & Thời gian sale */}
                            {isDiscountActive ? (
                              <div className="space-y-1">
                                {p.discountStock !== undefined && p.discountStock !== null ? (
                                  <div className="bg-rose-50 border border-rose-100 text-[#ee4d2d] rounded-md text-center py-0.5">
                                    <span className="text-[8px] font-black">
                                      🔥 Còn {p.discountStock} suất
                                    </span>
                                  </div>
                                ) : (
                                  <div className="bg-orange-50 border border-orange-100 text-[#ee4d2d] rounded-md text-center py-0.5">
                                    <span className="text-[8px] font-bold">
                                      {endTimeFormatted ? `⏱️ Hết lúc ${endTimeFormatted}` : "🔥 Đang giảm giá"}
                                    </span>
                                  </div>
                                )}

                                <button
                                  disabled={reachedLimit}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (onAddToCart && !reachedLimit) onAddToCart(p);
                                  }}
                                  className={`w-full text-[9px] font-bold py-1 rounded-lg transition flex items-center justify-center gap-0.5 cursor-pointer shadow-2xs ${
                                    reachedLimit
                                      ? "bg-stone-200 text-stone-400 cursor-not-allowed"
                                      : "bg-[#ee4d2d] hover:bg-[#d73f20] text-white active:scale-95"
                                  }`}
                                >
                                  <span>{reachedLimit ? "Đã đạt giới hạn 1" : "+ Mua ngay"}</span>
                                </button>
                              </div>
                            ) : isUpcoming ? (
                              <div className="space-y-1">
                                <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-md text-center py-0.5">
                                  <span className="text-[8px] font-bold">
                                    ⏰ Mở bán {startTimeFormatted}
                                  </span>
                                </div>
                                <button
                                  disabled
                                  className="w-full bg-stone-100 text-stone-400 text-[9px] font-bold py-1 rounded-lg cursor-not-allowed"
                                >
                                  Sắp diễn ra
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* LIST TẤT CẢ MÓN ĂN */}
              {filteredProducts.length > 0 ? (
                <div className="space-y-2">
                  {filteredProducts.map((product) => {
                    const { isDiscountActive, isUpcoming, currentPrice, discountPercent } = checkDiscountStatus(product);
                    const startTimeFormatted = formatTimeStr(product.discountStartTime);
                    const endTimeFormatted = formatTimeStr(product.discountEndTime);
                    const reachedLimit = isLimitReached(product);

                    return (
                      <div
                        key={product.id}
                        onClick={() => onProductClick && onProductClick(product)}
                        className="bg-white p-2.5 rounded-2xl border border-stone-200/80 shadow-2xs flex gap-3 cursor-pointer hover:border-orange-200 transition active:scale-[0.99] group"
                      >
                        {/* Image */}
                        <div className="relative w-22 h-22 rounded-xl overflow-hidden shrink-0 bg-stone-100">
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          />
                          {isDiscountActive && discountPercent > 0 && (
                            <span className="absolute top-0 left-0 bg-gradient-to-r from-red-600 to-[#ee4d2d] text-white text-[9px] font-black px-1.5 py-0.5 rounded-br-lg shadow-2xs">
                              -{discountPercent}% OFF
                            </span>
                          )}
                          {isUpcoming && (
                            <span className="absolute top-0 left-0 bg-amber-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-br-lg shadow-2xs">
                              ⏰ SẮP SALE
                            </span>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 flex flex-col justify-between min-w-0">
                          <div className="space-y-0.5">
                            <h4 className="text-xs font-bold text-stone-800 line-clamp-1 group-hover:text-[#ee4d2d] transition">
                              {product.name}
                            </h4>
                            <p className="text-[10px] text-stone-400 line-clamp-2 leading-relaxed">
                              {product.description || "Món ăn chế biến tươi nóng từ nguyên liệu sạch."}
                            </p>

                            <div className="flex flex-wrap items-center gap-1 pt-0.5">
                              {isDiscountActive && (
                                <span className="inline-block bg-amber-50 border border-amber-200 text-amber-800 text-[8px] font-bold px-1.5 py-0.2 rounded-md">
                                  👤 Giới hạn 1 món/người
                                </span>
                              )}

                              {product.discountBadge && (
                                <span className="inline-block bg-orange-50 border border-orange-200 text-[#ee4d2d] text-[8px] font-extrabold px-1.5 py-0.2 rounded-md">
                                  🏷️ {product.discountBadge}
                                </span>
                              )}

                              {/* Hiển thị thời gian / số lượng sale */}
                              {isDiscountActive && product.discountStock !== undefined && product.discountStock !== null && (
                                <span className="inline-block bg-rose-50 border border-rose-200 text-rose-700 text-[8px] font-bold px-1.5 py-0.2 rounded-md">
                                  🔥 Còn {product.discountStock} suất
                                </span>
                              )}

                              {isDiscountActive && endTimeFormatted && (
                                <span className="inline-block bg-stone-100 text-stone-600 text-[8px] font-medium px-1.5 py-0.2 rounded-md">
                                  ⏱️ Hết hạn {endTimeFormatted}
                                </span>
                              )}

                              {isUpcoming && startTimeFormatted && (
                                <span className="inline-block bg-amber-50 text-amber-700 border border-amber-200 text-[8px] font-bold px-1.5 py-0.2 rounded-md">
                                  ⏰ Mở bán {startTimeFormatted}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-end justify-between pt-1">
                            <div className="space-y-0.5">
                              <div className="flex items-baseline gap-1.5">
                                <span className="text-sm font-black text-[#ee4d2d]">
                                  {formatCurrency(currentPrice)}
                                </span>
                                {isDiscountActive && product.originalPrice > currentPrice && (
                                  <span className="text-[10px] text-stone-400 line-through">
                                    {formatCurrency(product.originalPrice)}
                                  </span>
                                )}
                              </div>
                              <p className="text-[8px] text-stone-400 font-medium">
                                Đã bán {product.soldCount || 0} suất
                              </p>
                            </div>

                            <button
                              type="button"
                              disabled={reachedLimit}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onAddToCart && !reachedLimit) onAddToCart(product);
                              }}
                              className={`font-bold px-3 py-1.5 rounded-xl text-xs transition flex items-center gap-1 shadow-2xs cursor-pointer ${
                                reachedLimit
                                  ? "bg-stone-200 text-stone-400 cursor-not-allowed"
                                  : "bg-[#ee4d2d] hover:bg-[#d73f20] text-white active:scale-95"
                              }`}
                            >
                              <span>{reachedLimit ? "Đã đạt tối đa 1" : "+ Thêm"}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-stone-400 text-xs space-y-2">
                  <span className="text-3xl">🔍</span>
                  <p className="font-medium">Không tìm thấy món phù hợp trong quán.</p>
                  {(searchQuery || filterType !== "all" || selectedCategory !== "all") && (
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setFilterType("all");
                        setSelectedCategory("all");
                      }}
                      className="text-[#ee4d2d] font-bold underline cursor-pointer"
                    >
                      Xóa tất cả bộ lọc
                    </button>
                  )}
                </div>
              )}
            </>
          ) : (
            /* TAB THÔNG TIN SHOP */
            <div className="space-y-3">
              <div className="bg-white p-3.5 rounded-2xl border border-stone-200/80 space-y-2.5 text-xs">
                <h4 className="font-bold text-stone-400 uppercase text-[10px] tracking-wider">
                  Tổng quan Quán
                </h4>
                <div className="grid grid-cols-3 gap-2 text-center py-1">
                  <div className="bg-stone-50 p-2 rounded-xl border border-stone-100">
                    <div className="text-amber-500 font-black text-sm">
                      ★ {(shop.rating || 5.0).toFixed(1)}
                    </div>
                    <div className="text-[9px] text-stone-400">Đánh giá</div>
                  </div>
                  <div className="bg-stone-50 p-2 rounded-xl border border-stone-100">
                    <div className="text-stone-800 font-black text-sm">
                      {shopProducts.length}
                    </div>
                    <div className="text-[9px] text-stone-400">Món ăn</div>
                  </div>
                  <div className="bg-stone-50 p-2 rounded-xl border border-stone-100">
                    <div className="text-emerald-600 font-black text-sm">
                      {distanceStr}
                    </div>
                    <div className="text-[9px] text-stone-400">Khoảng cách</div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-3.5 rounded-2xl border border-stone-200/80 space-y-2.5 text-xs">
                <h4 className="font-bold text-stone-400 uppercase text-[10px] tracking-wider">
                  Cam kết Dịch vụ & Chính sách Sale
                </h4>
                <div className="flex items-center gap-2.5 text-stone-700">
                  <span className="text-orange-500 text-base">🎁</span>
                  <span className="text-[11px] font-medium">Mỗi khách hàng được mua tối đa 1 sản phẩm giảm giá/đơn</span>
                </div>
                <div className="flex items-center gap-2.5 text-stone-700 border-t border-stone-100 pt-2">
                  <span className="text-orange-500 text-base">⚡</span>
                  <span className="text-[11px] font-medium">Giao hàng siêu tốc trong khu vực</span>
                </div>
                <div className="flex items-center gap-2.5 text-stone-700 border-t border-stone-100 pt-2">
                  <span className="text-emerald-500 text-base">🛡️</span>
                  <span className="text-[11px] font-medium">Đảm bảo an toàn thực phẩm & chất lượng</span>
                </div>
              </div>

              <div className="bg-white p-3.5 rounded-2xl border border-stone-200/80 space-y-1.5 text-xs">
                <h4 className="font-bold text-stone-400 uppercase text-[10px] tracking-wider">
                  Địa chỉ Cửa hàng
                </h4>
                <p className="text-stone-700 text-[11px] leading-relaxed font-medium">
                  📍 {shop.location || "Đang cập nhật địa chỉ chi tiết..."}
                </p>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}