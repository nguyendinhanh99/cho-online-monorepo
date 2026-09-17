"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/services/firebase";
import { 
  createUserWithEmailAndPassword, 
  GoogleAuthProvider, 
  signInWithPopup 
} from "firebase/auth";
import { submitMerchantKYC } from "@/services/kyc.service";

const generateMerchantCode = () => {
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  return `MS${randomNum}`;
};

export default function KYCWizard() {
  const router = useRouter();
  const [authType, setAuthType] = useState<"phone" | "email">("phone");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Mặc định tọa độ HCM (10.7769, 106.7009)
  const [coords, setCoords] = useState<[number, number]>([10.7769, 106.7009]);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
    phoneNumber: "",
    identityCardNumber: "",
    shopName: "",
    taxCode: "",
    address: "",
    businessCategory: "CONSUMER_GOODS", // Mặc định là Đồ gia dụng/Điện tử
  });

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Hàm xử lý riêng cho CCCD: Chỉ nhận chữ số và tối đa 12 ký tự
  const handleIdentityCardChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const onlyDigits = e.target.value.replace(/\D/g, "").slice(0, 12);
    updateField("identityCardNumber", onlyDigits);
  };

  // Reverse Geocoding: Lấy địa chỉ chữ từ tọa độ
  const fetchAddressFromCoords = async (lat: number, lng: number) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const data = await res.json();
      if (data && data.display_name) {
        updateField("address", data.display_name);
      }
    } catch (err) {
      console.error("Lỗi lấy địa chỉ:", err);
    }
  };

  // Hàm tự động lấy vị trí hiện tại từ thiết bị
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Trình duyệt của bạn không hỗ trợ định vị!");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setCoords([lat, lng]);
        fetchAddressFromCoords(lat, lng);
        setIsLocating(false);
      },
      (error) => {
        console.error(error);
        alert("Không thể lấy vị trí. Vui lòng bật GPS/quyền vị trí trên trình duyệt!");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleGoogleSignUp = async () => {
    try {
      setIsSubmitting(true);
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      setFormData((prev) => ({
        ...prev,
        email: result.user.email || "",
        fullName: prev.fullName || result.user.displayName || "",
      }));

      alert("Đã kết nối với Gmail: " + result.user.email);
    } catch (error: any) {
      alert("Đăng nhập Google thất bại: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.shopName || !formData.fullName || !formData.phoneNumber || !formData.identityCardNumber || !formData.address) {
      alert("Vui lòng điền đầy đủ các thông tin bắt buộc!");
      return;
    }

    if (formData.identityCardNumber.length !== 12) {
      alert("Số CCCD phải bao gồm đúng 12 chữ số!");
      return;
    }

    try {
      setIsSubmitting(true);
      let uid = auth.currentUser?.uid;

      if (!uid) {
        if (!formData.password) {
          alert("Vui lòng nhập mật khẩu!");
          return;
        }

        const accountEmail = authType === "phone" 
          ? `${formData.phoneNumber}@shopmerchant.com` 
          : formData.email;

        const userCredential = await createUserWithEmailAndPassword(auth, accountEmail, formData.password);
        uid = userCredential.user.uid;
      }

      const merchantCode = generateMerchantCode();

      await submitMerchantKYC(uid, {
        merchantCode: merchantCode,
        fullName: formData.fullName,
        ownerName: formData.fullName,
        phoneNumber: formData.phoneNumber,
        phone: formData.phoneNumber,
        identityCardNumber: formData.identityCardNumber,
        shopName: formData.shopName,
        storeName: formData.shopName,
        taxCode: formData.taxCode,
        address: formData.address,
        businessCategory: formData.businessCategory,
        pickupLocation: {
          latitude: coords[0],
          longitude: coords[1],
        },
        status: "PENDING_APPROVAL",
        createdAt: new Date(),
      });

      alert(`Tạo tài khoản thành công! Mã gian hàng của bạn là: #${merchantCode}`);
      router.push("/");
    } catch (error: any) {
      console.error("Lỗi đăng ký:", error);
      alert(error.message || "Đã có lỗi xảy ra!");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md w-full mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-stone-200 my-6">
      <div className="bg-[#ee4d2d] p-4 text-white text-center">
        <h1 className="font-bold text-base">Đăng Ký Cửa Hàng Mới</h1>
        <p className="text-[11px] opacity-90 mt-0.5">Tạo tài khoản bán hàng Merchant</p>

        <button
          type="button"
          onClick={handleGoogleSignUp}
          disabled={isSubmitting}
          className="mt-3 w-full bg-white text-stone-700 font-bold py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-2 hover:bg-stone-100 transition shadow-xs cursor-pointer"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
          </svg>
          {auth.currentUser ? `Đã liên kết (${auth.currentUser.email})` : "Đăng ký nhanh bằng Google"}
        </button>

        <div className="flex items-center my-3 opacity-60">
          <div className="flex-1 border-t border-white/40"></div>
          <span className="px-2 text-[10px] uppercase">Hoặc nhập thông tin</span>
          <div className="flex-1 border-t border-white/40"></div>
        </div>

        <div className="flex bg-black/15 p-1 rounded-lg text-xs font-semibold">
          <button
            type="button"
            onClick={() => setAuthType("phone")}
            className={`flex-1 py-1 rounded-md transition ${
              authType === "phone" ? "bg-white text-[#ee4d2d]" : "text-white opacity-80"
            }`}
          >
            Đăng ký bằng SĐT
          </button>
          <button
            type="button"
            onClick={() => setAuthType("email")}
            className={`flex-1 py-1 rounded-md transition ${
              authType === "email" ? "bg-white text-[#ee4d2d]" : "text-white opacity-80"
            }`}
          >
            Đăng ký bằng Email
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-3">
        <div>
          <label className="text-[11px] font-medium text-stone-600 block mb-1">Số điện thoại liên hệ *</label>
          <input
            type="tel"
            required
            value={formData.phoneNumber}
            onChange={(e) => updateField("phoneNumber", e.target.value)}
            className="w-full border border-stone-300 rounded-lg p-2 text-xs text-stone-800"
            placeholder="0912345678"
          />
        </div>

        {authType === "email" && (
          <div>
            <label className="text-[11px] font-medium text-stone-600 block mb-1">Email đăng nhập *</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => updateField("email", e.target.value)}
              className="w-full border border-stone-300 rounded-lg p-2 text-xs text-stone-800"
              placeholder="example@gmail.com"
            />
          </div>
        )}

        {/* Khối nhập mật khẩu có nút show/hide */}
        {!auth.currentUser && (
          <div>
            <label className="text-[11px] font-medium text-stone-600 block mb-1">Mật khẩu *</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={formData.password}
                onChange={(e) => updateField("password", e.target.value)}
                className="w-full border border-stone-300 rounded-lg p-2 pr-10 text-xs text-stone-800"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                {showPassword ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        )}

        <div>
          <label className="text-[11px] font-medium text-stone-600 block mb-1">Tên chủ cửa hàng *</label>
          <input
            type="text"
            required
            value={formData.fullName}
            onChange={(e) => updateField("fullName", e.target.value)}
            className="w-full border border-stone-300 rounded-lg p-2 text-xs text-stone-800"
            placeholder="Nguyễn Văn A"
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-[11px] font-medium text-stone-600 block">Số CCCD (Đúng 12 số) *</label>
            <span className="text-[10px] text-stone-400 font-mono">{formData.identityCardNumber.length}/12</span>
          </div>
          <input
            type="text"
            required
            maxLength={12}
            value={formData.identityCardNumber}
            onChange={handleIdentityCardChange}
            className="w-full border border-stone-300 rounded-lg p-2 text-xs text-stone-800 font-mono"
            placeholder="00109500xxxx"
          />
        </div>

        <div>
          <label className="text-[11px] font-medium text-stone-600 block mb-1">Tên Cửa Hàng / Shop *</label>
          <input
            type="text"
            required
            value={formData.shopName}
            onChange={(e) => updateField("shopName", e.target.value)}
            className="w-full border border-stone-300 rounded-lg p-2 text-xs text-stone-800"
            placeholder="Ví dụ: Bách Hóa An Bình"
          />
        </div>

        {/* Phân loại lĩnh vực kinh doanh */}
        <div>
          <label className="text-[11px] font-medium text-stone-600 block mb-1.5">Loại hình kinh doanh *</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => updateField("businessCategory", "CONSUMER_GOODS")}
              className={`p-2 rounded-lg border text-left text-[11px] font-semibold transition cursor-pointer flex flex-col justify-between ${
                formData.businessCategory === "CONSUMER_GOODS"
                  ? "border-[#ee4d2d] bg-orange-50 text-[#ee4d2d]"
                  : "border-stone-200 text-stone-700 hover:bg-stone-50"
              }`}
            >
              <span>🔌 Gia dụng / Điện tử</span>
              <span className="text-[9px] font-normal opacity-70 mt-1">Đồ điện, gia dụng, bách hóa</span>
            </button>

            <button
              type="button"
              onClick={() => updateField("businessCategory", "FNB")}
              className={`p-2 rounded-lg border text-left text-[11px] font-semibold transition cursor-pointer flex flex-col justify-between ${
                formData.businessCategory === "FNB"
                  ? "border-[#ee4d2d] bg-orange-50 text-[#ee4d2d]"
                  : "border-stone-200 text-stone-700 hover:bg-stone-50"
              }`}
            >
              <span>🍔 F&B (Ăn uống)</span>
              <span className="text-[9px] font-normal opacity-70 mt-1">Quán ăn, cafe, trà sữa, đồ uống</span>
            </button>

            <button
              type="button"
              onClick={() => updateField("businessCategory", "FASHION")}
              className={`p-2 rounded-lg border text-left text-[11px] font-semibold transition cursor-pointer flex flex-col justify-between ${
                formData.businessCategory === "FASHION"
                  ? "border-[#ee4d2d] bg-orange-50 text-[#ee4d2d]"
                  : "border-stone-200 text-stone-700 hover:bg-stone-50"
              }`}
            >
              <span>👗 Thời trang</span>
              <span className="text-[9px] font-normal opacity-70 mt-1">Quần áo, giày dép, phụ kiện</span>
            </button>
          </div>
        </div>

        <div>
          <label className="text-[11px] font-medium text-stone-600 block mb-1">Mã Số Thuế (Nếu có)</label>
          <input
            type="text"
            value={formData.taxCode}
            onChange={(e) => updateField("taxCode", e.target.value)}
            className="w-full border border-stone-300 rounded-lg p-2 text-xs text-stone-800"
            placeholder="0312345678"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between items-center mb-1">
            <label className="text-[11px] font-medium text-stone-600 block">
              Địa chỉ kinh doanh & Lấy hàng *
            </label>
            <button
              type="button"
              onClick={handleGetCurrentLocation}
              disabled={isLocating}
              className="text-[11px] text-[#ee4d2d] hover:underline font-medium flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {isLocating ? "Đang lấy vị trí..." : "Tự động lấy vị trí"}
            </button>
          </div>

          <textarea
            rows={2}
            required
            value={formData.address}
            onChange={(e) => updateField("address", e.target.value)}
            className="w-full border border-stone-300 rounded-lg p-2 text-xs text-stone-800"
            placeholder="Nhập địa chỉ chính xác hoặc nhấn Tự động lấy vị trí..."
          />

          <div className="text-[10px] text-stone-500 flex justify-between">
            <span>Tọa độ GPS lấy hàng:</span>
            <span className="font-mono text-stone-700">{coords[0].toFixed(5)}, {coords[1].toFixed(5)}</span>
          </div>
        </div>

        {/* Nút Gửi Hồ Sơ */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-[#ee4d2d] hover:bg-[#d83e20] text-white font-bold py-2.5 rounded-lg text-xs mt-2 transition disabled:opacity-50 cursor-pointer"
        >
          {isSubmitting ? "Đang xử lý..." : "Tạo Tài Khoản & Gửi Hồ Sơ"}
        </button>

        {/* 🌟 NÚT MỚI: QUAY LẠI ĐĂNG NHẬP */}
        <button
          type="button"
          onClick={() => router.push("/login")}
          className="w-full bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold py-2.5 rounded-lg text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Quay lại đăng nhập
        </button>
      </form>
    </div>
  );
}