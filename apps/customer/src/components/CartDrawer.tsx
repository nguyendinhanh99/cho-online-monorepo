"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/store/useCartStore";
import { isUserLoggedIn } from "@/utils/auth-guard";

/**
 * Hàm chuyển đổi chuỗi khoảng cách (VD: "785m", "1.2 km", "785 m") thành số KM chuẩn
 */
const parseDistanceToKm = (distanceStr: string = "1.0 km"): number => {
  if (!distanceStr) return 1.0;

  const str = distanceStr.toLowerCase().trim();
  const numericValue = parseFloat(str.replace(/[^0-9.]/g, "")) || 1.0;

  if (str.includes("m") && !str.includes("km")) {
    return numericValue / 1000;
  }

  return numericValue;
};

/**
 * Thuật toán tính Phí vận chuyển chuẩn hệ thống TMĐT Hà Tĩnh (Đã loại bỏ giảm phí ship từ sàn)
 */
const calculateShippingFeeDetails = (
  distanceKm: number = 1,
  orderDate: Date = new Date(),
  totalItemsCount: number = 1
) => {
  let baseFee = 0;
  const discount = 0; // 🚫 KHÔNG GIẢM PHÍ SHIP TỪ SÀN NỮA (Set về 0)

  if (distanceKm <= 1) {
    baseFee = 14000;
  } else if (distanceKm <= 2) {
    baseFee = 18000;
  } else if (distanceKm <= 3) {
    baseFee = 22000;
  } else if (distanceKm <= 4) {
    baseFee = 26000;
  } else if (distanceKm <= 5) {
    baseFee = 30000;
  } else {
    const extraKm = Math.ceil(distanceKm - 5);
    baseFee = 30000 + extraKm * 5000;
  }

  const hours = orderDate.getHours();
  const minutes = orderDate.getMinutes();
  const timeInMinutes = hours * 60 + minutes;

  let timeSurcharge = 0;
  if (timeInMinutes >= 11 * 60 && timeInMinutes <= 12 * 60 + 30) {
    timeSurcharge = 2000;
  } else if (timeInMinutes >= 18 * 60 && timeInMinutes <= 19 * 60 + 59) {
    timeSurcharge = 4000;
  } else if (timeInMinutes >= 20 * 60 || timeInMinutes === 0) {
    timeSurcharge = 7000;
  }

  let bulkSurcharge = 0;
  let isSplitOrder = false;

  if (totalItemsCount >= 11 && totalItemsCount <= 17) {
    bulkSurcharge = 10000;
  } else if (totalItemsCount >= 18) {
    baseFee = baseFee * 2;
    bulkSurcharge = 15000;
    isSplitOrder = true;
  }

  const finalFee = Math.max(0, baseFee + timeSurcharge + bulkSurcharge - discount);

  return {
    baseFee,
    timeSurcharge,
    bulkSurcharge,
    discount,
    finalFee,
    isSplitOrder,
  };
};

export function CartDrawer() {
  const router = useRouter();
  const {
    items,
    isOpen,
    closeCart,
    updateQuantity,
    removeItem,
    clearCart,
    getTotalPrice,
  } = useCartStore();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  };

  const handleIncreaseQuantity = (item: any) => {
    const prod = item.product || item;
    updateQuantity(prod.id, 1);
  };

  const handleDecreaseQuantity = (item: any) => {
    const prod = item.product || item;
    updateQuantity(prod.id, -1);
  };

  const {
    groupedItems,
    shopList,
    hasMultipleShops,
    totalItemsCount,
    rawTotalPrice,
    activeShopData,
    shipCalculation,
    finalShippingFee,
    finalTotalPrice,
    totalSavings,
  } = useMemo(() => {
    const rawTotalPrice = getTotalPrice();
    const totalItemsCount = items.reduce((sum, i) => sum + i.quantity, 0);

    const groupedItems = items.reduce((acc, item) => {
      const prod = (item.product || item) as any;
      const shopName = prod.shopName || "Cửa hàng";
      const rawDistance = prod.distance || "1.0 km";
      const parsedDistance = parseDistanceToKm(rawDistance);

      if (!acc[shopName]) {
        acc[shopName] = {
          products: [],
          distanceKm: parsedDistance,
          distanceStr: rawDistance,
        };
      }
      acc[shopName].products.push(item);
      return acc;
    }, {} as Record<string, { products: typeof items; distanceKm: number; distanceStr: string }>);

    const shopList = Object.keys(groupedItems);
    const hasMultipleShops = shopList.length > 1;
    const activeShopData = shopList.length === 1 ? groupedItems[shopList[0]] : null;

    const currentDate = new Date();
    const shipCalculation = calculateShippingFeeDetails(
      activeShopData?.distanceKm || 1,
      currentDate,
      totalItemsCount
    );

    const finalShippingFee = activeShopData ? shipCalculation.finalFee : 0;
    const finalTotalPrice = rawTotalPrice + finalShippingFee;

    // Chỉ tính tiết kiệm tiền món (Nếu sản phẩm giảm giá)
    const totalProductSavings = items.reduce((sum, item) => {
      const prod = (item.product || item) as any;
      if (prod.originalPrice && prod.originalPrice > prod.price) {
        return sum + (prod.originalPrice - prod.price) * item.quantity;
      }
      return sum;
    }, 0);

    const totalSavings = totalProductSavings; // Đã loại bỏ shipCalculation.discount

    return {
      groupedItems,
      shopList,
      hasMultipleShops,
      totalItemsCount,
      rawTotalPrice,
      activeShopData,
      shipCalculation,
      finalShippingFee,
      finalTotalPrice,
      totalSavings,
      currentDate,
    };
  }, [items, getTotalPrice]);

  if (!isOpen) return null;

  const handleCheckout = () => {
    if (hasMultipleShops) return;

    closeCart();
    if (!isUserLoggedIn()) {
      router.push("/login?redirectTo=/checkout");
    } else {
      router.push("/checkout");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity duration-300">
      <div className="absolute inset-0" onClick={closeCart} />

      <div className="relative z-10 w-full max-w-md bg-stone-50 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">

        {/* HEADER */}
        <div className="p-4 bg-white border-b border-stone-200/80 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-orange-500 to-amber-400 text-white flex items-center justify-center font-bold text-base shadow-md">
              🛒
            </div>
            <div>
              <h3 className="font-extrabold text-stone-900 text-sm">Giỏ hàng của bạn</h3>
              <p className="text-[11px] text-stone-500 font-medium">
                {totalItemsCount} món trong giỏ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <button
                type="button"
                onClick={clearCart}
                className="text-[11px] font-semibold text-stone-400 hover:text-red-500 px-2.5 py-1 rounded-full hover:bg-red-50 transition cursor-pointer"
              >
                Xóa tất cả
              </button>
            )}
            <button
              type="button"
              onClick={closeCart}
              aria-label="Đóng giỏ hàng"
              className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500 font-bold active:scale-90 transition cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* THÔNG BÁO TIẾT KIỆM NỔI BẬT */}
        {totalSavings > 0 && !hasMultipleShops && (
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-white flex items-center justify-between text-xs shadow-inner">
            <div className="flex items-center gap-2 font-medium">
              <span className="text-base leading-none">🎉</span>
              <span>Bạn tiết kiệm được <strong>{formatCurrency(totalSavings)}</strong> cho đơn này!</span>
            </div>
          </div>
        )}

        {/* CẢNH BÁO NHIỀU SHOP */}
        {hasMultipleShops && (
          <div className="bg-red-50 border-b border-red-200 p-3 text-xs text-red-700 flex items-start gap-2 animate-pulse">
            <span className="text-base leading-none">⚠️</span>
            <div>
              <p className="font-bold">Chỉ hỗ trợ đặt món từ 1 Cửa hàng/lần</p>
              <p className="text-[11px] text-red-600 mt-0.5">
                Giỏ hàng của bạn đang có sản phẩm từ {shopList.length} quán. Vui lòng xóa bớt để chỉ giữ lại 1 quán duy nhất.
              </p>
            </div>
          </div>
        )}

        {/* DANH SÁCH MÓN */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div className="w-20 h-20 rounded-full bg-orange-50 flex items-center justify-center text-4xl shadow-inner">
                🧺
              </div>
              <div>
                <h4 className="text-sm font-bold text-stone-800">Giỏ hàng chưa có món nào</h4>
                <p className="text-xs text-stone-400 mt-1">Hãy chọn vài món ngon để lấp đầy cái bụng đói nhé!</p>
              </div>
              <button
                type="button"
                onClick={closeCart}
                className="mt-2 px-5 py-2.5 bg-[#ee4d2d] text-white text-xs font-bold rounded-full shadow-md active:scale-95 transition cursor-pointer"
              >
                Khám phá món ngon ngay
              </button>
            </div>
          ) : (
            Object.entries(groupedItems).map(([shopName, shopData]) => {
              const shopShip = calculateShippingFeeDetails(
                shopData.distanceKm,
                new Date(),
                totalItemsCount
              );

              return (
                <div
                  key={shopName}
                  className={`bg-white rounded-2xl border p-3.5 shadow-xs space-y-3 transition-colors ${hasMultipleShops ? "border-red-300 ring-1 ring-red-100" : "border-stone-200/70"
                    }`}
                >
                  <div className="flex items-center justify-between pb-2.5 border-b border-stone-100">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-sm">🏪</span>
                      <span className="text-xs font-bold text-stone-900 truncate">{shopName}</span>
                    </div>

                    <div className="text-[10px] font-semibold text-stone-600 bg-stone-100 px-2.5 py-1 rounded-full shrink-0 flex items-center gap-1">
                      <span>📍 {shopData.distanceStr}</span>
                      <span className="text-stone-300">•</span>
                      <span>{formatCurrency(shopShip.finalFee)}</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {shopData.products.map((item) => {
                      const prod = (item.product || item) as any;
                      const hasDiscount = prod.originalPrice && prod.originalPrice > prod.price && !String(prod.id).includes("_normal");

                      return (
                        <div key={prod.id} className="flex gap-3 items-center">
                          <div className="relative shrink-0">
                            <img
                              src={prod.imageUrl}
                              alt={prod.name}
                              className="w-14 h-14 rounded-xl object-cover border border-stone-100"
                            />
                            {hasDiscount && (
                              <span className="absolute -top-1.5 -left-1.5 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full shadow-xs">
                                SALE
                              </span>
                            )}
                          </div>

                          <div className="flex-1 min-w-0 space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-xs font-bold text-stone-800 truncate">
                                {prod.name}
                              </h4>
                            </div>

                            <div className="flex items-baseline gap-1.5">
                              <span className="text-xs font-extrabold text-[#ee4d2d]">
                                {formatCurrency(prod.price)}
                              </span>
                              {hasDiscount && (
                                <span className="text-[10px] text-stone-400 line-through font-medium">
                                  {formatCurrency(prod.originalPrice)}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* BỘ ĐIỀU CHỈNH SỐ LƯỢNG */}
                          <div className="flex items-center gap-2">
                            <div className="flex items-center bg-stone-100 rounded-lg p-0.5 border border-stone-200">
                              <button
                                type="button"
                                onClick={() => handleDecreaseQuantity(item)}
                                className="w-6 h-6 flex items-center justify-center font-bold text-stone-600 hover:text-red-500 rounded-md active:bg-white transition cursor-pointer"
                              >
                                -
                              </button>
                              <span className="text-xs font-bold text-stone-800 w-6 text-center">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleIncreaseQuantity(item)}
                                className="w-6 h-6 flex items-center justify-center font-bold text-[#ee4d2d] rounded-md active:bg-white transition cursor-pointer"
                              >
                                +
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => removeItem(prod.id)}
                              className="text-stone-300 hover:text-red-500 p-1 text-xs transition cursor-pointer"
                              title="Xóa món này"
                              aria-label="Xóa món này"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* FOOTER THANH TOÁN */}
        {items.length > 0 && (
          <div className="p-4 bg-white border-t border-stone-200/80 space-y-3 shadow-2xl">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs text-stone-500">
                <span>Tạm tính ({totalItemsCount} món):</span>
                <span className="font-semibold text-stone-700">{formatCurrency(rawTotalPrice)}</span>
              </div>

              {!hasMultipleShops && (
                <div className="space-y-1 pt-1.5 border-t border-dashed border-stone-200">
                  <div className="flex justify-between items-center text-xs text-stone-600 font-semibold">
                    <span>🛵 Phí giao hàng TMĐT:</span>
                    <span className="text-stone-800">{formatCurrency(finalShippingFee)}</span>
                  </div>

                  <div className="pl-2 space-y-0.5 text-[10px] text-stone-400 border-l border-stone-200">
                    <div className="flex justify-between">
                      <span>• Phí gốc ({activeShopData?.distanceStr || "1km"}):</span>
                      <span>{formatCurrency(shipCalculation.baseFee)}</span>
                    </div>
                    {shipCalculation.timeSurcharge > 0 && (
                      <div className="flex justify-between text-amber-600">
                        <span>• Phụ phí khung giờ cao điểm:</span>
                        <span>+{formatCurrency(shipCalculation.timeSurcharge)}</span>
                      </div>
                    )}
                    {shipCalculation.bulkSurcharge > 0 && (
                      <div className="flex justify-between text-amber-600">
                        <span>• Phụ phí cồng kềnh:</span>
                        <span>+{formatCurrency(shipCalculation.bulkSurcharge)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-between items-baseline pt-2 border-t border-stone-200">
                <div>
                  <span className="text-sm font-bold text-stone-800">Tổng thanh toán:</span>
                  {totalSavings > 0 && !hasMultipleShops && (
                    <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                      Đã tiết kiệm {formatCurrency(totalSavings)}
                    </p>
                  )}
                </div>
                <span className="text-xl font-black text-[#ee4d2d]">
                  {hasMultipleShops ? formatCurrency(rawTotalPrice) : formatCurrency(finalTotalPrice)}
                </span>
              </div>
            </div>

            <button
              type="button"
              disabled={hasMultipleShops}
              onClick={handleCheckout}
              className={`w-full font-extrabold py-3.5 rounded-xl shadow-lg transition flex items-center justify-center gap-2 text-xs uppercase tracking-wider cursor-pointer ${hasMultipleShops
                  ? "bg-stone-300 text-stone-500 cursor-not-allowed shadow-none"
                  : "bg-gradient-to-r from-orange-500 to-[#ee4d2d] hover:opacity-95 text-white shadow-orange-500/25 active:scale-[0.98]"
                }`}
            >
              <span>{hasMultipleShops ? "Vui lòng chọn 1 Cửa hàng" : "Tiến hành thanh toán"}</span>
              {!hasMultipleShops && <span>➔</span>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}