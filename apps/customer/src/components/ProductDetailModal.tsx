"use client";

import { useState, useMemo, useEffect } from "react";
import { db } from "@cho-online/firebase";
import { collection, query, where, getDocs, limit } from "firebase/firestore";

interface Review {
  id: string;
  userName: string;
  avatar: string;
  rating: number;
  date: string;
  comment: string;
  productId?: string;
}

interface Product {
  id: string;
  shopId: string;
  merchantId: string;
  merchantCode: string;
  shopName: string;
  storeAddress?: string;  
  shopAddress?: string;   
  address?: string;
  isFavorite?: boolean;
  name: string;
  description: string;
  price: number;
  originalPrice: number;
  imageUrl: string;
  imageUrls: string[];
  soldCount: number;
  discountBadge?: string;
  stockProgress?: number;
  category: string;
  reviews: Review[];
}

interface Shop {
  id: string;
  rating: number;
  address?: string;
  storeAddress?: string;
  lat?: number;
  lng?: number;
  phone?: string;
}

interface ProductDetailModalProps {
  product: Product | null;
  shop?: Shop;
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number) => void;
  formatCurrency: (amount: number) => string;
}

export default function ProductDetailModal({
  product,
  shop,
  onClose,
  onAddToCart,
  formatCurrency,
}: ProductDetailModalProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [fetchedReviews, setFetchedReviews] = useState<Review[]>([]);
  const [loadingReviews, setLoadingReviews] = useState<boolean>(false);

  // 🌟 TRUY VẤN ĐÁNH GIÁ THỰC TẾ THEO ĐÚNG MÓN ĂN (PRODUCT ID / PRODUCT NAME)
  useEffect(() => {
    if (!product) return;

    let isMounted = true;
    const fetchReviewsFromFirestore = async () => {
      setLoadingReviews(true);
      try {
        const reviewsList: Review[] = [];

        // 1. Quét từ collection "reviews" theo productId
        const reviewsRef = collection(db, "reviews");
        
        // Tạo query ưu tiên kiểm tra theo productId trước
        let qReview = query(
          reviewsRef,
          where("productId", "==", product.id),
          limit(20)
        );
        let reviewSnap = await getDocs(qReview);

        // Nếu không có kết quả theo productId, tìm theo merchantCode để lọc thủ công theo tên món
        if (reviewSnap.empty) {
          qReview = query(
            reviewsRef,
            where("merchantCode", "==", product.merchantCode || product.shopId || ""),
            limit(30)
          );
          reviewSnap = await getDocs(qReview);
        }

        reviewSnap.forEach((docSnap) => {
          const data = docSnap.data();
          const revInfo = data.reviewInfo || data;

          // 🎯 KIỂM TRA ĐIỀU KIỆN: Đánh giá phải thuộc về sản phẩm hiện tại
          const matchProductId = data.productId === product.id || revInfo.productId === product.id;
          const matchProductName = 
            data.productName?.toLowerCase().trim() === product.name?.toLowerCase().trim() ||
            revInfo.productName?.toLowerCase().trim() === product.name?.toLowerCase().trim();

          // Chỉ lấy nếu trùng ID hoặc trùng Tên món ăn
          if (matchProductId || matchProductName) {
            const comment = revInfo.productComment || revInfo.comment || revInfo.reviewText || "";
            const rating = Number(revInfo.productRating || revInfo.rating || 5);
            const reviewerName = data.customerName || data.userName || data.userDisplayName || revInfo.userName || "Khách hàng";

            if (comment || rating) {
              reviewsList.push({
                id: docSnap.id,
                userName: reviewerName,
                avatar: data.userAvatar || data.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100",
                rating: rating,
                comment: comment,
                date: revInfo.reviewedAt || revInfo.createdAt 
                  ? typeof (revInfo.reviewedAt || revInfo.createdAt) === "string"
                    ? (revInfo.reviewedAt || revInfo.createdAt)
                    : new Date((revInfo.reviewedAt || revInfo.createdAt).seconds * 1000).toLocaleDateString("vi-VN")
                  : "Gần đây",
              });
            }
          }
        });

        // 2. Nếu collection "reviews" chưa có, quét từ "orders" và lọc theo sản phẩm nằm trong danh sách items
        if (reviewsList.length === 0) {
          const ordersRef = collection(db, "orders");
          const qOrder = query(
            ordersRef,
            where("merchantCode", "==", product.merchantCode || product.shopId || ""),
            limit(30)
          );
          const orderSnap = await getDocs(qOrder);

          orderSnap.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.reviewInfo) {
              const rev = data.reviewInfo;
              
              // Kiểm tra xem món ăn hiện tại có nằm trong đơn hàng này hay không
              const orderItems = data.items || data.products || [];
              const hasThisProduct = Array.isArray(orderItems) && orderItems.some((item: any) => 
                item.id === product.id || 
                item.name?.toLowerCase().trim() === product.name?.toLowerCase().trim()
              );

              if (hasThisProduct) {
                const comment = rev.productComment || rev.comment || "";
                const rating = Number(rev.productRating || 5);
                const reviewerName = data.customerName || data.phone || "Khách hàng";

                reviewsList.push({
                  id: docSnap.id,
                  userName: reviewerName,
                  avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100",
                  rating: rating,
                  comment: comment,
                  date: rev.reviewedAt 
                    ? new Date(rev.reviewedAt).toLocaleDateString("vi-VN")
                    : "Gần đây",
                });
              }
            }
          });
        }

        if (isMounted) {
          setFetchedReviews(reviewsList);
        }
      } catch (error) {
        console.error("Lỗi khi tải đánh giá sản phẩm:", error);
      } finally {
        if (isMounted) setLoadingReviews(false);
      }
    };

    fetchReviewsFromFirestore();

    return () => {
      isMounted = false;
    };
  }, [product]);

  const galleryImages = useMemo(() => {
    if (!product) return [];
    if (product.imageUrls && product.imageUrls.length > 0) {
      return product.imageUrls;
    }
    return [product.imageUrl];
  }, [product]);

  if (!product) return null;

  const resolvedAddress =
    product.address ||
    product.storeAddress ||
    product.shopAddress ||
    shop?.address ||
    shop?.storeAddress ||
    "501 Hà Huy Tập, thành phố Hà Tĩnh";

  const enrichedProduct: Product = {
    ...product,
    storeAddress: resolvedAddress,
    address: resolvedAddress,
  };

  const displayReviews = fetchedReviews;

  const avgRating = (() => {
    if (displayReviews.length === 0) {
      return (shop?.rating || 5.0).toFixed(1);
    }
    const sum = displayReviews.reduce((acc, r) => acc + r.rating, 0);
    return (sum / displayReviews.length).toFixed(1);
  })();

  const discountPercent =
    product.originalPrice > product.price
      ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
      : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-end sm:items-center justify-center transition-opacity animate-fade-in">
      <div className="bg-stone-50 w-full max-w-lg max-h-[90vh] sm:max-h-[85vh] rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col shadow-2xl relative">
        
        {/* Header / Top Action Bar */}
        <div className="absolute top-3 right-3 z-30 flex items-center gap-2">
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center backdrop-blur-md hover:bg-black/60 transition active:scale-90 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto flex-1 no-scrollbar">
          
          {/* Main Image Banner */}
          <div className="relative aspect-square w-full bg-stone-100">
            <img
              src={galleryImages[selectedImageIndex] || product.imageUrl}
              alt={product.name}
              className="w-full h-full object-cover"
            />

            {/* Badges */}
            <div className="absolute top-3 left-3 flex flex-col gap-1 items-start">
              {product.isFavorite && (
                <span className="bg-[#ee4d2d] text-white text-[10px] font-bold px-2 py-0.5 rounded-r-full shadow-md">
                  Yêu thích
                </span>
              )}
            </div>

            {/* Image Counter Badge */}
            {galleryImages.length > 1 && (
              <span className="absolute bottom-3 right-3 bg-black/60 text-white text-[11px] font-medium px-2.5 py-0.5 rounded-full backdrop-blur-md">
                {selectedImageIndex + 1}/{galleryImages.length}
              </span>
            )}
          </div>

          {/* Thumbnail Selector */}
          {galleryImages.length > 1 && (
            <div className="flex gap-2 p-2 bg-white overflow-x-auto border-b border-stone-100 no-scrollbar">
              {galleryImages.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImageIndex(idx)}
                  className={`w-12 h-12 rounded-lg overflow-hidden shrink-0 border-2 transition ${
                    selectedImageIndex === idx ? "border-[#ee4d2d]" : "border-transparent opacity-60"
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Product Header Info */}
          <div className="bg-white p-4 space-y-2 border-b border-stone-100">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-[#ee4d2d]">
                {formatCurrency(product.price)}
              </span>
              {product.originalPrice > product.price && (
                <span className="text-xs text-stone-400 line-through">
                  {formatCurrency(product.originalPrice)}
                </span>
              )}
              {discountPercent > 0 && (
                <span className="bg-orange-100 text-[#ee4d2d] text-[10px] font-bold px-1.5 py-0.5 rounded-xs">
                  -{discountPercent}%
                </span>
              )}
            </div>

            <h1 className="text-sm font-bold text-stone-800 leading-snug line-clamp-2">
              {product.name}
            </h1>

            <div className="flex items-center gap-2 text-xs text-stone-500 pt-1">
              <div className="flex items-center gap-1 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200">
                <span className="text-amber-500 font-bold">★ {avgRating}</span>
              </div>
              <span className="text-stone-300">•</span>
              <span>Đã bán <strong className="text-stone-700">{product.soldCount}</strong></span>
              <span className="text-stone-300">•</span>
              <span className="text-emerald-600 font-semibold">{product.shopName}</span>
            </div>

            {/* Địa chỉ quán */}
            {enrichedProduct.storeAddress && (
              <p className="text-[11px] text-stone-500 font-normal pt-1 flex items-center gap-1">
                📍 <span>Địa chỉ lấy hàng: <strong>{enrichedProduct.storeAddress}</strong></span>
              </p>
            )}
          </div>

          {/* Quantity Selector */}
          <div className="bg-white p-4 flex items-center justify-between border-b border-stone-100">
            <span className="text-xs font-bold text-stone-700">Số lượng</span>
            <div className="flex items-center border border-stone-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                className="w-8 h-8 flex items-center justify-center bg-stone-50 text-stone-600 font-bold disabled:opacity-30 active:bg-stone-200"
              >
                -
              </button>
              <span className="w-10 text-center text-xs font-bold text-stone-800">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity((q) => q + 1)}
                className="w-8 h-8 flex items-center justify-center bg-stone-50 text-stone-600 font-bold active:bg-stone-200"
              >
                +
              </button>
            </div>
          </div>

          {/* Description Block */}
          <div className="bg-white p-4 space-y-2 mt-2">
            <h3 className="text-xs font-bold text-stone-800 uppercase tracking-wider">
              Chi tiết sản phẩm
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed whitespace-pre-line">
              {product.description || "Chưa có thông tin mô tả chi tiết cho sản phẩm này."}
            </p>
          </div>

          {/* 🌟 KHU VỰC HIỂN THỊ ĐÁNH GIÁ VÀ TÊN NGƯỜI DÙNG CỦA MÓN ĂN */}
          <div className="bg-white p-4 space-y-3 mt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
                <span>💬 Đánh giá món ăn</span>
                <span className="bg-orange-100 text-[#ee4d2d] px-1.5 py-0.2 rounded-full text-[10px] font-bold">
                  {displayReviews.length}
                </span>
              </h3>
            </div>

            <div className="space-y-3">
              {loadingReviews ? (
                <div className="py-6 text-center space-y-1">
                  <div className="w-5 h-5 border-2 border-[#ee4d2d] border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-[10px] text-stone-400">Đang tải nhận xét món ăn...</p>
                </div>
              ) : displayReviews.length > 0 ? (
                displayReviews.map((rev) => (
                  <div key={rev.id} className="bg-stone-50/80 border border-stone-100 p-3 rounded-xl space-y-2 text-xs">
                    
                    {/* 👤 HIỂN THỊ TÊN VÀ AVATAR NGƯỜI ĐÁNH GIÁ */}
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <img
                          src={rev.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100"}
                          alt={rev.userName}
                          className="w-7 h-7 rounded-full object-cover border border-stone-200 shadow-xs"
                        />
                        <div className="flex flex-col">
                          <span className="font-bold text-stone-800 text-xs">
                            {rev.userName || "Khách hàng"}
                          </span>
                          <span className="text-[9px] text-emerald-600 font-semibold flex items-center gap-0.5">
                            <span>✓</span> Đã thưởng thức món này
                          </span>
                        </div>
                      </div>

                      <span className="text-[10px] text-stone-400 font-mono">
                        {rev.date}
                      </span>
                    </div>

                    {/* Số sao đánh giá */}
                    <div className="text-amber-400 text-[11px] flex items-center gap-1 pt-0.5">
                      <span>{"★".repeat(rev.rating)}{"☆".repeat(5 - rev.rating)}</span>
                      <span className="text-[10px] text-amber-700 font-extrabold bg-amber-100/70 px-1 rounded">
                        {rev.rating}/5
                      </span>
                    </div>

                    {/* Lời nhắn / Bình luận */}
                    {rev.comment ? (
                      <p className="text-stone-700 text-xs leading-relaxed bg-white p-2.5 rounded-lg border border-stone-100 italic">
                        &ldquo;{rev.comment}&rdquo;
                      </p>
                    ) : (
                      <p className="text-stone-400 text-[11px] italic">
                        Khách hàng không để lại nhận xét bằng chữ.
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-6 bg-stone-50 rounded-xl border border-dashed border-stone-200 space-y-1">
                  <div className="text-xl">⭐</div>
                  <p className="text-xs text-stone-500 font-medium">Chưa có đánh giá nào cho món này</p>
                  <p className="text-[10px] text-stone-400">Món ăn này chưa có đánh giá riêng từ người mua.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* E-Commerce Bottom Action Bar */}
        <div className="bg-white p-3 border-t border-stone-200 grid grid-cols-2 gap-2 shrink-0">
          <button
            onClick={() => {
              onAddToCart(enrichedProduct, quantity);
              onClose();
            }}
            className="w-full bg-orange-100 text-[#ee4d2d] font-bold py-3 rounded-xl text-xs active:scale-95 transition border border-orange-200 flex flex-col items-center justify-center leading-none gap-1 cursor-pointer"
          >
            <span>Thêm Vào Giỏ</span>
            <span className="text-[10px] font-normal opacity-80">
              {formatCurrency(product.price * quantity)}
            </span>
          </button>

          <button
            onClick={() => {
              onAddToCart(enrichedProduct, quantity);
              onClose();
            }}
            className="w-full bg-gradient-to-r from-[#ff5722] to-[#ee4d2d] text-white font-bold py-3 rounded-xl text-xs active:scale-95 transition shadow-md shadow-orange-500/20 flex flex-col items-center justify-center leading-none gap-1 cursor-pointer"
          >
            <span>Mua Ngay</span>
            <span className="text-[10px] font-normal opacity-90">Giao tận nơi</span>
          </button>
        </div>

      </div>
    </div>
  );
}