"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  useParams,
  useRouter,
} from "next/navigation";

import { db } from "@cho-online/firebase";

import {
  doc,
  onSnapshot,
} from "firebase/firestore";

/* =========================================================
   TYPES
========================================================= */

interface OrderData {
  paymentCode?: string;

  totalPrice: number;

  status: string;

  customerName?: string;

  pointsUsed?: number;

  userId?: string;
}

/* =========================================================
   PAGE
========================================================= */

export default function OrderPaymentPage() {
  const params = useParams();

  const router = useRouter();

  const orderId =
    params?.id as string;

  /* =======================================================
     STATE
  ======================================================= */

  const [
    order,
    setOrder,
  ] = useState<OrderData | null>(
    null
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    isPaidSuccess,
    setIsPaidSuccess,
  ] = useState(false);

  const [
    copied,
    setCopied,
  ] = useState(false);

  const [
    showConfirmModal,
    setShowConfirmModal,
  ] = useState(false);

  const [
    isDownloadingQr,
    setIsDownloadingQr,
  ] = useState(false);

  /* =======================================================
     BANK CONFIG
  ======================================================= */

  const BANK_CODE =
    "TPBank";

  const ACCOUNT_NO =
    "86666868999";

  const ACCOUNT_NAME =
    "NGUYEN DINH ANH";

  /* =======================================================
     ORDER LISTENER
  ======================================================= */

  useEffect(() => {
    if (!orderId) {
      return;
    }

    const orderRef =
      doc(
        db,
        "orders",
        orderId
      );

    const unsubscribe =
      onSnapshot(
        orderRef,
        (snapshot) => {
          if (
            snapshot.exists()
          ) {
            const data =
              snapshot.data() as OrderData;

            setOrder(data);

            const validPaidStatuses = [
              "paid",
              "paid_success",
              "completed",
              "processing",
            ];

            const normalizedStatus =
              String(
                data.status || ""
              ).toLowerCase();

            if (
              normalizedStatus !==
                "pending_payment" &&
              validPaidStatuses.includes(
                normalizedStatus
              )
            ) {
              setIsPaidSuccess(
                true
              );

              window.setTimeout(
                () => {
                  router.push(
                    "/orders"
                  );
                },
                2500
              );
            }
          }

          setLoading(false);
        }
      );

    return () =>
      unsubscribe();
  }, [
    orderId,
    router,
  ]);

  /* =======================================================
     FORMAT CURRENCY
  ======================================================= */

  const formatCurrency = (
    amount: number
  ) => {
    return new Intl.NumberFormat(
      "vi-VN",
      {
        style: "currency",
        currency: "VND",
      }
    ).format(
      amount || 0
    );
  };

  /* =======================================================
     BACK
  ======================================================= */

  const handleBackClick =
    () => {
      setShowConfirmModal(
        true
      );
    };

  const handleGoToOrders =
    () => {
      setShowConfirmModal(
        false
      );

      router.push(
        "/orders"
      );
    };

  /* =======================================================
     COPY PAYMENT CODE
  ======================================================= */

  const handleCopyCode =
    async (
      text: string
    ) => {
      try {
        await navigator.clipboard.writeText(
          text
        );

        setCopied(true);

        window.setTimeout(
          () =>
            setCopied(
              false
            ),
          2000
        );
      } catch (error) {
        console.error(
          "Không thể copy:",
          error
        );
      }
    };

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-3">

        <div className="w-9 h-9 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />

        <p className="text-xs font-semibold text-slate-400">
          Đang tải mã thanh toán...
        </p>

      </div>
    );
  }

  /* =======================================================
     ORDER NOT FOUND
  ======================================================= */

  if (!order) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center space-y-4">

        <p className="text-sm font-bold text-slate-700">
          Không tìm thấy đơn hàng!
        </p>

        <button
          type="button"
          onClick={() =>
            router.push(
              "/orders"
            )
          }
          className="text-xs bg-slate-900 text-white px-4 py-2 rounded-xl font-bold cursor-pointer"
        >
          Quay lại danh sách đơn
        </button>

      </div>
    );
  }

  /* =======================================================
     PAYMENT VALUES
  ======================================================= */

  const transferContent =
    order.paymentCode ||
    `DH${orderId
      .slice(-6)
      .toUpperCase()}`;

  const qrImageUrl =
    `https://vietqr.app/img?bank=${BANK_CODE}` +
    `&acc=${ACCOUNT_NO}` +
    `&template=compact` +
    `&amount=${order.totalPrice}` +
    `&des=${encodeURIComponent(
      transferContent
    )}` +
    `&holder=${encodeURIComponent(
      ACCOUNT_NAME
    )}`;

  /* =======================================================
     DOWNLOAD QR
  ======================================================= */

  const handleDownloadQr =
    async () => {
      try {
        setIsDownloadingQr(
          true
        );

        const params =
          new URLSearchParams({
            bank:
              BANK_CODE,

            acc:
              ACCOUNT_NO,

            amount:
              String(
                order.totalPrice
              ),

            des:
              transferContent,

            holder:
              ACCOUNT_NAME,
          });

        const response =
          await fetch(
            `/api/download-qr?${params.toString()}`
          );

        if (
          !response.ok
        ) {
          throw new Error(
            "Không thể tải mã QR"
          );
        }

        const blob =
          await response.blob();

        const blobUrl =
          URL.createObjectURL(
            blob
          );

        const anchor =
          document.createElement(
            "a"
          );

        anchor.href =
          blobUrl;

        anchor.download =
          `Anvami-VietQR-${transferContent}.png`;

        document.body.appendChild(
          anchor
        );

        anchor.click();

        anchor.remove();

        window.setTimeout(
          () => {
            URL.revokeObjectURL(
              blobUrl
            );
          },
          1000
        );
      } catch (error) {
        console.error(
          "Lỗi tải QR:",
          error
        );

        alert(
          "Không thể lưu mã QR. Vui lòng thử lại."
        );
      } finally {
        setIsDownloadingQr(
          false
        );
      }
    };

  /* =======================================================
     UI
  ======================================================= */

  return (
    <div className="bg-slate-50 min-h-screen text-slate-800 pb-20 font-sans relative">

      {/* ===================================================
          HEADER
      =================================================== */}

      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-100 px-4 py-3 flex items-center gap-3">

        <button
          type="button"
          onClick={
            handleBackClick
          }
          className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition cursor-pointer"
          title="Quay lại"
        >

          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 19l-7-7 7-7"
            />
          </svg>

        </button>

        <div>

          <h1 className="text-sm font-black text-slate-900">
            Thanh toán chuyển khoản
          </h1>

          <p className="text-[10px] text-slate-400 font-medium">
            Quét hoặc lưu mã VietQR để thanh toán
          </p>

        </div>

      </header>

      {/* ===================================================
          MAIN
      =================================================== */}

      <main className="max-w-md mx-auto p-4 space-y-4">

        {isPaidSuccess ? (

          /* =================================================
             SUCCESS
          ================================================= */

          <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 text-center space-y-3 animate-fade-in my-8">

            <div className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center text-3xl mx-auto shadow-lg shadow-emerald-500/30 animate-bounce">
              ✓
            </div>

            <h2 className="text-lg font-black text-emerald-900">
              Thanh toán thành công!
            </h2>

            <p className="text-xs text-emerald-700 font-medium">
              Hệ thống đã xác nhận tiền về.
              Đang chuyển bạn đến trang quản lý đơn hàng...
            </p>

          </div>

        ) : (

          <>

            {/* =================================================
                NOTICE
            ================================================= */}

            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-3.5 flex items-start gap-3 shadow-xs">

              <span className="text-lg leading-none">
                💡
              </span>

              <div className="text-xs space-y-1">

                <p className="font-extrabold text-indigo-950">
                  Thanh toán bằng VietQR
                </p>

                <p className="text-indigo-700 leading-relaxed font-medium text-[11px]">
                  Bạn có thể quét trực tiếp mã QR bên dưới
                  hoặc lưu mã QR về thiết bị rồi mở ứng dụng
                  ngân hàng và chọn ảnh QR từ thư viện.
                </p>

              </div>

            </div>

            {/* =================================================
                QR CARD
            ================================================= */}

            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 space-y-4">

              <div className="text-center space-y-1">

                <span className="text-xs font-black text-slate-900 uppercase tracking-wider block">
                  Mã VietQR thanh toán
                </span>

                <p className="text-[10px] text-slate-400">
                  Quét QR hoặc lưu ảnh về thiết bị
                </p>

              </div>

              {/* QR */}

              <div className="bg-slate-50 border border-slate-100 rounded-3xl p-4">

                <img
                  src={
                    qrImageUrl
                  }
                  alt="Mã VietQR Thanh Toán"
                  className="w-64 max-w-full h-auto mx-auto rounded-2xl bg-white shadow-sm"
                />

              </div>

              {/* AMOUNT */}

              <div className="text-center space-y-1">

                <p className="text-[10px] text-slate-400 font-semibold uppercase">
                  Số tiền cần thanh toán
                </p>

                <p className="text-2xl font-black text-orange-600">
                  {formatCurrency(
                    order.totalPrice
                  )}
                </p>

              </div>

              {/* DOWNLOAD */}

              <button
                type="button"
                onClick={
                  handleDownloadQr
                }
                disabled={
                  isDownloadingQr
                }
                className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] disabled:bg-emerald-400 text-white font-extrabold text-xs py-3.5 rounded-2xl shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >

                {isDownloadingQr ? (
                  <>

                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />

                    Đang lưu mã QR...

                  </>
                ) : (
                  <>

                    <span className="text-base">
                      📥
                    </span>

                    Lưu mã QR về thiết bị

                  </>
                )}

              </button>

              <p className="text-[10px] text-slate-400 text-center leading-relaxed px-3">
                Sau khi lưu, mở ứng dụng ngân hàng →
                Quét QR từ thư viện ảnh → Chọn ảnh vừa lưu.
              </p>

            </div>

            {/* =================================================
                TRANSFER CONTENT
            ================================================= */}

            <div className="bg-white rounded-3xl p-4 border border-red-100 shadow-sm">

              <div className="text-center space-y-2">

                <p className="text-[10px] text-slate-400 font-semibold uppercase">
                  Nội dung chuyển khoản
                </p>

                <div className="inline-flex items-center gap-2">

                  <span className="font-mono font-black text-red-600 bg-red-50 px-3 py-2 rounded-xl border border-red-200">
                    {transferContent}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      handleCopyCode(
                        transferContent
                      )
                    }
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold px-3 py-2 rounded-xl transition cursor-pointer"
                  >
                    {copied
                      ? "Đã chép!"
                      : "Copy"}
                  </button>

                </div>

                <p className="text-[10px] text-red-500 font-medium">
                  Không thay đổi nội dung chuyển khoản
                </p>

              </div>

            </div>

            {/* =================================================
                BANK INFORMATION
            ================================================= */}

            <div className="bg-white rounded-3xl p-4 border border-slate-100 text-xs space-y-3">

              <h3 className="font-black text-slate-800 pb-2 border-b border-slate-100">
                Thông tin tài khoản nhận
              </h3>

              <div className="flex justify-between items-center gap-3">

                <span className="text-slate-400 font-medium">
                  Ngân hàng:
                </span>

                <span className="font-bold text-slate-800">
                  {BANK_CODE}
                </span>

              </div>

              <div className="flex justify-between items-center gap-3">

                <span className="text-slate-400 font-medium">
                  Chủ tài khoản:
                </span>

                <span className="font-bold text-slate-800 text-right">
                  {ACCOUNT_NAME}
                </span>

              </div>

              <div className="flex justify-between items-center gap-3">

                <span className="text-slate-400 font-medium">
                  Số tài khoản:
                </span>

                <div className="flex items-center gap-2">

                  <span className="font-mono font-bold text-slate-900">
                    {ACCOUNT_NO}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      handleCopyCode(
                        ACCOUNT_NO
                      )
                    }
                    className="text-[9px] text-indigo-600 font-bold bg-indigo-50 px-2 py-1 rounded-lg cursor-pointer"
                  >
                    Copy
                  </button>

                </div>

              </div>

              <div className="flex justify-between items-center gap-3 pt-3 border-t border-slate-100">

                <span className="text-slate-400 font-medium">
                  Số tiền:
                </span>

                <span className="font-black text-orange-600 text-sm">
                  {formatCurrency(
                    order.totalPrice
                  )}
                </span>

              </div>

            </div>

            {/* =================================================
                PAY LATER
            ================================================= */}

            <button
              type="button"
              onClick={() =>
                router.push(
                  "/orders"
                )
              }
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-3 rounded-xl transition cursor-pointer"
            >
              Tôi sẽ thanh toán sau
            </button>

          </>

        )}

      </main>

      {/* ===================================================
          CONFIRM MODAL
      =================================================== */}

      {showConfirmModal && (

        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">

          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl border border-slate-100 animate-scale-up">

            <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center text-2xl mx-auto border border-indigo-100">
              📋
            </div>

            <div className="space-y-1.5">

              <h3 className="text-base font-black text-slate-900">
                Lưu đơn hàng chờ thanh toán?
              </h3>

              <p className="text-xs text-slate-500 leading-relaxed">
                Đơn hàng này sẽ được lưu ở mục{" "}
                <strong className="text-indigo-600">
                  Đơn hàng của tôi
                </strong>{" "}
                với trạng thái{" "}
                <em>
                  "Chờ thanh toán"
                </em>
                . Bạn có thể mở lại để thanh toán bất cứ lúc nào.
              </p>

            </div>

            <div className="flex items-center gap-2.5 pt-2">

              <button
                type="button"
                onClick={() =>
                  setShowConfirmModal(
                    false
                  )
                }
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs py-3 rounded-xl transition cursor-pointer"
              >
                Thanh toán ngay
              </button>

              <button
                type="button"
                onClick={
                  handleGoToOrders
                }
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs py-3 rounded-xl transition cursor-pointer shadow-md shadow-indigo-600/20"
              >
                Về danh sách đơn
              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}