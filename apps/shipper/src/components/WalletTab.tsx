"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  doc,
  setDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";

interface TopupRequest {
  id: string;
  amount: number;
  transferCode?: string;
  transferContent: string;
  billImage: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt?: any;
}

interface BankInfo {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

const POPULAR_BANKS = [
  "MB Bank",
  "Vietcombank",
  "Techcombank",
  "BIDV",
  "VietinBank",
  "VPBank",
  "Agribank",
  "TPBank",
  "ACB",
  "Sacombank",
  "VIB",
  "MSB",
];

const removeVietnameseAccents = (str: string) => {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toUpperCase()
    .trim();
};

export default function WalletTab() {
  const { profile } = useAuth();

  const userProfile = profile as (typeof profile & {
    uid?: string;
    fullName?: string;
    phone?: string;
    bankAccount?: BankInfo;
  }) | null;

  // State tổng số tiền COD tài xế đã thu từ các đơn COD
  const [codAmount, setCodAmount] = useState<number>(0);
  
  // Hạn mức COD tối đa cho phép
  const COD_LIMIT = 2000000;

  const normalizedUserName = userProfile?.fullName
    ? removeVietnameseAccents(userProfile.fullName)
    : "";

  // States Ngân hàng
  const [bankInfo, setBankInfo] = useState<BankInfo>({
    bankName: "",
    accountNumber: "",
    accountHolder: normalizedUserName,
  });
  const [isEditingBank, setIsEditingBank] = useState(false);
  const [isSavingBank, setIsSavingBank] = useState(false);

  // States Modal Thanh toán COD & Mã đối soát
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [topupAmount, setTopupAmount] = useState("");
  const [billImage, setBillImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Mã giao dịch ngắn 6 chữ số ngẫu nhiên phục vụ đối soát trên Admin
  const [transferCode, setTransferCode] = useState<string>("");

  // State Lịch sử thanh toán
  const [topupHistory, setTopupHistory] = useState<TopupRequest[]>([]);
  const [selectedBillModal, setSelectedBillModal] = useState<string | null>(null);

  // 1. LỰA CHỌN & LỌC TÍNH SỐ TIỀN COD SHIPPER ĐÃ THU TỪ CÁC ĐƠN "cod"
  useEffect(() => {
    if (!userProfile?.uid) return;

    const ordersQuery = query(
      collection(db, "orders"),
      where("shipperId", "==", userProfile.uid)
    );

    const unsubscribe = onSnapshot(
      ordersQuery,
      (snapshot) => {
        let totalCod = 0;

        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data();

          // Lấy phương thức thanh toán "cod" hoặc "COD"
          const isCod = data.paymentMethod?.toString().toLowerCase() === "cod";

          // Chỉ lấy các đơn hàng đã được giao/hoàn thành
          const isCompleted = 
            data.status === "completed" || 
            data.status === "delivered";

          if (isCod && isCompleted) {
            totalCod += Number(data.totalPrice || 0);
          }
        });

        setCodAmount(totalCod);
      },
      (error) => {
        console.error("Lỗi tính tiền COD đơn hàng:", error);
      }
    );

    return () => unsubscribe();
  }, [userProfile?.uid]);

  // Tạo mã đối soát ngẫu nhiên 6 chữ số mỗi khi mở modal thanh toán
  const handleOpenTopupModal = () => {
    const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
    setTransferCode(randomCode);
    setTopupAmount(codAmount > 0 ? codAmount.toString() : "");
    setShowTopupModal(true);
  };

  // Nội dung chuyển khoản chuẩn phục vụ đối soát Admin
  const transferContent = `COD ${transferCode}`;

  // Đồng bộ thông tin ngân hàng tài xế
  useEffect(() => {
    if (userProfile?.bankAccount) {
      setBankInfo(userProfile.bankAccount);
    } else if (normalizedUserName) {
      setBankInfo((prev) => ({
        ...prev,
        accountHolder: normalizedUserName,
      }));
    }
  }, [userProfile, normalizedUserName]);

  // Tải lịch sử nộp tiền COD
  useEffect(() => {
    if (!userProfile?.uid) return;

    const q = query(
      collection(db, "topup_requests"),
      where("shipperUid", "==", userProfile.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const history: TopupRequest[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as TopupRequest[];
        setTopupHistory(history);
      },
      (error) => {
        console.error("Lỗi tải lịch sử chuyển tiền:", error);
      }
    );

    return () => unsubscribe();
  }, [userProfile?.uid]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const MY_BANK_INFO = {
    bankId: "MB",
    bankName: "MB Bank (Ngân Hàng Quân Đội)",
    accountNumber: "0865234554",
    accountHolder: "NGUYEN DINH ANH",
  };

  const qrImageUrl = `https://img.vietqr.io/image/${MY_BANK_INFO.bankId}-${MY_BANK_INFO.accountNumber}-compact2.png?amount=${topupAmount || 0}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent(MY_BANK_INFO.accountHolder)}`;

  const uploadToCloudinary = async (base64Image: string) => {
    const cloudName = "lfqjrcvh"; 
    const uploadPreset = "ml_default"; 

    const formData = new FormData();
    formData.append("file", base64Image);
    formData.append("upload_preset", uploadPreset);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) throw new Error("Upload ảnh thất bại");
    const data = await res.json();
    return data.secure_url;
  };

  const handleSaveBankInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile?.uid) {
      triggerToast("❌ Vui lòng đăng nhập lại!");
      return;
    }

    if (!bankInfo.bankName || !bankInfo.accountNumber) {
      triggerToast("⚠️ Vui lòng điền đầy đủ thông tin ngân hàng!");
      return;
    }

    const inputHolderFormatted = removeVietnameseAccents(bankInfo.accountHolder);
    if (normalizedUserName && inputHolderFormatted !== normalizedUserName) {
      triggerToast(`⚠️ Tên chủ tài khoản phải trùng với tên đăng ký: ${normalizedUserName}`);
      return;
    }

    setIsSavingBank(true);
    try {
      const updatedBankData: BankInfo = {
        bankName: bankInfo.bankName,
        accountNumber: bankInfo.accountNumber,
        accountHolder: normalizedUserName || inputHolderFormatted,
      };

      const shipperRef = doc(db, "shippers", userProfile.uid);
      await setDoc(
        shipperRef,
        { bankAccount: updatedBankData },
        { merge: true }
      );

      setBankInfo(updatedBankData);
      triggerToast("✅ Lưu thông tin tài khoản thành công!");
      setIsEditingBank(false);
    } catch (error) {
      console.error("Lỗi lưu ngân hàng:", error);
      triggerToast("❌ Lưu thất bại, vui lòng thử lại!");
    } finally {
      setIsSavingBank(false);
    }
  };

  const handleBillChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setBillImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // NỘP YÊU CẦU NỘP COD KÈM MÃ ĐỐI SOÁT
  const handleSubmitTopup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topupAmount || !billImage) {
      triggerToast("⚠️ Vui lòng nhập số tiền và tải lên hóa đơn!");
      return;
    }

    setIsSubmitting(true);
    try {
      let imageUrl = billImage;
      if (billImage.startsWith("data:image")) {
        imageUrl = await uploadToCloudinary(billImage);
      }

      await addDoc(collection(db, "topup_requests"), {
        shipperUid: userProfile?.uid || "",
        shipperName: userProfile?.fullName || "Tài xế",
        shipperPhone: userProfile?.phone || "",
        transferCode: transferCode, // Lưu mã đối soát riêng biệt (vd: "887799")
        transferContent: transferContent, // Nội dung ck (vd: "COD 887799")
        amount: Number(topupAmount),
        billImage: imageUrl,
        type: "COD_CLEARANCE",
        status: "PENDING",
        createdAt: serverTimestamp(),
      });

      triggerToast("✅ Đã gửi bằng chứng nộp tiền! Admin sẽ đối soát và duyệt sớm.");
      setShowTopupModal(false);
      setTopupAmount("");
      setBillImage(null);
    } catch (error) {
      console.error("Lỗi nộp tiền:", error);
      triggerToast("❌ Gửi yêu cầu thất bại!");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isOverLimit = codAmount >= COD_LIMIT;

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "Vừa xong";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")} - ${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24 scrollbar-none relative">
      
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-lg backdrop-blur-md">
          {toastMessage}
        </div>
      )}

      {/* Card Tiền COD Cần Nộp */}
      <div className={`rounded-3xl p-5 text-white shadow-lg space-y-4 relative overflow-hidden transition-all ${
        isOverLimit 
          ? "bg-gradient-to-br from-rose-600 via-red-700 to-rose-900" 
          : codAmount > 0 
          ? "bg-gradient-to-br from-amber-500 via-orange-600 to-amber-700" 
          : "bg-gradient-to-br from-emerald-600 via-teal-700 to-emerald-900"
      }`}>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${codAmount > 0 ? "bg-amber-200 animate-ping" : "bg-emerald-300"}`} />
            <span className="text-[11px] font-black uppercase tracking-wider opacity-90">
              Tổng tiền COD đã thu
            </span>
          </div>
          <span className="bg-white/20 text-[10px] font-black px-2.5 py-1 rounded-full backdrop-blur-md border border-white/10">
            {codAmount > 0 ? "Cần nộp về hệ thống" : "Đã sạch nợ COD"}
          </span>
        </div>

        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {codAmount.toLocaleString("vi-VN")} <span className="text-lg font-bold">đ</span>
          </h1>
          
          <p className="text-[11px] mt-1 font-medium opacity-90">
            {codAmount > 0 
              ? `Tổng tiền thu từ các đơn COD đã giao thành công` 
              : "Bạn không giữ tiền mặt COD nào của hệ thống"}
          </p>
        </div>

        {/* Nút Nộp Tiền COD */}
        <div className="pt-1">
          <button
            onClick={handleOpenTopupModal}
            className="w-full bg-white hover:bg-slate-50 text-slate-900 font-black py-3 rounded-2xl text-xs transition active:scale-95 cursor-pointer shadow-md flex items-center justify-center gap-2"
          >
            <span>⚡ NỘP TIỀN COD VỀ HỆ THỐNG</span>
          </button>
        </div>
      </div>

      {/* Cảnh báo hạn mức */}
      {isOverLimit && (
        <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-2xl flex items-start gap-3">
          <span className="text-xl">🚫</span>
          <div className="space-y-0.5">
            <h4 className="text-xs font-black text-rose-800">Tài khoản tạm khóa nhận đơn</h4>
            <p className="text-[11px] text-rose-600 font-medium">
              Bạn đang giữ vượt hạn mức tiền COD ({COD_LIMIT.toLocaleString("vi-VN")} đ). Vui lòng nộp lại tiền COD để tiếp tục nhận đơn mới.
            </p>
          </div>
        </div>
      )}

      {/* LỊCH SỬ NỘP COD */}
      <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">💸</span>
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
              Lịch sử nộp COD ({topupHistory.length})
            </h3>
          </div>
        </div>

        {topupHistory.length > 0 ? (
          <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1 scrollbar-thin">
            {topupHistory.map((item) => (
              <div
                key={item.id}
                className="bg-slate-50 border border-slate-100 rounded-2xl p-3 flex items-center justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-800">
                      +{item.amount.toLocaleString("vi-VN")} đ
                    </span>
                    <span
                      className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                        item.status === "APPROVED"
                          ? "bg-emerald-100 text-emerald-700"
                          : item.status === "REJECTED"
                          ? "bg-rose-100 text-rose-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {item.status === "APPROVED"
                        ? "Đã duyệt"
                        : item.status === "REJECTED"
                        ? "Từ chối"
                        : "Chờ duyệt"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                    <span>{formatDate(item.createdAt)}</span>
                    {item.transferCode && (
                      <span className="font-mono bg-slate-200 text-slate-700 font-bold px-1.5 py-0.2 rounded">
                        Mã: {item.transferCode}
                      </span>
                    )}
                  </div>
                </div>

                {item.billImage && (
                  <button
                    onClick={() => setSelectedBillModal(item.billImage)}
                    className="text-[10px] font-bold text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-xl hover:bg-slate-100 transition flex items-center gap-1 cursor-pointer"
                  >
                    <span>🖼️ Xem bill</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-3 text-center">
            <p className="text-[11px] text-slate-500 font-medium">Chưa có lịch sử nộp tiền COD nào.</p>
          </div>
        )}
      </div>

      {/* TÀI KHOẢN NGÂN HÀNG CỦA TÀI XẾ */}
      <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">🏦</span>
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
              Tài khoản nhận tiền từ Hệ Thống
            </h3>
          </div>
          <button
            onClick={() => setIsEditingBank(!isEditingBank)}
            className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full cursor-pointer transition"
          >
            {isEditingBank ? "Hủy" : bankInfo.accountNumber ? "Sửa" : "+ Thêm mới"}
          </button>
        </div>

        {isEditingBank ? (
          <form onSubmit={handleSaveBankInfo} className="space-y-3 pt-1">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 block uppercase">Ngân hàng</label>
              <input
                type="text"
                placeholder="VD: MB Bank, Vietcombank..."
                value={bankInfo.bankName}
                onChange={(e) => setBankInfo({ ...bankInfo, bankName: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                required
              />
              
              <div className="flex flex-wrap gap-1.5 pt-1">
                {POPULAR_BANKS.map((bank) => (
                  <button
                    key={bank}
                    type="button"
                    onClick={() => setBankInfo({ ...bankInfo, bankName: bank })}
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                      bankInfo.bankName === bank
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {bank}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">Số tài khoản</label>
              <input
                type="text"
                placeholder="Nhập số tài khoản"
                value={bankInfo.accountNumber}
                onChange={(e) => setBankInfo({ ...bankInfo, accountNumber: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[10px] font-bold text-slate-400 block uppercase">
                  Tên chủ tài khoản
                </label>
                <span className="text-[9px] font-extrabold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                  🔒 Đã khóa
                </span>
              </div>
              <input
                type="text"
                value={normalizedUserName || bankInfo.accountHolder}
                readOnly
                disabled
                className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold uppercase text-slate-500 cursor-not-allowed select-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSavingBank}
              className="w-full bg-emerald-600 text-white font-bold text-xs py-2.5 rounded-xl hover:bg-emerald-700 transition cursor-pointer disabled:opacity-50"
            >
              {isSavingBank ? "Đang lưu..." : "LƯU TÀI KHOẢN NGÂN HÀNG"}
            </button>
          </form>
        ) : bankInfo.accountNumber ? (
          <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 space-y-1.5 text-xs">
            <div className="flex justify-between items-center text-slate-500">
              <span className="text-[11px] font-medium">Ngân hàng:</span>
              <span className="font-bold text-slate-800">{bankInfo.bankName}</span>
            </div>
            <div className="flex justify-between items-center text-slate-500">
              <span className="text-[11px] font-medium">Số tài khoản:</span>
              <span className="font-mono font-bold text-emerald-700">{bankInfo.accountNumber}</span>
            </div>
            <div className="flex justify-between items-center text-slate-500">
              <span className="text-[11px] font-medium">Chủ tài khoản:</span>
              <span className="font-bold text-slate-800 uppercase">
                {normalizedUserName || bankInfo.accountHolder}
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-3 text-center">
            <p className="text-[11px] text-slate-500 font-medium">Chưa liên kết tài khoản ngân hàng để nhận tiền từ hệ thống.</p>
          </div>
        )}
      </div>

      {/* Modal Xem Ảnh Bill */}
      {selectedBillModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-4 max-w-sm w-full space-y-3 relative shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-800 uppercase">Ảnh Bill Chuyển Tiền</h3>
              <button
                onClick={() => setSelectedBillModal(null)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
            <img
              src={selectedBillModal}
              alt="Bill ảnh"
              className="w-full max-h-96 object-contain rounded-2xl border border-slate-100"
            />
          </div>
        </div>
      )}

      {/* Modal Chuyển khoản Nộp COD */}
      {showTopupModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-md rounded-t-[2.5rem] sm:rounded-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-300 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-800 text-base">Thanh Toán Tiền COD</h3>
              <button
                onClick={() => setShowTopupModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 font-bold text-xs cursor-pointer flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitTopup} className="space-y-4">
              <div>
                <label className="text-[10px] font-extrabold text-slate-400 block mb-1 uppercase tracking-wider">
                  Số tiền COD nộp lại (VNĐ)
                </label>
                <input
                  type="number"
                  placeholder="Nhập số tiền chuyển"
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-3 text-sm font-black text-emerald-600 focus:outline-none focus:border-emerald-500 transition"
                  required
                />
              </div>

              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-center space-y-3">
                <p className="text-[11px] font-extrabold text-slate-600">
                  Quét QR Ngân hàng bên dưới để nộp tiền
                </p>
                
                <img
                  src={qrImageUrl}
                  alt="QR Ngân hàng Hệ thống"
                  className="w-48 h-48 mx-auto rounded-2xl border border-slate-200 shadow-sm object-contain bg-white p-2"
                />

                <div className="text-xs space-y-1.5 text-slate-700 font-medium pt-1 text-left bg-white p-3 rounded-xl border border-slate-100">
                  <p className="flex justify-between"><span>Ngân hàng:</span> <strong className="text-slate-800">{MY_BANK_INFO.bankName}</strong></p>
                  <p className="flex justify-between items-center">
                    <span>Số TK:</span> 
                    <strong className="text-emerald-700 text-sm font-mono">{MY_BANK_INFO.accountNumber}</strong>
                  </p>
                  <p className="flex justify-between"><span>Chủ TK:</span> <strong className="text-slate-800">{MY_BANK_INFO.accountHolder}</strong></p>
                </div>

                <div className="bg-amber-50 border border-amber-200/80 p-3 rounded-2xl text-left space-y-1.5">
                  <p className="text-[10px] font-black text-amber-800 uppercase tracking-wider">
                    Nội dung chuyển khoản đối soát:
                  </p>
                  <div className="flex items-center justify-between">
                    <code className="text-xs font-black text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-amber-200 select-all font-mono">
                      {transferContent}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(transferContent);
                        triggerToast("📋 Đã sao chép nội dung!");
                      }}
                      className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg hover:bg-emerald-200 transition cursor-pointer"
                    >
                      Sao chép
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-extrabold text-slate-400 block mb-1 uppercase tracking-wider">
                  Tải ảnh bill đã chuyển thành công
                </label>
                
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl p-4 bg-slate-50 hover:bg-slate-100 transition cursor-pointer relative">
                  {billImage ? (
                    <img
                      src={billImage}
                      alt="Bill screenshot"
                      className="max-h-36 rounded-xl object-contain shadow-xs"
                    />
                  ) : (
                    <div className="text-center space-y-1">
                      <span className="text-3xl block">📸</span>
                      <p className="text-xs font-bold text-slate-700">Tải bill chuyển khoản</p>
                    </div>
                  )}

                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleBillChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black py-3.5 rounded-2xl text-xs transition cursor-pointer shadow-md shadow-emerald-200 disabled:opacity-50"
              >
                {isSubmitting ? "ĐANG GỬI..." : "XÁC NHẬN ĐÃ CHUYỂN TIỀN"}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}