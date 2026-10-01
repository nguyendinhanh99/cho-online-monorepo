"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
} from "firebase/auth";

import {
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

/* ============================================================
   HELPERS
============================================================ */

const normalizePhone = (value: string): string => {
  let phone = String(value || "")
    .trim()
    .replace(/[^\d+]/g, "");

  if (phone.startsWith("+84")) {
    phone = `0${phone.slice(3)}`;
  }

  return phone.replace(/\D/g, "");
};

const isValidVietnamPhone = (phone: string): boolean =>
  /^0\d{9}$/.test(phone);

const getShipperVirtualEmail = (phone: string): string =>
  `${normalizePhone(phone)}@shipper.choonline.vn`;

const maskPhone = (phone: string): string => {
  const clean = normalizePhone(phone);

  if (clean.length < 7) {
    return clean;
  }

  return `${clean.slice(0, 4)}***${clean.slice(-3)}`;
};

async function readApiJson(response: Response): Promise<any> {
  const raw = await response.text();

  if (!raw.trim()) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    console.error("[SHIPPER PASSWORD RESET] API response không phải JSON:", {
      status: response.status,
      body: raw.slice(0, 500),
    });

    return null;
  }
}

/* ============================================================
   PAGE
============================================================ */

export default function ShipperLoginPage() {
  const router = useRouter();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  /* ==========================================================
     FORGOT PASSWORD
  ========================================================== */

  const [isForgotPasswordOpen, setIsForgotPasswordOpen] =
    useState(false);

  const [forgotPhone, setForgotPhone] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState(false);

  /* ==========================================================
     FORCE CHANGE TEMP PASSWORD
  ========================================================== */

  const [mustChangePassword, setMustChangePassword] =
    useState(false);

  const [loggedInShipperUid, setLoggedInShipperUid] =
    useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] =
    useState("");

  const [showNewPassword, setShowNewPassword] = useState(false);
  const [changePasswordLoading, setChangePasswordLoading] =
    useState(false);
  const [changePasswordError, setChangePasswordError] =
    useState("");

  /* ==========================================================
     GENERAL MODAL
  ========================================================== */

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: "PENDING" | "REJECTED" | "ERROR";
    title: string;
    message: string;
  }>({
    isOpen: false,
    type: "PENDING",
    title: "",
    message: "",
  });

  /* ==========================================================
     LOGIN
  ========================================================== */

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanPhone = normalizePhone(phone);

    if (!isValidVietnamPhone(cleanPhone)) {
      setModalState({
        isOpen: true,
        type: "ERROR",
        title: "Số điện thoại chưa hợp lệ",
        message:
          "Vui lòng kiểm tra lại số điện thoại đã đăng ký tài khoản Shipper.",
      });
      return;
    }

    if (password.length < 6) {
      setModalState({
        isOpen: true,
        type: "ERROR",
        title: "Mật khẩu chưa hợp lệ",
        message: "Mật khẩu phải có ít nhất 6 ký tự.",
      });
      return;
    }

    setIsLoading(true);

    try {
      const virtualEmail = getShipperVirtualEmail(cleanPhone);

      const userCredential =
        await signInWithEmailAndPassword(
          auth,
          virtualEmail,
          password
        );

      const uid = userCredential.user.uid;

      const shipperDoc = await getDoc(
        doc(db, "shippers", uid)
      );

      if (!shipperDoc.exists()) {
        await signOut(auth).catch(() => {});

        setModalState({
          isOpen: true,
          type: "ERROR",
          title: "Không tìm thấy tài khoản",
          message:
            "Số điện thoại này chưa được đăng ký làm đối tác tài xế.",
        });

        return;
      }

      const shipperData = shipperDoc.data();

      if (shipperData.status === "PENDING_APPROVAL") {
        await signOut(auth).catch(() => {});

        setModalState({
          isOpen: true,
          type: "PENDING",
          title: "Hồ sơ đang chờ phê duyệt",
          message:
            "Hồ sơ tài xế của bạn đang được Ban Quản Trị hệ thống kiểm tra và xét duyệt.",
        });

        return;
      }

      if (shipperData.status === "REJECTED") {
        await signOut(auth).catch(() => {});

        setModalState({
          isOpen: true,
          type: "REJECTED",
          title: "Hồ sơ không được duyệt",
          message:
            "Hồ sơ của bạn không đủ điều kiện xét duyệt. Vui lòng liên hệ bộ phận hỗ trợ.",
        });

        return;
      }

      if (shipperData.status !== "APPROVED") {
        await signOut(auth).catch(() => {});

        setModalState({
          isOpen: true,
          type: "ERROR",
          title: "Tài khoản chưa sẵn sàng",
          message:
            "Trạng thái tài khoản hiện tại chưa cho phép đăng nhập hệ thống Shipper.",
        });

        return;
      }

      /**
       * Admin vừa cấp mật khẩu tạm:
       * Không cho vào dashboard ngay.
       * Bắt buộc đổi mật khẩu mới trước.
       */
      if (Boolean(shipperData.mustChangePassword)) {
        setLoggedInShipperUid(uid);
        setMustChangePassword(true);
        setChangePasswordError("");
        setNewPassword("");
        setConfirmNewPassword("");
        return;
      }

      localStorage.setItem("shipper_token", uid);
      router.replace("/");
    } catch (error: any) {
      console.warn(
        "Lỗi đăng nhập Firebase:",
        error?.code || error?.message
      );

      let errorMessage =
        "Số điện thoại hoặc mật khẩu không chính xác. Vui lòng thử lại!";

      if (
        error?.code === "auth/invalid-credential" ||
        error?.code === "auth/user-not-found" ||
        error?.code === "auth/wrong-password" ||
        error?.code === "auth/invalid-email"
      ) {
        errorMessage = "Số điện thoại hoặc mật khẩu không đúng!";
      } else if (error?.code === "auth/too-many-requests") {
        errorMessage =
          "Tài khoản tạm thời bị khóa do đăng nhập sai quá nhiều lần. Vui lòng thử lại sau!";
      } else if (error?.code === "auth/network-request-failed") {
        errorMessage =
          "Không thể kết nối mạng. Vui lòng kiểm tra Internet.";
      }

      setModalState({
        isOpen: true,
        type: "ERROR",
        title: "Đăng nhập thất bại",
        message: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  /* ==========================================================
     PASSWORD RESET REQUEST
  ========================================================== */

  const openForgotPassword = () => {
    setForgotPhone(normalizePhone(phone) || phone);
    setForgotError("");
    setForgotSuccess(false);
    setIsForgotPasswordOpen(true);
  };

  const closeForgotPassword = () => {
    if (forgotLoading) {
      return;
    }

    setIsForgotPasswordOpen(false);
    setForgotError("");
    setForgotSuccess(false);
  };

  const handlePasswordResetRequest = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    const cleanPhone = normalizePhone(forgotPhone);

    if (!isValidVietnamPhone(cleanPhone)) {
      setForgotError("Số điện thoại chưa hợp lệ.");
      return;
    }

    setForgotLoading(true);
    setForgotError("");

    try {
      const response = await fetch(
        "/api/auth/password-reset-request",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            phone: cleanPhone,
          }),
          cache: "no-store",
        }
      );

      const data = await readApiJson(response);

      if (!response.ok) {
        throw new Error(
          data?.message ||
            `Không thể gửi yêu cầu (HTTP ${response.status}).`
        );
      }

      if (!data || data.success !== true) {
        throw new Error(
          "Máy chủ chưa trả về dữ liệu hợp lệ."
        );
      }

      setForgotPhone(cleanPhone);
      setForgotSuccess(true);
    } catch (error: any) {
      console.error(
        "[SHIPPER PASSWORD RESET REQUEST] Client:",
        error
      );

      setForgotError(
        error?.message ||
          "Chưa thể gửi yêu cầu. Vui lòng thử lại."
      );
    } finally {
      setForgotLoading(false);
    }
  };

  /* ==========================================================
     CHANGE TEMP PASSWORD
  ========================================================== */

  const handleChangeTemporaryPassword = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    const currentUser = auth.currentUser;

    if (!currentUser || !loggedInShipperUid) {
      setChangePasswordError(
        "Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại."
      );
      return;
    }

    if (newPassword.length < 6) {
      setChangePasswordError(
        "Mật khẩu mới phải có ít nhất 6 ký tự."
      );
      return;
    }

    if (newPassword === password) {
      setChangePasswordError(
        "Mật khẩu mới phải khác mật khẩu tạm hiện tại."
      );
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setChangePasswordError(
        "Mật khẩu xác nhận không khớp."
      );
      return;
    }

    setChangePasswordLoading(true);
    setChangePasswordError("");

    try {
      const virtualEmail = getShipperVirtualEmail(phone);

      /**
       * Xác minh lại bằng mật khẩu tạm vừa đăng nhập.
       */
      const credential =
        EmailAuthProvider.credential(
          virtualEmail,
          password
        );

      await reauthenticateWithCredential(
        currentUser,
        credential
      );

      await updatePassword(
        currentUser,
        newPassword
      );

      await updateDoc(
        doc(
          db,
          "shippers",
          loggedInShipperUid
        ),
        {
          mustChangePassword: false,
          passwordChangedAt:
            serverTimestamp(),
          updatedAt:
            serverTimestamp(),
        }
      );

      localStorage.setItem(
        "shipper_token",
        loggedInShipperUid
      );

      setMustChangePassword(false);
      setPassword("");
      setNewPassword("");
      setConfirmNewPassword("");

      router.replace("/");
    } catch (error: any) {
      console.warn(
        "Lỗi đổi mật khẩu Shipper:",
        error
      );

      const code = String(
        error?.code || ""
      );

      if (
        code === "auth/invalid-credential" ||
        code === "auth/wrong-password"
      ) {
        setChangePasswordError(
          "Mật khẩu tạm hiện tại không chính xác. Vui lòng đăng nhập lại."
        );
      } else if (
        code === "auth/weak-password"
      ) {
        setChangePasswordError(
          "Mật khẩu mới quá yếu. Vui lòng chọn mật khẩu mạnh hơn."
        );
      } else if (
        code === "auth/requires-recent-login"
      ) {
        setChangePasswordError(
          "Phiên đăng nhập đã hết hiệu lực. Vui lòng đăng xuất và đăng nhập lại."
        );
      } else if (
        code === "auth/too-many-requests"
      ) {
        setChangePasswordError(
          "Bạn đã thử quá nhiều lần. Vui lòng chờ một lúc rồi thử lại."
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

  const handleLogoutFromForcedChange = async () => {
    await signOut(auth).catch(() => {});

    setMustChangePassword(false);
    setLoggedInShipperUid("");
    setPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
    setChangePasswordError("");
  };

  /* ==========================================================
     UI
  ========================================================== */

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-stone-100 p-4 font-sans">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />

      <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />

      <div className="relative z-10 w-full max-w-sm space-y-6 rounded-3xl border border-stone-200/80 bg-white/90 p-6 shadow-xl backdrop-blur-md sm:p-8">
        {/* HEADER */}
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-3xl font-black text-white shadow-lg shadow-blue-500/20">
            🛵
          </div>

          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-stone-800">
              Tài Xế Shipper
            </h1>

            <p className="mt-1 text-xs font-medium text-stone-400">
              Đăng nhập hệ thống đối tác vận chuyển Anvami
            </p>
          </div>
        </div>

        {/* LOGIN FORM */}
        <form
          onSubmit={handleLogin}
          className="space-y-4"
        >
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-stone-600">
              Số điện thoại
            </label>

            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              placeholder="0865234554"
              value={phone}
              onChange={(e) =>
                setPhone(e.target.value)
              }
              className="w-full rounded-xl border border-stone-200 bg-stone-50/80 px-3.5 py-3 text-xs font-medium text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-600">
                Mật khẩu
              </label>

              <button
                type="button"
                onClick={openForgotPassword}
                className="cursor-pointer text-[11px] font-bold text-blue-600 transition hover:text-blue-700 hover:underline"
              >
                Quên mật khẩu?
              </button>
            </div>

            <div className="relative">
              <input
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                autoComplete="current-password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) =>
                  setPassword(
                    e.target.value
                  )
                }
                className="w-full rounded-xl border border-stone-200 bg-stone-50/80 py-3 pl-3.5 pr-14 text-xs font-medium text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10"
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword(
                    (value) =>
                      !value
                  )
                }
                className="absolute inset-y-0 right-3 my-auto h-fit cursor-pointer text-[10px] font-bold text-stone-400 transition hover:text-blue-600"
              >
                {showPassword
                  ? "Ẩn"
                  : "Hiện"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3 text-xs font-extrabold text-white shadow-md shadow-blue-500/20 transition-all duration-200 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-white" />
                Đang xử lý...
              </>
            ) : (
              "ĐĂNG NHẬP NGAY"
            )}
          </button>
        </form>

        <div className="border-t border-stone-100 pt-3 text-center text-xs text-stone-500">
          Chưa có tài khoản đối tác?{" "}
          <Link
            href="/register"
            className="font-extrabold text-blue-600 transition hover:text-blue-700 hover:underline"
          >
            Đăng ký làm Tài xế
          </Link>
        </div>
      </div>

      {/* ======================================================
          FORGOT PASSWORD REQUEST MODAL
      ====================================================== */}

      {isForgotPasswordOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/60 p-3 backdrop-blur-sm sm:items-center sm:p-4"
          onMouseDown={(e) => {
            if (
              e.target ===
              e.currentTarget
            ) {
              closeForgotPassword();
            }
          }}
        >
          <div className="w-full max-w-sm overflow-hidden rounded-[28px] border border-blue-100 bg-white shadow-2xl">
            <div className="relative bg-gradient-to-br from-blue-50 via-white to-indigo-50 px-5 pb-5 pt-5">
              <button
                type="button"
                onClick={closeForgotPassword}
                disabled={forgotLoading}
                className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-400 disabled:opacity-50"
                aria-label="Đóng"
              >
                ×
              </button>

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20">
                🔐
              </div>

              <h2 className="mt-3 text-base font-black text-stone-900">
                {forgotSuccess
                  ? "Đã gửi yêu cầu"
                  : "Yêu cầu cấp lại mật khẩu"}
              </h2>

              <p className="mt-1.5 pr-5 text-[11px] leading-relaxed text-stone-500">
                {forgotSuccess
                  ? "Anvami đã ghi nhận yêu cầu hỗ trợ tài khoản Shipper của bạn."
                  : "Nhập số điện thoại đã đăng ký. Admin sẽ xác minh tài khoản và cấp mật khẩu tạm thời."}
              </p>
            </div>

            {!forgotSuccess ? (
              <form
                onSubmit={
                  handlePasswordResetRequest
                }
                className="space-y-4 p-5"
              >
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold text-stone-700">
                    Số điện thoại đăng ký
                  </label>

                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="0865234554"
                    value={forgotPhone}
                    onChange={(e) => {
                      setForgotPhone(
                        e.target.value
                      );
                      setForgotError("");
                    }}
                    className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold text-stone-800 outline-none transition focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-100"
                    required
                  />

                  {forgotError && (
                    <div className="mt-2 rounded-xl border border-rose-100 bg-rose-50 p-2.5 text-[10px] font-semibold text-rose-600">
                      {forgotError}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-3.5">
                  <p className="text-[10px] font-black text-stone-700">
                    Quy trình hỗ trợ
                  </p>

                  <div className="mt-2 space-y-1.5 text-[9px] leading-relaxed text-stone-500">
                    <p>1. Gửi yêu cầu bằng số điện thoại Shipper đã đăng ký.</p>
                    <p>2. Admin Anvami kiểm tra và xác minh tài khoản.</p>
                    <p>3. Hệ thống tạo mật khẩu tạm và Admin chủ động gửi cho bạn.</p>
                    <p>4. Đăng nhập bằng mật khẩu tạm và tạo mật khẩu mới.</p>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3.5 text-xs font-black uppercase tracking-wide text-white shadow-lg shadow-blue-500/20 transition active:scale-[0.99] disabled:opacity-50"
                >
                  {forgotLoading
                    ? "Đang gửi yêu cầu..."
                    : "Gửi yêu cầu hỗ trợ"}
                </button>

                <p className="text-center text-[9px] leading-relaxed text-stone-400">
                  Anvami không yêu cầu bạn cung cấp mật khẩu hiện tại cho nhân viên hỗ trợ.
                </p>
              </form>
            ) : (
              <div className="p-5">
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 font-black text-white">
                      ✓
                    </div>

                    <div>
                      <p className="text-[11px] font-black text-emerald-800">
                        Yêu cầu đã được ghi nhận
                      </p>

                      <p className="mt-1 text-[10px] leading-relaxed text-emerald-700/80">
                        Yêu cầu hỗ trợ cho Shipper số{" "}
                        <span className="font-black">
                          {maskPhone(forgotPhone)}
                        </span>{" "}
                        đã được chuyển tới bộ phận quản trị.
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={closeForgotPassword}
                  className="mt-4 w-full rounded-2xl bg-stone-900 py-3.5 text-xs font-black text-white"
                >
                  Đã hiểu
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================
          FORCE CHANGE TEMP PASSWORD MODAL
      ====================================================== */}

      {mustChangePassword && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-stone-950/70 p-3 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-sm overflow-hidden rounded-[28px] border border-blue-100 bg-white shadow-2xl">
            <div className="bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20">
                🔑
              </div>

              <h2 className="mt-3 text-base font-black text-stone-900">
                Tạo mật khẩu mới
              </h2>

              <p className="mt-1.5 text-[11px] leading-relaxed text-stone-500">
                Bạn đang đăng nhập bằng mật khẩu tạm do Anvami cấp. Vui lòng tạo mật khẩu riêng trước khi vào hệ thống Shipper.
              </p>
            </div>

            <form
              onSubmit={
                handleChangeTemporaryPassword
              }
              className="space-y-4 p-5"
            >
              {changePasswordError && (
                <div className="rounded-2xl border border-rose-100 bg-rose-50 px-3.5 py-3 text-[10px] font-semibold leading-relaxed text-rose-600">
                  {changePasswordError}
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-[11px] font-bold text-stone-700">
                  Mật khẩu mới
                </label>

                <div className="relative">
                  <input
                    type={
                      showNewPassword
                        ? "text"
                        : "password"
                    }
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(
                        e.target.value
                      );
                      setChangePasswordError("");
                    }}
                    placeholder="Tối thiểu 6 ký tự"
                    disabled={changePasswordLoading}
                    className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 pr-14 text-sm font-semibold text-stone-800 outline-none transition focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                    required
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowNewPassword(
                        (value) =>
                          !value
                      )
                    }
                    className="absolute inset-y-0 right-3 my-auto h-fit text-[10px] font-bold text-stone-400 hover:text-blue-600"
                  >
                    {showNewPassword
                      ? "Ẩn"
                      : "Hiện"}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-bold text-stone-700">
                  Nhập lại mật khẩu mới
                </label>

                <input
                  type={
                    showNewPassword
                      ? "text"
                      : "password"
                  }
                  autoComplete="new-password"
                  value={confirmNewPassword}
                  onChange={(e) => {
                    setConfirmNewPassword(
                      e.target.value
                    );
                    setChangePasswordError("");
                  }}
                  placeholder="Nhập lại mật khẩu mới"
                  disabled={changePasswordLoading}
                  className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold text-stone-800 outline-none transition focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                  required
                />
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-3.5 text-[9px] leading-relaxed text-stone-500">
                Mật khẩu mới nên khác mật khẩu tạm và không chia sẻ cho người khác hoặc nhân viên hỗ trợ.
              </div>

              <button
                type="submit"
                disabled={changePasswordLoading}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3.5 text-xs font-black uppercase tracking-wide text-white shadow-lg shadow-blue-500/20 transition active:scale-[0.99] disabled:opacity-50"
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

              <button
                type="button"
                disabled={changePasswordLoading}
                onClick={() => {
                  void handleLogoutFromForcedChange();
                }}
                className="w-full py-2 text-[10px] font-bold text-stone-400 transition hover:text-rose-500 disabled:opacity-50"
              >
                Đăng xuất
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================
          STATUS / ERROR MODAL
      ====================================================== */}

      {modalState.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xs space-y-4 rounded-3xl border border-stone-100 bg-white p-6 text-center shadow-2xl">
            <div
              className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-2xl ring-8 ${
                modalState.type === "PENDING"
                  ? "bg-amber-50 text-amber-500 ring-amber-50/50"
                  : "bg-rose-50 text-rose-500 ring-rose-50/50"
              }`}
            >
              {modalState.type === "PENDING" && "⏳"}
              {modalState.type === "REJECTED" && "❌"}
              {modalState.type === "ERROR" && "⚠️"}
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-extrabold text-stone-800">
                {modalState.title}
              </h3>

              <p className="text-xs leading-relaxed text-stone-500">
                {modalState.message}
              </p>
            </div>

            {modalState.type === "PENDING" && (
              <div className="space-y-2 rounded-2xl border border-blue-100 bg-blue-50/70 p-3 text-[11px] text-blue-900">
                <p className="font-medium text-stone-600">
                  Nếu quá{" "}
                  <strong className="text-stone-800">
                    24 giờ
                  </strong>{" "}
                  chưa được duyệt, vui lòng liên hệ trực tiếp:
                </p>

                <a
                  href="https://zalo.me/0865234554"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-95"
                >
                  💬 Liên hệ Zalo: 0865234554
                </a>
              </div>
            )}

            <button
              type="button"
              onClick={() =>
                setModalState(
                  (prev) => ({
                    ...prev,
                    isOpen: false,
                  })
                )
              }
              className="w-full cursor-pointer rounded-xl bg-stone-100 py-2.5 text-xs font-bold text-stone-700 transition hover:bg-stone-200 active:scale-95"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
