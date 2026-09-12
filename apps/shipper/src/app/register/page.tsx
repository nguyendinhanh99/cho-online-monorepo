"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase"; // File config Firebase Auth & Firestore

const CLOUD_NAME = "lfqjrcvh";
const UPLOAD_PRESET = "ml_default";

export default function ShipperRegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");

  // Form State
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    password: "",
    identityCardNumber: "",
    licensePlate: "",
    vehicleType: "MOTORBIKE",
  });

  // State lưu file thực tế để upload
  const [files, setFiles] = useState<{
    avatar: File | null;
    idFront: File | null;
    idBack: File | null;
    driverLicense: File | null;
  }>({
    avatar: null,
    idFront: null,
    idBack: null,
    driverLicense: null,
  });

  // State lưu link ảnh xem trước (Preview)
  const [previews, setPreviews] = useState({
    avatar: "",
    idFront: "",
    idBack: "",
    driverLicense: "",
  });

  // Hàm xử lý khi chọn file ảnh
  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: keyof typeof files
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      setFiles((prev) => ({ ...prev, [field]: file }));
      
      // Xóa URL blob cũ để giải phóng bộ nhớ
      if (previews[field]) {
        URL.revokeObjectURL(previews[field]);
      }
      
      setPreviews((prev) => ({ ...prev, [field]: URL.createObjectURL(file) }));
    }
  };

  // Hàm upload 1 file duy nhất lên Cloudinary
  const uploadToCloudinary = async (file: File): Promise<string> => {
    const data = new FormData();
    data.append("file", file);
    data.append("upload_preset", UPLOAD_PRESET);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      { method: "POST", body: data }
    );

    if (!res.ok) {
      throw new Error("Lỗi khi tải ảnh lên Cloudinary");
    }

    const result = await res.json();
    return result.secure_url;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!files.avatar || !files.idFront || !files.idBack || !files.driverLicense) {
      return alert("Vui lòng tải lên đủ: Ảnh đại diện, CCCD (2 mặt) và Bằng lái xe!");
    }

    setIsLoading(true);

    try {
      // 1. Upload 4 ảnh lên Cloudinary song song
      setUploadStatus("Đang tải ảnh giấy tờ lên Cloudinary...");
      const [avatarUrl, idFrontUrl, idBackUrl, driverLicenseUrl] = await Promise.all([
        uploadToCloudinary(files.avatar),
        uploadToCloudinary(files.idFront),
        uploadToCloudinary(files.idBack),
        uploadToCloudinary(files.driverLicense),
      ]);

      // 2. Tạo tài khoản Firebase Auth (dùng SĐT đã làm sạch để tạo email ảo)
      setUploadStatus("Đang tạo tài khoản Firebase...");
      const cleanPhone = formData.phone.trim().replace(/\s+/g, "");
      const virtualEmail = `${cleanPhone}@shipper.choonline.vn`;

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        virtualEmail,
        formData.password
      );
      const uid = userCredential.user.uid;

      // 3. Lưu thông tin hồ sơ + Link ảnh Cloudinary vào Firestore
      setUploadStatus("Đang lưu thông tin hồ sơ...");
      await setDoc(doc(db, "shippers", uid), {
        uid,
        fullName: formData.fullName.trim(),
        phone: cleanPhone,
        identityCardNumber: formData.identityCardNumber.trim(),
        licensePlate: formData.licensePlate.trim(),
        vehicleType: formData.vehicleType,
        
        // Link ảnh từ Cloudinary
        avatarUrl,
        idCardFrontUrl: idFrontUrl,
        idCardBackUrl: idBackUrl,
        driverLicenseUrl,
        
        status: "PENDING_APPROVAL", // Trạng thái chờ Admin duyệt 24h
        createdAt: new Date().toISOString(),
      });

      setIsLoading(false);
      alert("Nộp hồ sơ thành công! Vui lòng chờ duyệt trong vòng 24h.");
      router.push("/pending");
    } catch (error: any) {
      setIsLoading(false);
      console.error("Lỗi đăng ký:", error);

      // Bắt lỗi trùng Email / Số điện thoại từ Firebase Auth
      if (error.code === "auth/email-already-in-use") {
        alert("Số điện thoại này đã được đăng ký! Vui lòng sử dụng số khác hoặc đăng nhập.");
      } else if (error.code === "auth/weak-password") {
        alert("Mật khẩu quá yếu! Vui lòng nhập từ 6 ký tự trở lên.");
      } else {
        alert("Đã xảy ra lỗi: " + (error.message || "Không thể gửi hồ sơ"));
      }
    }
  };

  return (
    <main className="min-h-screen bg-stone-100 py-6 px-4 font-sans flex justify-center">
      <div className="w-full max-w-lg bg-white rounded-3xl border border-stone-200/80 shadow-md p-6 space-y-6">
        <div className="text-center space-y-1">
          <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center text-xl font-bold mx-auto shadow-xs">
            🪪
          </div>
          <h1 className="text-lg font-black text-stone-800">Đăng Ký Tài Xế & Xác Minh Hồ Sơ</h1>
          <p className="text-xs text-stone-400">
            Điền đúng thông tin và chụp rõ nét giấy tờ để được duyệt trong 24h
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* 1. THÔNG TIN CÁ NHÂN */}
          <div className="space-y-3 bg-stone-50 p-3.5 rounded-2xl border border-stone-200/60">
            <h3 className="font-extrabold text-stone-700 uppercase text-[10px] tracking-wider">
              1. Thông tin cá nhân & Đăng nhập
            </h3>

            <div>
              <label className="block font-bold text-stone-600 mb-1">Họ và tên tài xế *</label>
              <input
                type="text"
                required
                placeholder="Nguyễn Văn A"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full bg-white border border-stone-200 rounded-xl p-2.5 text-stone-800 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold text-stone-600 mb-1">Số điện thoại *</label>
                <input
                  type="tel"
                  required
                  placeholder="0901234567"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-white border border-stone-200 rounded-xl p-2.5 text-stone-800 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block font-bold text-stone-600 mb-1">Mật khẩu *</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full bg-white border border-stone-200 rounded-xl p-2.5 text-stone-800 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* 2. THÔNG TIN PHƯƠNG TIỆN */}
          <div className="space-y-3 bg-stone-50 p-3.5 rounded-2xl border border-stone-200/60">
            <h3 className="font-extrabold text-stone-700 uppercase text-[10px] tracking-wider">
              2. Thông tin Phương tiện & CCCD
            </h3>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold text-stone-600 mb-1">Số CCCD *</label>
                <input
                  type="text"
                  required
                  placeholder="048099XXXXXX"
                  value={formData.identityCardNumber}
                  onChange={(e) => setFormData({ ...formData, identityCardNumber: e.target.value })}
                  className="w-full bg-white border border-stone-200 rounded-xl p-2.5 text-stone-800 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block font-bold text-stone-600 mb-1">Biển số xe *</label>
                <input
                  type="text"
                  required
                  placeholder="43-F1 123.45"
                  value={formData.licensePlate}
                  onChange={(e) => setFormData({ ...formData, licensePlate: e.target.value })}
                  className="w-full bg-white border border-stone-200 rounded-xl p-2.5 text-stone-800 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* 3. ĐỌC VÀ TẢI ẢNH GIẤY TỜ */}
          <div className="space-y-3 bg-blue-50/60 p-3.5 rounded-2xl border border-blue-200/60">
            <h3 className="font-extrabold text-blue-900 uppercase text-[10px] tracking-wider">
              3. Tải lên giấy tờ xác minh (Upload qua Cloudinary)
            </h3>

            {/* Avatar */}
            <div>
              <label className="block font-bold text-stone-700 mb-1">Ảnh chân dung *</label>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, "avatar")}
                  className="text-[11px] text-stone-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white"
                />
                {previews.avatar && (
                  <img src={previews.avatar} alt="Avatar" className="w-10 h-10 rounded-full object-cover border-2 border-blue-500" />
                )}
              </div>
            </div>

            {/* CCCD */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <label className="block font-bold text-stone-700 mb-1">CCCD Mặt Trước *</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, "idFront")}
                  className="w-full text-[10px] text-stone-500 file:py-1 file:px-2 file:rounded-lg file:border-0 file:bg-stone-200 file:font-bold"
                />
                {previews.idFront && (
                  <img src={previews.idFront} alt="CCCD Truoc" className="mt-1.5 h-16 w-full rounded-lg object-cover border" />
                )}
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">CCCD Mặt Sau *</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, "idBack")}
                  className="w-full text-[10px] text-stone-500 file:py-1 file:px-2 file:rounded-lg file:border-0 file:bg-stone-200 file:font-bold"
                />
                {previews.idBack && (
                  <img src={previews.idBack} alt="CCCD Sau" className="mt-1.5 h-16 w-full rounded-lg object-cover border" />
                )}
              </div>
            </div>

            {/* Bằng lái xe */}
            <div className="pt-1">
              <label className="block font-bold text-stone-700 mb-1">Ảnh Bằng Lái Xe *</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileChange(e, "driverLicense")}
                className="w-full text-[10px] text-stone-500 file:py-1 file:px-2 file:rounded-lg file:border-0 file:bg-stone-200 file:font-bold"
              />
              {previews.driverLicense && (
                <img src={previews.driverLicense} alt="Bang Lai" className="mt-1.5 h-20 w-full rounded-lg object-cover border" />
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-3.5 rounded-2xl transition cursor-pointer text-xs shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? uploadStatus : "NỘP HỒ SƠ ĐỂ CHỜ DUYỆT (24H)"}
          </button>
        </form>

        <div className="pt-1 border-t text-center text-xs text-stone-500">
          Đã có tài khoản?{" "}
          <Link href="/login" className="font-extrabold text-blue-600 hover:underline">
            Đăng nhập ngay
          </Link>
        </div>
      </div>
    </main>
  );
}