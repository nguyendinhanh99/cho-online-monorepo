"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/services/firebase";
import {
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs
} from "firebase/firestore";
import {
  signOut,
  onAuthStateChanged,
  updateProfile,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  User
} from "firebase/auth";

import { NotificationsModal } from "./NotificationsModal";
import MapComponent from "./MapComponent"; // 🗺️ Import component bản đồ của bạn

// 🇻🇳 HELPER CHUẨN HÓA VÀ LÀM SẠCH ĐỊA CHỈ TIẾNG VIỆT
const cleanVietnameseAddress = (rawAddress: string) => {
  if (!rawAddress) return "";
  return rawAddress
    .replace(/\bWard\b/gi, "Phường")
    .replace(/\bProvince\b/gi, "Tỉnh")
    .replace(/\bDistrict\b/gi, "Quận/Huyện")
    .replace(/\bCity\b/gi, "Thành phố")
    .replace(/\bVietnam\b/gi, "Việt Nam")
    .replace(/\s+/g, " ")
    .trim();
};

interface AccountTabProps {
  onLogout?: () => void;
}

type AccountStatus = "PENDING" | "APPROVED" | "REJECTED" | "BLOCKED" | string;

interface ToastState {
  message: string;
  type: "success" | "error" | "info";
}

// 🏷️ DANH MỤC LOẠI HÌNH KINH DOANH
const CATEGORY_OPTIONS = [
  { id: "FNB", label: "Ăn uống, quán ăn, cafe, trà sữa", icon: "🍔" },
  { id: "CONSUMER_GOODS", label: "Đồ gia dụng / Điện tử", icon: "🔌" },
  { id: "FASHION", label: "Thời trang, quần áo, phụ kiện", icon: "👕" },
];

export default function AccountTab({ onLogout }: AccountTabProps) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [togglingOpenStatus, setTogglingOpenStatus] = useState(false);

  const [toast, setToast] = useState<ToastState | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // 🔔 STATE SỐ LƯỢNG THÔNG BÁO CHƯA ĐỌC
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // 🌟 STATE LƯU ĐÁNH GIÁ CỦA CỬA HÀNG
  const [shopRating, setShopRating] = useState<number>(5.0);
  const [reviewCount, setReviewCount] = useState<number>(0);

  // 🗺️ STATE MODAL BẢN ĐỒ & TỌA ĐỘ
  const [showMapModal, setShowMapModal] = useState(false);
  const [tempLat, setTempLat] = useState<number>(18.3559); // Mặc định Hà Tĩnh
  const [tempLng, setTempLng] = useState<number>(105.8980);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [changingPassLoading, setChangingPassLoading] = useState(false);

  const [storeInfo, setStoreInfo] = useState({
    merchantCode: "",
    avatarUrl: "",
    phone: "",
    ownerName: "",
    storeName: "",
    category: "FNB",
    taxCode: "",
    address: "",
    shipperNote: "", // 🚚 Ô bổ sung ghi chú chi tiết cho shipper
    identityCardNumber: "",
    status: "APPROVED" as AccountStatus,
    blockReason: "",
    isOpen: true,
    openTime: "07:00",
    closeTime: "22:00",
    pickupLocation: {
      latitude: null as number | null,
      longitude: null as number | null,
    },
  });

  const [tempInfo, setTempInfo] = useState({ ...storeInfo });

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const isWithinOperatingHours = () => {
    if (!storeInfo.openTime || !storeInfo.closeTime) return true;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [openH, openM] = storeInfo.openTime.split(":").map(Number);
    const [closeH, closeM] = storeInfo.closeTime.split(":").map(Number);

    const openMinutes = openH * 60 + openM;
    const closeMinutes = closeH * 60 + closeM;

    if (openMinutes <= closeMinutes) {
      return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
    } else {
      return currentMinutes >= openMinutes || currentMinutes <= closeMinutes;
    }
  };

  const inOperatingHours = isWithinOperatingHours();

  // 🌟 HÀM TÍNH TRUNG BÌNH SAO VÀ ĐÁNH GIÁ TỪ FIRESTORE
  const fetchShopReviews = async (merchantCode: string, merchantUid: string) => {
    try {
      const reviewsRef = collection(db, "reviews");

      let q = query(reviewsRef, where("merchantCode", "==", merchantCode));
      let querySnapshot = await getDocs(q);

      if (querySnapshot.empty && merchantUid) {
        q = query(reviewsRef, where("merchantId", "==", merchantUid));
        querySnapshot = await getDocs(q);
      }

      if (!querySnapshot.empty) {
        let total = 0;
        let count = 0;

        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const r = Number(data.rating ?? data.productRating ?? 0);
          if (r > 0) {
            total += r;
            count += 1;
          }
        });

        if (count > 0) {
          setShopRating(Number((total / count).toFixed(1)));
          setReviewCount(count);
          return;
        }
      }

      setShopRating(5.0);
      setReviewCount(0);
    } catch (error) {
      console.warn("Lỗi tính lượt đánh giá:", error);
      setShopRating(5.0);
      setReviewCount(0);
    }
  };

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;
    let unsubscribeNotif: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        const docRef = doc(db, "merchants", user.uid);

        unsubscribeSnapshot = onSnapshot(
          docRef,
          (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();

              const lat = data.pickupLocation?.latitude ?? data.location?.latitude ?? data.lat ?? null;
              const lng = data.pickupLocation?.longitude ?? data.location?.longitude ?? data.lng ?? null;

              let rawCat = data.businessCategory || data.category || "FNB";
              if (rawCat === "F&B") rawCat = "FNB";

              const fetchedInfo = {
                merchantCode: data.merchantCode || "",
                avatarUrl: data.avatarUrl || data.avatar || user.photoURL || "",
                phone: data.phone || data.phoneNumber || user.phoneNumber || user.email || "",
                ownerName: data.fullName || data.ownerName || user.displayName || "",
                storeName: data.shopName || data.storeName || data.name || "",
                category: rawCat,
                taxCode: data.taxCode || "",
                address: cleanVietnameseAddress(data.address || ""),
                shipperNote: data.shipperNote || "", // 🚚 Đọc trường shipperNote từ Firestore
                identityCardNumber: data.identityCardNumber || data.idCardNumber || "",
                status: (data.status as AccountStatus) || "APPROVED",
                blockReason: data.blockReason || "",
                isOpen: data.isOpen !== undefined ? data.isOpen : true,
                openTime: data.openTime || "07:00",
                closeTime: data.closeTime || "22:00",
                pickupLocation: {
                  latitude: lat,
                  longitude: lng,
                },
              };

              setStoreInfo((prev) => {
                if (prev.status !== "BLOCKED" && fetchedInfo.status === "BLOCKED") {
                  showToast("Tài khoản của bạn vừa bị Admin tạm khóa!", "error");
                }
                return fetchedInfo;
              });

              setTempInfo(fetchedInfo);

              if (data.rating !== undefined && data.rating !== null) {
                setShopRating(Number(data.rating));
                setReviewCount(data.reviewCount || 0);
              } else {
                fetchShopReviews(data.merchantCode || "", user.uid);
              }
            } else {
              const defaultInfo = {
                merchantCode: "",
                avatarUrl: user.photoURL || "",
                phone: user.email || "",
                ownerName: user.displayName || "",
                storeName: "",
                category: "FNB",
                taxCode: "",
                address: "",
                shipperNote: "",
                identityCardNumber: "",
                status: "PENDING" as AccountStatus,
                blockReason: "",
                isOpen: true,
                openTime: "07:00",
                closeTime: "22:00",
                pickupLocation: { latitude: null, longitude: null },
              };
              setStoreInfo(defaultInfo);
              setTempInfo(defaultInfo);
            }
            setLoading(false);
          },
          (error) => {
            console.warn("Lỗi lắng nghe Firestore real-time:", error);
            setLoading(false);
          }
        );

        const notifRef = collection(db, "notifications");
        const qNotif = query(
          notifRef,
          where("targetUserId", "==", user.uid),
          where("isRead", "==", false)
        );

        unsubscribeNotif = onSnapshot(
          qNotif,
          (snapshot) => {
            setUnreadCount(snapshot.size);
          },
          (err) => {
            console.warn("Lỗi lắng nghe số lượng thông báo:", err);
          }
        );
      } else {
        setCurrentUser(null);
        setUnreadCount(0);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
      if (unsubscribeNotif) unsubscribeNotif();
    };
  }, []);

  // 🗺️ HÀM LẤY ĐỊA CHỈ TỪ TỌA ĐỘ KHI CHỌN XONG TRÊN MAP
  const fetchAddressFromCoords = async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=vi`
      );
      const data = await res.json();
      if (data && data.display_name) {
        return cleanVietnameseAddress(data.display_name);
      }
    } catch (err) {
      console.warn("Lỗi quy đổi tọa độ:", err);
    }
    return "";
  };

  const handleToggleStoreOpen = async () => {
    if (!currentUser) return;

    if (storeInfo.status !== "APPROVED") {
      showToast("Tài khoản chưa được phê duyệt hoặc đang bị khóa!", "error");
      return;
    }

    const newIsOpen = !storeInfo.isOpen;

    try {
      setTogglingOpenStatus(true);
      const docRef = doc(db, "merchants", currentUser.uid);

      await updateDoc(docRef, {
        isOpen: newIsOpen,
        updatedAt: new Date(),
      });

      showToast(newIsOpen ? "Cửa hàng đã BẬT nhận đơn! 🟢" : "Cửa hàng đã TẠM NGHỈ nhận đơn! 🔴", "success");
    } catch (error) {
      console.warn("Lỗi cập nhật trạng thái mở cửa:", error);
      showToast("Không thể thay đổi trạng thái cửa hàng!", "error");
    } finally {
      setTogglingOpenStatus(false);
    }
  };

  const handleOpenEdit = () => {
    setTempInfo({ ...storeInfo });
    setTempLat(storeInfo.pickupLocation.latitude || 18.3559);
    setTempLng(storeInfo.pickupLocation.longitude || 105.8980);
    setIsEditing(true);
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const CLOUD_NAME = "lfqjrcvh";
    const UPLOAD_PRESET = "ml_default";

    try {
      setUploadingAvatar(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", UPLOAD_PRESET);

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        { method: "POST", body: formData }
      );

      const data = await res.json();
      if (data.secure_url) {
        setTempInfo((prev) => ({ ...prev, avatarUrl: data.secure_url }));
        showToast("Đã tải ảnh mới! Nhấn Lưu để hoàn tất.", "success");
      } else {
        showToast("Lỗi tải ảnh lên Cloudinary!", "error");
      }
    } catch (error) {
      console.warn("Lỗi upload:", error);
      showToast("Không thể tải ảnh đại diện lên!", "error");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    try {
      setSaving(true);
      const docRef = doc(db, "merchants", currentUser.uid);
      const cleanedAddr = cleanVietnameseAddress(tempInfo.address);

      await setDoc(
        docRef,
        {
          avatarUrl: tempInfo.avatarUrl,
          avatar: tempInfo.avatarUrl,
          phone: tempInfo.phone,
          phoneNumber: tempInfo.phone,
          fullName: tempInfo.ownerName,
          ownerName: tempInfo.ownerName,
          shopName: tempInfo.storeName,
          storeName: tempInfo.storeName,
          category: tempInfo.category,
          businessCategory: tempInfo.category,
          identityCardNumber: tempInfo.identityCardNumber,
          taxCode: tempInfo.taxCode,
          address: cleanedAddr,
          shipperNote: tempInfo.shipperNote, // 🚚 Lưu trường ghi chú cho shipper lên Firestore
          openTime: tempInfo.openTime,
          closeTime: tempInfo.closeTime,
          pickupLocation: tempInfo.pickupLocation.latitude && tempInfo.pickupLocation.longitude
            ? {
              latitude: tempInfo.pickupLocation.latitude,
              longitude: tempInfo.pickupLocation.longitude,
            }
            : null,
          lat: tempInfo.pickupLocation.latitude,
          lng: tempInfo.pickupLocation.longitude,
          updatedAt: new Date(),
        },
        { merge: true }
      );

      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: tempInfo.storeName,
          photoURL: tempInfo.avatarUrl,
        });
      }

      setIsEditing(false);
      showToast("Cập nhật thông tin thành công! ✨", "success");
    } catch (error) {
      console.warn("Lỗi cập nhật Firestore:", error);
      showToast("Đã xảy ra lỗi khi lưu thông tin!", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !currentUser.email) return;

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showToast("Mật khẩu mới không khớp!", "error");
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      showToast("Mật khẩu mới phải từ 6 ký tự trở lên!", "error");
      return;
    }

    try {
      setChangingPassLoading(true);

      const credential = EmailAuthProvider.credential(currentUser.email, passwordForm.currentPassword);
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, passwordForm.newPassword);

      setIsChangingPassword(false);
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      showToast("Đổi mật khẩu thành công! 🔒", "success");
    } catch (error: any) {
      console.warn("Lỗi đổi mật khẩu:", error);
      if (error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
        showToast("Mật khẩu hiện tại không chính xác!", "error");
      } else {
        showToast("Lỗi: " + (error.message || "Không thể đổi mật khẩu"), "error");
      }
    } finally {
      setChangingPassLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      sessionStorage.clear();
      if (onLogout) onLogout();
      else router.push("/login");
    } catch (error) {
      showToast("Đã xảy ra lỗi khi đăng xuất!", "error");
    }
  };

  const getCategoryLabel = (catId: string) => {
    const found = CATEGORY_OPTIONS.find((c) => c.id === catId);
    return found ? `${found.icon} ${found.label}` : "🍔 Ăn uống, quán ăn, cafe, trà sữa";
  };

  if (loading) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-stone-100 shadow-sm text-center text-xs text-stone-400 animate-pulse max-w-lg mx-auto">
        Đang tải thông tin cửa hàng...
      </div>
    );
  }

  const renderKycBadge = () => {
    switch (storeInfo.status) {
      case "APPROVED":
        return (
          <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-bold text-[10px]">
            ✓ Đã Duyệt Hồ Sơ
          </span>
        );
      case "PENDING":
        return (
          <span className="text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-bold text-[10px]">
            ⏳ Đang Chờ Duyệt
          </span>
        );
      case "REJECTED":
        return (
          <span className="text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full font-bold text-[10px]">
            ✕ Từ Chối Hồ Sơ
          </span>
        );
      case "BLOCKED":
        return (
          <span className="text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full font-bold text-[10px]">
            🔒 Tài Khoản Đang Khóa
          </span>
        );
      default:
        return (
          <span className="text-stone-600 bg-stone-100 px-2 py-0.5 rounded-full font-bold text-[10px]">
            {storeInfo.status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4 text-xs max-w-lg mx-auto pb-12 relative">
      {/* 🔔 TOAST THÔNG BÁO */}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 animate-in fade-in slide-in-from-top-4">
          <div
            className={`flex items-center gap-2 px-4 py-2.5 rounded-full shadow-xl border text-xs font-semibold backdrop-blur-md ${
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

      {/* CARD THÔNG TIN CỬA HÀNG */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200/60 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <h2 className="font-bold text-sm text-stone-800 flex items-center gap-2">
            <span className="w-1.5 h-4 bg-[#ee4d2d] rounded-full"></span>
            Thông tin cửa hàng
          </h2>
          <span className="text-[10px] text-stone-400 font-mono font-medium">
            Mã: #{storeInfo.merchantCode || currentUser?.uid.slice(0, 6).toUpperCase()}
          </span>
        </div>

        <div className="flex items-center gap-4 py-2 bg-stone-50/60 p-3 rounded-xl border border-stone-100">
          <div className="w-16 h-16 rounded-full border-2 border-white shadow-xs overflow-hidden bg-stone-200 shrink-0">
            {storeInfo.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={storeInfo.avatarUrl}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-stone-400 text-xl font-bold">
                🏪
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-stone-800 text-sm truncate">
              {storeInfo.storeName || "Chưa đặt tên cửa hàng"}
            </h3>
            <p className="text-stone-500 text-[11px] truncate mt-0.5">
              Chủ shop: <span className="font-semibold text-stone-700">{storeInfo.ownerName || "Chưa cập nhật"}</span>
            </p>

            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-full text-[10px] font-bold">
                ⭐ {shopRating.toFixed(1)}
              </span>
              <span className="text-[10px] text-stone-400">
                ({reviewCount > 0 ? `${reviewCount} đánh giá` : "Chưa có đánh giá"})
              </span>
            </div>

            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span className="px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-full text-[10px] font-bold">
                {getCategoryLabel(storeInfo.category)}
              </span>

              {renderKycBadge()}

              {storeInfo.status === "APPROVED" && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                    storeInfo.isOpen && inOperatingHours
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-stone-100 text-stone-600 border-stone-200"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      storeInfo.isOpen && inOperatingHours ? "bg-emerald-500 animate-pulse" : "bg-stone-400"
                    }`}
                  />
                  {storeInfo.isOpen ? (inOperatingHours ? "Đang Mở Cửa" : "Ngoài Giờ HĐ") : "Tạm Nghỉ"}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 🔘 TRẠNG THÁI MỞ CỬA & THỜI GIAN HOẠT ĐỘNG */}
        {storeInfo.status === "APPROVED" ? (
          <div className="space-y-3 bg-stone-50/80 p-3.5 rounded-xl border border-stone-200/60">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="font-bold text-stone-800 text-xs">Trạng thái mở cửa nhận đơn</p>
                <p className="text-[11px] text-stone-500">
                  {storeInfo.isOpen
                    ? (inOperatingHours ? "Khách hàng có thể tìm thấy và đặt món" : "Đang trong khung giờ đóng cửa")
                    : "Đang tạm ngưng nhận đơn hàng mới"}
                </p>
              </div>

              <button
                type="button"
                disabled={togglingOpenStatus}
                onClick={handleToggleStoreOpen}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  storeInfo.isOpen ? "bg-emerald-500" : "bg-stone-300"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    storeInfo.isOpen ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <div className="pt-2 border-t border-stone-200/60 flex items-center justify-between text-[11px]">
              <span className="text-stone-500 font-medium flex items-center gap-1">
                <span>⏰</span> Khung giờ hoạt động:
              </span>
              <span className="font-bold text-stone-800 font-mono bg-white px-2 py-0.5 rounded-md border border-stone-200">
                {storeInfo.openTime} - {storeInfo.closeTime}
              </span>
            </div>
          </div>
        ) : storeInfo.status === "BLOCKED" ? (
          <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-rose-700 text-sm">
              <span>🔒</span>
              <span>Tài khoản của bạn đã bị khóa!</span>
            </div>
            <div className="bg-white/80 p-3 rounded-lg border border-rose-100 space-y-1">
              <span className="font-bold text-rose-800 block text-[11px]">Lý do từ Quản trị viên (Admin):</span>
              <p className="text-rose-700 text-xs leading-relaxed font-medium">
                {storeInfo.blockReason ? storeInfo.blockReason : "Tài khoản hiện bị tạm ngừng hoạt động. Vui lòng liên hệ hỗ trợ."}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-amber-50/80 border border-amber-200/80 p-3 rounded-xl text-[11px] text-amber-800">
            ⚠️ <b>Tài khoản chưa thể bán hàng:</b>{" "}
            {storeInfo.status === "PENDING" && "Hồ sơ của bạn đang chờ Admin xem xét duyệt."}
            {storeInfo.status === "REJECTED" && "Hồ sơ đã bị Admin từ chối."}
          </div>
        )}

        <div className="space-y-2.5 pt-1 divide-y divide-stone-100/80">
          <div className="flex justify-between items-center pt-2">
            <span className="text-stone-500">🏬 Loại hình kinh doanh:</span>
            <span className="font-bold text-[#ee4d2d]">
              {getCategoryLabel(storeInfo.category)}
            </span>
          </div>
          <div className="flex justify-between items-center pt-2">
            <span className="text-stone-500">📱 Liên hệ:</span>
            <span className="font-medium text-stone-800">{storeInfo.phone || "—"}</span>
          </div>
          <div className="flex justify-between items-center pt-2">
            <span className="text-stone-500">🪪 CCCD / CMND:</span>
            <span className="font-mono font-medium text-stone-800">{storeInfo.identityCardNumber || "—"}</span>
          </div>
          <div className="flex justify-between items-center pt-2">
            <span className="text-stone-500">📑 Mã Số Thuế:</span>
            <span className="font-medium text-stone-800">{storeInfo.taxCode || "Chưa có"}</span>
          </div>
          <div className="flex justify-between items-start pt-2">
            <span className="text-stone-500 shrink-0">📍 Địa chỉ chuẩn:</span>
            <span className="font-medium text-stone-800 text-right ml-4 leading-snug">
              {storeInfo.address || "Chưa cập nhật địa chỉ"}
            </span>
          </div>
          {/* Hiển thị ghi chú shipper ở màn hình chính nếu có */}
          <div className="flex justify-between items-start pt-2">
            <span className="text-stone-500 shrink-0">🚚 Ghi chú shipper:</span>
            <span className="font-medium text-stone-700 text-right ml-4 italic">
              {storeInfo.shipperNote || "Chưa có ghi chú chi tiết"}
            </span>
          </div>
        </div>

        <button
          onClick={handleOpenEdit}
          className="w-full mt-2 bg-[#ee4d2d] hover:bg-[#d73f20] active:scale-[0.99] text-white font-bold py-2.5 rounded-xl shadow-xs transition cursor-pointer flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span>Chỉnh Sửa Thông Tin Cửa Hàng</span>
        </button>
      </div>

      {/* 🔐 CARD CÀI ĐẶT & TIỆN ÍCH */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200/60 shadow-xs space-y-3">
        <h2 className="font-bold text-sm text-stone-800 flex items-center gap-2 border-b border-stone-100 pb-3">
          <span className="w-1.5 h-4 bg-stone-700 rounded-full"></span>
          Cài đặt & Tiện ích
        </h2>

        <div className="space-y-2 pt-1">
          <button
            onClick={() => setIsNotificationsOpen(true)}
            className="w-full bg-indigo-50/80 hover:bg-indigo-100/80 text-indigo-900 font-semibold py-2.5 px-4 rounded-xl border border-indigo-200/80 transition flex items-center justify-between cursor-pointer relative"
          >
            <span className="flex items-center gap-2">
              🔔 Thông báo từ Admin
              {unreadCount > 0 && (
                <span className="inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-bold leading-none text-white bg-rose-600 rounded-full animate-bounce">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </span>
            <span className="text-indigo-500 font-normal text-[11px]">Xem ngay ›</span>
          </button>

          <button
            onClick={() => setIsChangingPassword(true)}
            className="w-full bg-stone-50 hover:bg-stone-100 text-stone-700 font-semibold py-2.5 px-4 rounded-xl border border-stone-200 transition flex items-center justify-between cursor-pointer"
          >
            <span className="flex items-center gap-2">
              🔒 Đổi mật khẩu
            </span>
            <span className="text-stone-400 font-normal text-[11px]">Thay đổi ›</span>
          </button>

          <button
            onClick={handleLogout}
            className="w-full bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold py-2.5 px-4 rounded-xl border border-rose-200 transition flex items-center justify-between cursor-pointer active:scale-[0.99]"
          >
            <span className="flex items-center gap-2">
              🚪 Đăng xuất tài khoản
            </span>
            <span className="text-rose-400 font-normal text-[11px]">Thoát ngay ›</span>
          </button>
        </div>
      </div>

      {/* 📝 MODAL CHỈNH SỬA THÔNG TIN */}
      {isEditing && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-100 bg-stone-50/50">
              <h3 className="font-bold text-stone-800 text-sm flex items-center gap-2">
                <span className="w-1.5 h-4 bg-[#ee4d2d] rounded-full"></span>
                Cập nhật thông tin cửa hàng
              </h3>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-lg transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveInfo} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="flex flex-col items-center gap-2 py-1">
                <div className="relative group cursor-pointer">
                  <div className="w-20 h-20 rounded-full border-2 border-stone-200 shadow-xs overflow-hidden bg-stone-50 flex items-center justify-center">
                    {tempInfo.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={tempInfo.avatarUrl}
                        alt="Avatar"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-stone-400 text-xl">🏪</span>
                    )}

                    {uploadingAvatar && (
                      <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center text-white text-[10px] font-medium">
                        Đang tải...
                      </div>
                    )}
                  </div>

                  <label className="absolute bottom-0 right-0 bg-[#ee4d2d] hover:bg-[#d73f20] text-white p-1.5 rounded-full shadow-md cursor-pointer transition transform active:scale-90">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h0.93a2 2 0 001.664-.89l0.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l0.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      disabled={uploadingAvatar}
                      className="hidden"
                    />
                  </label>
                </div>
                <span className="text-[10px] text-stone-500 font-medium">
                  Bấm vào máy ảnh để đổi logo cửa hàng
                </span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-stone-600 block mb-1 font-semibold text-[11px]">
                    Loại hình kinh doanh <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={tempInfo.category}
                    onChange={(e) => setTempInfo({ ...tempInfo, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 font-bold text-stone-800 bg-white focus:outline-none focus:border-[#ee4d2d] transition"
                  >
                    {CATEGORY_OPTIONS.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.icon} {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="bg-amber-50/60 border border-amber-200/60 p-3 rounded-xl space-y-2">
                  <label className="text-amber-900 font-bold text-[11px] flex items-center gap-1">
                    <span>⏰</span> Cấu hình thời gian hoạt động
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] text-stone-500 font-medium block mb-0.5">Giờ Mở Cửa</span>
                      <input
                        type="time"
                        required
                        value={tempInfo.openTime}
                        onChange={(e) => setTempInfo({ ...tempInfo, openTime: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-stone-200 text-xs font-mono font-bold text-stone-800 outline-none focus:border-[#ee4d2d]"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-stone-500 font-medium block mb-0.5">Giờ Đóng Cửa</span>
                      <input
                        type="time"
                        required
                        value={tempInfo.closeTime}
                        onChange={(e) => setTempInfo({ ...tempInfo, closeTime: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-stone-200 text-xs font-mono font-bold text-stone-800 outline-none focus:border-[#ee4d2d]"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-stone-600 block mb-1 font-semibold text-[11px]">
                    Tên Cửa Hàng / Shop <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={tempInfo.storeName}
                    onChange={(e) => setTempInfo({ ...tempInfo, storeName: e.target.value })}
                    placeholder="Ví dụ: Cửa hàng Điện máy X"
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 font-medium text-stone-800 focus:outline-none focus:border-[#ee4d2d] transition"
                  />
                </div>

                <div>
                  <label className="text-stone-600 block mb-1 font-semibold text-[11px]">
                    Họ và Tên chủ cửa hàng <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={tempInfo.ownerName}
                    onChange={(e) => setTempInfo({ ...tempInfo, ownerName: e.target.value })}
                    placeholder="Nguyễn Văn A"
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 font-medium text-stone-800 focus:outline-none focus:border-[#ee4d2d] transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-stone-600 block mb-1 font-semibold text-[11px]">
                      Số điện thoại <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={tempInfo.phone}
                      onChange={(e) => setTempInfo({ ...tempInfo, phone: e.target.value })}
                      placeholder="0912345678"
                      className="w-full px-3 py-2 rounded-xl border border-stone-200 font-medium text-stone-800 focus:outline-none focus:border-[#ee4d2d] transition"
                    />
                  </div>
                  <div>
                    <label className="text-stone-600 block mb-1 font-semibold text-[11px]">
                      Số CCCD / CMND
                    </label>
                    <input
                      type="text"
                      value={tempInfo.identityCardNumber}
                      onChange={(e) => setTempInfo({ ...tempInfo, identityCardNumber: e.target.value })}
                      placeholder="042095xxxxxx"
                      className="w-full px-3 py-2 rounded-xl border border-stone-200 font-medium text-stone-800 focus:outline-none focus:border-[#ee4d2d] transition font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-stone-600 block mb-1 font-semibold text-[11px]">
                    Mã Số Thuế (Nếu có)
                  </label>
                  <input
                    type="text"
                    value={tempInfo.taxCode}
                    onChange={(e) => setTempInfo({ ...tempInfo, taxCode: e.target.value })}
                    placeholder="Mã số thuế doanh nghiệp / hộ kinh doanh"
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 font-medium text-stone-800 focus:outline-none focus:border-[#ee4d2d] transition"
                  />
                </div>

                {/* 🗺️ KHU VỰC ĐỊA CHỈ & NÚT MỞ MAP COMPONENT */}
                <div className="space-y-2 bg-stone-50/80 p-3.5 rounded-xl border border-stone-200/80">
                  <div className="flex items-center justify-between">
                    <label className="text-stone-700 block font-bold text-[11px] flex items-center gap-1">
                      <span>📍</span> Địa chỉ cửa hàng & GPS <span className="text-red-500">*</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        setTempLat(tempInfo.pickupLocation.latitude || 18.3559);
                        setTempLng(tempInfo.pickupLocation.longitude || 105.8980);
                        setShowMapModal(true);
                      }}
                      className="text-[10px] bg-[#ee4d2d]/10 hover:bg-[#ee4d2d]/20 text-[#ee4d2d] font-bold px-2.5 py-1 rounded-lg border border-[#ee4d2d]/30 transition flex items-center gap-1 cursor-pointer"
                    >
                      🗺️ Chọn vị trí trên Bản đồ
                    </button>
                  </div>

                  {/* 🔒 Ô địa chỉ tự động (Khóa không cho thay đổi bằng tay trực tiếp) */}
                  <textarea
                    rows={2}
                    required
                    disabled
                    value={tempInfo.address}
                    placeholder="Chọn vị trí trên bản đồ để hệ thống điền tự động..."
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 font-medium text-stone-600 bg-stone-100 cursor-not-allowed transition text-xs"
                  />

                  {/* 🚚 Ô MỚI: Nhập địa chỉ chi tiết cho shipper (shipperNote) */}
                  <div className="mt-2 pt-2 border-t border-stone-200/60">
                    <label className="text-stone-700 block font-bold text-[11px] mb-1 flex items-center gap-1">
                      <span>📝</span> Ghi chú chi tiết cho shipper (`shipperNote`)
                    </label>
                    <input
                      type="text"
                      value={tempInfo.shipperNote}
                      onChange={(e) => setTempInfo({ ...tempInfo, shipperNote: e.target.value })}
                      placeholder="Ví dụ: Nhà cổng xanh, ngõ rộng ô tô vào được..."
                      className="w-full px-3 py-2 rounded-xl border border-stone-200 font-medium text-stone-800 bg-white focus:outline-none focus:border-[#ee4d2d] transition text-xs"
                    />
                    <span className="text-[10px] text-stone-400 mt-0.5 block">
                      Giúp shipper dễ dàng nhận diện và tìm đến cửa hàng nhanh chóng hơn.
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] bg-white px-3 py-1.5 rounded-lg border border-stone-200/60 font-mono mt-2">
                    <span className="text-stone-500 font-sans font-medium">Tọa độ pickup (GPS):</span>
                    {tempInfo.pickupLocation.latitude && tempInfo.pickupLocation.longitude ? (
                      <span className="text-emerald-700 font-bold">
                        {tempInfo.pickupLocation.latitude.toFixed(6)}, {tempInfo.pickupLocation.longitude.toFixed(6)}
                      </span>
                    ) : (
                      <span className="text-amber-600 font-medium font-sans">⚠️ Chưa ghim vị trí bản đồ</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold py-2.5 rounded-xl transition cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-[#ee4d2d] hover:bg-[#d73f20] text-white font-bold py-2.5 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  {saving ? "Đang Lưu..." : "Lưu Thay Đổi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🗺️ MODAL TÍCH HỢP MAP COMPONENT CỦA BẠN */}
      {showMapModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col h-[85vh]">
            <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50">
              <h3 className="font-bold text-stone-800 text-sm flex items-center gap-2">
                <span>📍</span> Ghim vị trí chính xác của cửa hàng
              </h3>
              <button
                type="button"
                onClick={() => setShowMapModal(false)}
                className="text-stone-400 hover:text-stone-600 text-lg p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Khung chứa MapComponent */}
            <div className="relative flex-1 w-full h-full bg-stone-100">
              <MapComponent
                lat={tempLat}
                lng={tempLng}
                onSelect={(lat, lng) => {
                  setTempLat(lat);
                  setTempLng(lng);
                }}
              />
            </div>

            <div className="p-4 border-t border-stone-100 flex items-center justify-between bg-white gap-3">
              <div className="text-[11px] text-stone-600 truncate font-mono">
                Lat: <span className="font-bold text-emerald-700">{tempLat.toFixed(5)}</span>, Lng: <span className="font-bold text-emerald-700">{tempLng.toFixed(5)}</span>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowMapModal(false)}
                  className="bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold px-4 py-2 rounded-xl text-xs transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    // Tự động reverse geocoding lấy địa chỉ tên đường khi người dùng bấm xác nhận
                    const addr = await fetchAddressFromCoords(tempLat, tempLng);
                    setTempInfo((prev) => ({
                      ...prev,
                      address: addr || prev.address,
                      pickupLocation: {
                        latitude: tempLat,
                        longitude: tempLng,
                      },
                    }));
                    setShowMapModal(false);
                    showToast("📍 Đã cập nhật tọa độ và địa chỉ thành công!", "success");
                  }}
                  className="bg-[#ee4d2d] hover:bg-[#d73f20] text-white font-bold px-5 py-2 rounded-xl text-xs shadow-xs transition cursor-pointer"
                >
                  Xác Nhận Vị Trí Này
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🔐 MODAL ĐỔI MẬT KHẨU */}
      {isChangingPassword && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-100 bg-stone-50/50">
              <h3 className="font-bold text-stone-800 text-sm flex items-center gap-2">
                <span className="w-1.5 h-4 bg-stone-700 rounded-full"></span>
                Thay đổi mật khẩu
              </h3>
              <button
                type="button"
                onClick={() => setIsChangingPassword(false)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-lg transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="p-5 space-y-3">
              <div>
                <label className="text-stone-600 block mb-1 font-semibold text-[11px]">
                  Mật khẩu hiện tại <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 font-medium text-stone-800 focus:outline-none focus:border-stone-600 transition"
                />
              </div>

              <div>
                <label className="text-stone-600 block mb-1 font-semibold text-[11px]">
                  Mật khẩu mới <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  placeholder="Tối thiểu 6 ký tự"
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 font-medium text-stone-800 focus:outline-none focus:border-stone-600 transition"
                />
              </div>

              <div>
                <label className="text-stone-600 block mb-1 font-semibold text-[11px]">
                  Xác nhận mật khẩu mới <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  placeholder="Nhập lại mật khẩu mới"
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 font-medium text-stone-800 focus:outline-none focus:border-stone-600 transition"
                />
              </div>

              <div className="pt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsChangingPassword(false)}
                  className="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold py-2.5 rounded-xl transition cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={changingPassLoading}
                  className="flex-1 bg-stone-800 hover:black text-white font-bold py-2.5 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {changingPassLoading ? "Đang xử lý..." : "Cập Nhật"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🔔 MODAL XEM THÔNG BÁO TÁCH RIÊNG */}
      {isNotificationsOpen && currentUser && (
        <NotificationsModal
          merchantId={currentUser.uid}
          merchantCode={storeInfo.merchantCode}
          onClose={() => setIsNotificationsOpen(false)}
        />
      )}
    </div>
  );
}