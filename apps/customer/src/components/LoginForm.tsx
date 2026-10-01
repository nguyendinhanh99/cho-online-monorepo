"use client";



import { useState } from "react";

import { useRouter } from "next/navigation";

import {

  loginWithGoogle,

  loginWithPhoneAndPassword,

  registerWithPhoneAndPassword,

} from "../services/auth.service";



type AuthMode = "LOGIN" | "REGISTER";



interface LoginFormProps {

  onSuccess?: () => void;

  redirectTo?: string;

}



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



const maskPhone = (phone: string): string => {

  const clean = normalizePhone(phone);



  if (clean.length < 7) return clean;



  return `${clean.slice(0, 4)}***${clean.slice(-3)}`;

};



export function LoginForm({

  onSuccess,

  redirectTo = "/",

}: LoginFormProps) {

  const router = useRouter();



  const [mode, setMode] = useState<AuthMode>("LOGIN");



  // ============================================================

  // FORM STATES

  // ============================================================



  const [phone, setPhone] = useState("");

  const [password, setPassword] = useState("");

  const [fullName, setFullName] = useState("");



  const [loading, setLoading] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");



  // ============================================================

  // FORGOT PASSWORD REQUEST STATES

  // ============================================================



  const [showForgotPassword, setShowForgotPassword] =

    useState(false);



  const [forgotPhone, setForgotPhone] = useState("");

  const [forgotLoading, setForgotLoading] = useState(false);

  const [forgotError, setForgotError] = useState("");

  const [forgotSuccess, setForgotSuccess] = useState(false);



  // ============================================================

  // HELPERS

  // ============================================================



  const switchMode = (newMode: AuthMode) => {

    setMode(newMode);

    setErrorMessage("");



    if (newMode === "LOGIN") {

      setFullName("");

    }

  };



  // Xử lý sau khi Đăng nhập / Đăng ký thành công

  const handleSuccess = () => {

    /**

     * Nếu page cha đã truyền onSuccess thì để page cha tự redirect.

     * Tránh router.push() hai lần.

     */

    if (onSuccess) {

      onSuccess();

      return;

    }



    router.push(redirectTo || "/");

    router.refresh();

  };



  // ============================================================

  // GOOGLE LOGIN

  // ============================================================



  const handleGoogleLogin = async () => {

    setErrorMessage("");

    setLoading(true);



    try {

      await loginWithGoogle();

      handleSuccess();

    } catch (error: any) {

      console.error("Google Auth Error:", error);



      setErrorMessage(

        error?.message ||

          "Đăng nhập bằng Gmail thất bại!"

      );

    } finally {

      setLoading(false);

    }

  };



  // ============================================================

  // PHONE LOGIN / REGISTER

  // ============================================================



  const handleSubmitPhoneAuth = async (

    e: React.FormEvent

  ) => {

    e.preventDefault();



    setErrorMessage("");



    const cleanPhone = normalizePhone(phone);



    if (!isValidVietnamPhone(cleanPhone)) {

      setErrorMessage("Số điện thoại chưa hợp lệ.");

      return;

    }



    if (password.length < 6) {

      setErrorMessage(

        "Mật khẩu phải chứa ít nhất 6 ký tự!"

      );

      return;

    }



    if (

      mode === "REGISTER" &&

      fullName.trim().length < 2

    ) {

      setErrorMessage("Vui lòng nhập họ và tên.");

      return;

    }



    setLoading(true);



    try {

      if (mode === "REGISTER") {

        /**

         * Giữ nguyên cách đăng ký cũ:

         * SĐT + mật khẩu + họ tên.

         */

        await registerWithPhoneAndPassword(

          cleanPhone,

          password,

          fullName.trim()

        );

      } else {

        await loginWithPhoneAndPassword(

          cleanPhone,

          password

        );

      }



      handleSuccess();

    } catch (error: any) {

      setErrorMessage(

        error?.message ||

          "Đã xảy ra lỗi. Vui lòng thử lại!"

      );

    } finally {

      setLoading(false);

    }

  };



  // ============================================================

  // PASSWORD RESET REQUEST

  // ============================================================



  const openForgotPassword = () => {

    setForgotPhone(

      normalizePhone(phone) || phone

    );



    setForgotError("");

    setForgotSuccess(false);

    setShowForgotPassword(true);

  };



  const closeForgotPassword = () => {

    if (forgotLoading) return;



    setShowForgotPassword(false);

    setForgotError("");

    setForgotSuccess(false);

  };



  const handleCreatePasswordResetRequest = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    const cleanPhone =
      normalizePhone(
        forgotPhone
      );

    if (
      !isValidVietnamPhone(
        cleanPhone
      )
    ) {
      setForgotError(
        "Số điện thoại chưa hợp lệ."
      );
      return;
    }

    setForgotLoading(true);
    setForgotError("");

    try {
      const response =
        await fetch(
          "/api/auth/password-reset-request",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              Accept:
                "application/json",
            },
            body:
              JSON.stringify({
                phone:
                  cleanPhone,
              }),
            cache:
              "no-store",
          }
        );

      /**
       * Không dùng response.json() trực tiếp.
       * Nếu API trả body rỗng hoặc route lỗi,
       * response.json() sẽ ném:
       * "Unexpected end of JSON input".
       */
      const rawResponse =
        await response.text();

      let data: any = null;

      if (
        rawResponse.trim()
      ) {
        try {
          data =
            JSON.parse(
              rawResponse
            );
        } catch {
          console.error(
            "[PASSWORD RESET REQUEST] Response không phải JSON:",
            {
              status:
                response.status,
              statusText:
                response.statusText,
              body:
                rawResponse.slice(
                  0,
                  500
                ),
            }
          );
        }
      }

      if (!response.ok) {
        throw new Error(
          data?.message ||
            `Không thể gửi yêu cầu (HTTP ${response.status}).`
        );
      }

      if (
        !data ||
        data.success !== true
      ) {
        throw new Error(
          "API quên mật khẩu chưa trả về dữ liệu hợp lệ."
        );
      }

      setForgotPhone(
        cleanPhone
      );

      setForgotSuccess(
        true
      );
    } catch (error: any) {
      console.error(
        "[PASSWORD RESET REQUEST] Client error:",
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



  return (

    <>

      <div className="w-full max-w-md mx-auto bg-brand-surface rounded-3xl shadow-xl border border-stone-200/80 p-8 text-brand-text transition-all">

        {/* ======================================================

            HEADER BRANDING

        \====================================================== */}



        <div className="text-center mb-6">

          <div className="inline-flex items-center justify-center w-14 h-14 bg-white text-brand-primary rounded-2xl mb-3 border border-orange-100 shadow-[0_8px_24px_rgba(238,77,45,0.12)]">

            <img

              src="/logo.png"

              alt="Anvami"

              draggable={false}

              className="w-10 h-10 object-contain"

            />

          </div>



          <h2 className="text-2xl font-black text-brand-text tracking-tight">

            {mode === "LOGIN"

              ? "Đăng nhập Anvami"

              : "Tạo tài khoản mới"}

          </h2>



          <p className="text-xs text-brand-muted mt-1 font-medium">

            Mua sắm và đặt món thuận tiện cùng Anvami

          </p>

        </div>



        {/* ======================================================

            ERROR

        \====================================================== */}



        {errorMessage && (

          <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl flex items-start gap-2 animate-in fade-in">

            <span>⚠️</span>

            <span>{errorMessage}</span>

          </div>

        )}



        {/* ======================================================

            GOOGLE

        \====================================================== */}



        <button

          type="button"

          onClick={handleGoogleLogin}

          disabled={loading}

          className="w-full bg-white hover:bg-stone-50 text-stone-700 font-bold py-3.5 px-4 rounded-2xl border border-stone-300 shadow-sm transition duration-200 disabled:opacity-50 flex justify-center items-center gap-3 text-sm cursor-pointer"

        >

          <svg className="w-5 h-5" viewBox="0 0 24 24">

            <path

              fill="#4285F4"

              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"

            />

            <path

              fill="#34A853"

              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"

            />

            <path

              fill="#FBBC05"

              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"

            />

            <path

              fill="#EA4335"

              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"

            />

          </svg>



          <span>

            {mode === "LOGIN"

              ? "Đăng nhập nhanh bằng Google"

              : "Đăng ký nhanh bằng Google"}

          </span>

        </button>



        {/* ======================================================

            DIVIDER

        \====================================================== */}



        <div className="relative my-6 text-center">

          <div className="absolute inset-0 flex items-center">

            <div className="w-full border-t border-stone-200" />

          </div>



          <span className="relative bg-brand-surface px-3 text-[11px] font-bold text-brand-muted uppercase tracking-wider">

            Hoặc dùng SĐT

          </span>

        </div>



        {/* ======================================================

            PHONE FORM

        \====================================================== */}



        <form

          onSubmit={handleSubmitPhoneAuth}

          className="space-y-4"

        >

          {mode === "REGISTER" && (

            <div>

              <label className="block text-[11px] font-bold text-brand-muted uppercase tracking-wider mb-1.5">

                Họ và tên

              </label>



              <input

                type="text"

                autoComplete="name"

                placeholder="Nguyễn Văn A"

                value={fullName}

                onChange={(e) =>

                  setFullName(e.target.value)

                }

                className="w-full px-4 py-3 border border-stone-200 rounded-2xl text-brand-text bg-brand-bg focus:bg-brand-surface focus:outline-none focus:ring-2 focus:ring-brand-primary transition text-sm font-medium"

                required

              />

            </div>

          )}



          <div>

            <label className="block text-[11px] font-bold text-brand-muted uppercase tracking-wider mb-1.5">

              Số điện thoại

            </label>



            <input

              type="tel"

              inputMode="tel"

              autoComplete="tel"

              placeholder="0865234554"

              value={phone}

              onChange={(e) => {

                setPhone(e.target.value);



                if (errorMessage) {

                  setErrorMessage("");

                }

              }}

              className="w-full px-4 py-3 border border-stone-200 rounded-2xl text-brand-text bg-brand-bg focus:bg-brand-surface focus:outline-none focus:ring-2 focus:ring-brand-primary transition text-sm font-medium"

              required

            />

          </div>



          <div>

            <div className="flex items-center justify-between gap-3 mb-1.5">

              <label className="block text-[11px] font-bold text-brand-muted uppercase tracking-wider">

                Mật khẩu

              </label>



              {mode === "LOGIN" && (

                <button

                  type="button"

                  onClick={openForgotPassword}

                  className="text-[10px] font-black text-brand-primary hover:underline cursor-pointer"

                >

                  Quên mật khẩu?

                </button>

              )}

            </div>



            <input

              type="password"

              autoComplete={

                mode === "LOGIN"

                  ? "current-password"

                  : "new-password"

              }

              placeholder="••••••••"

              value={password}

              onChange={(e) => {

                setPassword(e.target.value);



                if (errorMessage) {

                  setErrorMessage("");

                }

              }}

              className="w-full px-4 py-3 border border-stone-200 rounded-2xl text-brand-text bg-brand-bg focus:bg-brand-surface focus:outline-none focus:ring-2 focus:ring-brand-primary transition text-sm font-medium"

              required

            />

          </div>



          <button

            type="submit"

            disabled={loading}

            className="w-full bg-brand-primary hover:bg-brand-primary-hover active:opacity-90 text-brand-surface font-bold py-3.5 rounded-2xl shadow-lg transition duration-200 disabled:opacity-50 flex justify-center items-center gap-2 text-sm mt-2 cursor-pointer"

          >

            {loading ? (

              <>

                <span className="w-4 h-4 border-2 border-brand-surface border-t-transparent rounded-full animate-spin" />

                <span>Đang xử lý...</span>

              </>

            ) : (

              <span>

                {mode === "LOGIN"

                  ? "Đăng nhập SĐT"

                  : "Tạo tài khoản"}

              </span>

            )}

          </button>

        </form>



        {/* ======================================================

            MODE SWITCHER

        \====================================================== */}



        <div className="mt-6 pt-5 border-t border-stone-100 text-center text-xs text-brand-muted">

          {mode === "LOGIN" ? (

            <div>

              Bạn chưa có tài khoản?{" "}

              <button

                type="button"

                onClick={() => switchMode("REGISTER")}

                className="text-brand-accent font-bold hover:underline cursor-pointer"

              >

                Đăng ký ngay

              </button>

            </div>

          ) : (

            <div>

              Đã có tài khoản?{" "}

              <button

                type="button"

                onClick={() => switchMode("LOGIN")}

                className="text-brand-accent font-bold hover:underline cursor-pointer"

              >

                Đăng nhập ngay

              </button>

            </div>

          )}

        </div>

      </div>



      {/* ========================================================

          PASSWORD RESET REQUEST MODAL

      \======================================================== */}



      {showForgotPassword && (

        <div

          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-[2px] p-3"

          onMouseDown={(e) => {

            if (e.target === e.currentTarget) {

              closeForgotPassword();

            }

          }}

        >

          <div className="w-full max-w-sm overflow-hidden rounded-[28px] bg-white border border-orange-100 shadow-2xl">

            <div className="relative p-5 bg-gradient-to-br from-orange-50 via-white to-[#fff5ef]">

              <button

                type="button"

                onClick={closeForgotPassword}

                disabled={forgotLoading}

                className="absolute right-4 top-4 w-8 h-8 rounded-full bg-white border border-stone-200 text-stone-400 font-black disabled:opacity-50"

                aria-label="Đóng"

              >

                ×

              </button>



              <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff6a00] to-[#ee4d2d] text-white shadow-lg shadow-orange-500/20">

                <svg

                  viewBox="0 0 24 24"

                  fill="none"

                  stroke="currentColor"

                  strokeWidth="1.9"

                  strokeLinecap="round"

                  strokeLinejoin="round"

                  className="w-6 h-6"

                  aria-hidden="true"

                >

                  <rect

                    x="4"

                    y="10"

                    width="16"

                    height="11"

                    rx="2"

                  />

                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />

                  <path d="M12 14v3" />

                </svg>

              </div>



              <h3 className="mt-3 text-base font-black text-stone-900">

                {forgotSuccess

                  ? "Đã gửi yêu cầu"

                  : "Yêu cầu cấp lại mật khẩu"}

              </h3>



              <p className="mt-1.5 pr-5 text-[11px] text-stone-500 leading-relaxed">

                {forgotSuccess

                  ? "Anvami đã ghi nhận yêu cầu hỗ trợ của bạn."

                  : "Nhập số điện thoại đã đăng ký. Bộ phận hỗ trợ sẽ kiểm tra và xử lý yêu cầu trên hệ thống."}

              </p>

            </div>



            {!forgotSuccess ? (

              <form

                onSubmit={

                  handleCreatePasswordResetRequest

                }

                className="p-5 space-y-4"

              >

                <div>

                  <label className="block text-[11px] font-bold text-stone-700 mb-1.5">

                    Số điện thoại đăng ký

                  </label>



                  <input

                    type="tel"

                    inputMode="tel"

                    autoComplete="tel"

                    placeholder="0865234554"

                    value={forgotPhone}

                    onChange={(e) => {

                      setForgotPhone(e.target.value);

                      setForgotError("");

                    }}

                    className="w-full px-4 py-3 rounded-2xl border border-stone-200 bg-stone-50 text-sm font-medium text-stone-800 outline-none focus:border-[#ee4d2d] focus:bg-white focus:ring-2 focus:ring-orange-100"

                    required

                  />



                  {forgotError && (

                    <div className="mt-2 p-2.5 rounded-xl bg-rose-50 border border-rose-100 text-[10px] font-semibold text-rose-600">

                      {forgotError}

                    </div>

                  )}

                </div>



                <div className="rounded-2xl border border-orange-100 bg-orange-50/70 p-3.5">

                  <p className="text-[10px] font-bold text-stone-700">

                    Quy trình hỗ trợ

                  </p>



                  <div className="mt-2 space-y-1.5 text-[9px] leading-relaxed text-stone-500">

                    <p>1. Gửi yêu cầu bằng số điện thoại đã đăng ký.</p>

                    <p>2. Admin Anvami kiểm tra tài khoản và xác minh yêu cầu.</p>

                    <p>3. Anvami cấp mật khẩu tạm thời và chủ động liên hệ với bạn.</p>

                    <p>4. Sau khi đăng nhập, bạn sẽ được yêu cầu đổi mật khẩu mới.</p>

                  </div>

                </div>



                <button

                  type="submit"

                  disabled={forgotLoading}

                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#ff6a00] to-[#ee4d2d] text-white text-xs font-black uppercase tracking-wide shadow-lg shadow-orange-500/20 disabled:opacity-50"

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

                    <div className="flex w-9 h-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white font-black">

                      ✓

                    </div>



                    <div>

                      <p className="text-[11px] font-black text-emerald-800">

                        Yêu cầu đã được ghi nhận

                      </p>



                      <p className="mt-1 text-[10px] leading-relaxed text-emerald-700/80">

                        Yêu cầu hỗ trợ cho số{" "}

                        <span className="font-black">

                          {maskPhone(forgotPhone)}

                        </span>{" "}

                        đã được gửi tới bộ phận quản trị Anvami.

                      </p>

                    </div>

                  </div>

                </div>



                <div className="mt-3 rounded-2xl bg-stone-50 p-3.5 text-[9px] leading-relaxed text-stone-500">

                  Nhân viên Anvami sẽ xác minh trước khi cấp mật khẩu tạm. Không chia sẻ mật khẩu tạm với người khác sau khi nhận được.

                </div>



                <button

                  type="button"

                  onClick={closeForgotPassword}

                  className="mt-4 w-full py-3.5 rounded-2xl bg-stone-900 text-white text-xs font-black"

                >

                  Đã hiểu

                </button>

              </div>

            )}

          </div>

        </div>

      )}

    </>

  );

}
