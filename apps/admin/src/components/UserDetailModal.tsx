"use client";

import { useEffect, useState } from "react";

interface UserDetailModalProps {
  user: any;
  onClose: () => void;
  onUpdateStatus?: (
    userId: string,
    newStatus: string,
    role: string,
    blockReason?: string
  ) => void;
  onRefresh: () => void;
}

const QUICK_REASONS = [
  "Ảnh giấy tờ (CCCD/Bằng lái) bị mờ, mờ số hoặc cắt góc",
  "Thông tin khai báo không trùng khớp với ảnh chụp giấy tờ",
  "Ảnh chụp không phải là giấy tờ gốc (chụp qua màn hình khác)",
  "Giấy phép lái xe hoặc CCCD đã hết hạn sử dụng",
  "Tài khoản vi phạm điều khoản dịch vụ / Nghi vấn gian lận",
  "Chưa hoàn tất thanh toán / Công nợ phí dịch vụ (1.500.000đ)",
];

export function UserDetailModal({
  user,
  onClose,
  onRefresh,
}: UserDetailModalProps) {
  // =========================================================
  // BASIC
  // =========================================================

  const [isEditing, setIsEditing] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  // =========================================================
  // RESET PASSWORD
  // =========================================================

  const [
    showResetPasswordModal,
    setShowResetPasswordModal,
  ] = useState(false);

  const [newPassword, setNewPassword] =
    useState("");

  const [
    isResettingPassword,
    setIsResettingPassword,
  ] = useState(false);

  // =========================================================
  // IMAGE PREVIEW
  // =========================================================

  const [
    previewImage,
    setPreviewImage,
  ] = useState<{
    url: string;
    title: string;
  } | null>(null);

  const [imageRotation, setImageRotation] =
    useState(0);

  // =========================================================
  // BLOCK / REJECT
  // =========================================================

  const [
    showBlockReasonModal,
    setShowBlockReasonModal,
  ] = useState(false);

  const [blockReason, setBlockReason] =
    useState("");

  const [
    pendingActionStatus,
    setPendingActionStatus,
  ] = useState<
    "BLOCKED" | "REJECTED"
  >("BLOCKED");

  // =========================================================
  // BLOCK REASON EDIT
  // =========================================================

  const [
    editBlockReason,
    setEditBlockReason,
  ] = useState("");

  const [
    isUpdatingReason,
    setIsUpdatingReason,
  ] = useState(false);

  // =========================================================
  // SHIPPER DEPOSIT
  // =========================================================

  const [isDepositPaid, setIsDepositPaid] =
    useState(false);

  const [
    isUpdatingDeposit,
    setIsUpdatingDeposit,
  ] = useState(false);

  // =========================================================
  // MERCHANT COMMISSION
  // =========================================================

  const [
    commissionPercent,
    setCommissionPercent,
  ] = useState("0");

  const [
    originalCommission,
    setOriginalCommission,
  ] = useState("0");

  const [
    isEditingCommission,
    setIsEditingCommission,
  ] = useState(false);

  const [
    isSavingCommission,
    setIsSavingCommission,
  ] = useState(false);

  // =========================================================
  // FORM DATA
  // =========================================================

  const [
    formData,
    setFormData,
  ] = useState({
    fullName: "",
    phone: "",
    identityCardNumber: "",
    address: "",
    shopName: "",
    licensePlate: "",
    vehicleType: "MOTORBIKE",
  });

  // =========================================================
  // USER ID / ROLE / STATUS
  // =========================================================

  const userId =
    user?.uid ||
    user?.id ||
    user?._id ||
    "";

  const userRole = String(
    user?.role || "SHIPPER"
  ).toUpperCase();

  const currentStatus = String(
    user?.status ||
      "PENDING_APPROVAL"
  ).toUpperCase();

  const isMerchant =
    userRole === "MERCHANT";

  const isPending =
    currentStatus === "PENDING" ||
    currentStatus ===
      "PENDING_APPROVAL";

  const isApproved =
    currentStatus === "APPROVED" ||
    currentStatus === "ACTIVE";

  const isBlocked =
    currentStatus === "BLOCKED";

  const isRejected =
    currentStatus === "REJECTED";

  // =========================================================
  // LOAD USER DATA
  // =========================================================

  useEffect(() => {
    if (!user) {
      return;
    }

    const rawCommission =
      user?.commissionPercent ??
      user?.platformCommissionPercent ??
      user?.merchantCommissionPercent ??
      user?.platformFeePercent ??
      0;

    const numericCommission =
      Number(rawCommission);

    const safeCommission =
      Number.isFinite(
        numericCommission
      )
        ? Math.min(
            100,
            Math.max(
              0,
              numericCommission
            )
          )
        : 0;

    const commissionString =
      safeCommission.toString();

    setFormData({
      fullName:
        user.fullName ||
        user.ownerName ||
        user.shopName ||
        "",

      phone:
        user.phone ||
        user.phoneNumber ||
        "",

      identityCardNumber:
        user.identityCardNumber ||
        user.idCardNumber ||
        "",

      address:
        user.address ||
        "",

      shopName:
        user.shopName ||
        user.storeName ||
        "",

      licensePlate:
        user.licensePlate ||
        "",

      vehicleType:
        user.vehicleType ||
        "MOTORBIKE",
    });

    setCommissionPercent(
      commissionString
    );

    setOriginalCommission(
      commissionString
    );

    setEditBlockReason(
      user?.blockReason || ""
    );

    setIsDepositPaid(
      Boolean(
        user?.isDepositPaid ||
          user?.depositStatus ===
            "PAID"
      )
    );

    setIsEditingCommission(
      false
    );
  }, [user]);

  // =========================================================
  // SHIPPER CHECK
  // =========================================================

  const isShipper =
    userRole === "SHIPPER" ||
    Boolean(
      user?.driverLicenseUrl
    );

  const hasIdFront = Boolean(
    user?.idCardFrontUrl
  );

  const hasIdBack = Boolean(
    user?.idCardBackUrl
  );

  const hasLicense = Boolean(
    user?.driverLicenseUrl
  );

  const isDocumentsComplete =
    hasIdFront &&
    hasIdBack &&
    hasLicense;

  const isShipperEligible =
    isShipper
      ? isDocumentsComplete &&
        isDepositPaid
      : true;

  // =========================================================
  // RESET PASSWORD
  // =========================================================

  const generateRandomPassword =
    () => {
      const chars =
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

      let password = "";

      for (
        let i = 0;
        i < 8;
        i++
      ) {
        password +=
          chars.charAt(
            Math.floor(
              Math.random() *
                chars.length
            )
          );
      }

      setNewPassword(
        password
      );
    };

  const handleResetPassword =
    async () => {
      if (
        !newPassword.trim() ||
        newPassword.length < 6
      ) {
        alert(
          "Mật khẩu phải từ 6 ký tự trở lên!"
        );
        return;
      }

      setIsResettingPassword(
        true
      );

      try {
        const res =
          await fetch(
            "/api/users/reset-password",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                userId,
                newPassword:
                  newPassword.trim(),
              }),
            }
          );

        const data =
          await res.json();

        if (data.success) {
          alert(
            `✅ Cập nhật mật khẩu thành công!\n\nMật khẩu mới: ${newPassword.trim()}`
          );

          setShowResetPasswordModal(
            false
          );

          setNewPassword("");
        } else {
          alert(
            "Lỗi: " +
              (data.message ||
                "Không thể cập nhật mật khẩu")
          );
        }
      } catch (error) {
        console.error(
          "❌ Lỗi đặt lại mật khẩu:",
          error
        );

        alert(
          "Lỗi kết nối máy chủ"
        );
      } finally {
        setIsResettingPassword(
          false
        );
      }
    };

  // =========================================================
  // DEPOSIT
  // =========================================================

  const handleToggleDeposit =
    async () => {
      const nextStatus =
        !isDepositPaid;

      if (
        !confirm(
          `Xác nhận đánh dấu Shipper đã ${
            nextStatus
              ? "ĐÃ ĐÓNG"
              : "CHƯA ĐÓNG"
          } khoản phí 1.500.000 VNĐ?`
        )
      ) {
        return;
      }

      setIsUpdatingDeposit(
        true
      );

      try {
        const res =
          await fetch(
            "/api/users",
            {
              method: "PATCH",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                userId,
                status:
                  currentStatus,
                role: userRole,
                isDepositPaid:
                  nextStatus,
              }),
            }
          );

        const data =
          await res.json();

        if (data.success) {
          setIsDepositPaid(
            nextStatus
          );

          await onRefresh();
        } else {
          alert(
            data.message ||
              "Cập nhật đóng phí thất bại"
          );
        }
      } catch (error) {
        console.error(
          "❌ Lỗi cập nhật đóng phí:",
          error
        );

        alert(
          "Lỗi kết nối máy chủ"
        );
      } finally {
        setIsUpdatingDeposit(
          false
        );
      }
    };

  // =========================================================
  // SAVE MERCHANT COMMISSION
  // =========================================================

  const handleSaveCommission =
    async () => {
      // -----------------------------------------------
      // Chỉ Merchant mới được chỉnh hoa hồng
      // -----------------------------------------------

      if (!isMerchant) {
        alert(
          "Chỉ tài khoản Merchant mới có thể cấu hình chiết khấu."
        );
        return;
      }

      // -----------------------------------------------
      // Bắt buộc phải có userId
      // -----------------------------------------------

      if (!userId) {
        alert(
          "Không xác định được userId Merchant."
        );
        return;
      }

      // -----------------------------------------------
      // API hiện tại yêu cầu status
      // -----------------------------------------------

      if (!currentStatus) {
        alert(
          "Không xác định được trạng thái Merchant."
        );
        return;
      }

      // -----------------------------------------------
      // Chuẩn hóa số
      // -----------------------------------------------

      const rawValue =
        commissionPercent
          .replace(",", ".")
          .trim();

      if (!rawValue) {
        alert(
          "Vui lòng nhập mức chiết khấu."
        );
        return;
      }

      const commission =
        Number(rawValue);

      if (
        !Number.isFinite(
          commission
        )
      ) {
        alert(
          "Chiết khấu phải là một số hợp lệ."
        );
        return;
      }

      if (
        commission < 0 ||
        commission > 100
      ) {
        alert(
          "Chiết khấu phải nằm trong khoảng 0% - 100%."
        );
        return;
      }

      const normalizedCommission =
        Number(
          commission.toFixed(2)
        );

      // -----------------------------------------------
      // SAVE
      // -----------------------------------------------

      try {
        setIsSavingCommission(
          true
        );

        const payload = {
          userId,

          // QUAN TRỌNG:
          // API hiện tại bắt buộc status
          status: currentStatus,

          role: "MERCHANT",

          commissionPercent:
            normalizedCommission,

          updateType:
            "MERCHANT_COMMISSION",
        };

        console.log(
          "📤 [MERCHANT COMMISSION] PATCH /api/users:",
          payload
        );

        const res =
          await fetch(
            "/api/users",
            {
              method: "PATCH",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify(
                payload
              ),
            }
          );

        const data =
          await res.json();

        console.log(
          "📥 [MERCHANT COMMISSION] API response:",
          data
        );

        if (!res.ok || !data.success) {
          throw new Error(
            data.message ||
              `Không thể cập nhật chiết khấu (HTTP ${res.status})`
          );
        }

        // -----------------------------------------------
        // LOCAL STATE
        // -----------------------------------------------

        const saved =
          normalizedCommission.toString();

        setCommissionPercent(
          saved
        );

        setOriginalCommission(
          saved
        );

        setIsEditingCommission(
          false
        );

        alert(
          `✅ Đã cập nhật chiết khấu cho ${
            user?.shopName ||
            user?.storeName ||
            user?.ownerName ||
            "Merchant"
          }: ${normalizedCommission}%`
        );

        // -----------------------------------------------
        // REFRESH DANH SÁCH
        // -----------------------------------------------

        await onRefresh();
      } catch (error: any) {
        console.error(
          "❌ Lỗi cập nhật chiết khấu Merchant:",
          error
        );

        alert(
          error?.message ||
            "Không thể cập nhật chiết khấu Merchant."
        );
      } finally {
        setIsSavingCommission(
          false
        );
      }
    };

  // =========================================================
  // CANCEL COMMISSION EDIT
  // =========================================================

  const handleCancelCommission =
    () => {
      if (
        isSavingCommission
      ) {
        return;
      }

      setCommissionPercent(
        originalCommission
      );

      setIsEditingCommission(
        false
      );
    };

  // =========================================================
  // UPDATE STATUS
  // =========================================================

  const executeUpdateStatus =
    async (
      status: string,
      reason?: string
    ) => {
      if (!userId) {
        alert(
          "Không xác định được userId."
        );
        return;
      }

      setLoading(true);

      try {
        const res =
          await fetch(
            "/api/users",
            {
              method: "PATCH",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                userId,
                status,
                role: userRole,
                blockReason:
                  reason || "",
              }),
            }
          );

        const data =
          await res.json();

        if (data.success) {
          setShowBlockReasonModal(
            false
          );

          await onRefresh();
          onClose();
        } else {
          alert(
            "Lỗi: " +
              (data.message ||
                "Thao tác thất bại")
          );
        }
      } catch (error) {
        console.error(
          "❌ Lỗi cập nhật trạng thái:",
          error
        );

        alert(
          "Lỗi kết nối máy chủ"
        );
      } finally {
        setLoading(false);
      }
    };

  // =========================================================
  // SAVE BLOCK REASON
  // =========================================================

  const handleSaveBlockReason =
    async () => {
      const trimmedReason =
        editBlockReason.trim();

      if (!trimmedReason) {
        alert(
          "Lý do không được để trống!"
        );
        return;
      }

      setIsUpdatingReason(
        true
      );

      try {
        const res =
          await fetch(
            "/api/users",
            {
              method: "PATCH",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                userId,
                status:
                  currentStatus,
                role: userRole,
                blockReason:
                  trimmedReason,
              }),
            }
          );

        const data =
          await res.json();

        if (data.success) {
          alert(
            "✅ Đã cập nhật lý do thành công!"
          );

          await onRefresh();
        } else {
          alert(
            data.message ||
              "Không thể cập nhật lý do"
          );
        }
      } catch (error) {
        console.error(
          "❌ Lỗi cập nhật lý do:",
          error
        );

        alert(
          "Lỗi kết nối máy chủ"
        );
      } finally {
        setIsUpdatingReason(
          false
        );
      }
    };

  // =========================================================
  // SAVE BASIC PROFILE
  // =========================================================

  const handleSaveEdit =
    async () => {
      setLoading(true);

      try {
        const res =
          await fetch(
            "/api/users",
            {
              method: "PUT",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                userId,
                role: userRole,
                ...formData,
              }),
            }
          );

        const data =
          await res.json();

        if (data.success) {
          setIsEditing(false);

          await onRefresh();
          onClose();
        } else {
          alert(
            data.message ||
              "Cập nhật không thành công"
          );
        }
      } catch (error) {
        console.error(
          "❌ Lỗi cập nhật thông tin:",
          error
        );

        alert(
          "Lỗi kết nối máy chủ"
        );
      } finally {
        setLoading(false);
      }
    };

  // =========================================================
  // DELETE USER
  // =========================================================

  const handleDeleteUser =
    async () => {
      if (
        !confirm(
          `⚠️ XÓA VĨNH VIỄN tài khoản "${formData.fullName}"?\n\nHành động này không thể hoàn tác!`
        )
      ) {
        return;
      }

      setLoading(true);

      try {
        const res =
          await fetch(
            `/api/users?userId=${encodeURIComponent(
              userId
            )}&role=${encodeURIComponent(
              userRole
            )}`,
            {
              method: "DELETE",
            }
          );

        const data =
          await res.json();

        if (data.success) {
          await onRefresh();
          onClose();
        } else {
          alert(
            data.message ||
              "Lỗi xóa tài khoản"
          );
        }
      } catch (error) {
        console.error(
          "❌ Lỗi xóa tài khoản:",
          error
        );

        alert(
          "Lỗi khi kết nối máy chủ"
        );
      } finally {
        setLoading(false);
      }
    };

  // =========================================================
  // BLOCK
  // =========================================================

  const handleToggleBlock =
    () => {
      if (isBlocked) {
        executeUpdateStatus(
          "APPROVED"
        );
        return;
      }

      setPendingActionStatus(
        "BLOCKED"
      );

      setBlockReason("");

      setShowBlockReasonModal(
        true
      );
    };

  // =========================================================
  // REJECT
  // =========================================================

  const handleRejectUser =
    () => {
      setPendingActionStatus(
        "REJECTED"
      );

      setBlockReason("");

      setShowBlockReasonModal(
        true
      );
    };

  // =========================================================
  // CONFIRM BLOCK / REJECT
  // =========================================================

  const handleConfirmActionWithReason =
    (
      event?: React.MouseEvent
    ) => {
      event?.preventDefault();

      const trimmedReason =
        blockReason.trim();

      if (!trimmedReason) {
        alert(
          "Vui lòng nhập hoặc chọn lý do!"
        );
        return;
      }

      executeUpdateStatus(
        pendingActionStatus,
        trimmedReason
      );
    };

  // =========================================================
  // LIGHTBOX
  // =========================================================

  const openLightbox = (
    url: string,
    title: string
  ) => {
    setImageRotation(0);

    setPreviewImage({
      url,
      title,
    });
  };

  // =========================================================
  // NO USER
  // =========================================================

  if (!user) {
    return null;
  }

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden text-slate-200 animate-in fade-in zoom-in-95 duration-150 relative flex flex-col max-h-[90vh]">

        {/* =====================================================
            HEADER
        ====================================================== */}

        <div className="bg-slate-800/90 px-6 py-4 flex justify-between items-center border-b border-slate-700/60 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-white">
                {isEditing
                  ? "✏️ Chỉnh Sửa Hồ Sơ"
                  : `Chi Tiết Hồ Sơ (${userRole})`}
              </h3>

              {isPending && (
                <span className="bg-amber-500/20 text-amber-400 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-amber-500/40 animate-pulse">
                  ⏳ Chờ Phê Duyệt
                </span>
              )}
            </div>

            <p className="text-xs text-slate-400 font-mono mt-0.5">
              UID: {userId}
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center font-bold transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* =====================================================
            BODY
        ====================================================== */}

        <div className="p-6 space-y-4 overflow-y-auto text-xs flex-1 custom-scrollbar">
          {isEditing ? (
            /* =================================================
               EDIT FORM
            ================================================== */

            <div className="space-y-3 bg-slate-800/50 p-4 rounded-2xl border border-slate-700">
              <div>
                <label className="font-bold text-slate-400 block mb-1">
                  Họ và Tên
                </label>

                <input
                  type="text"
                  value={
                    formData.fullName
                  }
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      fullName:
                        event.target
                          .value,
                    })
                  }
                  className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl font-semibold text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-400 block mb-1">
                    Số Điện Thoại
                  </label>

                  <input
                    type="text"
                    value={
                      formData.phone
                    }
                    onChange={(
                      event
                    ) =>
                      setFormData({
                        ...formData,
                        phone: event
                          .target
                          .value,
                      })
                    }
                    className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl font-semibold text-white outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-400 block mb-1">
                    Số CCCD/CMND
                  </label>

                  <input
                    type="text"
                    value={
                      formData.identityCardNumber
                    }
                    onChange={(
                      event
                    ) =>
                      setFormData({
                        ...formData,
                        identityCardNumber:
                          event
                            .target
                            .value,
                      })
                    }
                    className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl font-semibold text-white font-mono outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {isShipper && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-400 block mb-1">
                      Biển Số Xe
                    </label>

                    <input
                      type="text"
                      value={
                        formData.licensePlate
                      }
                      onChange={(
                        event
                      ) =>
                        setFormData({
                          ...formData,
                          licensePlate:
                            event
                              .target
                              .value,
                        })
                      }
                      className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl font-semibold text-white outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-400 block mb-1">
                      Loại Phương Tiện
                    </label>

                    <input
                      type="text"
                      value={
                        formData.vehicleType
                      }
                      onChange={(
                        event
                      ) =>
                        setFormData({
                          ...formData,
                          vehicleType:
                            event
                              .target
                              .value,
                        })
                      }
                      className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl font-semibold text-white outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}

              {isMerchant && (
                <>
                  <div>
                    <label className="font-bold text-slate-400 block mb-1">
                      Tên Cửa Hàng
                    </label>

                    <input
                      type="text"
                      value={
                        formData.shopName
                      }
                      onChange={(
                        event
                      ) =>
                        setFormData({
                          ...formData,
                          shopName:
                            event
                              .target
                              .value,
                        })
                      }
                      className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl font-semibold text-white outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-400 block mb-1">
                      Địa Chỉ
                    </label>

                    <input
                      type="text"
                      value={
                        formData.address
                      }
                      onChange={(
                        event
                      ) =>
                        setFormData({
                          ...formData,
                          address:
                            event
                              .target
                              .value,
                        })
                      }
                      className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl font-semibold text-white outline-none focus:border-indigo-500"
                    />
                  </div>
                </>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  disabled={
                    loading
                  }
                  onClick={
                    handleSaveEdit
                  }
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition cursor-pointer"
                >
                  {loading
                    ? "Đang lưu..."
                    : "💾 Lưu Thay Đổi"}
                </button>

                <button
                  onClick={() =>
                    setIsEditing(
                      false
                    )
                  }
                  className="px-4 bg-slate-800 text-slate-300 font-bold rounded-xl border border-slate-700 cursor-pointer hover:bg-slate-700"
                >
                  Hủy
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* =================================================
                  BASIC INFO
              ================================================== */}

              <div className="grid grid-cols-2 gap-4 bg-slate-800/40 p-4 rounded-2xl border border-slate-700/60">
                <div className="flex items-center gap-3 col-span-2 sm:col-span-1">
                  {user.avatarUrl ? (
                    <img
                      src={
                        user.avatarUrl
                      }
                      alt="Avatar"
                      className="w-10 h-10 rounded-full object-cover border border-indigo-500/50"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center font-bold text-slate-300">
                      {(formData.fullName ||
                        "?")
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                  )}

                  <div>
                    <span className="text-slate-400 block mb-0.5">
                      Họ và Tên
                    </span>

                    <span className="font-bold text-sm text-slate-100">
                      {
                        formData.fullName
                      }
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 block mb-0.5">
                    Số Điện Thoại
                  </span>

                  <span className="font-bold text-sm text-slate-100">
                    {
                      formData.phone
                    }
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block mb-0.5">
                    Số CCCD / CMND
                  </span>

                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    {
                      formData.identityCardNumber ||
                      "N/A"
                    }
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block mb-0.5">
                    Trạng Thái Hồ Sơ
                  </span>

                  <span
                    className={`font-bold inline-flex items-center gap-1 ${
                      isBlocked ||
                      isRejected
                        ? "text-rose-400"
                        : isApproved
                        ? "text-emerald-400"
                        : "text-amber-400"
                    }`}
                  >
                    {isPending
                      ? "⏳ Chờ Phê Duyệt"
                      : isApproved
                      ? "✅ Đã Duyệt"
                      : isRejected
                      ? "❌ Đã Từ Chối"
                      : "🔒 Bị Khóa"}
                  </span>
                </div>
              </div>

              {/* =================================================
                  MERCHANT COMMISSION
              ================================================== */}

              {isMerchant && (
                <div className="bg-gradient-to-br from-indigo-950/60 to-slate-800/70 p-4 rounded-2xl border border-indigo-500/30 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-indigo-300 uppercase flex items-center gap-1.5">
                        💎 Chiết Khấu Sàn
                      </h4>

                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Mức hoa hồng áp dụng riêng
                        cho gian hàng này.
                      </p>
                    </div>

                    {user.merchantCode && (
                      <span className="text-[10px] text-slate-500 font-mono">
                        {user.merchantCode}
                      </span>
                    )}
                  </div>

                  <div className="bg-slate-950/60 rounded-xl border border-slate-700/70 p-3">
                    {isEditingCommission ? (
                      <div className="space-y-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                            Mức chiết khấu
                          </label>

                          <div className="flex items-center gap-2">
                            <div className="relative w-[140px]">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step={0.1}
                                value={
                                  commissionPercent
                                }
                                onChange={(
                                  event
                                ) =>
                                  setCommissionPercent(
                                    event
                                      .target
                                      .value
                                  )
                                }
                                disabled={
                                  isSavingCommission
                                }
                                autoFocus
                                className="w-full bg-slate-900 border border-indigo-500 rounded-xl px-3 py-2.5 pr-8 text-lg font-black text-white outline-none focus:ring-2 focus:ring-indigo-500/20"
                              />

                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-indigo-400">
                                %
                              </span>
                            </div>

                            <span className="text-xs text-slate-500">
                              0% – 100%
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={
                              isSavingCommission
                            }
                            onClick={
                              handleSaveCommission
                            }
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5"
                          >
                            {isSavingCommission
                              ? "Đang lưu..."
                              : "💾 Lưu chiết khấu"}
                          </button>

                          <button
                            type="button"
                            disabled={
                              isSavingCommission
                            }
                            onClick={
                              handleCancelCommission
                            }
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 font-bold rounded-xl text-xs transition cursor-pointer"
                          >
                            Hủy
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-14 h-14 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">
                            <span className="text-xl font-black text-indigo-300">
                              {
                                commissionPercent
                              }
                              %
                            </span>
                          </div>

                          <div>
                            <p className="text-sm font-extrabold text-white">
                              Hoa hồng Merchant
                            </p>

                            <p className="text-[10px] text-slate-500 mt-0.5">
                              Áp dụng riêng cho{" "}
                              {user.shopName ||
                                user.storeName ||
                                "gian hàng"}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setIsEditingCommission(
                              true
                            )
                          }
                          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition cursor-pointer"
                        >
                          ✏️ Chỉnh
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* =================================================
                  SHIPPER DEPOSIT
              ================================================== */}

              {isShipper && (
                <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-amber-400 uppercase flex items-center gap-1.5">
                        💰 Phí Gia Nhập Ban Đầu
                        (1.500.000 VNĐ)
                      </h4>

                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Yêu cầu hoàn tất trước khi
                        phê duyệt hồ sơ Shipper.
                      </p>
                    </div>

                    <span
                      className={`text-xs font-bold px-3 py-1 rounded-full border ${
                        isDepositPaid
                          ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                          : "bg-rose-500/20 border-rose-500/50 text-rose-300"
                      }`}
                    >
                      {isDepositPaid
                        ? "✓ Đã đóng 1.5tr"
                        : "✕ Chưa đóng"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-slate-700/50">
                    <span className="text-slate-300 font-medium text-xs">
                      Xác minh thanh toán từ
                      Admin:
                    </span>

                    <button
                      type="button"
                      disabled={
                        isUpdatingDeposit
                      }
                      onClick={
                        handleToggleDeposit
                      }
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${
                        isDepositPaid
                          ? "bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40"
                          : "bg-emerald-600 hover:bg-emerald-500 text-white"
                      }`}
                    >
                      {isUpdatingDeposit
                        ? "Đang xử lý..."
                        : isDepositPaid
                        ? "🔄 Đánh dấu Chưa đóng"
                        : "✅ Xác nhận ĐÃ ĐÓNG"}
                    </button>
                  </div>
                </div>
              )}

              {/* =================================================
                  SHIPPER ELIGIBILITY
              ================================================== */}

              {isShipper &&
                isPending && (
                  <div
                    className={`p-3 rounded-2xl border text-xs flex items-center justify-between ${
                      isShipperEligible
                        ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
                        : "bg-amber-950/40 border-amber-500/30 text-amber-300"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">
                        {isShipperEligible
                          ? "✅"
                          : "⚠️"}
                      </span>

                      <span>
                        {isShipperEligible
                          ? "Đã đủ điều kiện: Hồ sơ đầy đủ giấy tờ & đã hoàn tất phí."
                          : !isDocumentsComplete &&
                            !isDepositPaid
                          ? "Chưa đủ điều kiện: thiếu giấy tờ và chưa đóng phí."
                          : !isDocumentsComplete
                          ? "Chưa đủ điều kiện: còn thiếu giấy tờ."
                          : "Chưa đủ điều kiện: chưa hoàn tất phí."}
                      </span>
                    </div>
                  </div>
                )}

              {/* =================================================
                  BLOCK REASON
              ================================================== */}

              {(isBlocked ||
                isRejected) && (
                <div className="bg-rose-950/40 border border-rose-500/30 p-4 rounded-2xl space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-rose-400 flex items-center gap-1.5">
                      🔒 Lý Do{" "}
                      {isRejected
                        ? "Từ Chối"
                        : "Bị Khóa"}
                    </span>

                    <span className="text-[10px] text-rose-300/70 font-mono">
                      Chỉnh sửa trực tiếp
                    </span>
                  </div>

                  <textarea
                    rows={2}
                    value={
                      editBlockReason
                    }
                    onChange={(event) =>
                      setEditBlockReason(
                        event.target
                          .value
                      )
                    }
                    placeholder="Nhập hoặc chỉnh sửa lý do..."
                    className="w-full p-2.5 bg-slate-950/80 border border-rose-500/30 rounded-xl text-xs text-rose-100 placeholder-rose-400/50 outline-none focus:border-rose-500 font-medium resize-none"
                  />

                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 font-medium">
                      Gợi ý chọn nhanh:
                    </span>

                    <div className="flex flex-wrap gap-1">
                      {QUICK_REASONS.map(
                        (
                          reason,
                          index
                        ) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() =>
                              setEditBlockReason(
                                reason
                              )
                            }
                            className="text-[10px] bg-slate-900/80 hover:bg-rose-900/40 text-slate-300 border border-slate-700/80 px-2 py-0.5 rounded-md transition cursor-pointer text-left"
                          >
                            +{" "}
                            {reason}
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      disabled={
                        isUpdatingReason
                      }
                      onClick={
                        handleSaveBlockReason
                      }
                      className="bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold px-3 py-1.5 rounded-xl transition cursor-pointer text-xs"
                    >
                      {isUpdatingReason
                        ? "Đang lưu..."
                        : "💾 Cập Nhật Lý Do"}
                    </button>
                  </div>
                </div>
              )}

              {/* =================================================
                  SHIPPER DOCUMENTS
              ================================================== */}

              {isShipper && (
                <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-indigo-400 uppercase flex items-center gap-1.5">
                      🛵 Phương Tiện & Giấy Tờ
                      Xác Minh
                    </h4>

                    <span className="text-[10px] text-slate-400">
                      Click ảnh để phóng to
                      & xoay
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-slate-300 bg-slate-900/60 p-3 rounded-xl border border-slate-700/50">
                    <div>
                      Biển số xe:{" "}
                      <b className="text-white font-mono">
                        {
                          formData.licensePlate
                        }
                      </b>
                    </div>

                    <div>
                      Loại xe:{" "}
                      <b className="text-white">
                        {
                          formData.vehicleType
                        }
                      </b>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 pt-1">
                    {/* FRONT */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-semibold text-slate-400">
                          CCCD Mặt Trước
                        </span>

                        {hasIdFront && (
                          <span className="text-[9px] text-emerald-400 font-bold">
                            ✓ Đã nộp
                          </span>
                        )}
                      </div>

                      {hasIdFront ? (
                        <div
                          onClick={() =>
                            openLightbox(
                              user.idCardFrontUrl,
                              "CCCD Mặt Trước"
                            )
                          }
                          className="relative group cursor-pointer overflow-hidden rounded-xl border border-slate-700 hover:border-indigo-500 transition h-24 bg-slate-950"
                        >
                          <img
                            src={
                              user.idCardFrontUrl
                            }
                            alt="Front"
                            className="w-full h-full object-cover group-hover:scale-105 transition"
                          />

                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition">
                            🔍 Phóng to
                          </div>
                        </div>
                      ) : (
                        <div className="h-24 bg-slate-900 rounded-xl border border-slate-800 border-dashed flex items-center justify-center text-slate-500 text-[10px]">
                          Chưa tải lên
                        </div>
                      )}
                    </div>

                    {/* BACK */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-semibold text-slate-400">
                          CCCD Mặt Sau
                        </span>

                        {hasIdBack && (
                          <span className="text-[9px] text-emerald-400 font-bold">
                            ✓ Đã nộp
                          </span>
                        )}
                      </div>

                      {hasIdBack ? (
                        <div
                          onClick={() =>
                            openLightbox(
                              user.idCardBackUrl,
                              "CCCD Mặt Sau"
                            )
                          }
                          className="relative group cursor-pointer overflow-hidden rounded-xl border border-slate-700 hover:border-indigo-500 transition h-24 bg-slate-950"
                        >
                          <img
                            src={
                              user.idCardBackUrl
                            }
                            alt="Back"
                            className="w-full h-full object-cover group-hover:scale-105 transition"
                          />

                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition">
                            🔍 Phóng to
                          </div>
                        </div>
                      ) : (
                        <div className="h-24 bg-slate-900 rounded-xl border border-slate-800 border-dashed flex items-center justify-center text-slate-500 text-[10px]">
                          Chưa tải lên
                        </div>
                      )}
                    </div>

                    {/* LICENSE */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-semibold text-slate-400">
                          Bằng Lái Xe
                        </span>

                        {hasLicense && (
                          <span className="text-[9px] text-emerald-400 font-bold">
                            ✓ Đã nộp
                          </span>
                        )}
                      </div>

                      {hasLicense ? (
                        <div
                          onClick={() =>
                            openLightbox(
                              user.driverLicenseUrl,
                              "Bằng Lái Xe"
                            )
                          }
                          className="relative group cursor-pointer overflow-hidden rounded-xl border border-slate-700 hover:border-indigo-500 transition h-24 bg-slate-950"
                        >
                          <img
                            src={
                              user.driverLicenseUrl
                            }
                            alt="License"
                            className="w-full h-full object-cover group-hover:scale-105 transition"
                          />

                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition">
                            🔍 Phóng to
                          </div>
                        </div>
                      ) : (
                        <div className="h-24 bg-slate-900 rounded-xl border border-slate-800 border-dashed flex items-center justify-center text-slate-500 text-[10px]">
                          Chưa tải lên
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* =================================================
                  MERCHANT INFO
              ================================================== */}

              {isMerchant && (
                <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700 space-y-2">
                  <h4 className="font-bold text-amber-400 uppercase">
                    🏪 Thông Tin Gian Hàng
                  </h4>

                  <div className="grid grid-cols-2 gap-2 text-slate-300">
                    <div>
                      Tên gian hàng:{" "}
                      <b className="text-white">
                        {
                          formData.shopName
                        }
                      </b>
                    </div>

                    <div>
                      Mã Merchant:{" "}
                      <b className="text-white">
                        {
                          user.merchantCode ||
                          userId
                        }
                      </b>
                    </div>

                    <div>
                      Mã số thuế:{" "}
                      <b className="text-white">
                        {
                          user.taxCode ||
                          "N/A"
                        }
                      </b>
                    </div>

                    <div>
                      Địa chỉ:{" "}
                      <b className="text-white">
                        {
                          formData.address ||
                          "N/A"
                        }
                      </b>
                    </div>
                  </div>
                </div>
              )}

              {/* =================================================
                  ACTIONS
              ================================================== */}

              <div className="pt-2 border-t border-slate-800 space-y-2">
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setIsEditing(
                        true
                      )
                    }
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2.5 rounded-xl border border-slate-700 transition cursor-pointer"
                  >
                    ✏️ Sửa Thông Tin
                  </button>

                  <button
                    onClick={() => {
                      setNewPassword(
                        ""
                      );

                      setShowResetPasswordModal(
                        true
                      );
                    }}
                    className="flex-1 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 font-bold py-2.5 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    🔑 Đổi Mật Khẩu
                  </button>

                  <button
                    disabled={
                      loading
                    }
                    onClick={
                      handleDeleteUser
                    }
                    className="px-4 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-bold rounded-xl transition cursor-pointer"
                  >
                    🗑️ Xóa
                  </button>
                </div>

                <div className="flex gap-2 pt-1">
                  {isPending ? (
                    <>
                      <button
                        disabled={
                          loading ||
                          (isShipper &&
                            !isShipperEligible)
                        }
                        onClick={() =>
                          executeUpdateStatus(
                            "APPROVED"
                          )
                        }
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:border disabled:border-slate-700 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition cursor-pointer shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-1.5"
                      >
                        ✓ Phê Duyệt Hồ Sơ
                      </button>

                      <button
                        disabled={
                          loading
                        }
                        onClick={
                          handleRejectUser
                        }
                        className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 rounded-xl transition cursor-pointer shadow-lg shadow-rose-900/30 flex items-center justify-center gap-1.5"
                      >
                        ✕ Từ Chối
                      </button>
                    </>
                  ) : (
                    <button
                      disabled={
                        loading
                      }
                      onClick={
                        handleToggleBlock
                      }
                      className={`flex-1 font-bold py-2.5 rounded-xl text-white transition cursor-pointer active:scale-98 disabled:opacity-50 ${
                        isBlocked
                          ? "bg-emerald-600 hover:bg-emerald-500"
                          : "bg-amber-600 hover:bg-amber-500"
                      }`}
                    >
                      {isBlocked
                        ? "🔓 Mở Khóa Tài Khoản"
                        : "🔒 Khóa Tài Khoản"}
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* =====================================================
          RESET PASSWORD MODAL
      ====================================================== */}

      {showResetPasswordModal && (
        <div className="fixed inset-0 z-[60] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-indigo-500/40 w-full max-w-sm rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xl">
                🔑
              </div>

              <div>
                <h4 className="font-bold text-white text-sm">
                  Đặt Lại Mật Khẩu
                </h4>

                <p className="text-[11px] text-slate-400">
                  {
                    formData.fullName
                  }
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-300">
                  Mật khẩu mới
                </label>

                <button
                  type="button"
                  onClick={
                    generateRandomPassword
                  }
                  className="text-[10px] font-bold text-indigo-400 hover:underline cursor-pointer"
                >
                  ⚡ Tự động tạo
                </button>
              </div>

              <input
                type="text"
                value={
                  newPassword
                }
                onChange={(event) =>
                  setNewPassword(
                    event.target
                      .value
                  )
                }
                placeholder="Nhập mật khẩu mới..."
                className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono font-bold text-emerald-400 placeholder-slate-600 outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex gap-2 justify-end pt-2 border-t border-slate-800">
              <button
                disabled={
                  isResettingPassword
                }
                onClick={() =>
                  setShowResetPasswordModal(
                    false
                  )
                }
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
              >
                Hủy
              </button>

              <button
                disabled={
                  isResettingPassword
                }
                onClick={
                  handleResetPassword
                }
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs cursor-pointer"
              >
                {isResettingPassword
                  ? "Đang lưu..."
                  : "Xác Nhận Đổi MK"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          BLOCK / REJECT MODAL
      ====================================================== */}

      {showBlockReasonModal && (
        <div className="fixed inset-0 z-[60] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/40 w-full max-w-md rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <span className="text-amber-500 text-xl">
                ⚠️
              </span>

              <h4 className="font-bold text-white text-sm">
                Lý Do{" "}
                {pendingActionStatus ===
                "REJECTED"
                  ? "Từ Chối Hồ Sơ"
                  : "Khóa Tài Khoản"}
              </h4>
            </div>

            <p className="text-slate-300 text-xs leading-relaxed">
              Lý do này sẽ được ghi vào hệ
              thống và gửi thông báo trực tiếp
              tới người dùng.
            </p>

            <div className="space-y-1.5">
              <span className="text-[11px] text-slate-400 font-medium">
                Gợi ý chọn nhanh:
              </span>

              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                {QUICK_REASONS.map(
                  (
                    reason,
                    index
                  ) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() =>
                        setBlockReason(
                          reason
                        )
                      }
                      className="text-[10px] bg-slate-800 hover:bg-indigo-900/50 text-slate-300 border border-slate-700 px-2.5 py-1 rounded-lg transition cursor-pointer text-left"
                    >
                      +{" "}
                      {reason}
                    </button>
                  )
                )}
              </div>
            </div>

            <textarea
              rows={3}
              value={
                blockReason
              }
              onChange={(event) =>
                setBlockReason(
                  event.target
                    .value
                )
              }
              placeholder="Hoặc tự nhập lý do chi tiết..."
              className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500 resize-none"
            />

            <div className="flex gap-2 justify-end pt-2 border-t border-slate-800">
              <button
                disabled={
                  loading
                }
                onClick={() =>
                  setShowBlockReasonModal(
                    false
                  )
                }
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
              >
                Hủy
              </button>

              <button
                type="button"
                disabled={
                  loading
                }
                onClick={
                  handleConfirmActionWithReason
                }
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs cursor-pointer"
              >
                {loading
                  ? "Đang xử lý..."
                  : "Xác Nhận & Gửi TB"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          IMAGE LIGHTBOX
      ====================================================== */}

      {previewImage && (
        <div
          onClick={() =>
            setPreviewImage(
              null
            )
          }
          className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out"
        >
          <div
            className="max-w-3xl max-h-[90vh] space-y-3 text-center"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="flex justify-between items-center text-white px-2">
              <span className="font-bold text-sm">
                {
                  previewImage.title
                }
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setImageRotation(
                      (rotation) =>
                        (rotation +
                          90) %
                        360
                    )
                  }
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-lg border border-slate-700 text-indigo-300 cursor-pointer"
                >
                  🔄 Xoay
                </button>

                <button
                  onClick={() =>
                    setPreviewImage(
                      null
                    )
                  }
                  className="text-xl font-bold p-1 hover:text-rose-400 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 flex items-center justify-center min-h-[300px]">
              <img
                src={
                  previewImage.url
                }
                alt={
                  previewImage.title
                }
                style={{
                  transform: `rotate(${imageRotation}deg)`,
                }}
                className="max-w-full max-h-[75vh] object-contain transition-transform duration-200"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}