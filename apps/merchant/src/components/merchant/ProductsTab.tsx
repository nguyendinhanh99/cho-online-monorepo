"use client";

import { useState, useEffect } from "react";
import { db, auth } from "@/services/firebase";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc, 
  deleteDoc,
  serverTimestamp 
} from "firebase/firestore";

export interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  stock: number;
  discountStock?: number;
  maxPerUser?: number | null;
  discountStartTime?: string;
  discountEndTime?: string;
  isAvailable: boolean;
  isFeatured?: boolean;
  isConsumerGood?: boolean;
  category: string;
  description?: string;
  imageUrls?: string[];
  merchantId?: string;
}

// 🛒 Danh mục dành riêng cho Hàng Tiêu Dùng, Tạp Hóa & Điện Máy
const CONSUMER_GOODS_CATEGORIES: Record<string, string[]> = {
  // --- ĐIỆN MÁY & CÔNG NGHỆ ---
  "📱 Điện Thoại & Phụ Kiện": ["Sạc dự phòng", "Tai nghe Bluetooth", "Cáp sạc Type-C", "Ốp lưng"],
  "🔌 Thiết Bị Điện": ["Bóng đèn LED", "Ổ cắm điện", "Pin AA/AAA", "Công tắc"],
  "🍳 Điện Gia Dụng": ["Nồi chiên không dầu", "Ấm siêu tốc", "Nồi cơm điện", "Quạt máy"],
  
  // --- BÁCH HÓA & TIÊU DÙNG ---
  "🧺 Giặt Xả Giá Sốc": ["Nước giặt", "Nước xả vải", "Bột giặt", "Túi giặt"],
  "🧂 Gia Vị Nhà Bếp": ["Dầu ăn", "Nước mắm", "Hạt nêm", "Đường cát", "Muối tinh"],
  "🧻 Giấy & Bìm Tã": ["Giấy vệ sinh", "Bỉm / Tã em bé", "Khăn giấy khô", "Khăn giấy ướt"],
  "🧹 Vệ sinh nhà cửa": ["Nước lau sàn", "Nước rửa chén", "Xịt lau kính", "Túi rác"],
  "🧼 Chăm sóc cá nhân": ["Sữa tắm", "Dầu gội đầu", "Bàn chải đánh răng", "Kem đánh răng"]
};

// 🍔 Danh mục dành riêng cho Thực Đơn Quán (Ăn uống)
const FOOD_CATEGORIES: Record<string, string[]> = {
  "☕ Cà phê": ["Cà phê đen đá", "Cà phê sữa đá", "Bạc xỉu", "Cà phê muối", "Capuchino", "Espresso"],
  "🧋 Trà sữa": ["Trà sữa truyền thống", "Trà sữa trân châu đường đen", "Trà sữa Ô long", "Trà sữa Matcha"],
  "🍳 Điểm tâm & Ăn sáng": ["Bánh mì ốp la", "Bánh mì pate thịt", "Xôi mặn", "Bánh bao"],
  "🍚 Cơm & Món chính": ["Cơm tấm sườn nướng", "Cơm gà xối mỡ", "Cơm văn phòng"],
  "🍜 Bún, Phở & Mì": ["Phở bò", "Phở gà", "Bún bò Huế", "Bún thịt nướng"],
  "🍿 Đồ ăn vặt": ["Cá viên chiên", "Bánh tráng trộn", "Khoai tây chiên"]
};

const QUICK_DISCOUNTS = [10, 15, 20, 25, 30, 50];

export default function ProductsTab({ formatCurrency }: { formatCurrency?: (amount: number) => string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activeMainTab, setActiveMainTab] = useState<"food" | "consumer">("consumer");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  
  const [quickDuration, setQuickDuration] = useState<string>("2h");

  // Form State
  const [newProduct, setNewProduct] = useState({
    name: "",
    originalPrice: "",
    discountPercent: "0",
    price: "",
    stock: "100",
    hasDiscountLimit: false,
    discountStock: "10",
    hasPerUserLimit: false,
    maxPerUser: "1",
    hasTimeLimit: false,
    discountStartTime: "",
    discountEndTime: "",
    category: "📱 Điện Thoại & Phụ Kiện",
    description: "",
    isFeatured: false,
    isConsumerGood: true,
  });

  const currentUser = auth.currentUser;

  const formatISO = (date: Date) => {
    const tzOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
  };

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const q = query(collection(db, "products"), where("merchantId", "==", currentUser.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const productList: Product[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<Product, "id">),
      }));
      setProducts(productList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const resetForm = (forConsumer = activeMainTab === "consumer") => {
    const defaultCategories = forConsumer ? CONSUMER_GOODS_CATEGORIES : FOOD_CATEGORIES;
    const firstCategory = Object.keys(defaultCategories)[0];

    setNewProduct({
      name: "",
      originalPrice: "",
      discountPercent: "0",
      price: "",
      stock: "100",
      hasDiscountLimit: false,
      discountStock: "10",
      hasPerUserLimit: false,
      maxPerUser: "1",
      hasTimeLimit: false,
      discountStartTime: "",
      discountEndTime: "",
      category: firstCategory,
      description: "",
      isFeatured: false,
      isConsumerGood: forConsumer,
    });
    setSelectedFiles([]);
    setPreviewUrls([]);
    setExistingImageUrls([]);
    setEditingProduct(null);
    setQuickDuration("2h");
  };

  const handleOpenAddModal = (categoryPreset?: string, namePreset?: string) => {
    const isConsumer = activeMainTab === "consumer";
    resetForm(isConsumer);
    
    if (categoryPreset) {
      setNewProduct((prev) => ({
        ...prev,
        category: categoryPreset,
        name: namePreset || "",
      }));
    }
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (product: Product) => {
    setEditingProduct(product);
    
    const orig = product.originalPrice || product.price;
    const sale = product.price;
    const calcPercent = (product.originalPrice && product.originalPrice > sale)
      ? Math.round(((product.originalPrice - sale) / product.originalPrice) * 100)
      : 0;

    setNewProduct({
      name: product.name || "",
      originalPrice: orig ? orig.toString() : "",
      discountPercent: calcPercent.toString(),
      price: sale ? sale.toString() : "",
      stock: product.stock !== undefined ? product.stock.toString() : "0",
      hasDiscountLimit: product.discountStock !== undefined && product.discountStock !== null && product.discountStock >= 0,
      discountStock: product.discountStock !== undefined && product.discountStock !== null ? product.discountStock.toString() : "10",
      hasPerUserLimit: product.maxPerUser !== undefined && product.maxPerUser !== null && product.maxPerUser > 0,
      maxPerUser: product.maxPerUser !== undefined && product.maxPerUser !== null ? product.maxPerUser.toString() : "1",
      hasTimeLimit: !!(product.discountStartTime || product.discountEndTime),
      discountStartTime: product.discountStartTime || "",
      discountEndTime: product.discountEndTime || "",
      category: product.category || (product.isConsumerGood ? "📱 Điện Thoại & Phụ Kiện" : "☕ Cà phê"),
      description: product.description || "",
      isFeatured: !!product.isFeatured,
      isConsumerGood: !!product.isConsumerGood,
    });
    setExistingImageUrls(product.imageUrls || []);
    setSelectedFiles([]);
    setPreviewUrls([]);
    setQuickDuration("custom");
    setIsModalOpen(true);
  };

  const handleSelectQuickDuration = (type: string) => {
    setQuickDuration(type);
    const now = new Date();
    const startTimeStr = formatISO(now);
    let endTime = new Date(now);

    if (type === "2h") {
      endTime.setHours(endTime.getHours() + 2);
    } else if (type === "4h") {
      endTime.setHours(endTime.getHours() + 4);
    } else if (type === "today") {
      endTime.setHours(23, 59, 0, 0);
    } else if (type === "3days") {
      endTime.setDate(endTime.getDate() + 3);
    }

    setNewProduct((prev) => ({
      ...prev,
      discountStartTime: startTimeStr,
      discountEndTime: formatISO(endTime),
    }));
  };

  const handleToggleTimeLimit = (checked: boolean) => {
    if (checked && (!newProduct.discountStartTime || !newProduct.discountEndTime)) {
      handleSelectQuickDuration("2h");
    }
    setNewProduct((prev) => ({ ...prev, hasTimeLimit: checked }));
  };

  const handleOriginalPriceChange = (val: string) => {
    const orig = Number(val) || 0;
    const pct = Number(newProduct.discountPercent) || 0;
    let calcPrice = orig;
    if (pct > 0 && orig > 0) {
      calcPrice = Math.round(orig * (1 - pct / 100));
    }
    setNewProduct((prev) => ({
      ...prev,
      originalPrice: val,
      price: calcPrice > 0 ? calcPrice.toString() : "",
    }));
  };

  const handleDiscountPercentChange = (pctValue: number) => {
    const orig = Number(newProduct.originalPrice) || Number(newProduct.price) || 0;
    const pct = Math.min(100, Math.max(0, pctValue));
    let calcPrice = orig;
    if (pct > 0 && orig > 0) {
      calcPrice = Math.round(orig * (1 - pct / 100));
    }
    setNewProduct((prev) => ({
      ...prev,
      discountPercent: pct.toString(),
      price: calcPrice > 0 ? calcPrice.toString() : prev.price,
    }));
  };

  const handleSalePriceChange = (val: string) => {
    const sale = Number(val) || 0;
    const orig = Number(newProduct.originalPrice) || 0;
    let calcPercent = 0;
    if (orig > 0 && sale < orig) {
      calcPercent = Math.round(((orig - sale) / orig) * 100);
    }
    setNewProduct((prev) => ({
      ...prev,
      price: val,
      discountPercent: calcPercent.toString(),
    }));
  };

  const checkDiscountStatus = (prod: Product) => {
    const hasDiscount = prod.originalPrice && prod.originalPrice > prod.price;
    if (!hasDiscount) return { active: false, reason: "none" };

    const now = new Date();
    if (prod.discountStartTime && now < new Date(prod.discountStartTime)) {
      return { active: false, reason: "not_started" };
    }
    if (prod.discountEndTime && now > new Date(prod.discountEndTime)) {
      return { active: false, reason: "expired" };
    }
    if (prod.discountStock !== undefined && prod.discountStock !== null && prod.discountStock <= 0) {
      return { active: false, reason: "out_of_stock" };
    }

    return { active: true, reason: "active" };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...filesArray]);
      const newPreviews = filesArray.map((file) => URL.createObjectURL(file));
      setPreviewUrls((prev) => [...prev, ...newPreviews]);
    }
  };

  const handleRemoveNewImage = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveExistingImage = (index: number) => {
    setExistingImageUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadToCloudinary = async (files: File[]): Promise<string[]> => {
    const CLOUD_NAME = "lfqjrcvh";
    const UPLOAD_PRESET = "ml_default";

    const uploadPromises = files.map(async (file) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", UPLOAD_PRESET);

      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: formData });
      if (!res.ok) throw new Error("Lỗi upload ảnh");
      const data = await res.json();
      return data.secure_url;
    });

    return Promise.all(uploadPromises);
  };

  const handleToggleStock = async (productId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, "products", productId), { isAvailable: !currentStatus });
    } catch (error) {
      console.error("Lỗi đổi trạng thái:", error);
    }
  };

  const handleDelete = async (productId: string) => {
    if (confirm("Bạn có chắc muốn xóa mặt hàng này?")) {
      await deleteDoc(doc(db, "products", productId));
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    try {
      setIsSubmitting(true);
      let newlyUploadedUrls: string[] = [];
      if (selectedFiles.length > 0) {
        newlyUploadedUrls = await uploadToCloudinary(selectedFiles);
      }

      const finalImageUrls = [...existingImageUrls, ...newlyUploadedUrls];
      if (finalImageUrls.length === 0) {
        finalImageUrls.push("https://placehold.co/100x100?text=Product");
      }

      const priceNum = Number(newProduct.price) || 0;
      const originalPriceInput = Number(newProduct.originalPrice) || 0;
      const finalOriginalPrice = originalPriceInput > priceNum ? originalPriceInput : null;
      const stockNum = Number(newProduct.stock) || 0;

      let finalDiscountStock: number | null = null;
      if (finalOriginalPrice && newProduct.hasDiscountLimit) {
        finalDiscountStock = Number(newProduct.discountStock) || 0;
      }

      let finalMaxPerUser: number | null = null;
      if (finalOriginalPrice && newProduct.hasPerUserLimit) {
        finalMaxPerUser = Math.max(1, Number(newProduct.maxPerUser) || 1);
      }

      let startTimeVal: string | null = null;
      let endTimeVal: string | null = null;
      if (finalOriginalPrice && newProduct.hasTimeLimit) {
        startTimeVal = newProduct.discountStartTime || null;
        endTimeVal = newProduct.discountEndTime || null;
      }

      const payload: any = {
        name: newProduct.name,
        price: priceNum,
        originalPrice: finalOriginalPrice,
        stock: stockNum,
        discountStock: finalDiscountStock,
        maxPerUser: finalMaxPerUser,
        discountStartTime: startTimeVal,
        discountEndTime: endTimeVal,
        category: newProduct.category,
        description: newProduct.description,
        imageUrls: finalImageUrls,
        isAvailable: stockNum > 0,
        isFeatured: newProduct.isFeatured,
        isConsumerGood: newProduct.isConsumerGood,
        updatedAt: serverTimestamp(),
      };

      if (editingProduct) {
        await updateDoc(doc(db, "products", editingProduct.id), payload);
      } else {
        payload.createdAt = serverTimestamp();
        payload.merchantId = currentUser.uid;
        await addDoc(collection(db, "products"), payload);
      }

      resetForm();
      setIsModalOpen(false);
    } catch (error) {
      console.error(error);
      alert("Đã có lỗi xảy ra!");
    } finally {
      setIsSubmitting(false);
    }
  };

  const defaultFormatCurrency = (amount: number) =>
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
  const currencyFormatter = formatCurrency || defaultFormatCurrency;

  const formatDateString = (dateStr?: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")} ${d.getDate()}/${d.getMonth() + 1}`;
  };

  const filteredProducts = products.filter((p) => 
    activeMainTab === "consumer" ? p.isConsumerGood === true : !p.isConsumerGood
  );

  const currentCategories = activeMainTab === "consumer" ? CONSUMER_GOODS_CATEGORIES : FOOD_CATEGORIES;

  if (loading) return <div className="p-8 text-center text-xs text-stone-400">Đang tải sản phẩm...</div>;

  return (
    <div className="space-y-4 text-xs font-sans max-w-xl mx-auto pb-10">
      
      {/* THANH CHUYỂN TAB: BÁCH HÓA / ĐỒ ĂN UỐNG */}
      <div className="bg-stone-200/60 p-1 rounded-2xl flex gap-1">
        <button
          onClick={() => setActiveMainTab("consumer")}
          className={`flex-1 py-2.5 rounded-xl font-black text-xs transition flex items-center justify-center gap-1.5 ${
            activeMainTab === "consumer"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-stone-600 hover:text-stone-900"
          }`}
        >
          <span>🛒 Bách Hóa & Điện Máy</span>
          <span className="bg-white/20 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
            {products.filter(p => p.isConsumerGood).length}
          </span>
        </button>

        <button
          onClick={() => setActiveMainTab("food")}
          className={`flex-1 py-2.5 rounded-xl font-black text-xs transition flex items-center justify-center gap-1.5 ${
            activeMainTab === "food"
              ? "bg-orange-500 text-white shadow-sm"
              : "text-stone-600 hover:text-stone-900"
          }`}
        >
          <span>🍔 Thực Đơn Quán</span>
          <span className="bg-white/20 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
            {products.filter(p => !p.isConsumerGood).length}
          </span>
        </button>
      </div>

      {/* Header Bar */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-stone-200/80 shadow-xs">
        <div>
          <h2 className="text-sm font-black text-stone-800 uppercase tracking-wide">
            {activeMainTab === "consumer" ? "🛒 Sản Phẩm Tiêu Dùng & Điện Máy" : "🍔 Thực Đơn Đồ Ăn/Uống"}
          </h2>
          <p className="text-[11px] text-stone-400">
            {activeMainTab === "consumer" 
              ? "Sản phẩm tự động gắn cờ isConsumerGood: true" 
              : "Quản lý thực đơn chế biến tại quán"}
          </p>
        </div>
        <button
          onClick={() => handleOpenAddModal()}
          className={`text-white text-xs font-bold px-3.5 py-2 rounded-xl cursor-pointer transition shadow-xs flex items-center gap-1 shrink-0 ${
            activeMainTab === "consumer" ? "bg-blue-600 hover:bg-blue-700" : "bg-gradient-to-r from-orange-500 to-rose-500 hover:opacity-95"
          }`}
        >
          <span className="text-base leading-none">+</span> Thêm {activeMainTab === "consumer" ? "Mặt Hàng" : "Món"}
        </button>
      </div>

      {/* Gợi Ý Nhanh Theo Danh Mục */}
      <div className={`p-3.5 rounded-2xl border shadow-xs space-y-2 ${
        activeMainTab === "consumer" ? "bg-blue-50/50 border-blue-200/60" : "bg-amber-50/50 border-amber-200/60"
      }`}>
        <div className="flex justify-between items-center">
          <span className="font-extrabold text-stone-800 text-[11px] uppercase tracking-wide flex items-center gap-1">
            ⚡ Gợi Ý {activeMainTab === "consumer" ? "Hàng Bách Hóa & Điện Máy" : "Đồ Ăn/Uống"}
          </span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {Object.entries(currentCategories).map(([categoryName, suggestions]) => (
            <div 
              key={categoryName}
              className="bg-white border border-stone-200 rounded-xl p-2 shrink-0 w-48 flex flex-col justify-between shadow-xs"
            >
              <div>
                <div className="flex justify-between items-center mb-1.5 pb-1 border-b border-stone-100">
                  <span className="font-black text-stone-800 text-[10px] truncate">
                    {categoryName}
                  </span>
                  <button 
                    type="button"
                    onClick={() => handleOpenAddModal(categoryName)}
                    className={`text-[9px] text-white font-bold px-1.5 py-0.5 rounded-md ${
                      activeMainTab === "consumer" ? "bg-blue-600" : "bg-orange-500"
                    }`}
                  >
                    + Tạo
                  </button>
                </div>
                <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                  {suggestions.slice(0, 4).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => handleOpenAddModal(categoryName, item)}
                      className="text-[9px] bg-stone-50 hover:bg-stone-100 text-stone-600 font-medium px-1.5 py-0.5 rounded-md border border-stone-200 truncate w-full text-left"
                    >
                      + {item}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Danh Sách Sản Phẩm */}
      <div className="space-y-3">
        {filteredProducts.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-stone-200 text-center space-y-2">
            <span className="text-3xl block">📦</span>
            <p className="font-bold text-stone-600">Chưa có sản phẩm nào trong danh mục này.</p>
            <p className="text-[11px] text-stone-400">
              {activeMainTab === "consumer" 
                ? "Nhấn nút 'Thêm Mặt Hàng' để tạo sản phẩm mới." 
                : "Nhấn nút 'Thêm Món' bên trên để tạo món mới."}
            </p>
          </div>
        ) : (
          filteredProducts.map((prod) => {
            const discountPercent = prod.originalPrice && prod.originalPrice > prod.price
              ? Math.round(((prod.originalPrice - prod.price) / prod.originalPrice) * 100)
              : 0;

            const discountStatus = checkDiscountStatus(prod);
            const isDiscountActive = discountStatus.active;

            return (
              <div key={prod.id} className="bg-white p-3.5 rounded-2xl border border-stone-200/80 shadow-xs flex gap-3.5 items-stretch relative">
                <div className="w-20 h-20 rounded-xl overflow-hidden bg-stone-100 shrink-0 border border-stone-100 relative">
                  <img
                    src={prod.imageUrls?.[0] || "https://placehold.co/100x100?text=Product"}
                    alt={prod.name}
                    className={`w-full h-full object-cover ${!prod.isAvailable ? "grayscale opacity-50" : ""}`}
                  />
                  {prod.isConsumerGood ? (
                    <span className="absolute bottom-0.5 left-0.5 bg-blue-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-md">
                      🛒 Bách Hóa
                    </span>
                  ) : prod.isFeatured && (
                    <span className="absolute top-0.5 left-0.5 bg-amber-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md shadow-xs">
                      ★ Best Seller
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[10px] bg-stone-100 text-stone-700 font-bold px-2 py-0.5 rounded-md max-w-[140px] truncate">
                        {prod.category}
                      </span>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-stone-400 font-medium">
                          {prod.isAvailable ? "Đang bán" : "Tắt bán"}
                        </span>
                        <button
                          onClick={() => handleToggleStock(prod.id, prod.isAvailable)}
                          className={`w-9 h-5 rounded-full p-0.5 transition cursor-pointer flex items-center shrink-0 ${
                            prod.isAvailable ? "bg-emerald-500 justify-end" : "bg-stone-300 justify-start"
                          }`}
                        >
                          <div className="w-4 h-4 bg-white rounded-full shadow-xs"></div>
                        </button>
                      </div>
                    </div>

                    <h4 className="text-xs font-bold text-stone-800 line-clamp-1">{prod.name}</h4>
                  </div>

                  {/* Chi tiết khuyến mãi Flash Sale nếu có */}
                  {prod.originalPrice && prod.originalPrice > prod.price && (
                    <div className="my-1.5 bg-amber-50/60 border border-amber-200/50 p-1.5 rounded-xl text-[10px] space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-800">
                          {isDiscountActive ? "🔥 Flash Sale Đang Khuyến Mãi" : "⚠️ Khuyến mãi dừng / Hết hạn"}
                        </span>
                        {discountStatus.reason === "not_started" && <span className="text-amber-600 font-medium">Chưa bắt đầu</span>}
                        {discountStatus.reason === "expired" && <span className="text-rose-500 font-medium">Đã hết hạn</span>}
                        {discountStatus.reason === "out_of_stock" && <span className="text-stone-500 font-medium">Hết suất giảm</span>}
                      </div>

                      {(prod.discountStartTime || prod.discountEndTime) && (
                        <div className="text-[9px] text-stone-500 flex justify-between">
                          <span>⏰ Bắt đầu: {formatDateString(prod.discountStartTime)}</span>
                          <span>Kết thúc: {formatDateString(prod.discountEndTime)}</span>
                        </div>
                      )}

                      <div className="flex gap-3 text-[9px] text-stone-600 font-medium">
                        {prod.discountStock !== undefined && prod.discountStock !== null && (
                          <span>Suất giảm giá còn lại: <strong className="text-rose-600">{prod.discountStock}</strong></span>
                        )}
                        {prod.maxPerUser && (
                          <span>Tối đa/khách: <strong>{prod.maxPerUser}</strong></span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex items-end justify-between mt-2 pt-1.5 border-t border-stone-100">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="text-xs font-black text-rose-600">
                        {currencyFormatter(isDiscountActive ? prod.price : (prod.originalPrice || prod.price))}
                      </span>

                      {isDiscountActive && prod.originalPrice && (
                        <span className="text-[10px] text-stone-400 line-through">
                          {currencyFormatter(prod.originalPrice)}
                        </span>
                      )}

                      {isDiscountActive && (
                        <span className="text-[9px] text-rose-500 font-extrabold bg-rose-50 px-1.5 py-0.5 rounded-md border border-rose-100">
                          -{discountPercent}% OFF
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2 shrink-0">
                      <button 
                        onClick={() => handleOpenEditModal(prod)} 
                        className="text-[11px] bg-stone-100 hover:bg-stone-200 text-indigo-600 font-bold px-2.5 py-1 rounded-lg transition"
                      >
                        Sửa
                      </button>
                      <button 
                        onClick={() => handleDelete(prod.id)} 
                        className="text-[11px] bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold px-2.5 py-1 rounded-lg transition"
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Thêm / Sửa Sản Phẩm */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
              <h3 className="font-bold text-stone-800 text-sm">
                {editingProduct ? "✏️ Chỉnh Sửa Sản Phẩm" : "✨ Thêm Sản Phẩm Mới"}
              </h3>
              <button
                onClick={() => { setIsModalOpen(false); resetForm(); }}
                className="w-7 h-7 bg-stone-200/60 text-stone-600 rounded-full font-bold flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-4 overflow-y-auto space-y-4">
              
              {/* Checkbox Phân Loại */}
              <div className="bg-blue-50/80 p-3 rounded-2xl border border-blue-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-extrabold text-blue-900 block">🛒 Phân Loại Hàng Tiêu Dùng / Điện Máy</span>
                  <span className="text-[10px] text-blue-700">Tự động lưu trường <code className="bg-blue-100 px-1 rounded font-mono">isConsumerGood: true</code></span>
                </div>
                <input
                  type="checkbox"
                  checked={newProduct.isConsumerGood}
                  onChange={(e) => setNewProduct({ ...newProduct, isConsumerGood: e.target.checked })}
                  className="w-5 h-5 accent-blue-600 cursor-pointer"
                />
              </div>

              {/* Chọn danh mục */}
              <div>
                <label className="text-[11px] font-bold text-stone-700 block mb-1.5">1. Chọn Danh Mục *</label>
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-1 bg-stone-50 border border-stone-100 rounded-2xl">
                  {Object.keys(newProduct.isConsumerGood ? CONSUMER_GOODS_CATEGORIES : FOOD_CATEGORIES).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setNewProduct({ ...newProduct, category: cat })}
                      className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold border transition ${
                        newProduct.category === cat
                          ? "bg-blue-600 border-blue-600 text-white shadow-xs"
                          : "bg-white border-stone-200 text-stone-600 hover:bg-stone-100"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tên món & Tồn kho */}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="text-[11px] font-bold text-stone-700 block mb-1">Tên sản phẩm *</label>
                  <input
                    type="text"
                    required
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                    className="w-full border border-stone-200 rounded-xl p-2 text-xs focus:outline-none focus:border-blue-500"
                    placeholder="VD: Tai nghe, Nước giặt..."
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-stone-700 block mb-1">Tồn kho</label>
                  <input
                    type="number"
                    required
                    value={newProduct.stock}
                    onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })}
                    className="w-full border border-stone-200 rounded-xl p-2 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* CẤU HÌNH GIÁ & FLASH SALE NÂNG CAO */}
              <div className="bg-rose-50/40 border border-rose-100 p-3 rounded-2xl space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-black text-stone-800 uppercase tracking-wide flex items-center gap-1">
                    🏷️ Giá Bán & Khuyến Mãi
                  </label>
                  {Number(newProduct.discountPercent) > 0 && (
                    <span className="text-[10px] font-black text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full">
                      Giảm {newProduct.discountPercent}%
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-stone-600 block mb-1">Giá gốc niêm yết (đ)</label>
                    <input
                      type="number"
                      placeholder="VD: 50000"
                      value={newProduct.originalPrice}
                      onChange={(e) => handleOriginalPriceChange(e.target.value)}
                      className="w-full border border-stone-200 rounded-xl p-2 text-xs text-stone-700 font-bold bg-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-stone-600 block mb-1">Giá bán ưu đãi (đ) *</label>
                    <input
                      type="number"
                      required
                      placeholder="VD: 40000"
                      value={newProduct.price}
                      onChange={(e) => handleSalePriceChange(e.target.value)}
                      className="w-full border border-stone-200 rounded-xl p-2 text-xs text-rose-600 font-extrabold bg-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Mức % giảm giá */}
                <div>
                  <span className="text-[10px] font-bold text-stone-500 block mb-1.5">Chọn nhanh % giảm giá:</span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleDiscountPercentChange(0)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition ${
                        Number(newProduct.discountPercent) === 0
                          ? "bg-stone-700 border-stone-700 text-white"
                          : "bg-white border-stone-200 text-stone-600 hover:bg-stone-50"
                      }`}
                    >
                      Không giảm
                    </button>
                    {QUICK_DISCOUNTS.map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => handleDiscountPercentChange(pct)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition ${
                          Number(newProduct.discountPercent) === pct
                            ? "bg-rose-500 border-rose-500 text-white"
                            : "bg-white border-stone-200 text-stone-600 hover:bg-rose-50"
                        }`}
                      >
                        -{pct}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cấu hình nâng cao Flash Sale */}
                {Number(newProduct.originalPrice) > Number(newProduct.price) && (
                  <div className="pt-2 border-t border-rose-200/60 space-y-2.5">
                    <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wide block">
                      ⚙️ Giới hạn khuyến mãi (Tùy chọn)
                    </span>

                    {/* Giới hạn số lượng suất giảm giá */}
                    <div className="flex items-center justify-between gap-2 bg-white p-2 rounded-xl border border-rose-100">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="hasDiscountLimit"
                          checked={newProduct.hasDiscountLimit}
                          onChange={(e) => setNewProduct({ ...newProduct, hasDiscountLimit: e.target.checked })}
                          className="w-4 h-4 accent-rose-500 rounded"
                        />
                        <label htmlFor="hasDiscountLimit" className="text-[10px] font-bold text-stone-700 cursor-pointer">
                          Giới hạn số suất giảm
                        </label>
                      </div>
                      {newProduct.hasDiscountLimit && (
                        <input
                          type="number"
                          value={newProduct.discountStock}
                          onChange={(e) => setNewProduct({ ...newProduct, discountStock: e.target.value })}
                          className="w-20 border border-stone-200 rounded-lg p-1 text-xs text-center font-bold focus:outline-none"
                          placeholder="Số suất"
                        />
                      )}
                    </div>

                    {/* Giới hạn số lượng mỗi khách */}
                    <div className="flex items-center justify-between gap-2 bg-white p-2 rounded-xl border border-rose-100">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="hasPerUserLimit"
                          checked={newProduct.hasPerUserLimit}
                          onChange={(e) => setNewProduct({ ...newProduct, hasPerUserLimit: e.target.checked })}
                          className="w-4 h-4 accent-rose-500 rounded"
                        />
                        <label htmlFor="hasPerUserLimit" className="text-[10px] font-bold text-stone-700 cursor-pointer">
                          Giới hạn mua / khách
                        </label>
                      </div>
                      {newProduct.hasPerUserLimit && (
                        <input
                          type="number"
                          value={newProduct.maxPerUser}
                          onChange={(e) => setNewProduct({ ...newProduct, maxPerUser: e.target.value })}
                          className="w-20 border border-stone-200 rounded-lg p-1 text-xs text-center font-bold focus:outline-none"
                          placeholder="Tối đa"
                        />
                      )}
                    </div>

                    {/* Thời gian khuyến mãi */}
                    <div className="bg-white p-2 rounded-xl border border-rose-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="hasTimeLimit"
                            checked={newProduct.hasTimeLimit}
                            onChange={(e) => handleToggleTimeLimit(e.target.checked)}
                            className="w-4 h-4 accent-rose-500 rounded"
                          />
                          <label htmlFor="hasTimeLimit" className="text-[10px] font-bold text-stone-700 cursor-pointer">
                            Hẹn giờ đếm ngược
                          </label>
                        </div>
                      </div>

                      {newProduct.hasTimeLimit && (
                        <div className="space-y-2 pt-1">
                          <div className="flex flex-wrap gap-1">
                            {[
                              { id: "2h", label: "2 Giờ" },
                              { id: "4h", label: "4 Giờ" },
                              { id: "today", label: "Hết ngày" },
                              { id: "3days", label: "3 Ngày" },
                            ].map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => handleSelectQuickDuration(item.id)}
                                className={`px-2 py-0.5 rounded-md text-[9px] font-bold border ${
                                  quickDuration === item.id
                                    ? "bg-rose-500 border-rose-500 text-white"
                                    : "bg-stone-50 border-stone-200 text-stone-600"
                                }`}
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>

                          <div className="grid grid-cols-2 gap-1.5 text-[9px]">
                            <div>
                              <span className="text-stone-500 font-medium block">Bắt đầu</span>
                              <input
                                type="datetime-local"
                                value={newProduct.discountStartTime}
                                onChange={(e) => {
                                  setQuickDuration("custom");
                                  setNewProduct({ ...newProduct, discountStartTime: e.target.value });
                                }}
                                className="w-full border border-stone-200 rounded-md p-1 text-[10px]"
                              />
                            </div>
                            <div>
                              <span className="text-stone-500 font-medium block">Kết thúc</span>
                              <input
                                type="datetime-local"
                                value={newProduct.discountEndTime}
                                onChange={(e) => {
                                  setQuickDuration("custom");
                                  setNewProduct({ ...newProduct, discountEndTime: e.target.value });
                                }}
                                className="w-full border border-stone-200 rounded-md p-1 text-[10px]"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Upload ảnh */}
              <div>
                <label className="text-[11px] font-bold text-stone-700 block mb-1">Hình ảnh sản phẩm</label>
                <div className="flex flex-wrap gap-2">
                  {existingImageUrls.map((url, index) => (
                    <div key={index} className="relative w-14 h-14 rounded-xl overflow-hidden border border-stone-200">
                      <img src={url} alt="Existing" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemoveExistingImage(index)}
                        className="absolute top-0 right-0 bg-rose-500 text-white w-4 h-4 text-[9px] font-bold flex items-center justify-center"
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  {previewUrls.map((url, index) => (
                    <div key={index} className="relative w-14 h-14 rounded-xl overflow-hidden border border-stone-200">
                      <img src={url} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemoveNewImage(index)}
                        className="absolute top-0 right-0 bg-rose-500 text-white w-4 h-4 text-[9px] font-bold flex items-center justify-center"
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  <label className="border-2 border-dashed border-stone-300 rounded-xl w-14 h-14 flex flex-col items-center justify-center cursor-pointer bg-stone-50">
                    <span className="text-xs">📸</span>
                    <span className="text-[8px] font-bold text-stone-500">+ Tải ảnh</span>
                    <input type="file" multiple accept="image/*" onChange={handleFileChange} className="hidden" />
                  </label>
                </div>
              </div>

              {/* Mô tả */}
              <div>
                <label className="text-[11px] font-bold text-stone-700 block mb-1">Mô tả sản phẩm</label>
                <textarea
                  rows={2}
                  value={newProduct.description}
                  onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                  className="w-full border border-stone-200 rounded-xl p-2 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => { setIsModalOpen(false); resetForm(); }}
                  className="flex-1 bg-stone-100 py-2.5 rounded-xl font-bold text-stone-600"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`flex-1 text-white py-2.5 rounded-xl font-bold ${
                    newProduct.isConsumerGood ? "bg-blue-600 hover:bg-blue-700" : "bg-gradient-to-r from-orange-500 to-rose-500"
                  }`}
                >
                  {isSubmitting ? "Đang lưu..." : editingProduct ? "Lưu Cập Nhật" : "Tạo Sản Phẩm Mới"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}