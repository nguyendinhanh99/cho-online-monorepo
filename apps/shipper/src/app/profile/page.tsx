"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { doc, updateDoc, collection, query, where, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import BottomNav from "@/components/BottomNav";

export default function ProfilePage() {
  const router = useRouter();
  const { profile, loading } = useAuth();

  // State lưu chỉ số uy tín
  const [shipperStats, setShipperStats] = useState({
    rating: 5.0,
    completedOrders: 0,
    completionRate: 100,
  });

  // State Modal Cập nhật thông tin
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // State Modal Đổi mật khẩu
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Form State Cập nhật thông tin
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    licensePlate: "",
    vehicleType: "MOTORBIKE",
    identityCardNumber: "",
    avatarUrl: "",

    // 🏦 Tài khoản nhận thanh toán T+1 từ Sàn
    bankName: "",
    accountNumber: "",
    accountHolder: "",
  });

  // LẤY DỮ LIỆU ĐÁNH GIÁ & ĐƠN HÀNG THỰC TẾ
  useEffect(() => {
    if (!profile?.uid) return;

    let unsubscribe = () => {};

    try {
      const ordersQuery = query(
        collection(db, "orders"),
        where("shipperId", "==", profile.uid)
      );

      unsubscribe = onSnapshot(
        ordersQuery,
        (snapshot) => {
          let totalCompleted = 0;
          let totalRatingSum = 0;
          let ratedCount = 0;
          const totalOrdersAssigned = snapshot.docs.length;

          snapshot.docs.forEach((docSnap) => {
            const data = docSnap.data();

            if (data.status === "completed") {
              totalCompleted++;
            }

            const driverRating = data.reviewInfo?.driverRating;
            if (typeof driverRating === "number" && driverRating > 0) {
              totalRatingSum += driverRating;
              ratedCount++;
            }
          });

          const avgRating = ratedCount > 0 ? totalRatingSum / ratedCount : 5.0;
          const rate =
            totalOrdersAssigned > 0
              ? Math.round((totalCompleted / totalOrdersAssigned) * 100)
              : 100;

          setShipperStats({
            rating: avgRating,
            completedOrders: totalCompleted,
            completionRate: rate,
          });
        },
        (error) => {
          console.warn("⚠️ Không thể tải chỉ số shipper:", error);
        }
      );
    } catch (err) {
      console.error("Lỗi khởi tạo truy vấn đơn hàng:", err);
    }

    return () => unsubscribe();
  }, [profile?.uid]);

  const handleOpenEditModal = () => {
    if (profile) {
      const bankAccount = (profile as any)?.bankAccount || {};

      setFormData({
        fullName: profile.fullName || "",
        phone: profile.phone || "",
        licensePlate: profile.licensePlate || "",
        vehicleType: profile.vehicleType || "MOTORBIKE",
        identityCardNumber: profile.identityCardNumber || "",
        avatarUrl: profile.avatarUrl || "",

        // Ưu tiên object bankAccount, fallback field legacy để tương thích dữ liệu cũ
        bankName:
          bankAccount.bankName ||
          (profile as any)?.bankName ||
          "",
        accountNumber:
          bankAccount.accountNumber ||
          (profile as any)?.accountNumber ||
          "",
        accountHolder:
          bankAccount.accountHolder ||
          (profile as any)?.accountHolder ||
          (profile as any)?.bankOwner ||
          "",
      });
      setIsEditing(true);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);

    try {
      const CLOUD_NAME = "lfqjrcvh";
      const UPLOAD_PRESET = "unsigned_preset";

      const data = new FormData();
      data.append("file", file);
      data.append("upload_preset", UPLOAD_PRESET);

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        {
          method: "POST",
          body: data,
        }
      );

      const result = await res.json();
      if (result.secure_url) {
        setFormData((prev) => ({ ...prev, avatarUrl: result.secure_url }));
      } else {
        const reader = new FileReader();
        reader.onloadend = () => {
          setFormData((prev) => ({ ...prev, avatarUrl: reader.result as string }));
        };
        reader.readAsDataURL(file);
      }
    } catch (error) {
      console.error("Lỗi upload ảnh:", error);
      alert("Không thể tải ảnh lên, vui lòng kiểm tra lại cấu hình!");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.uid) return;

    const bankName = formData.bankName.trim();
    const accountNumber = formData.accountNumber.replace(/\s+/g, "").trim();
    const accountHolder = formData.accountHolder.trim().toUpperCase();

    const hasAnyBankField =
      Boolean(bankName) ||
      Boolean(accountNumber) ||
      Boolean(accountHolder);

    // Nếu Shipper bắt đầu nhập thông tin thanh toán thì phải nhập đủ 3 trường.
    if (
      hasAnyBankField &&
      (!bankName || !accountNumber || !accountHolder)
    ) {
      alert(
        "Vui lòng nhập đầy đủ Tên ngân hàng, Số tài khoản và Tên chủ tài khoản."
      );
      return;
    }

    // STK lưu dạng string để không mất số 0 ở đầu.
    if (
      accountNumber &&
      !/^\d{6,20}$/.test(accountNumber)
    ) {
      alert(
        "Số tài khoản ngân hàng phải gồm 6–20 chữ số."
      );
      return;
    }

    setIsSaving(true);
    try {
      const docRef = doc(db, "shippers", profile.uid);
      await updateDoc(docRef, {
        fullName: formData.fullName,
        phone: formData.phone,
        licensePlate: formData.licensePlate,
        vehicleType: formData.vehicleType,
        identityCardNumber: formData.identityCardNumber,
        avatarUrl: formData.avatarUrl,

        // =====================================================
        // 🏦 TÀI KHOẢN NHẬN THANH TOÁN T+1
        // Accounting API đọc trực tiếp cấu trúc này.
        // =====================================================
        bankAccount: {
          bankName,
          accountNumber,
          accountHolder,
          updatedAt: new Date().toISOString(),
        },

        // Legacy fields để tương thích những màn hình/API cũ.
        bankName,
        accountNumber,
        accountHolder,
        bankOwner: accountHolder,

        updatedAt: new Date().toISOString(),
      });

      setIsEditing(false);
      window.location.reload();
    } catch (error) {
      console.error("Lỗi khi cập nhật thông tin:", error);
      alert("Cập nhật thất bại!");
    } finally {
      setIsSaving(false);
    }
  };

  // 🔥 XỬ LÝ XÁC THỰC MẬT KHẨU CŨ TRƯỚC KHI ĐỔI MẬT KHẨU MỚI
  const handleChangePasswordDirect = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!oldPassword) {
      alert("Vui lòng nhập mật khẩu hiện tại!");
      return;
    }

    if (newPassword.length < 6) {
      alert("Mật khẩu mới phải chứa ít nhất 6 ký tự!");
      return;
    }

    if (newPassword !== confirmPassword) {
      alert("Mật khẩu xác nhận không khớp!");
      return;
    }

    if (oldPassword === newPassword) {
      alert("Mật khẩu mới không được trùng với mật khẩu cũ!");
      return;
    }

    const user = auth.currentUser;
    if (!user || !user.email) {
      alert("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại!");
      return;
    }

    setIsChangingPassword(true);
    try {
      // Step 1: Xác thực mật khẩu cũ
      const credential = EmailAuthProvider.credential(user.email, oldPassword);
      await reauthenticateWithCredential(user, credential);

      // Step 2: Đổi sang mật khẩu mới
      await updatePassword(user, newPassword);

      alert("✅ Đổi mật khẩu thành công!");
      setIsPasswordModalOpen(false);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      console.error("Lỗi đổi mật khẩu:", error);
      if (error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
        alert("❌ Mật khẩu cũ không chính xác. Vui lòng kiểm tra lại!");
      } else if (error.code === "auth/too-many-requests") {
        alert("🔒 Bạn đã thử quá nhiều lần. Vui lòng thử lại sau!");
      } else {
        alert("Đổi mật khẩu thất bại: " + (error.message || "Vui lòng thử lại sau."));
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLogout = async () => {
    if (confirm("Bạn có chắc chắn muốn đăng xuất tài khoản?")) {
      try {
        await signOut(auth);
        router.push("/login");
      } catch (error) {
        alert("Đăng xuất thất bại!");
      }
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-full bg-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="w-9 h-9 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-400 font-semibold">Đang tải hồ sơ...</span>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="h-screen w-full bg-slate-100 flex items-center justify-center font-sans p-4">
        <div className="bg-white p-6 rounded-3xl text-center space-y-4 max-w-sm w-full shadow-lg border border-slate-100">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-2xl">
            🔒
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-extrabold text-slate-800">Bạn chưa đăng nhập</h2>
            <p className="text-xs text-slate-400">Vui lòng đăng nhập để xem thông tin cá nhân</p>
          </div>
          <button
            onClick={() => router.push("/login")}
            className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-extrabold py-3.5 rounded-2xl text-xs transition shadow-md shadow-emerald-200 cursor-pointer"
          >
            ĐĂNG NHẬP NGAY
          </button>
        </div>
      </div>
    );
  }

  const formatVehicleType = (type?: string) => {
    if (type === "MOTORBIKE") return "Xe máy";
    if (type === "CAR") return "Ô tô";
    return type || "Chưa đăng ký";
  };

  const formattedJoinDate = profile.createdAt
    ? new Date(profile.createdAt).toLocaleDateString("vi-VN", {
        month: "2-digit",
        year: "numeric",
      })
    : "Mới";

  const isApproved = profile?.status === "APPROVED";
  const isBlocked = profile?.status === "BLOCKED";
  const isDepositPaid =
    (profile as any)?.isDepositPaid === true ||
    (profile as any)?.depositStatus === "PAID";

  // ============================================================
  // 🏦 TÀI KHOẢN NHẬN THANH TOÁN
  // ============================================================
  const payoutBank = (profile as any)?.bankAccount || {};

  const payoutBankName =
    payoutBank.bankName ||
    (profile as any)?.bankName ||
    "";

  const payoutAccountNumber =
    String(
      payoutBank.accountNumber ||
        (profile as any)?.accountNumber ||
        ""
    ).trim();

  const payoutAccountHolder =
    payoutBank.accountHolder ||
    (profile as any)?.accountHolder ||
    (profile as any)?.bankOwner ||
    "";

  const hasPayoutBank =
    Boolean(payoutBankName) &&
    Boolean(payoutAccountNumber) &&
    Boolean(payoutAccountHolder);

  const maskedAccountNumber = payoutAccountNumber
    ? `•••• ${payoutAccountNumber.slice(-4)}`
    : "Chưa cập nhật";

  return (
    <div className="h-screen w-full bg-slate-100 flex items-center justify-center font-sans overflow-hidden">
      <div className="w-full max-w-md h-full bg-slate-50 flex flex-col relative overflow-hidden shadow-2xl">
        
        {/* Header Hero Banner */}
        <div className="relative bg-gradient-to-r from-emerald-600 to-teal-700 text-white pt-6 pb-14 px-5 shrink-0 rounded-b-[2rem] shadow-sm">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-black tracking-wide">Tài khoản cá nhân</h1>
            <button
              onClick={handleOpenEditModal}
              className="px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md flex items-center gap-1.5 text-xs font-bold transition active:scale-95 border border-white/20 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 fill-none stroke-current stroke-[2.5]" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              <span>Chỉnh sửa</span>
            </button>
          </div>
        </div>

        {/* Dynamic Content */}
        <div className="flex-1 overflow-y-auto px-4 -mt-10 space-y-4 pb-24 scrollbar-none z-10">
          
          {/* CẢNH BÁO TÀI KHOẢN BỊ KHÓA */}
          {isBlocked && (
            <div className="bg-rose-50 border-2 border-rose-200 rounded-3xl p-4 shadow-md space-y-2 text-rose-900 animate-pulse">
              <div className="flex items-center gap-2">
                <span className="text-xl">⛔</span>
                <h3 className="font-extrabold text-sm uppercase tracking-wide text-rose-700">
                  Tài khoản tạm thời bị khóa
                </h3>
              </div>
              <p className="text-xs text-rose-600 leading-relaxed">
                <strong className="font-bold">Nội dung / Lý do:</strong>{" "}
                {(profile as any)?.blockReason || "Tài khoản bị khóa bởi Quản trị viên do vi phạm quy định."}
              </p>
              <p className="text-[11px] text-rose-500 italic">
                * Vui lòng liên hệ bộ phận CSKH để được hỗ trợ mở lại tài khoản.
              </p>
            </div>
          )}

          {/* Main Profile Card */}
          <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-md space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                {profile.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt={profile.fullName}
                    className="w-16 h-16 rounded-2xl object-cover ring-4 ring-emerald-500/20 shadow-md"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 text-white flex items-center justify-center font-black text-2xl shadow-md">
                    {profile.fullName?.charAt(0) || "S"}
                  </div>
                )}

                {isApproved && (
                  <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm">
                    <svg className="w-4 h-4 text-emerald-500 fill-current" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
              
              <div className="space-y-1">
                <h2 className="font-black text-slate-800 text-base leading-tight">
                  {profile.fullName}
                </h2>
                <p className="text-xs text-slate-400 font-medium">{profile.phone}</p>
                
                <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                  isBlocked
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : isApproved 
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                    : "bg-amber-50 text-amber-700 border-amber-200"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isBlocked ? "bg-rose-500" : isApproved ? "bg-emerald-500" : "bg-amber-500"}`}></span>
                  {isBlocked ? "Tài khoản bị khóa" : isApproved ? "Tài khoản đối tác đã duyệt" : "Đang chờ xét duyệt"}
                </span>
              </div>
            </div>

            {/* TRẠNG THÁI ĐÓNG PHÍ GIA NHẬP 1.500.000Đ */}
            <div className={`p-3.5 rounded-2xl border flex items-center justify-between shadow-xs ${
              isDepositPaid 
                ? "bg-emerald-50/80 border-emerald-200 text-emerald-900" 
                : "bg-amber-50/80 border-amber-200 text-amber-900"
            }`}>
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-base ${
                  isDepositPaid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                }`}>
                  💵
                </div>
                <div>
                  <h4 className="text-xs font-extrabold">Phí ký quỹ / Gia nhập</h4>
                  <p className="text-[10px] font-medium opacity-80">Mức phí: 1.500.000 VNĐ</p>
                </div>
              </div>
              <span className={`text-[10px] font-extrabold px-3 py-1 rounded-xl border ${
                isDepositPaid 
                  ? "bg-emerald-600 text-white border-emerald-600" 
                  : "bg-amber-500 text-white border-amber-500"
              }`}>
                {isDepositPaid ? "Đã thanh toán" : "Chưa thanh toán"}
              </span>
            </div>

            {/* KHỐI HIỂN THỊ CHỈ SỐ UY TÍN */}
            <div className="bg-gradient-to-br from-amber-50/80 via-orange-50/40 to-slate-50 p-3.5 rounded-2xl border border-amber-200/60 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wider flex items-center gap-1">
                  🛡️ Chỉ số uy tín Shipper
                </span>
                <span className="text-[10px] font-bold text-amber-600 bg-amber-100/80 px-2 py-0.5 rounded-md">
                  {shipperStats.rating >= 4.8 ? "Hạng Xuất Sắc 🏆" : shipperStats.rating >= 4.5 ? "Hạng Tốt ⭐" : "Hạng Thường"}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center pt-1">
                <div className="bg-white/80 p-2 rounded-xl border border-amber-100 shadow-xs">
                  <span className="text-[10px] text-slate-400 font-bold block">Đánh giá</span>
                  <span className="font-black text-xs text-amber-600 flex items-center justify-center gap-0.5 mt-0.5">
                    ⭐ {shipperStats.rating.toFixed(1)}
                  </span>
                </div>

                <div className="bg-white/80 p-2 rounded-xl border border-amber-100 shadow-xs">
                  <span className="text-[10px] text-slate-400 font-bold block">Đơn thành công</span>
                  <span className="font-black text-xs text-slate-800 mt-0.5 block">
                    {shipperStats.completedOrders}
                  </span>
                </div>

                <div className="bg-white/80 p-2 rounded-xl border border-amber-100 shadow-xs">
                  <span className="text-[10px] text-slate-400 font-bold block">Tỷ lệ hoàn thành</span>
                  <span className="font-black text-xs text-emerald-600 mt-0.5 block">
                    {shipperStats.completionRate}%
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-100">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Số CCCD</span>
                <span className="font-extrabold text-xs text-slate-800 block mt-0.5 truncate">
                  {profile.identityCardNumber || "Chưa cập nhật"}
                </span>
              </div>

              <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-100">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Tham gia từ</span>
                <span className="font-extrabold text-xs text-slate-800 block mt-0.5">
                  Tháng {formattedJoinDate}
                </span>
              </div>
            </div>
          </div>

          {/* Registered Vehicle Section */}
          <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-xs space-y-3">
            <h3 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider px-1">
              Thông tin phương tiện
            </h3>
            <div className="flex items-center justify-between bg-slate-50/70 p-3 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100 text-lg">
                  {profile.vehicleType === "CAR" ? "🚗" : "🛵"}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">
                    {formatVehicleType(profile.vehicleType)}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Biển số: <strong className="text-slate-800 font-extrabold">{profile.licensePlate || "Chưa bổ sung"}</strong>
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-extrabold bg-emerald-100/80 text-emerald-800 px-3 py-1 rounded-xl">
                {profile.vehicleType || "N/A"}
              </span>
            </div>
          </div>

          {/* 🏦 Tài khoản nhận thanh toán T+1 */}
          <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-xs space-y-3">
            <div className="flex items-center justify-between px-1">
              <div>
                <h3 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                  Tài khoản nhận thanh toán
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Sàn sử dụng tài khoản này để chi trả đối soát T+1.
                </p>
              </div>

              <span
                className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${
                  hasPayoutBank
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                }`}
              >
                {hasPayoutBank ? "✓ Đã thiết lập" : "⚠ Chưa thiết lập"}
              </span>
            </div>

            {hasPayoutBank ? (
              <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white border border-emerald-100 flex items-center justify-center text-lg shadow-xs shrink-0">
                    🏦
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black text-slate-800 truncate">
                      {payoutBankName}
                    </p>

                    <p className="font-mono text-sm font-black text-emerald-700 mt-0.5 tracking-wide">
                      {maskedAccountNumber}
                    </p>

                    <p className="text-[10px] text-slate-500 font-bold uppercase truncate mt-0.5">
                      {payoutAccountHolder}
                    </p>
                  </div>
                </div>

                <p className="text-[10px] text-emerald-700/80 mt-3 leading-relaxed">
                  Kiểm tra kỹ thông tin trước ngày đối soát. Tiền sẽ được chuyển
                  theo tài khoản đã lưu trên hệ thống.
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleOpenEditModal}
                className="w-full text-left bg-amber-50 hover:bg-amber-100/80 border border-amber-200 rounded-2xl p-3.5 transition cursor-pointer"
              >
                <div className="flex items-start gap-2.5">
                  <span className="text-lg">⚠️</span>
                  <div>
                    <p className="text-xs font-extrabold text-amber-800">
                      Chưa có tài khoản nhận tiền
                    </p>
                    <p className="text-[10px] text-amber-700/80 mt-1 leading-relaxed">
                      Hãy bổ sung tài khoản ngân hàng để Sàn có thể thanh toán
                      thu nhập T+1 cho bạn.
                    </p>
                  </div>
                </div>
              </button>
            )}
          </div>

          {/* Account Actions */}
          <div className="space-y-2 pt-2">
            <button
              onClick={() => setIsPasswordModalOpen(true)}
              className="w-full bg-white hover:bg-slate-50 active:scale-98 text-slate-700 border border-slate-200 font-extrabold py-3.5 rounded-2xl text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-xs"
            >
              <span className="text-base">🔑</span>
              <span>ĐỔI MẬT KHẨU TÀI KHOẢN</span>
            </button>

            <button
              onClick={handleLogout}
              className="w-full bg-rose-50 hover:bg-rose-100 active:scale-98 text-rose-600 border border-rose-100 font-extrabold py-3.5 rounded-2xl text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-xs"
            >
              <svg className="w-4 h-4 fill-none stroke-current stroke-[2.5]" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>ĐĂNG XUẤT TÀI KHOẢN</span>
            </button>
          </div>

        </div>

        {/* MODAL CẬP NHẬT HỒ SƠ */}
        {isEditing && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-end justify-center">
            <div className="bg-white w-full rounded-t-[2.5rem] p-6 space-y-5 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-300 shadow-2xl">
              
              <div className="space-y-3">
                <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto" />
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-extrabold text-slate-800 text-base">Cập nhật thông tin</h3>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold text-xs flex items-center justify-center transition cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="flex flex-col items-center justify-center space-y-2 py-1">
                  <div className="relative w-20 h-20 group">
                    <img
                      src={formData.avatarUrl || "/file.svg"}
                      alt="Avatar Preview"
                      className="w-20 h-20 rounded-2xl object-cover border-2 border-emerald-500 shadow-md"
                    />
                    {uploadingImage && (
                      <div className="absolute inset-0 bg-black/60 rounded-2xl flex items-center justify-center text-white text-[10px] font-bold backdrop-blur-xs">
                        Đang tải...
                      </div>
                    )}
                  </div>
                  <label className="cursor-pointer bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-extrabold px-3.5 py-1.5 rounded-xl text-[11px] transition border border-emerald-100 shadow-xs">
                    <span>{uploadingImage ? "Đang xử lý..." : "📷 Đổi ảnh đại diện"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      disabled={uploadingImage}
                    />
                  </label>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-extrabold text-slate-400 block mb-1 uppercase tracking-wider">
                      Họ và tên
                    </label>
                    <input
                      type="text"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                      placeholder="Nhập họ tên đầy đủ"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-extrabold text-slate-400 block mb-1 uppercase tracking-wider">
                      Số điện thoại
                    </label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                      placeholder="Nhập số điện thoại"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-extrabold text-slate-400 block mb-1 uppercase tracking-wider">
                        Biển số xe
                      </label>
                      <input
                        type="text"
                        value={formData.licensePlate}
                        onChange={(e) => setFormData({ ...formData, licensePlate: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                        placeholder="38-A1 123.45"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-extrabold text-slate-400 block mb-1 uppercase tracking-wider">
                        Phương tiện
                      </label>
                      <select
                        value={formData.vehicleType}
                        onChange={(e) => setFormData({ ...formData, vehicleType: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                      >
                        <option value="MOTORBIKE">Xe máy</option>
                        <option value="CAR">Ô tô</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-extrabold text-slate-400 block mb-1 uppercase tracking-wider">
                      Số CCCD
                    </label>
                    <input
                      type="text"
                      value={formData.identityCardNumber}
                      onChange={(e) => setFormData({ ...formData, identityCardNumber: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                      placeholder="Nhập 12 số CCCD"
                      required
                    />
                  </div>

                  {/* =================================================
                      🏦 TÀI KHOẢN NHẬN THANH TOÁN T+1
                  ================================================= */}
                  <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-3.5 space-y-3">
                    <div className="flex items-start gap-2">
                      <span className="text-lg">🏦</span>
                      <div>
                        <h4 className="text-xs font-extrabold text-emerald-900">
                          Tài khoản nhận thanh toán
                        </h4>
                        <p className="text-[10px] text-emerald-700/80 mt-0.5 leading-relaxed">
                          Dùng để nhận tiền đối soát T+1 từ Sàn. Tên chủ tài
                          khoản nên trùng với thông tin đăng ký của Shipper.
                        </p>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-extrabold text-slate-500 block mb-1 uppercase tracking-wider">
                        Tên ngân hàng
                      </label>
                      <input
                        type="text"
                        value={formData.bankName}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            bankName: e.target.value,
                          })
                        }
                        className="w-full bg-white border border-emerald-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 transition"
                        placeholder="Ví dụ: MB Bank, Vietcombank..."
                        autoComplete="organization"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-extrabold text-slate-500 block mb-1 uppercase tracking-wider">
                        Số tài khoản
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formData.accountNumber}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            accountNumber: e.target.value.replace(/\D/g, ""),
                          })
                        }
                        className="w-full bg-white border border-emerald-200 rounded-xl px-3.5 py-2.5 text-xs font-black font-mono text-slate-800 focus:outline-none focus:border-emerald-500 transition"
                        placeholder="Nhập số tài khoản ngân hàng"
                        autoComplete="off"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-extrabold text-slate-500 block mb-1 uppercase tracking-wider">
                        Tên chủ tài khoản
                      </label>
                      <input
                        type="text"
                        value={formData.accountHolder}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            accountHolder: e.target.value.toUpperCase(),
                          })
                        }
                        className="w-full bg-white border border-emerald-200 rounded-xl px-3.5 py-2.5 text-xs font-black uppercase text-slate-800 focus:outline-none focus:border-emerald-500 transition"
                        placeholder="NGUYEN VAN A"
                        autoComplete="name"
                      />
                    </div>

                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      🔐 Trên màn hình chính chỉ hiển thị 4 số cuối để hạn chế
                      lộ thông tin tài khoản.
                    </p>
                  </div>
                </div>

                <div className="pt-3 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-600 font-extrabold py-3.5 rounded-2xl text-xs transition cursor-pointer"
                  >
                    HỦY BỎ
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || uploadingImage}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-extrabold py-3.5 rounded-2xl text-xs transition shadow-md shadow-emerald-200 flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    {isSaving ? "ĐANG LƯU..." : "LƯU THAY ĐỔI"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 🔥 MODAL ĐỔI MẬT KHẨU (CÓ YÊU CẦU MẬT KHẨU CŨ) */}
        {isPasswordModalOpen && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-end justify-center">
            <div className="bg-white w-full rounded-t-[2.5rem] p-6 space-y-4 animate-in slide-in-from-bottom duration-300 shadow-2xl">
              <div className="space-y-2">
                <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto" />
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-extrabold text-slate-800 text-base">🔑 Đổi mật khẩu tài khoản</h3>
                  <button
                    onClick={() => {
                      setIsPasswordModalOpen(false);
                      setOldPassword("");
                      setNewPassword("");
                      setConfirmPassword("");
                    }}
                    className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold text-xs flex items-center justify-center cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <form onSubmit={handleChangePasswordDirect} className="space-y-3">
                {/* O NHẬP MẬT KHẨU CŨ */}
                <div>
                  <label className="text-[10px] font-extrabold text-amber-700 block mb-1 uppercase tracking-wider">
                    Mật khẩu hiện tại (cũ)
                  </label>
                  <input
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="w-full bg-amber-50/50 border border-amber-200 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500 focus:bg-white transition"
                    placeholder="Nhập mật khẩu đang sử dụng"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 block mb-1 uppercase tracking-wider">
                    Mật khẩu mới
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                    placeholder="Tối thiểu 6 ký tự"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 block mb-1 uppercase tracking-wider">
                    Nhập lại mật khẩu mới
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                    placeholder="Xác nhận mật khẩu mới"
                    required
                  />
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsPasswordModalOpen(false);
                      setOldPassword("");
                      setNewPassword("");
                      setConfirmPassword("");
                    }}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-600 font-extrabold py-3.5 rounded-2xl text-xs transition cursor-pointer"
                  >
                    HỦY BỎ
                  </button>
                  <button
                    type="submit"
                    disabled={isChangingPassword}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-extrabold py-3.5 rounded-2xl text-xs transition shadow-md shadow-emerald-200 cursor-pointer disabled:opacity-50"
                  >
                    {isChangingPassword ? "ĐANG LƯU..." : "XÁC NHẬN ĐỔI"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <BottomNav />
      </div>
    </div>
  );
}