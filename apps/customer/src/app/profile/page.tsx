"use client";


import { useEffect, useState } from "react";


import { useRouter } from "next/navigation";


import { auth, db } from "@cho-online/firebase";


import {
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signOut,
  updatePassword,
  User,
} from "firebase/auth";


import { doc, getDoc, setDoc } from "firebase/firestore";


import dynamic from "next/dynamic";


const MapComponent = dynamic(() => import("./MapComponent"), {


  ssr: false,


  loading: () => (


    <div className="h-full flex items-center justify-center bg-stone-100 text-xs text-stone-500 font-medium">


      Đang tải bản đồ tương tác...


    </div>


  ),


});


type AddressType = "home" | "office";

/**
 * Giá trị quy đổi điểm thưởng của Anvami.
 * 1 điểm = 10 VNĐ.
 *
 * Khi thay đổi chính sách sau này chỉ cần sửa hằng số này.
 */
const POINT_VALUE_VND = 10;


const VIETNAM_BANKS = [


  { code: "MB", name: "MBBank - Ngân hàng Quân Đội", shortName: "MBBank" },


  { code: "VCB", name: "Vietcombank - NH Ngoại Thương Việt Nam", shortName: "Vietcombank" },


  { code: "TCB", name: "Techcombank - NH Kỹ Thương", shortName: "Techcombank" },


  { code: "BIDV", name: "BIDV - NH Đầu tư và Phát triển VN", shortName: "BIDV" },


  { code: "CTG", name: "VietinBank - NH Công Thương Việt Nam", shortName: "VietinBank" },


  { code: "TPB", name: "TPBank - NH Tiên Phong", shortName: "TPBank" },


  { code: "ACB", name: "ACB - NH Á Châu", shortName: "ACB" },


  { code: "VPB", name: "VPBank - NH Thịnh Vượng", shortName: "VPBank" },


  { code: "STB", name: "Sacombank - NH Sài Gòn Thương Tín", shortName: "Sacombank" },


  { code: "HDB", name: "HDBank - NH Phát triển TP.HCM", shortName: "HDBank" },


  { code: "VIB", name: "VIB - NH Quốc tế", shortName: "VIB" },


  { code: "MSB", name: "MSB - NH Hàng Hải", shortName: "MSB" },


];


interface Toast {


  message: string;


  type: "success" | "error" | "info";


}


export default function ProfilePage() {


  const router = useRouter();


  const [user, setUser] = useState<User | null>(null);


  const [loading, setLoading] = useState(true);


  const [points, setPoints] = useState<number>(0);


  const [showTermsModal, setShowTermsModal] = useState(false);


  const [showMapModal, setShowMapModal] = useState(false);


  // =========================================================
  // BẢO MẬT / ĐỔI MẬT KHẨU
  // =========================================================


  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);


  const [mustChangePassword, setMustChangePassword] = useState(false);


  const [currentPassword, setCurrentPassword] = useState("");


  const [newPassword, setNewPassword] = useState("");


  const [confirmNewPassword, setConfirmNewPassword] = useState("");


  const [showPasswordFields, setShowPasswordFields] = useState(false);


  const [changePasswordLoading, setChangePasswordLoading] = useState(false);


  const [changePasswordError, setChangePasswordError] = useState("");


  const [tempCoords, setTempCoords] = useState<{ lat: number; lng: number }>({


    lat: 18.33722,


    lng: 105.90153,


  });


  const [toast, setToast] = useState<Toast | null>(null);


  const [fullName, setFullName] = useState("");


  const [phone, setPhone] = useState("");


  // 🏠 Địa chỉ tự động từ bản đồ/GPS (Chỉ đọc - Người dùng không sửa trực tiếp)


  const [streetAddress, setStreetAddress] = useState("75 Hải Thượng Lãn Ông, Hà Tĩnh");


  // 📝 Thêm ô ghi chú thủ công riêng cho shipper


  const [shipperNote, setShipperNote] = useState("");


  const [addressType, setAddressType] = useState<AddressType>("home");


  const [isDefault, setIsDefault] = useState(true);


  const [bankCode, setBankCode] = useState("MB");


  const [bankAccount, setBankAccount] = useState("");


  const [bankOwner, setBankOwner] = useState("");


  const [coords, setCoords] = useState<{ lat: number | null; lng: number | null }>({


    lat: 18.33722,


    lng: 105.90153,


  });


  const [saving, setSaving] = useState(false);


  const [isLocating, setIsLocating] = useState(false);


  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {


    setToast({ message, type });


    setTimeout(() => {


      setToast(null);


    }, 3500);


  };


  const resetFormState = () => {


    setFullName("");


    setPhone("");


    setPoints(0);


    setMustChangePassword(false);


    setShowChangePasswordModal(false);


    setCurrentPassword("");


    setNewPassword("");


    setConfirmNewPassword("");


    setShowPasswordFields(false);


    setChangePasswordError("");


    setStreetAddress("75 Hải Thượng Lãn Ông, Hà Tĩnh");


    setShipperNote("");


    setAddressType("home");


    setIsDefault(true);


    setCoords({ lat: 18.33722, lng: 105.90153 });


    setBankCode("MB");


    setBankAccount("");


    setBankOwner("");


  };


  useEffect(() => {


    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {


      setUser(currentUser);


      if (currentUser) {


        try {


          const userDoc = await getDoc(doc(db, "users", currentUser.uid));


          if (userDoc.exists()) {


            const data = userDoc.data();


            setFullName(data.fullName || currentUser.displayName || "");


            setPhone(data.phone || currentUser.phoneNumber || "");


            setPoints(data.points || 0);


            const forcePasswordChange = Boolean(data.mustChangePassword);


            setMustChangePassword(forcePasswordChange);


            if (forcePasswordChange) {


              setShowChangePasswordModal(true);


            }


            if (data.refundBankInfo) {


              setBankCode(data.refundBankInfo.bankCode || "MB");


              setBankAccount(data.refundBankInfo.bankAccount || "");


              setBankOwner(data.refundBankInfo.bankOwner || "");


            }


            if (data.addressDetails?.streetAddress) {


              setStreetAddress(data.addressDetails.streetAddress);


              setShipperNote(data.addressDetails.shipperNote || "");


              setAddressType(data.addressDetails.addressType || "home");


              setIsDefault(data.addressDetails.isDefault ?? true);


            } else if (data.address) {


              setStreetAddress(data.address);


            }


            const latitude = data.location?.latitude ?? data.lat ?? 18.33722;


            const longitude = data.location?.longitude ?? data.lng ?? 105.90153;


            setCoords({ lat: latitude, lng: longitude });


          } else {


            setFullName(currentUser.displayName || "");


            setPhone(currentUser.phoneNumber || "");


          }


        } catch (error) {


          console.warn("Lỗi lấy thông tin người dùng:", error);


        }


      } else {


        resetFormState();


      }


      setLoading(false);


    });


    return () => unsubscribe();


  }, []);


  const formatCurrency = (amount: number) => {


    return new Intl.NumberFormat("vi-VN", {


      style: "currency",


      currency: "VND",


    }).format(amount);


  };


  const handleGetCurrentLocation = () => {


    if (!navigator.geolocation) {


      showToast("Trình duyệt không hỗ trợ định vị GPS!", "error");


      return;


    }


    setIsLocating(true);


    navigator.geolocation.getCurrentPosition(


      async (position) => {


        const lat = position.coords.latitude;


        const lng = position.coords.longitude;


        setCoords({ lat, lng });


        // Tự động dịch GPS ra địa chỉ tiếng Việt


        try {


          const res = await fetch(


            `https\://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=vi`


          );


          const data = await res.json();


          if (data && data.display_name) {


            setStreetAddress(data.display_name);


          }


        } catch (err) {


          console.warn("Lỗi dịch GPS:", err);


        }


        setIsLocating(false);


        showToast("📍 Đã cập nhật tọa độ GPS & địa chỉ thành công!", "success");


      },


      (error) => {


        console.warn("Lỗi vị trí GPS:", error.code, error.message);


        showToast("Không thể lấy vị trí. Vui lòng bật GPS!", "error");


        setIsLocating(false);


      },


      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }


    );


  };


  const openMapPickerModal = () => {


    setTempCoords({


      lat: coords.lat || 18.33722,


      lng: coords.lng || 105.90153,


    });


    setShowMapModal(true);


  };


  const handleConfirmMapLocation = async () => {


    setCoords(tempCoords);


    setShowMapModal(false);


    try {


      const res = await fetch(


        `https\://nominatim.openstreetmap.org/reverse?format=json&lat=${tempCoords.lat}&lon=${tempCoords.lng}&zoom=18&addressdetails=1&accept-language=vi`


      );


      const data = await res.json();


      if (data && data.display_name) {


        setStreetAddress(data.display_name);


        showToast("📍 Đã cập nhật địa chỉ tự động từ bản đồ!", "success");


      } else {


        showToast("📍 Đã chốt vị trí trên bản đồ thành công!", "success");


      }


    } catch (err) {


      console.warn("Lỗi dịch ngược tọa độ:", err);


      showToast("📍 Đã chốt vị trí trên bản đồ thành công!", "success");


    }


  };


  // =========================================================
  // ĐỔI MẬT KHẨU
  // =========================================================


  const hasPasswordProvider = Boolean(
    user?.email &&
      user?.providerData?.some(
        (provider) => provider.providerId === "password"
      )
  );


  const isForcedPasswordChange =
    mustChangePassword && hasPasswordProvider;


  const resetPasswordForm = () => {


    setCurrentPassword("");


    setNewPassword("");


    setConfirmNewPassword("");


    setShowPasswordFields(false);


    setChangePasswordError("");


  };


  const openChangePasswordModal = () => {


    resetPasswordForm();


    setShowChangePasswordModal(true);


  };


  const closeChangePasswordModal = () => {


    if (changePasswordLoading || isForcedPasswordChange) {


      return;


    }


    resetPasswordForm();


    setShowChangePasswordModal(false);


  };


  const handleChangePassword = async (e: React.FormEvent) => {


    e.preventDefault();


    if (!user) {


      return;


    }


    setChangePasswordError("");


    if (!hasPasswordProvider || !user.email) {


      setChangePasswordError(
        "Tài khoản này đăng nhập bằng Google. Mật khẩu được quản lý bởi tài khoản Google của bạn."
      );


      return;


    }


    if (!currentPassword) {


      setChangePasswordError("Vui lòng nhập mật khẩu hiện tại.");


      return;


    }


    if (newPassword.length < 6) {


      setChangePasswordError("Mật khẩu mới phải có ít nhất 6 ký tự.");


      return;


    }


    if (newPassword === currentPassword) {


      setChangePasswordError("Mật khẩu mới phải khác mật khẩu hiện tại.");


      return;


    }


    if (newPassword !== confirmNewPassword) {


      setChangePasswordError("Mật khẩu xác nhận không khớp.");


      return;


    }


    setChangePasswordLoading(true);


    try {


      /**
       * Xác minh lại người dùng bằng mật khẩu hiện tại trước khi đổi.
       *
       * Tài khoản Customer legacy của Anvami vẫn có email Auth nội bộ
       * dạng SĐT@choonline.internal nên có thể dùng EmailAuthProvider
       * để re-authenticate bình thường.
       */
      const credential = EmailAuthProvider.credential(
        user.email,
        currentPassword
      );


      await reauthenticateWithCredential(user, credential);


      await updatePassword(user, newPassword);


      /**
       * Nếu mật khẩu hiện tại là mật khẩu tạm do Admin cấp,
       * sau khi đổi thành công thì xóa cờ bắt buộc đổi mật khẩu.
       */
      await setDoc(
        doc(db, "users", user.uid),
        {
          mustChangePassword: false,
          passwordChangedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          merge: true,
        }
      );


      setMustChangePassword(false);


      resetPasswordForm();


      setShowChangePasswordModal(false);


      showToast("🔐 Đổi mật khẩu thành công!", "success");


    } catch (error: any) {


      console.warn("Lỗi đổi mật khẩu:", error);


      const code = String(error?.code || "");


      if (
        code === "auth/invalid-credential" ||
        code === "auth/wrong-password"
      ) {


        setChangePasswordError("Mật khẩu hiện tại không chính xác.");


      } else if (code === "auth/weak-password") {


        setChangePasswordError("Mật khẩu mới quá yếu. Vui lòng chọn mật khẩu mạnh hơn.");


      } else if (code === "auth/requires-recent-login") {


        setChangePasswordError(
          "Phiên đăng nhập đã quá lâu. Vui lòng đăng xuất, đăng nhập lại rồi đổi mật khẩu."
        );


      } else if (code === "auth/too-many-requests") {


        setChangePasswordError(
          "Bạn đã thử quá nhiều lần. Vui lòng chờ một lúc rồi thử lại."
        );


      } else if (code === "auth/network-request-failed") {


        setChangePasswordError(
          "Không thể kết nối mạng. Vui lòng kiểm tra Internet và thử lại."
        );


      } else {


        setChangePasswordError(
          "Chưa thể đổi mật khẩu. Vui lòng thử lại."
        );


      }


    } finally {


      setChangePasswordLoading(false);


    }


  };


  const handleSaveInfo = async (e: React.FormEvent) => {


    e.preventDefault();


    if (!user) return;


    setSaving(true);


    try {


      const selectedBank = VIETNAM_BANKS.find((b) => b.code === bankCode);


      const profileData = {


        fullName,


        phone,


        address: streetAddress.trim(),


        shipperNote: shipperNote.trim(),


        addressDetails: {


          streetAddress: streetAddress.trim(),


          shipperNote: shipperNote.trim(),


          addressType,


          isDefault,


        },


        refundBankInfo: {


          bankCode,


          bankName: selectedBank?.shortName || bankCode,


          bankAccount: bankAccount.trim(),


          bankOwner: bankOwner.toUpperCase().trim(),


        },


        location: coords.lat && coords.lng ? { latitude: coords.lat, longitude: coords.lng } : null,


        lat: coords.lat,


        lng: coords.lng,


        updatedAt: new Date().toISOString(),


      };


      await setDoc(doc(db, "users", user.uid), profileData, { merge: true });


      localStorage.setItem("user_shipping_info", JSON.stringify(profileData));


      showToast("🎉 Lưu thông tin cá nhân & ngân hàng thành công!", "success");


    } catch (error) {


      console.warn("Lỗi lưu thông tin:", error);


      showToast("Không thể lưu thông tin. Vui lòng thử lại!", "error");


    } finally {


      setSaving(false);


    }


  };


  const handleSignOut = async () => {


    try {


      await signOut(auth);


      localStorage.removeItem("user_shipping_info");


      localStorage.clear();


      sessionStorage.clear();


      setUser(null);


      resetFormState();


      router.push("/login");


    } catch (error) {


      console.warn("Lỗi đăng xuất:", error);


    }


  };


  if (loading) {


    return (


      <div className="min-h-screen flex items-center justify-center bg-stone-50">


        <div className="flex flex-col items-center gap-2">


          <div className="w-8 h-8 border-3 border-[#ee4d2d] border-t-transparent rounded-full animate-spin"></div>


          <p className="text-xs font-semibold text-stone-500">Đang tải hồ sơ...</p>


        </div>


      </div>


    );


  }


  if (!user) {


    return (


      <div className="max-w-md mx-auto p-6 text-center space-y-4 my-10">


        <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center text-2xl mx-auto">


          👤


        </div>


        <h2 className="text-base font-bold text-stone-800">Bạn chưa đăng nhập</h2>


        <p className="text-xs text-stone-500">


          Vui lòng đăng nhập để lưu địa chỉ và trải nghiệm mua sắm nhanh chóng hơn.


        </p>


        <button


          type="button"


          onClick={() => router.push("/login?redirectTo=/profile")}


          className="w-full bg-gradient-to-r from-[#ff6a00] to-[#ee4d2d] text-white font-bold py-3 rounded-xl text-xs uppercase tracking-wider shadow-sm active:scale-98 transition cursor-pointer"


        >


          Đăng nhập ngay


        </button>


      </div>


    );


  }


  return (


    <div className="bg-gradient-to-b from-[#fff8f3] via-[#fffdfb] to-[#fff7f2] min-h-screen py-6 px-3 relative">


      {toast && (


        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 animate-in fade-in slide-in-from-top-4">


          <div


            className={`flex items-center gap-2 px-4 py-3 rounded-2xl shadow-xl border text-xs font-semibold backdrop-blur-md ${


              toast.type === "success"


                ? "bg-emerald-900/90 text-white border-emerald-700"


                : toast.type === "error"


                ? "bg-rose-900/90 text-white border-rose-700"


                : "bg-stone-900/90 text-white border-stone-700"


            }`}


          >


            <span>


              {toast.type === "success" ? "✅" : toast.type === "error" ? "⚠️" : "ℹ️"}


            </span>


            <span>{toast.message}</span>


          </div>


        </div>


      )}


      <div className="max-w-lg mx-auto space-y-4">


        {/* CARD TÀI KHOẢN */}


        <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs flex items-center gap-3.5">


          <div className="w-12 h-12 bg-gradient-to-br from-[#ff6a00] to-[#ee4d2d] text-white font-bold text-lg rounded-full flex items-center justify-center shrink-0 shadow-xs">


            {fullName ? fullName.charAt(0).toUpperCase() : "U"}


          </div>


          <div className="flex-1 min-w-0">


            <div className="flex items-center gap-1.5">


              <h3 className="font-bold text-stone-800 text-sm truncate">


                {fullName || "Thành viên Chợ Online"}


              </h3>


              <span className="bg-orange-50 text-[#ee4d2d] border border-orange-200 text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0">


                ✓ Đã xác thực


              </span>


            </div>


            <p className="text-xs text-stone-500 truncate mt-0.5">


              {user.email || user.phoneNumber || "Khách hàng thân thiết"}


            </p>


          </div>


        </div>


        {/* THẺ ĐIỂM THƯỞNG */}


        <div className="bg-gradient-to-br from-[#ff7a00] via-[#ff5a24] to-[#ee4d2d] text-white p-4 rounded-2xl shadow-md space-y-3 relative overflow-hidden">


          <div className="absolute -right-4 -bottom-4 text-white/10 text-8xl font-black select-none pointer-events-none">


            🎁


          </div>


          <div className="flex items-center justify-between relative z-10">


            <span className="text-xs font-semibold uppercase tracking-wider text-orange-50 flex items-center gap-1.5">


              <span>🌟</span> Điểm thưởng tích lũy


            </span>


            <span className="bg-white/20 backdrop-blur-md text-[10px] px-2 py-0.5 rounded-full font-medium">


              1 điểm = {POINT_VALUE_VND.toLocaleString("vi-VN")} VNĐ


            </span>


          </div>


          <div className="flex items-baseline justify-between relative z-10">


            <div>


              <span className="text-3xl font-black tracking-tight">{points.toLocaleString("vi-VN")}</span>


              <span className="text-xs text-orange-50 font-medium ml-1.5">điểm</span>


            </div>


            <p className="text-xs font-bold text-orange-100 bg-black/10 px-2.5 py-1 rounded-xl">


              Tương đương: {formatCurrency(points * POINT_VALUE_VND)}


            </p>


          </div>


          <p className="text-[11px] text-orange-50/90 relative z-10 pt-1 border-t border-white/20">


            💡 Điểm có thể dùng để giảm trực tiếp giá trị đơn hàng khi thanh toán. Mỗi 1 điểm tương đương 10 VNĐ.


          </p>


        </div>


        {/* FORM THÔNG TIN THANH TOÁN VÀ ĐỊA CHỈ */}


        <form onSubmit={handleSaveInfo} className="bg-white rounded-2xl border border-stone-200/80 shadow-2xs overflow-hidden">


          <div className="px-4 py-3.5 border-b border-stone-100 bg-stone-50/50">


            <h2 className="font-bold text-xs text-stone-800 uppercase tracking-wide flex items-center gap-1.5">


              <span className="text-[#ee4d2d]">📍</span> Địa chỉ & Tài khoản nhận tiền


            </h2>


          </div>


          <div className="p-4 space-y-4 text-xs">


            {/* HỌ TÊN & SĐT */}


            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">


              <div>


                <label className="font-semibold text-stone-700 block mb-1">


                  Họ và tên người nhận <span className="text-rose-500">*</span>


                </label>


                <input


                  type="text"


                  required


                  placeholder="Nhập họ và tên"


                  value={fullName}


                  onChange={(e) => setFullName(e.target.value)}


                  className="w-full bg-stone-50 px-3 py-2.5 rounded-xl border border-stone-200 outline-none focus:bg-white focus:border-[#ee4d2d] focus:ring-1 focus:ring-[#ee4d2d]/25 font-medium transition"


                />


              </div>


              <div>


                <label className="font-semibold text-stone-700 block mb-1">


                  Số điện thoại <span className="text-rose-500">*</span>


                </label>


                <input


                  type="tel"


                  required


                  placeholder="Nhập số điện thoại"


                  value={phone}


                  onChange={(e) => setPhone(e.target.value)}


                  className="w-full bg-stone-50 px-3 py-2.5 rounded-xl border border-stone-200 outline-none focus:bg-white focus:border-[#ee4d2d] focus:ring-1 focus:ring-[#ee4d2d]/25 font-medium transition"


                />


              </div>


            </div>


            {/* 🌟 KHU VỰC CHỌN VỊ TRÍ NỔI BẬT */}


            <div className="p-3.5 bg-gradient-to-br from-orange-50 via-amber-50/50 to-white rounded-2xl border-2 border-white/20 shadow-xs space-y-2.5">


              <div className="flex items-center justify-between">


                <span className="font-bold text-stone-800 text-xs flex items-center gap-1.5">


                  <span className="text-[#ee4d2d] text-sm">📍</span> Chọn nhanh tọa độ giao hàng:


                </span>


                <span className="text-[10px] bg-[#ee4d2d] text-white px-2 py-0.5 rounded-full font-semibold shadow-2xs">


                  Bắt buộc


                </span>


              </div>


              <div className="grid grid-cols-2 gap-2.5">


                <button


                  type="button"


                  onClick={handleGetCurrentLocation}


                  disabled={isLocating}


                  className="flex items-center justify-center gap-2 bg-white hover:bg-orange-50 text-[#ee4d2d] border-2 border-[#ee4d2d] font-bold py-3 px-3 rounded-xl shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-50"


                >


                  <span className="text-base">📍</span>


                  <span className="truncate">{isLocating ? "Đang lấy vị trí..." : "GPS hiện tại"}</span>


                </button>


                <button


                  type="button"


                  onClick={openMapPickerModal}


                  className="flex items-center justify-center gap-2 bg-gradient-to-r from-[#ff6a00] to-[#ee4d2d] hover:brightness-95 text-white font-bold py-3 px-3 rounded-xl shadow-md transition active:scale-95 cursor-pointer"


                >


                  <span className="text-base">🗺️</span>


                  <span className="truncate">Chọn bản đồ</span>


                </button>


              </div>


            </div>


            {/* 🔒 Ô ĐỊA CHỈ TỰ ĐỘNG TỪ BẢN ĐỒ (READ-ONLY) */}


            <div>


              <label className="font-semibold text-stone-700 block mb-1 flex items-center justify-between">


                <span>Địa chỉ tự động từ bản đồ <span className="text-rose-500">*</span></span>


                <span className="text-[10px] text-amber-600 font-normal">🔒 Hệ thống tự cập nhật</span>


              </label>


              <textarea


                rows={2}


                readOnly


                value={streetAddress}


                className="w-full bg-stone-100 text-stone-600 p-3 rounded-xl border border-stone-200 outline-none font-medium resize-none cursor-not-allowed select-none"


              />


              <p className="text-[10px] text-stone-400 mt-1">


                💡 Ô này lấy tự động từ GPS hoặc nút "Chọn bản đồ" phía trên để tính phí ship chuẩn xác.


              </p>


            </div>


            {/* 📝 Ô NHẬP THỦ CÔNG CHO SHIPPER */}


            <div>


              <label className="font-semibold text-stone-700 block mb-1">


                Ghi chú thêm cho Shipper <span className="text-stone-400 font-normal">(Tùy chọn)</span>


              </label>


              <input


                type="text"


                placeholder="Ví dụ: Nhà cổng màu xanh, ngõ rộng ô tô vào được..."


                value={shipperNote}


                onChange={(e) => setShipperNote(e.target.value)}


                className="w-full bg-stone-50 px-3 py-2.5 rounded-xl border border-stone-200 outline-none focus:bg-white focus:border-[#ee4d2d] focus:ring-1 focus:ring-[#ee4d2d]/25 font-medium transition"


              />


              <p className="text-[10px] text-stone-400 mt-1">


                🚚 Shipper sẽ nhìn thấy dòng ghi chú này để dễ dàng tìm nhà bạn hơn.


              </p>


            </div>


            {/* TRẠNG THÁI TỌA ĐỘ GPS / BẢN ĐỒ */}


            <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200/60 flex items-center justify-between text-[11px]">


              {coords.lat && coords.lng ? (


                <span className="text-[#ee4d2d] font-semibold flex items-center gap-1">


                  <span>✓ Tọa độ bản đồ:</span>


                  <span className="font-mono bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200">


                    {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}


                  </span>


                </span>


              ) : (


                <span className="text-stone-400">


                  ⚠️ Chưa có tọa độ (Bấm "Chọn bản đồ" hoặc "GPS" để tính phí ship chuẩn)


                </span>


              )}


            </div>


            {/* LOẠI ĐỊA CHỈ & MẶC ĐỊNH */}


            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">


              <div>


                <label className="font-semibold text-stone-700 block mb-1.5">


                  Loại địa chỉ


                </label>


                <div className="flex gap-2">


                  <button


                    type="button"


                    onClick={() => setAddressType("home")}


                    className={`flex-1 py-2 rounded-xl border text-xs font-semibold transition cursor-pointer ${


                      addressType === "home"


                        ? "border-[#ee4d2d] bg-orange-50 text-[#ee4d2d]"


                        : "border-stone-200 bg-stone-50 text-stone-600"


                    }`}


                  >


                    🏠 Nhà riêng


                  </button>


                  <button


                    type="button"


                    onClick={() => setAddressType("office")}


                    className={`flex-1 py-2 rounded-xl border text-xs font-semibold transition cursor-pointer ${


                      addressType === "office"


                        ? "border-[#ee4d2d] bg-orange-50 text-[#ee4d2d]"


                        : "border-stone-200 bg-stone-50 text-stone-600"


                    }`}


                  >


                    🏢 Văn phòng


                  </button>


                </div>


              </div>


              <div className="flex items-center justify-between sm:justify-start sm:gap-3 sm:pt-6">


                <span className="font-semibold text-stone-700">


                  Đặt làm mặc định


                </span>


                <input


                  type="checkbox"


                  checked={isDefault}


                  onChange={(e) => setIsDefault(e.target.checked)}


                  className="w-4 h-4 accent-[#ee4d2d] rounded cursor-pointer"


                />


              </div>


            </div>


            {/* MỤC CẤU HÌNH NGÂN HÀNG HOÀN TIỀN */}


            <div className="pt-3 border-t border-stone-200/80 space-y-3">


              <div className="flex items-center justify-between">


                <label className="font-bold text-stone-800 text-xs flex items-center gap-1.5">


                  <span className="text-[#ee4d2d]">🏦</span> Tài khoản nhận hoàn tiền


                </label>


                <span className="text-[10px] text-stone-400 font-medium">


                  Sử dụng khi bị hủy đơn


                </span>


              </div>


              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">


                <div className="sm:col-span-2">


                  <label className="font-semibold text-stone-700 block mb-1">


                    Tên Ngân hàng


                  </label>


                  <select


                    value={bankCode}


                    onChange={(e) => setBankCode(e.target.value)}


                    className="w-full bg-stone-50 px-3 py-2.5 rounded-xl border border-stone-200 outline-none focus:bg-white focus:border-[#ee4d2d] focus:ring-1 focus:ring-[#ee4d2d]/20 font-medium transition cursor-pointer"


                  >


                    {VIETNAM_BANKS.map((bank) => (


                      <option key={bank.code} value={bank.code}>


                        {bank.name}


                      </option>


                    ))}


                  </select>


                </div>


                <div>


                  <label className="font-semibold text-stone-700 block mb-1">


                    Số tài khoản ngân hàng


                  </label>


                  <input


                    type="text"


                    placeholder="Nhập số tài khoản"


                    value={bankAccount}


                    onChange={(e) => setBankAccount(e.target.value)}


                    className="w-full bg-stone-50 px-3 py-2.5 rounded-xl border border-stone-200 outline-none focus:bg-white focus:border-[#ee4d2d] focus:ring-1 focus:ring-[#ee4d2d]/20 font-mono transition"


                  />


                </div>


                <div>


                  <label className="font-semibold text-stone-700 block mb-1">


                    Tên chủ tài khoản (Viết hoa không dấu)


                  </label>


                  <input


                    type="text"


                    placeholder="NGUYEN VAN A"


                    value={bankOwner}


                    onChange={(e) => setBankOwner(e.target.value.toUpperCase())}


                    className="w-full bg-stone-50 px-3 py-2.5 rounded-xl border border-stone-200 outline-none focus:bg-white focus:border-[#ee4d2d] focus:ring-1 focus:ring-[#ee4d2d]/20 font-medium transition uppercase"


                  />


                </div>


              </div>


            </div>


            {/* BUTTON SUBMIT */}


            <button


              type="submit"


              disabled={saving}


              className="w-full mt-2 bg-gradient-to-r from-[#ff6a00] to-[#ee4d2d] hover:brightness-95 active:scale-98 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-wider transition shadow-sm cursor-pointer disabled:opacity-50"


            >


              {saving ? "Đang lưu..." : "Lưu thông tin hồ sơ"}


            </button>


          </div>


        </form>


        {/* ============================================================

            BẢO MẬT TÀI KHOẢN

        ============================================================ */}


        <div
          className={`group rounded-2xl border bg-white px-4 py-3.5 shadow-sm transition ${
            mustChangePassword
              ? "border-amber-200 ring-2 ring-amber-100/70"
              : "border-stone-200/80 hover:border-orange-200 hover:shadow-md"
          }`}
        >


          <div className="flex items-center justify-between gap-3">


            <div className="flex min-w-0 items-center gap-3">


              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${
                  mustChangePassword
                    ? "bg-amber-50 text-amber-600 ring-amber-200"
                    : "bg-orange-50 text-[#ee4d2d] ring-orange-100"
                }`}
              >


                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                  aria-hidden="true"
                >


                  <rect x="4" y="10" width="16" height="11" rx="2" />


                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />


                  <path d="M12 14v3" />


                </svg>


              </div>


              <div className="min-w-0">


                <div className="flex flex-wrap items-center gap-1.5">


                  <p className="truncate text-xs font-extrabold text-stone-800">


                    Bảo mật tài khoản


                  </p>


                  {mustChangePassword && hasPasswordProvider && (


                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-700">


                      Cần đổi mật khẩu


                    </span>


                  )}


                </div>


                <p className="mt-0.5 text-[10px] font-medium leading-relaxed text-stone-400">


                  {hasPasswordProvider
                    ? mustChangePassword
                      ? "Bạn đang dùng mật khẩu tạm. Hãy tạo mật khẩu mới để tiếp tục bảo vệ tài khoản."
                      : "Đổi mật khẩu định kỳ để tăng mức độ an toàn cho tài khoản."
                    : "Tài khoản đăng nhập bằng Google. Mật khẩu được quản lý bởi Google."}


                </p>


              </div>


            </div>


            {hasPasswordProvider ? (


              <button
                type="button"
                onClick={openChangePasswordModal}
                className={`shrink-0 rounded-xl px-3 py-2 text-[11px] font-bold transition active:scale-95 ${
                  mustChangePassword
                    ? "bg-amber-500 text-white shadow-sm hover:bg-amber-600"
                    : "bg-stone-50 text-stone-600 ring-1 ring-stone-200 hover:bg-orange-50 hover:text-[#ee4d2d] hover:ring-orange-200"
                }`}
              >


                {mustChangePassword ? "Đổi ngay" : "Đổi mật khẩu"}


              </button>


            ) : (


              <span className="shrink-0 rounded-xl bg-stone-50 px-3 py-2 text-[10px] font-semibold text-stone-400 ring-1 ring-stone-200">


                Google


              </span>


            )}


          </div>


        </div>


        {/* ============================================================

            ĐIỀU KHOẢN

        ============================================================ */}


        <div className="group flex items-center justify-between gap-3 rounded-2xl border border-stone-200/80 bg-white px-4 py-3.5 shadow-sm transition hover:border-orange-200 hover:shadow-md">

          <div className="flex min-w-0 items-center gap-3">

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#ee4d2d] ring-1 ring-orange-100">

              <svg

                viewBox="0 0 24 24"

                fill="none"

                stroke="currentColor"

                strokeWidth="1.9"

                strokeLinecap="round"

                strokeLinejoin="round"

                className="h-5 w-5"

                aria-hidden="true"

              >

                <path d="M6 3h9l3 3v15H6z" />

                <path d="M14 3v4h4" />

                <path d="M9 11h6" />

                <path d="M9 15h6" />

              </svg>

            </div>


            <div className="min-w-0">

              <p className="truncate text-xs font-extrabold text-stone-800">

                Điều khoản & Quy chế Sàn TMĐT

              </p>

              <p className="mt-0.5 truncate text-[10px] font-medium text-stone-400">

                Quyền lợi, nghĩa vụ và chính sách mua hàng

              </p>

            </div>

          </div>


          <button

            type="button"

            onClick={() => setShowTermsModal(true)}

            className="flex shrink-0 items-center gap-1 rounded-xl bg-stone-50 px-3 py-2 text-[11px] font-bold text-stone-600 ring-1 ring-stone-200 transition hover:bg-orange-50 hover:text-[#ee4d2d] hover:ring-orange-200 active:scale-95"

          >

            Xem

            <svg

              viewBox="0 0 24 24"

              fill="none"

              stroke="currentColor"

              strokeWidth="2"

              strokeLinecap="round"

              strokeLinejoin="round"

              className="h-3.5 w-3.5"

              aria-hidden="true"

            >

              <path d="m9 18 6-6-6-6" />

            </svg>

          </button>

        </div>


        {/* ============================================================

            ĐĂNG XUẤT

        ============================================================ */}


        <button

          type="button"

          onClick={handleSignOut}

          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-100 bg-white py-3 text-xs font-extrabold text-rose-600 shadow-sm transition hover:bg-rose-50 hover:border-rose-200 active:scale-[0.99]"

        >

          <svg

            viewBox="0 0 24 24"

            fill="none"

            stroke="currentColor"

            strokeWidth="1.9"

            strokeLinecap="round"

            strokeLinejoin="round"

            className="h-[17px] w-[17px]"

            aria-hidden="true"

          >

            <path d="M10 17l5-5-5-5" />

            <path d="M15 12H3" />

            <path d="M14 3h4a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-4" />

          </svg>


          Đăng xuất tài khoản

        </button>


        {/* ============================================================

            FOOTER ANVAMI

        ============================================================ */}


        <footer className="pb-24 pt-2">

          <div className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-[#ff6a00] via-[#f2552d] to-[#ee4d2d] px-4 py-4 text-white shadow-[0_16px_40px_rgba(238,77,45,0.18)]">

            {/* decorative glow */}

            <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/10 blur-2xl" />

            <div className="pointer-events-none absolute -bottom-10 -left-8 h-28 w-28 rounded-full bg-orange-300/20 blur-2xl" />


            <div className="relative flex items-center gap-3">

              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white shadow-[0_8px_20px_rgba(120,53,15,0.18)]">

                <img

                  src="/logo.png"

                  alt="Anvami"

                  draggable={false}

                  className="h-8 w-8 object-contain"

                />

              </div>


              <div className="min-w-0">

                <p className="text-[15px] font-black tracking-tight">

                  Anvami

                </p>

                <p className="mt-0.5 text-[10px] font-medium text-white/75">

                  Thương mại điện tử địa phương

                </p>

              </div>

            </div>


            <div className="relative my-3 h-px bg-white/15" />


            <div className="relative flex items-center justify-between gap-3">

              <button

                type="button"

                onClick={() => setShowTermsModal(true)}

                className="text-[10px] font-semibold text-white/85 transition hover:text-white"

              >

                Điều khoản sử dụng

              </button>


              <p className="text-right text-[9px] font-medium text-white/65">

                © 2026 Anvami

              </p>

            </div>


            <p className="relative mt-1.5 text-[9px] leading-relaxed text-white/55">

              Anvami đang trong giai đoạn phát triển và hoàn thiện dịch vụ.

            </p>

          </div>

        </footer>


      </div>


      {/* ============================================================

        MODAL ĐỔI MẬT KHẨU

    ============================================================ */}


    {showChangePasswordModal && (


      <div
        className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center sm:p-4"
        onMouseDown={(e) => {


          if (
            e.target === e.currentTarget &&
            !isForcedPasswordChange
          ) {


            closeChangePasswordModal();


          }


        }}
      >


        <div className="w-full max-w-md overflow-hidden rounded-[28px] border border-orange-100 bg-white shadow-2xl">


          <div className="relative border-b border-orange-100/70 bg-gradient-to-br from-orange-50 via-white to-[#fff6f1] px-5 pb-5 pt-5">


            {!isForcedPasswordChange && (


              <button
                type="button"
                onClick={closeChangePasswordModal}
                disabled={changePasswordLoading}
                className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-400 shadow-sm transition hover:text-stone-700 disabled:opacity-50"
                aria-label="Đóng"
              >


                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                  aria-hidden="true"
                >


                  <path d="M18 6 6 18" />


                  <path d="m6 6 12 12" />


                </svg>


              </button>


            )}


            <div
              className={`flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg ${
                isForcedPasswordChange
                  ? "bg-gradient-to-br from-amber-400 to-orange-500 shadow-orange-500/20"
                  : "bg-gradient-to-br from-[#ff6a00] to-[#ee4d2d] shadow-orange-500/20"
              }`}
            >


              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6"
                aria-hidden="true"
              >


                <rect x="4" y="10" width="16" height="11" rx="2" />


                <path d="M8 10V7a4 4 0 0 1 8 0v3" />


                <path d="M12 14v3" />


              </svg>


            </div>


            <h3 className="mt-3 text-base font-black tracking-tight text-stone-900">


              {isForcedPasswordChange
                ? "Tạo mật khẩu mới"
                : "Đổi mật khẩu"}


            </h3>


            <p className="mt-1 text-[11px] leading-relaxed text-stone-500">


              {isForcedPasswordChange
                ? "Bạn đang đăng nhập bằng mật khẩu tạm do Anvami cấp. Vui lòng đổi sang mật khẩu riêng của bạn."
                : "Nhập mật khẩu hiện tại để xác minh trước khi tạo mật khẩu mới."}


            </p>


          </div>


          {!hasPasswordProvider ? (


            <div className="p-5">


              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-[11px] leading-relaxed text-blue-700">


                Tài khoản này sử dụng Google để đăng nhập. Bạn không cần tạo mật khẩu riêng trên Anvami.


              </div>


              <button
                type="button"
                onClick={closeChangePasswordModal}
                className="mt-4 w-full rounded-xl bg-stone-900 py-3 text-xs font-black text-white"
              >


                Đóng


              </button>


            </div>


          ) : (


            <form
              onSubmit={handleChangePassword}
              className="space-y-4 p-5"
            >


              {changePasswordError && (


                <div className="rounded-2xl border border-rose-100 bg-rose-50 px-3.5 py-3 text-[10px] font-semibold leading-relaxed text-rose-600">


                  {changePasswordError}


                </div>


              )}


              <div>


                <label className="mb-1.5 block text-[11px] font-bold text-stone-700">


                  {isForcedPasswordChange
                    ? "Mật khẩu tạm hiện tại"
                    : "Mật khẩu hiện tại"}


                </label>


                <div className="relative">


                  <input
                    type={showPasswordFields ? "text" : "password"}
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => {


                      setCurrentPassword(e.target.value);


                      if (changePasswordError) {


                        setChangePasswordError("");


                      }


                    }}
                    placeholder={
                      isForcedPasswordChange
                        ? "Nhập mật khẩu tạm Anvami đã cấp"
                        : "Nhập mật khẩu hiện tại"
                    }
                    disabled={changePasswordLoading}
                    className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-3.5 py-3 pr-16 text-sm font-semibold text-stone-800 outline-none transition placeholder:font-normal placeholder:text-stone-300 focus:border-[#ee4d2d] focus:bg-white focus:ring-2 focus:ring-orange-100 disabled:opacity-60"
                    required
                  />


                  <button
                    type="button"
                    onClick={() =>
                      setShowPasswordFields((value) => !value)
                    }
                    className="absolute inset-y-0 right-3 my-auto h-fit text-[10px] font-bold text-stone-400 transition hover:text-[#ee4d2d]"
                  >


                    {showPasswordFields ? "Ẩn" : "Hiện"}


                  </button>


                </div>


              </div>


              <div>


                <label className="mb-1.5 block text-[11px] font-bold text-stone-700">


                  Mật khẩu mới


                </label>


                <input
                  type={showPasswordFields ? "text" : "password"}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => {


                    setNewPassword(e.target.value);


                    if (changePasswordError) {


                      setChangePasswordError("");


                    }


                  }}
                  placeholder="Tối thiểu 6 ký tự"
                  disabled={changePasswordLoading}
                  className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-3.5 py-3 text-sm font-semibold text-stone-800 outline-none transition placeholder:font-normal placeholder:text-stone-300 focus:border-[#ee4d2d] focus:bg-white focus:ring-2 focus:ring-orange-100 disabled:opacity-60"
                  required
                />


              </div>


              <div>


                <label className="mb-1.5 block text-[11px] font-bold text-stone-700">


                  Nhập lại mật khẩu mới


                </label>


                <input
                  type={showPasswordFields ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmNewPassword}
                  onChange={(e) => {


                    setConfirmNewPassword(e.target.value);


                    if (changePasswordError) {


                      setChangePasswordError("");


                    }


                  }}
                  placeholder="Nhập lại mật khẩu mới"
                  disabled={changePasswordLoading}
                  className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-3.5 py-3 text-sm font-semibold text-stone-800 outline-none transition placeholder:font-normal placeholder:text-stone-300 focus:border-[#ee4d2d] focus:bg-white focus:ring-2 focus:ring-orange-100 disabled:opacity-60"
                  required
                />


              </div>


              <div className="rounded-2xl border border-orange-100 bg-orange-50/60 p-3.5">


                <p className="text-[10px] font-bold text-stone-700">


                  Gợi ý bảo mật


                </p>


                <ul className="mt-1.5 space-y-1 text-[9px] leading-relaxed text-stone-500">


                  <li>• Mật khẩu phải có ít nhất 6 ký tự.</li>


                  <li>• Không sử dụng lại mật khẩu tạm được Anvami cấp.</li>


                  <li>• Không chia sẻ mật khẩu với nhân viên hỗ trợ hoặc người khác.</li>


                </ul>


              </div>


              <button
                type="submit"
                disabled={changePasswordLoading}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#ff6a00] to-[#ee4d2d] py-3.5 text-xs font-black uppercase tracking-wide text-white shadow-lg shadow-orange-500/20 transition hover:brightness-95 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55"
              >


                {changePasswordLoading ? (


                  <>


                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-white" />


                    Đang cập nhật...


                  </>


                ) : (


                  "Đổi mật khẩu"


                )}


              </button>


              {isForcedPasswordChange && (


                <button
                  type="button"
                  disabled={changePasswordLoading}
                  onClick={handleSignOut}
                  className="w-full py-2 text-[10px] font-bold text-stone-400 transition hover:text-rose-500 disabled:opacity-50"
                >


                  Đăng xuất tài khoản


                </button>


              )}


            </form>


          )}


        </div>


      </div>


    )}


    {/* MODAL CHỌN VỊ TRÍ TRÊN BẢN ĐỒ */}


      {showMapModal && (


        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">


          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl flex flex-col h-[520px] overflow-hidden border border-stone-200">


            <div className="p-4 border-b border-stone-100 bg-stone-50 flex items-center justify-between">


              <div>


                <h3 className="font-bold text-stone-800 text-sm uppercase tracking-wide">


                  🗺️ Chọn vị trí giao hàng trên bản đồ


                </h3>


                <p className="text-[11px] text-stone-500">Chạm hoặc click trực tiếp lên bản đồ để đặt ghim vị trí nhà bạn</p>


              </div>


              <button


                type="button"


                onClick={() => setShowMapModal(false)}


                className="w-8 h-8 rounded-full bg-stone-200/60 text-stone-600 hover:bg-stone-300 font-bold flex items-center justify-center text-sm transition cursor-pointer"


              >


                ✕


              </button>


            </div>


            <div className="flex-1 relative z-0">


              <MapComponent


                lat={tempCoords.lat}


                lng={tempCoords.lng}


                onSelect={(lat, lng) => setTempCoords({ lat, lng })}


              />


            </div>


            <div className="p-3.5 border-t border-stone-100 bg-stone-50 flex items-center justify-between gap-3">


              <span className="text-[11px] font-mono text-stone-600 truncate">


                Tọa độ chọn: {tempCoords.lat.toFixed(5)}, {tempCoords.lng.toFixed(5)}


              </span>


              <button


                type="button"


                onClick={handleConfirmMapLocation}


                className="bg-gradient-to-r from-[#ff6a00] to-[#ee4d2d] hover:brightness-95 text-white font-bold px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider transition active:scale-98 cursor-pointer shrink-0"


              >


                Xác nhận vị trí này


              </button>


            </div>


          </div>


        </div>


      )}


      {/* MODAL ĐIỀU KHOẢN SỬ DỤNG */}


      {showTermsModal && (


        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">


          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden border border-stone-200">


            <div className="p-4 border-b border-stone-100 bg-stone-50 flex items-center justify-between">


              <div className="flex items-center gap-2">


                <span className="text-lg">📜</span>


                <h3 className="font-bold text-stone-800 text-sm uppercase tracking-wide">


                  Điều khoản dịch vụ Sàn TMĐT Chợ Online


                </h3>


              </div>


              <button


                type="button"


                onClick={() => setShowTermsModal(false)}


                className="w-8 h-8 rounded-full bg-stone-200/60 text-stone-600 hover:bg-stone-300 font-bold flex items-center justify-center text-sm transition cursor-pointer"


              >


                ✕


              </button>


            </div>


            <div className="p-4 overflow-y-auto space-y-4 text-xs text-stone-600 leading-relaxed">


              <p className="font-medium text-stone-700 italic">


                Chào mừng bạn đến với Sàn thương mại điện tử <strong>Chợ Online</strong>. Bằng việc đăng ký tài khoản và mua hàng trên hệ thống, bạn cam kết đã đọc, hiểu và đồng ý tuân thủ toàn bộ các điều khoản dưới đây.


              </p>


              <div>


                <h4 className="font-bold text-stone-800 text-xs mb-1">1. Tài khoản & Bảo mật</h4>


                <p>


                  - Người dùng phải cung cấp thông tin chính xác về Họ tên, Số điện thoại và Địa chỉ giao hàng.<br />


                  - Bạn có trách nhiệm bảo mật thông tin đăng nhập và chịu trách nhiệm cho mọi hoạt động phát sinh từ tài khoản của mình.


                </p>


              </div>


              <div>


                <h4 className="font-bold text-stone-800 text-xs mb-1">2. Đặt hàng & Xác nhận đơn hàng</h4>


                <p>


                  - Đơn hàng chỉ được coi là xác nhận thành công sau khi hệ thống thông báo trạng thái "Đã tiếp nhận" hoặc "Cửa hàng xác nhận".<br />


                  - Chợ Online có quyền hủy đơn trong trường hợp sản phẩm hết hàng, sai giá niêm yết do lỗi kỹ thuật hoặc không liên lạc được với người nhận.


                </p>


              </div>


              <div>


                <h4 className="font-bold text-stone-800 text-xs mb-1">3. Giá cả & Thanh toán</h4>


                <p>


                  - Giá hiển thị trên sàn là giá bán cuối cùng đã bao gồm thuế (nếu có). Phí vận chuyển sẽ được tính dựa trên khoảng cách GPS thực tế.<br />


                  - Hỗ trợ các hình thức thanh toán: Tiền mặt khi nhận hàng (COD), Ví điện tử hoặc Chuyển khoản ngân hàng trực tuyến.


                </p>


              </div>


              <div>


                <h4 className="font-bold text-stone-800 text-xs mb-1">4. Chính sách Giao hàng & Kiểm hàng</h4>


                <p>


                  - Người mua có quyền kiểm tra tình trạng bên ngoài của sản phẩm ngay khi Shipper giao đến.<br />


                  - Đối với mặt hàng tươi sống, hoa quả, nước ép: Nếu sản phẩm bị dập nát, hư hỏng hoặc không đúng mô tả, khách hàng có quyền từ chối nhận hàng.


                </p>


              </div>


              <div>


                <h4 className="font-bold text-stone-800 text-xs mb-1">5. Chính sách Đổi trả & Hoàn tiền</h4>


                <p>


                  - Hỗ trợ đổi trả/hoàn tiền trong vòng 24h kể từ khi nhận hàng đối với sản phẩm bị lỗi chất lượng hoặc hỏng hóc do vận chuyển.<br />


                  - Tiền hoàn sẽ được chuyển về Tài khoản ngân hàng mà bạn đã cập nhật trong phần Hồ sơ tài khoản.


                </p>


              </div>


            </div>


            <div className="p-3.5 border-t border-stone-100 bg-stone-50 flex justify-end">


              <button


                type="button"


                onClick={() => setShowTermsModal(false)}


                className="w-full bg-gradient-to-r from-[#ff6a00] to-[#ee4d2d] hover:brightness-95 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition active:scale-98 cursor-pointer"


              >


                Tôi đã hiểu & Đồng ý


              </button>


            </div>


          </div>


        </div>


      )}


    </div>


  );


}