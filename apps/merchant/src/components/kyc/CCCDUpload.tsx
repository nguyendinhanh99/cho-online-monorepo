"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/services/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { submitMerchantKYC } from "@/services/kyc.service";

export default function KYCWizard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    fullName: "",
    phoneNumber: "",
    shopName: "",
    taxCode: "",
    address: "",
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push("/login");
      } else {
        setUser(currentUser);
        setFormData((prev) => ({
          ...prev,
          fullName: prev.fullName || currentUser.displayName || "",
        }));
      }
      setLoadingUser(false);
    });

    return () => unsubscribe();
  }, [router]);

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.shopName || !formData.phoneNumber || !formData.address) {
      alert("Vui lòng điền đầy đủ các thông tin bắt buộc!");
      return;
    }

    try {
      setIsSubmitting(true);
      await submitMerchantKYC(user.uid, {
        ...formData,
        status: "PENDING_APPROVAL", // Trạng thái chờ Admin duyệt
      });
      alert("Đăng ký thành công! Vui lòng chờ Admin duyệt tài khoản bán hàng.");
      router.push("/");
    } catch (error) {
      console.error("Lỗi đăng ký:", error);
      alert("Đã có lỗi xảy ra, vui lòng thử lại!");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingUser) {
    return <div className="text-center p-10 text-xs text-stone-500">Đang kiểm tra đăng nhập...</div>;
  }

  return (
    <div className="max-w-md w-full mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-stone-200">
      <div className="bg-[#ee4d2d] p-4 text-white text-center">
        <h1 className="font-bold text-base">Đăng Ký Cửa Hàng (Merchant)</h1>
        <p className="text-[11px] opacity-90 mt-0.5">Tài khoản: {user?.email}</p>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-3">
        <div>
          <label className="text-[11px] font-medium text-stone-600 block mb-1">Tên chủ cửa hàng *</label>
          <input
            type="text"
            required
            value={formData.fullName}
            onChange={(e) => updateField("fullName", e.target.value)}
            className="w-full border border-stone-300 rounded-lg p-2 text-xs"
            placeholder="Nguyễn Văn A"
          />
        </div>

        <div>
          <label className="text-[11px] font-medium text-stone-600 block mb-1">Số điện thoại liên hệ *</label>
          <input
            type="tel"
            required
            value={formData.phoneNumber}
            onChange={(e) => updateField("phoneNumber", e.target.value)}
            className="w-full border border-stone-300 rounded-lg p-2 text-xs"
            placeholder="0912345678"
          />
        </div>

        <div>
          <label className="text-[11px] font-medium text-stone-600 block mb-1">Tên Cửa Hàng / Shop *</label>
          <input
            type="text"
            required
            value={formData.shopName}
            onChange={(e) => updateField("shopName", e.target.value)}
            className="w-full border border-stone-300 rounded-lg p-2 text-xs"
            placeholder="Ví dụ: Bách Hóa An Bình"
          />
        </div>

        <div>
          <label className="text-[11px] font-medium text-stone-600 block mb-1">Mã Số Thuế (Nếu có)</label>
          <input
            type="text"
            value={formData.taxCode}
            onChange={(e) => updateField("taxCode", e.target.value)}
            className="w-full border border-stone-300 rounded-lg p-2 text-xs"
            placeholder="0312345678"
          />
        </div>

        <div>
          <label className="text-[11px] font-medium text-stone-600 block mb-1">Địa chỉ kinh doanh *</label>
          <textarea
            rows={2}
            required
            value={formData.address}
            onChange={(e) => updateField("address", e.target.value)}
            className="w-full border border-stone-300 rounded-lg p-2 text-xs"
            placeholder="Số nhà, đường, Phường/Xã, Quận/Huyện..."
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-[#ee4d2d] hover:bg-[#d83e20] text-white font-bold py-2.5 rounded-lg text-xs mt-2 transition disabled:opacity-50"
        >
          {isSubmitting ? "Đang gửi đăng ký..." : "Gửi Hồ Sơ Cho Admin Duyệt"}
        </button>
      </form>
    </div>
  );
}