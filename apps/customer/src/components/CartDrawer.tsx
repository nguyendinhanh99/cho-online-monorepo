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
 * Thuật toán tính Phí vận chuyển chuẩn hệ thống TMĐT Hà Tĩnh
 */
const calculateShippingFeeDetails = (
  distanceKm: number = 1,
  orderDate: Date = new Date(),
  totalItemsCount: number = 1
) => {
  let baseFee = 0;
  const discount = 0; // KHÔNG GIẢM PHÍ SHIP TỪ SÀN NỮA

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
    selectedMerchantId,
    setSelectedMerchantId,
    getTotalPrice,
    getTotalItems,
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

  // 1. Gom nhóm danh sách mặt hàng theo merchantId
  const groupedMerchants = useMemo(() => {
    const map: Record<
      string,
      {
        merchantId: string;
        shopName: string;
        distanceStr: string;
        distanceKm: number;
        products: typeof items;
      }
    > = {};

    items.forEach((item) => {
      const prod = (item.product || item) as any;
      const mId = prod.merchantId || "default_merchant";
      const shopName = prod.merchantName || prod.shopName || "Cửa hàng";
      const rawDistance = prod.distance || "1.0 km";
      const parsedDistance = parseDistanceToKm(rawDistance);

      if (!map[mId]) {
        map[mId] = {
          merchantId: mId,
          shopName,
          distanceStr: rawDistance,
          distanceKm: parsedDistance,
          products: [],
        };
      }
      map[mId].products.push(item);
    });

    return map;
  }, [items]);

  const merchantList = Object.values(groupedMerchants);

  // 2. Tự động xác định Cửa hàng đang được chọn (Radio Active)
  const activeMerchantId = useMemo(() => {
    if (merchantList.length === 0) return null;
    if (selectedMerchantId && groupedMerchants[selectedMerchantId]) {
      return selectedMerchantId;
    }
    return merchantList[0].merchantId;
  }, [selectedMerchantId, groupedMerchants, merchantList]);

  // 3. Thông tin chi tiết về Cửa hàng đang chọn
  const activeMerchantData = activeMerchantId ? groupedMerchants[activeMerchantId] : null;
  const activeItems = activeMerchantData ? activeMerchantData.products : [];

  const rawTotalPrice = useMemo(() => {
    return activeMerchantId ? getTotalPrice(activeMerchantId) : 0;
  }, [activeMerchantId, getTotalPrice, items]);

  const activeItemsCount = useMemo(() => {
    return activeMerchantId ? getTotalItems(activeMerchantId) : 0;
  }, [activeMerchantId, getTotalItems, items]);

  // 4. Tính toán Phí Vận Chuyển riêng biệt cho Cửa hàng được chọn
  const shipCalculation = useMemo(() => {
    if (!activeMerchantData) {
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
  }, [activeMerchantData, activeItemsCount]);

  const finalShippingFee = shipCalculation.finalFee;
  const finalTotalPrice = rawTotalPrice + finalShippingFee;

  // 5. Tính số tiền tiết kiệm được (Đã ép kiểu as any để sửa lỗi đỏ TypeScript)
  const totalSavings = useMemo(() => {
    return activeItems.reduce((sum, item) => {
      const prod = (item.product || item) as any;
      if (prod.originalPrice && prod.originalPrice > prod.price) {
        return sum + (prod.originalPrice - prod.price) * item.quantity;
      }
      return sum;
    }, 0);
  }, [activeItems]);

  if (!isOpen) return null;

  const handleCheckout = () => {
    if (!activeMerchantId) return;

    setSelectedMerchantId(activeMerchantId);
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
                {items.reduce((acc, i) => acc + i.quantity, 0)} món trong giỏ ({merchantList.length} quán)
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

        {/* THÔNG BÁO TIẾT KIỆM */}
        {totalSavings > 0 && (
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-white flex items-center justify-between text-xs shadow-inner">
            <div className="flex items-center gap-2 font-medium">
              <span className="text-base leading-none">🎉</span>
              <span>
                Bạn tiết kiệm được <strong>{formatCurrency(totalSavings)}</strong> cho đơn này!
              </span>
            </div>
          </div>
        )}

        {/* CẢNH BÁO / HƯỚNG DẪN KHI CÓ NHIỀU QUÁN */}
        {merchantList.length > 1 && (
          <div className="bg-amber-50 border-b border-amber-200 p-3 text-xs text-amber-800 flex items-start gap-2">
            <span className="text-base leading-none">💡</span>
            <div>
              <p className="font-bold">Giỏ hàng có món từ {merchantList.length} Quán khác nhau</p>
              <p className="text-[11px] text-amber-700 mt-0.5">
                Vui lòng chọn nút tròn bên dưới quán bạn muốn tiến hành thanh toán trước.
              </p>
            </div>
          </div>
        )}

        {/* DANH SÁCH MÓN PHÂN THEO QUÁN */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div className="w-20 h-20 rounded-full bg-orange-50 flex items-center justify-center text-4xl shadow-inner">
                🧺
              </div>
              <div>
                <h4 className="text-sm font-bold text-stone-800">Giỏ hàng chưa có món nào</h4>
                <p className="text-xs text-stone-400 mt-1">
                  Hãy chọn vài món ngon để lấp đầy cái bụng đói nhé!
                </p>
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
            merchantList.map((merchantGroup) => {
              const isSelected = merchantGroup.merchantId === activeMerchantId;
              const shopShip = calculateShippingFeeDetails(
                merchantGroup.distanceKm,
                new Date(),
                merchantGroup.products.reduce((acc, i) => acc + i.quantity, 0)
              );

              return (
                <div
                  key={merchantGroup.merchantId}
                  className={`bg-white rounded-2xl border p-3.5 shadow-xs space-y-3 transition-all ${
                    isSelected
                      ? "border-orange-500 ring-2 ring-orange-100"
                      : "border-stone-200/70 opacity-75 hover:opacity-100"
                  }`}
                >
                  {/* THANH THÔNG TIN VÀ CHỌN SHOP */}
                  <div className="flex items-center justify-between pb-2.5 border-b border-stone-100">
                    <label className="flex items-center gap-2.5 min-w-0 cursor-pointer">
                      <input
                        type="radio"
                        name="selectedMerchant"
                        checked={isSelected}
                        onChange={() => setSelectedMerchantId(merchantGroup.merchantId)}
                        className="w-4 h-4 accent-[#ee4d2d] cursor-pointer"
                      />
                      <span className="text-sm">🏪</span>
                      <span className="text-xs font-extrabold text-stone-900 truncate">
                        {merchantGroup.shopName}
                      </span>
                    </label>

                    <div className="text-[10px] font-semibold text-stone-600 bg-stone-100 px-2.5 py-1 rounded-full shrink-0 flex items-center gap-1">
                      <span>📍 {merchantGroup.distanceStr}</span>
                      <span className="text-stone-300">•</span>
                      <span>{formatCurrency(shopShip.finalFee)}</span>
                    </div>
                  </div>

                  {/* CÁC SẢN PHẨM CỦA SHOP */}
                  <div className="space-y-3">
                    {merchantGroup.products.map((item) => {
                      const prod = (item.product || item) as any;
                      const hasDiscount =
                        prod.originalPrice &&
                        prod.originalPrice > prod.price &&
                        !String(prod.id).includes("_normal");

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
                            <h4 className="text-xs font-bold text-stone-800 truncate">
                              {prod.name}
                            </h4>

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

        {/* FOOTER THANH TOÁN (TÍNH RIÊNG THEO CỬA HÀNG ĐANG CHỌN) */}
        {items.length > 0 && activeMerchantData && (
          <div className="p-4 bg-white border-t border-stone-200/80 space-y-3 shadow-2xl">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs text-stone-500">
                <span>Tạm tính ({activeItemsCount} món):</span>
                <span className="font-semibold text-stone-700">
                  {formatCurrency(rawTotalPrice)}
                </span>
              </div>

              <div className="space-y-1 pt-1.5 border-t border-dashed border-stone-200">
                <div className="flex justify-between items-center text-xs text-stone-600 font-semibold">
                  <span>🛵 Phí giao hàng TMĐT:</span>
                  <span className="text-stone-800">{formatCurrency(finalShippingFee)}</span>
                </div>

                <div className="pl-2 space-y-0.5 text-[10px] text-stone-400 border-l border-stone-200">
                  <div className="flex justify-between">
                    <span>• Phí gốc ({activeMerchantData.distanceStr}):</span>
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

              <div className="flex justify-between items-baseline pt-2 border-t border-stone-200">
                <div>
                  <span className="text-sm font-bold text-stone-800">Tổng thanh toán:</span>
                  {totalSavings > 0 && (
                    <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                      Đã tiết kiệm {formatCurrency(totalSavings)}
                    </p>
                  )}
                </div>
                <span className="text-xl font-black text-[#ee4d2d]">
                  {formatCurrency(finalTotalPrice)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCheckout}
              className="w-full font-extrabold py-3.5 rounded-xl shadow-lg transition flex items-center justify-center gap-2 text-xs uppercase tracking-wider cursor-pointer bg-gradient-to-r from-orange-500 to-[#ee4d2d] hover:opacity-95 text-white shadow-orange-500/25 active:scale-[0.98]"
            >
              <span>Thanh toán đơn {activeMerchantData.shopName}</span>
              <span>➔</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}