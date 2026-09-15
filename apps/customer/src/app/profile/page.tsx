"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@cho-online/firebase";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import dynamic from "next/dynamic";

// Khai báo dynamic import component bản đồ Leaflet để tránh lỗi SSR (window is not defined) trong Next.js
const MapComponent = dynamic(() => import("./MapComponent"), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center bg-stone-100 text-xs text-stone-500 font-medium">
      Đang tải bản đồ tương tác...
    </div>
  ),
});

type AddressType = "home" | "office";

// Danh sách các ngân hàng phổ biến tại Việt Nam theo chuẩn VietQR
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

  // 🎁 State lưu trữ số điểm đã tích lũy
  const [points, setPoints] = useState<number>(0);

  // State quản lý Modal Điều khoản sử dụng
  const [showTermsModal, setShowTermsModal] = useState(false);

  // 🗺️ State quản lý Modal Chọn Bản Đồ trực tiếp
  const [showMapModal, setShowMapModal] = useState(false);
  const [tempCoords, setTempCoords] = useState<{ lat: number; lng: number }>({
    lat: 18.33722,
    lng: 105.90153,
  });

  // State quản lý Toast thông báo
  const [toast, setToast] = useState<Toast | null>(null);

  // Thông tin liên hệ
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  // Phân rã địa chỉ theo chuẩn Quán Cafe Chill
  const [province, setProvince] = useState("Hà Tĩnh");
  const [district, setDistrict] = useState("Thành Sen");
  const [ward, setWard] = useState("");
  const [streetAddress, setStreetAddress] = useState("75 Hải Thượng Lãn Ông");
  const [addressType, setAddressType] = useState<AddressType>("home");
  const [isDefault, setIsDefault] = useState(true);

  // 🏦 Thông tin Tài khoản Ngân hàng Hoàn tiền
  const [bankCode, setBankCode] = useState("MB");
  const [bankAccount, setBankAccount] = useState("");
  const [bankOwner, setBankOwner] = useState("");

  // Tọa độ GPS (Tọa độ quán Cafe Chill mặc định)
  const [coords, setCoords] = useState<{ lat: number | null; lng: number | null }>({
    lat: 18.33722,
    lng: 105.90153,
  });

  const [saving, setSaving] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);

  const isFirstLoad = useRef(true);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  // Hàm reset dữ liệu theo mặc định địa chỉ quán
  const resetFormState = () => {
    setFullName("");
    setPhone("");
    setPoints(0);
    setProvince("Hà Tĩnh");
    setDistrict("Thành Sen");
    setWard("");
    setStreetAddress("75 Hải Thượng Lãn Ông");
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

            // 🎁 LẤY SỐ ĐIỂM TÍCH LŨY
            setPoints(data.points || 0);

            // 🏦 LẤY THÔNG TIN NGÂN HÀNG HOÀN TIỀN
            if (data.refundBankInfo) {
              setBankCode(data.refundBankInfo.bankCode || "MB");
              setBankAccount(data.refundBankInfo.bankAccount || "");
              setBankOwner(data.refundBankInfo.bankOwner || "");
            }

            if (data.addressDetails) {
              setProvince(data.addressDetails.province || "Hà Tĩnh");
              setDistrict(data.addressDetails.district || "Thành Sen");
              setWard(data.addressDetails.ward || "");
              setStreetAddress(data.addressDetails.streetAddress || "75 Hải Thượng Lãn Ông");
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

  // ✅ Ghép chuỗi địa chỉ đầy đủ sạch đẹp, không lặp lại
  const getFullAddressString = () => {
    const parts = [streetAddress.trim(), ward.trim(), district.trim(), province.trim()].filter(Boolean);
    return parts.join(", ");
  };

  // Tự động tìm tọa độ khi người dùng nhập địa chỉ tay
  const fetchCoordsFromAddress = async (searchQuery: string) => {
    if (!searchQuery || searchQuery.trim().length < 5) return;

    try {
      setIsSearchingAddress(true);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`
      );
      const data = await res.json();

      if (data && data.length > 0) {
        setCoords({
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
        });
      }
    } catch (err) {
      console.warn("Lỗi tìm tọa độ:", err);
    } finally {
      setIsSearchingAddress(false);
    }
  };

  useEffect(() => {
    if (loading || !user) return;

    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      return;
    }

    const fullAddr = getFullAddressString();
    if (!fullAddr || fullAddr.trim().length < 5) return;

    const timer = setTimeout(() => {
      fetchCoordsFromAddress(fullAddr);
    }, 800);

    return () => clearTimeout(timer);
  }, [province, district, ward, streetAddress]);

  // ✅ CẬP NHẬT TỌA ĐỘ GPS HIỆN TẠI
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      showToast("Trình duyệt không hỗ trợ định vị GPS!", "error");
      return;
    }

    setIsLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        setCoords({ lat, lng });
        setIsLocating(false);
        showToast("📍 Đã cập nhật tọa độ GPS thành công!", "success");
      },
      (error) => {
        console.warn("Lỗi vị trí GPS:", error.code, error.message);

        let errorMsg = "Không thể lấy vị trí. Vui lòng bật GPS!";
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = "Bạn đã từ chối quyền truy cập vị trí trên trình duyệt!";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMsg = "Thông tin vị trí hiện không khả dụng!";
        } else if (error.code === error.TIMEOUT) {
          errorMsg = "Hết thời gian chờ phản hồi GPS!";
        }

        showToast(errorMsg, "error");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // 🗺️ Mở Modal bản đồ chọn vị trí
  const openMapPickerModal = () => {
    setTempCoords({
      lat: coords.lat || 18.33722,
      lng: coords.lng || 105.90153,
    });
    setShowMapModal(true);
  };

  // 🗺️ Xác nhận vị trí từ Modal Bản Đồ
  const handleConfirmMapLocation = () => {
    setCoords(tempCoords);
    setShowMapModal(false);
    showToast("📍 Đã chốt vị trí trên bản đồ thành công!", "success");
  };

  const handleSaveInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    try {
      const fullAddress = getFullAddressString();
      const selectedBank = VIETNAM_BANKS.find((b) => b.code === bankCode);

      const profileData = {
        fullName,
        phone,
        address: fullAddress,
        addressDetails: {
          province,
          district,
          ward,
          streetAddress,
          addressType,
          isDefault,
        },
        // 🏦 Lưu cấu hình hoàn tiền
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
          <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-semibold text-stone-500">Đang tải hồ sơ...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto p-6 text-center space-y-4 my-10">
        <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center text-2xl mx-auto">
          👤
        </div>
        <h2 className="text-base font-bold text-stone-800">Bạn chưa đăng nhập</h2>
        <p className="text-xs text-stone-500">
          Vui lòng đăng nhập để lưu địa chỉ và trải nghiệm mua sắm nhanh chóng hơn.
        </p>
        <button
          type="button"
          onClick={() => router.push("/login?redirectTo=/profile")}
          className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-wider shadow-sm active:scale-98 transition cursor-pointer"
        >
          Đăng nhập ngay
        </button>
      </div>
    );
  }

  return (
    <div className="bg-stone-100 min-h-screen py-6 px-3 relative">
      {/* UI TOAST THÔNG BÁO */}
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
          <div className="w-12 h-12 bg-emerald-600 text-white font-bold text-lg rounded-full flex items-center justify-center shrink-0 shadow-xs">
            {fullName ? fullName.charAt(0).toUpperCase() : "U"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-stone-800 text-sm truncate">
                {fullName || "Thành viên Chợ Online"}
              </h3>
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0">
                ✓ Đã xác thực
              </span>
            </div>
            <p className="text-xs text-stone-500 truncate mt-0.5">
              {user.email || user.phoneNumber || "Khách hàng thân thiết"}
            </p>
          </div>
        </div>

        {/* 🎁 THẺ ĐIỂM THƯỞNG */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-4 rounded-2xl shadow-md space-y-3 relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 text-emerald-500/20 text-8xl font-black select-none pointer-events-none">
            🎁
          </div>
          <div className="flex items-center justify-between relative z-10">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-100 flex items-center gap-1.5">
              <span>🌟</span> Điểm thưởng tích lũy
            </span>
            <span className="bg-white/20 backdrop-blur-md text-[10px] px-2 py-0.5 rounded-full font-medium">
              1 điểm = 1 VNĐ
            </span>
          </div>

          <div className="flex items-baseline justify-between relative z-10">
            <div>
              <span className="text-3xl font-black tracking-tight">{points.toLocaleString("vi-VN")}</span>
              <span className="text-xs text-emerald-100 font-medium ml-1.5">điểm</span>
            </div>
            <p className="text-xs font-bold text-emerald-200 bg-black/10 px-2.5 py-1 rounded-xl">
              Tương đương: {formatCurrency(points)}
            </p>
          </div>

          <p className="text-[11px] text-emerald-100/90 relative z-10 pt-1 border-t border-emerald-500/40">
            💡 Dùng điểm này để làm mã giảm giá trừ trực tiếp vào đơn hàng khi thanh toán.
          </p>
        </div>

        {/* FORM THÔNG TIN THANH TOÁN VÀ ĐỊA CHỈ */}
        <form onSubmit={handleSaveInfo} className="bg-white rounded-2xl border border-stone-200/80 shadow-2xs overflow-hidden">
          <div className="px-4 py-3.5 border-b border-stone-100 bg-stone-50/50 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold text-xs text-stone-800 uppercase tracking-wide flex items-center gap-1.5">
              <span className="text-emerald-600">📍</span> Địa chỉ & Tài khoản nhận tiền
            </h2>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleGetCurrentLocation}
                disabled={isLocating}
                className="text-[11px] text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 active:scale-95 transition disabled:opacity-50"
              >
                📍 {isLocating ? "Đang lấy..." : "GPS hiện tại"}
              </button>
              <button
                type="button"
                onClick={openMapPickerModal}
                className="text-[11px] text-white bg-emerald-600 hover:bg-emerald-700 font-semibold px-2.5 py-1 rounded-lg shadow-xs active:scale-95 transition"
              >
                🗺️ Chọn bản đồ
              </button>
            </div>
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
                  className="w-full bg-stone-50 px-3 py-2.5 rounded-xl border border-stone-200 outline-none focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 font-medium transition"
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
                  className="w-full bg-stone-50 px-3 py-2.5 rounded-xl border border-stone-200 outline-none focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 font-medium transition"
                />
              </div>
            </div>

            {/* TỈNH / HUYỆN / XÃ */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="font-semibold text-stone-700 block mb-1">
                  Tỉnh / Thành <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Tỉnh/TP"
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  className="w-full bg-stone-50 px-2.5 py-2.5 rounded-xl border border-stone-200 outline-none focus:bg-white focus:border-emerald-600 font-medium transition"
                />
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1">
                  Quận / Huyện <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Quận/Huyện"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full bg-stone-50 px-2.5 py-2.5 rounded-xl border border-stone-200 outline-none focus:bg-white focus:border-emerald-600 font-medium transition"
                />
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1">
                  Phường / Xã
                </label>
                <input
                  type="text"
                  placeholder="Phường/Xã"
                  value={ward}
                  onChange={(e) => setWard(e.target.value)}
                  className="w-full bg-stone-50 px-2.5 py-2.5 rounded-xl border border-stone-200 outline-none focus:bg-white focus:border-emerald-600 font-medium transition"
                />
              </div>
            </div>

            {/* ĐỊA CHỈ CHI TIẾT */}
            <div>
              <label className="font-semibold text-stone-700 block mb-1">
                Địa chỉ chi tiết <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={2}
                required
                placeholder="Số nhà, tên đường, thôn/xóm, tên tòa nhà..."
                value={streetAddress}
                onChange={(e) => setStreetAddress(e.target.value)}
                className="w-full bg-stone-50 p-3 rounded-xl border border-stone-200 outline-none focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 font-medium transition resize-none"
              />
              <p className="text-[10px] text-stone-400 mt-1">
                💡 Hãy ghi rõ số nhà, ngõ/ngách để shipper giao hàng chính xác nhất.
              </p>
            </div>

            {/* TRẠNG THÁI TỌA ĐỘ GPS / BẢN ĐỒ */}
            <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200/60 flex items-center justify-between text-[11px]">
              {isSearchingAddress ? (
                <span className="text-amber-600 font-medium animate-pulse flex items-center gap-1">
                  <span>⏳</span> Đang khớp tọa độ bản đồ...
                </span>
              ) : coords.lat && coords.lng ? (
                <span className="text-emerald-600 font-semibold flex items-center gap-1">
                  <span>✓ Tọa độ bản đồ:</span>
                  <span className="font-mono bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
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
                        ? "border-emerald-600 bg-emerald-50 text-emerald-700"
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
                        ? "border-emerald-600 bg-emerald-50 text-emerald-700"
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
                  className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                />
              </div>
            </div>

            {/* 🏦 MỤC CẤU HÌNH NGÂN HÀNG HOÀN TIỀN */}
            <div className="pt-3 border-t border-stone-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <label className="font-bold text-stone-800 text-xs flex items-center gap-1.5">
                  <span className="text-emerald-600">🏦</span> Tài khoản nhận hoàn tiền
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
                    className="w-full bg-stone-50 px-3 py-2.5 rounded-xl border border-stone-200 outline-none focus:bg-white focus:border-emerald-600 font-medium transition cursor-pointer"
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
                    className="w-full bg-stone-50 px-3 py-2.5 rounded-xl border border-stone-200 outline-none focus:bg-white focus:border-emerald-600 font-mono transition"
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
                    className="w-full bg-stone-50 px-3 py-2.5 rounded-xl border border-stone-200 outline-none focus:bg-white focus:border-emerald-600 font-medium transition uppercase"
                  />
                </div>
              </div>
            </div>

            {/* BUTTON SUBMIT */}
            <button
              type="submit"
              disabled={saving || isSearchingAddress}
              className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-wider transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              {saving ? "Đang lưu..." : "Lưu thông tin hồ sơ"}
            </button>
          </div>
        </form>

        {/* NÚT XEM ĐIỀU KHOẢN */}
        <div className="bg-white p-3.5 rounded-2xl border border-stone-200/80 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">📜</span>
            <div>
              <p className="font-bold text-stone-800 text-xs">Điều khoản & Quy chế Sàn TMĐT</p>
              <p className="text-[10px] text-stone-500">Quyền lợi, nghĩa vụ và chính sách mua hàng</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowTermsModal(true)}
            className="px-3 py-1.5 bg-stone-100 hover:bg-emerald-50 hover:text-emerald-700 text-stone-700 font-semibold text-[11px] rounded-xl border border-stone-200 transition cursor-pointer active:scale-95"
          >
            Xem ngay
          </button>
        </div>

        {/* NÚT ĐĂNG XUẤT */}
        <button
          type="button"
          onClick={handleSignOut}
          className="w-full bg-white hover:bg-rose-50 text-rose-600 font-bold py-3 rounded-2xl border border-stone-200/80 text-xs transition active:scale-98 shadow-2xs cursor-pointer"
        >
          🚪 Đăng xuất tài khoản
        </button>
      </div>

      {/* 🗺️ MODAL CHỌN VỊ TRÍ TRÊN BẢN ĐỒ */}
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

            {/* Vùng chứa bản đồ Leaflet động */}
            <div className="flex-1 relative z-0">
              <MapComponent
                lat={tempCoords.lat}
                lng={tempCoords.lng}
                onSelect={(lat, lng) => setTempCoords({ lat, lng })}
              />
            </div>

            {/* Footer Modal bản đồ */}
            <div className="p-3.5 border-t border-stone-100 bg-stone-50 flex items-center justify-between gap-3">
              <span className="text-[11px] font-mono text-stone-600 truncate">
                Tọa độ chọn: {tempCoords.lat.toFixed(5)}, {tempCoords.lng.toFixed(5)}
              </span>
              <button
                type="button"
                onClick={handleConfirmMapLocation}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider transition active:scale-98 cursor-pointer shrink-0"
              >
                Xác nhận vị trí này
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📜 MODAL ĐIỀU KHOẢN SỬ DỤNG */}
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
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition active:scale-98 cursor-pointer"
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