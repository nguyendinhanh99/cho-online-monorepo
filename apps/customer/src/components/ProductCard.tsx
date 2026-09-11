"use client";

import { Product } from "@cho-online/types";

interface ProductCardProps {
  product: Product;
  onAddToCart?: (product: Product) => void;
}

export function ProductCard({ product, onAddToCart }: ProductCardProps) {
  // Cast product sang type có originalPrice và unit
  const p = product as Product & { originalPrice?: number; unit?: string };

  const formatCurrency = (amount?: number) => {
    if (!amount) return "";
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200/70 shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-md transition group">
      <div>
        {/* Hình ảnh */}
        <div className="relative w-full h-36 bg-stone-100 overflow-hidden">
          <img
            src={p.imageUrl}
            alt={p.name}
            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
          />
          {Boolean(p.originalPrice && p.originalPrice > p.price) && (
            <span className="absolute top-2 left-2 bg-rose-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
              Giảm giá
            </span>
          )}
        </div>

        {/* Thông tin */}
        <div className="p-3">
          <span className="text-[9px] font-bold text-brand-accent uppercase tracking-wider block mb-0.5">
            {p.category === "fruit" ? "🍓 Hoa Quả" : "🍹 Nước Ép"}
          </span>
          <h4 className="font-bold text-stone-800 text-xs line-clamp-1 group-hover:text-brand-primary transition">
            {p.name}
          </h4>
          <p className="text-[10px] text-stone-400 mt-0.5 line-clamp-1">
            {p.description}
          </p>
        </div>
      </div>

      {/* Giá & Nút Thêm */}
      <div className="p-3 pt-0 flex items-end justify-between mt-1">
        <div>
          <div className="text-sm font-black text-brand-primary">
            {formatCurrency(p.price)}
          </div>
          <div className="text-[10px] text-stone-400">
            {p.originalPrice && p.originalPrice > p.price ? (
              <span className="line-through mr-1">
                {formatCurrency(p.originalPrice)}
              </span>
            ) : null}
            <span>/ {p.unit || "phần"}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onAddToCart && onAddToCart(product)}
          className="w-8 h-8 rounded-xl bg-brand-primary/10 hover:bg-brand-primary hover:text-white text-brand-primary font-bold flex items-center justify-center transition active:scale-90 text-sm"
          title="Thêm vào giỏ"
        >
          ➕
        </button>
      </div>
    </div>
  );
}