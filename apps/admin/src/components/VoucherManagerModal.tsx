"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";

import {
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";

// ============================================================
// TYPES
// ============================================================

type VoucherTargetType = "ALL" | "MERCHANT";

type VoucherApplyType = "ORDER" | "SHIPPING";

type VoucherDiscountType = "FIXED" | "PERCENTAGE";

interface Voucher {
  id: string;
  code: string;
  title: string;
  description?: string;

  applyType: VoucherApplyType;
  discountType: VoucherDiscountType;
  discountValue: number;

  maxDiscount?: number | null;
  minOrder?: number | null;

  usageLimit?: number | null;
  usedCount?: number;

  limitPerUser?: number;

  startDate?: string | null;
  endDate?: string | null;

  isActive?: boolean;

  // ==========================================================
  // TARGET SHOP
  // ==========================================================

  targetType?: VoucherTargetType;

  merchantId?: string | null;
  merchantName?: string | null;
  merchantCode?: string | null;
  merchantCommissionPercent?: number | null;
}

interface MerchantOption {
  id: string;
  shopName: string;
  merchantCode?: string;
  commissionPercent: number;
  status?: string;
}

// ============================================================
// PROPS
// ============================================================

interface VoucherManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// ============================================================
// COMPONENT
// ============================================================

export default function VoucherManagerModal({
  isOpen,
  onClose,
}: VoucherManagerModalProps) {
  // ==========================================================
  // TABS
  // ==========================================================

  const [activeTab, setActiveTab] =
    useState<"list" | "form">("list");

  // ==========================================================
  // VOUCHERS
  // ==========================================================

  const [vouchers, setVouchers] =
    useState<Voucher[]>([]);

  const [fetchingList, setFetchingList] =
    useState(true);

  // ==========================================================
  // MERCHANTS
  // ==========================================================

  const [merchants, setMerchants] =
    useState<MerchantOption[]>([]);

  const [fetchingMerchants, setFetchingMerchants] =
    useState(false);

  // ==========================================================
  // EDIT
  // ==========================================================

  const [editingVoucherId, setEditingVoucherId] =
    useState<string | null>(null);

  // ==========================================================
  // FORM
  // ==========================================================

  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] =
    useState("");

  const [applyType, setApplyType] =
    useState<VoucherApplyType>("ORDER");

  const [discountType, setDiscountType] =
    useState<VoucherDiscountType>("FIXED");

  const [discountValue, setDiscountValue] =
    useState("");

  const [maxDiscount, setMaxDiscount] =
    useState("");

  const [minOrder, setMinOrder] =
    useState("");

  const [usageLimit, setUsageLimit] =
    useState("");

  const [limitPerUser, setLimitPerUser] =
    useState("1");

  const [startDate, setStartDate] =
    useState("");

  const [endDate, setEndDate] =
    useState("");

  const [isActive, setIsActive] =
    useState(true);

  // ==========================================================
  // TARGET
  // ==========================================================

  const [targetType, setTargetType] =
    useState<VoucherTargetType>("ALL");

  const [selectedMerchantId, setSelectedMerchantId] =
    useState("");

  // ==========================================================
  // FALLBACK INFO FOR OLD / MISSING MERCHANT
  // ==========================================================

  const [selectedMerchantName, setSelectedMerchantName] =
    useState("");

  const [selectedMerchantCode, setSelectedMerchantCode] =
    useState("");

  const [
    selectedMerchantCommission,
    setSelectedMerchantCommission,
  ] = useState<number | null>(null);

  // ==========================================================
  // LOADING
  // ==========================================================

  const [loading, setLoading] =
    useState(false);

  // ==========================================================
  // FETCH VOUCHERS
  // ==========================================================

  useEffect(() => {
    if (!isOpen) return;

    setFetchingList(true);

    const q = query(
      collection(db, "vouchers"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe =
      onSnapshot(
        q,
        (snapshot) => {
          const list: Voucher[] =
            snapshot.docs.map(
              (docSnap) => {
                const data =
                  docSnap.data();

                return {
                  id: docSnap.id,

                  code:
                    String(
                      data.code || ""
                    ),

                  title:
                    String(
                      data.title || ""
                    ),

                  description:
                    String(
                      data.description || ""
                    ),

                  applyType:
                    data.applyType ===
                    "SHIPPING"
                      ? "SHIPPING"
                      : "ORDER",

                  discountType:
                    data.discountType ===
                    "PERCENTAGE"
                      ? "PERCENTAGE"
                      : "FIXED",

                  discountValue:
                    Number(
                      data.discountValue || 0
                    ),

                  maxDiscount:
                    data.maxDiscount !==
                      undefined &&
                    data.maxDiscount !==
                      null &&
                    data.maxDiscount !==
                      ""
                      ? Number(
                          data.maxDiscount
                        )
                      : null,

                  minOrder:
                    data.minOrder !==
                      undefined &&
                    data.minOrder !==
                      null &&
                    data.minOrder !==
                      ""
                      ? Number(
                          data.minOrder
                        )
                      : null,

                  usageLimit:
                    data.usageLimit !==
                      undefined &&
                    data.usageLimit !==
                      null &&
                    data.usageLimit !==
                      ""
                      ? Number(
                          data.usageLimit
                        )
                      : null,

                  usedCount:
                    Number(
                      data.usedCount || 0
                    ),

                  limitPerUser:
                    Number(
                      data.limitPerUser || 1
                    ),

                  startDate:
                    data.startDate ||
                    null,

                  endDate:
                    data.endDate ||
                    null,

                  isActive:
                    data.isActive !== false,

                  // ----------------------------------------
                  // TARGET
                  // ----------------------------------------

                  targetType:
                    data.targetType ===
                    "MERCHANT"
                      ? "MERCHANT"
                      : data.merchantId
                      ? "MERCHANT"
                      : "ALL",

                  merchantId:
                    data.merchantId ||
                    null,

                  merchantName:
                    data.merchantName ||
                    null,

                  merchantCode:
                    data.merchantCode ||
                    null,

                  merchantCommissionPercent:
                    data.merchantCommissionPercent !==
                      undefined &&
                    data.merchantCommissionPercent !==
                      null
                      ? Number(
                          data.merchantCommissionPercent
                        )
                      : null,
                };
              }
            );

          setVouchers(list);
          setFetchingList(false);
        },
        (error) => {
          console.error(
            "❌ Lỗi tải danh sách voucher:",
            error
          );

          setFetchingList(false);
        }
      );

    return () => unsubscribe();
  }, [isOpen]);

  // ==========================================================
  // FETCH MERCHANTS
  // ==========================================================

useEffect(() => {
  if (!isOpen) return;

  setFetchingMerchants(true);

  const merchantCollection =
    collection(db, "merchants");

  const unsubscribe =
    onSnapshot(
      merchantCollection,
      (snapshot) => {
        const list: MerchantOption[] = [];

        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data();

          const status = String(
            data.status || ""
          ).toUpperCase();

          // Chỉ lấy quán đã duyệt / đang hoạt động
          if (
            status &&
            status !== "APPROVED" &&
            status !== "ACTIVE"
          ) {
            return;
          }

          const parsedCommission = Number(
            data.commissionPercent ?? 10
          );

          const commissionPercent =
            Number.isFinite(parsedCommission) &&
            parsedCommission >= 0 &&
            parsedCommission <= 100
              ? parsedCommission
              : 10;

          const merchant: MerchantOption = {
            id: docSnap.id,

            shopName: String(
              data.shopName ||
                data.storeName ||
                data.name ||
                "Gian hàng"
            ),

            merchantCode: data.merchantCode
              ? String(data.merchantCode)
              : undefined,

            commissionPercent,

            status: status || "APPROVED",
          };

          list.push(merchant);
        });

        list.sort((a, b) =>
          a.shopName.localeCompare(
            b.shopName,
            "vi"
          )
        );

        setMerchants(list);
        setFetchingMerchants(false);
      },
      (error) => {
        console.error(
          "❌ Lỗi tải danh sách Merchant:",
          error
        );

        setFetchingMerchants(false);
      }
    );

  return () => unsubscribe();
}, [isOpen]);
  // ==========================================================
  // FORMAT DATE
  // ==========================================================

  const formatISOToInput = (
    isoStr?: string | null
  ) => {
    if (!isoStr) return "";

    try {
      const date = new Date(
        isoStr
      );

      if (
        isNaN(
          date.getTime()
        )
      ) {
        return "";
      }

      return date
        .toISOString()
        .slice(0, 16);
    } catch {
      return "";
    }
  };

  // ==========================================================
  // FORMAT CURRENCY
  // ==========================================================

  const formatCurrency = (
    value: number
  ) =>
    new Intl.NumberFormat(
      "vi-VN",
      {
        style: "currency",
        currency: "VND",
      }
    ).format(value || 0);

  // ==========================================================
  // CURRENT SELECTED MERCHANT
  // ==========================================================

  const selectedMerchant =
    useMemo(() => {
      if (
        !selectedMerchantId
      ) {
        return null;
      }

      return (
        merchants.find(
          (merchant) =>
            merchant.id ===
            selectedMerchantId
        ) || null
      );
    }, [
      merchants,
      selectedMerchantId,
    ]);

  // ==========================================================
  // SELECT MERCHANT
  // ==========================================================

  const handleMerchantChange = (
    merchantId: string
  ) => {
    setSelectedMerchantId(
      merchantId
    );

    const merchant =
      merchants.find(
        (item) =>
          item.id ===
          merchantId
      );

    if (!merchant) {
      return;
    }

    setSelectedMerchantName(
      merchant.shopName
    );

    setSelectedMerchantCode(
      merchant.merchantCode ||
        ""
    );

    setSelectedMerchantCommission(
      merchant.commissionPercent
    );
  };

  // ==========================================================
  // EDIT
  // ==========================================================

  const handleEdit = (
    voucher: Voucher
  ) => {
    setEditingVoucherId(
      voucher.id
    );

    setCode(
      voucher.code
    );

    setTitle(
      voucher.title
    );

    setDescription(
      voucher.description ||
        ""
    );

    setApplyType(
      voucher.applyType
    );

    setDiscountType(
      voucher.discountType
    );

    setDiscountValue(
      String(
        voucher.discountValue
      )
    );

    setMaxDiscount(
      voucher.maxDiscount !==
        null &&
      voucher.maxDiscount !==
        undefined
        ? String(
            voucher.maxDiscount
          )
        : ""
    );

    setMinOrder(
      voucher.minOrder !==
        null &&
      voucher.minOrder !==
        undefined
        ? String(
            voucher.minOrder
          )
        : ""
    );

    setUsageLimit(
      voucher.usageLimit !==
        null &&
      voucher.usageLimit !==
        undefined
        ? String(
            voucher.usageLimit
          )
        : ""
    );

    setLimitPerUser(
      voucher.limitPerUser
        ? String(
            voucher.limitPerUser
          )
        : "1"
    );

    setStartDate(
      formatISOToInput(
        voucher.startDate
      )
    );

    setEndDate(
      formatISOToInput(
        voucher.endDate
      )
    );

    setIsActive(
      voucher.isActive !==
        false
    );

    // ----------------------------------------------
    // TARGET
    // ----------------------------------------------

    const isMerchantVoucher =
      voucher.targetType ===
        "MERCHANT" ||
      Boolean(
        voucher.merchantId
      );

    if (
      isMerchantVoucher &&
      voucher.merchantId
    ) {
      setTargetType(
        "MERCHANT"
      );

      setSelectedMerchantId(
        voucher.merchantId
      );

      setSelectedMerchantName(
        voucher.merchantName ||
          ""
      );

      setSelectedMerchantCode(
        voucher.merchantCode ||
          ""
      );

      setSelectedMerchantCommission(
        voucher.merchantCommissionPercent ??
          null
      );
    } else {
      setTargetType(
        "ALL"
      );

      setSelectedMerchantId(
        ""
      );

      setSelectedMerchantName(
        ""
      );

      setSelectedMerchantCode(
        ""
      );

      setSelectedMerchantCommission(
        null
      );
    }

    setActiveTab("form");
  };

  // ==========================================================
  // OPEN CREATE
  // ==========================================================

  const handleOpenCreateForm = () => {
    resetForm();

    setEditingVoucherId(
      null
    );

    setActiveTab("form");
  };

  // ==========================================================
  // TOGGLE ACTIVE
  // ==========================================================

  const handleToggleActive = async (
    voucher: Voucher
  ) => {
    try {
      await updateDoc(
        doc(
          db,
          "vouchers",
          voucher.id
        ),
        {
          isActive:
            !voucher.isActive,
        }
      );
    } catch (error) {
      console.error(
        "❌ Lỗi cập nhật trạng thái:",
        error
      );

      alert(
        "Không thể thay đổi trạng thái voucher!"
      );
    }
  };

  // ==========================================================
  // DELETE
  // ==========================================================

  const handleDelete = async (
    id: string,
    voucherCode: string
  ) => {
    const confirmed =
      confirm(
        `Bạn có chắc chắn muốn xóa mã "${voucherCode}" không?`
      );

    if (!confirmed) {
      return;
    }

    try {
      await deleteDoc(
        doc(
          db,
          "vouchers",
          id
        )
      );
    } catch (error) {
      console.error(
        "❌ Lỗi xóa voucher:",
        error
      );

      alert(
        "Không thể xóa voucher!"
      );
    }
  };

  // ==========================================================
  // SUBMIT
  // ==========================================================

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    // --------------------------------------------------------
    // BASIC VALIDATION
    // --------------------------------------------------------

    const cleanCode =
      code
        .toUpperCase()
        .trim();

    const cleanTitle =
      title.trim();

    if (
      !cleanCode ||
      !cleanTitle ||
      !discountValue
    ) {
      alert(
        "Vui lòng điền đầy đủ thông tin bắt buộc."
      );

      return;
    }

    const numericDiscount =
      Number(
        discountValue
      );

    if (
      !Number.isFinite(
        numericDiscount
      ) ||
      numericDiscount <= 0
    ) {
      alert(
        "Mức giảm phải lớn hơn 0."
      );

      return;
    }

    if (
      discountType ===
        "PERCENTAGE" &&
      numericDiscount > 100
    ) {
      alert(
        "Mức giảm phần trăm không được vượt quá 100%."
      );

      return;
    }

    // --------------------------------------------------------
    // TARGET VALIDATION
    // --------------------------------------------------------

    if (
      targetType ===
        "MERCHANT" &&
      !selectedMerchantId
    ) {
      alert(
        "Vui lòng chọn quán áp dụng voucher."
      );

      return;
    }

    // --------------------------------------------------------
    // DATE VALIDATION
    // --------------------------------------------------------

    if (
      startDate &&
      endDate
    ) {
      const start =
        new Date(
          startDate
        ).getTime();

      const end =
        new Date(
          endDate
        ).getTime();

      if (
        !Number.isNaN(start) &&
        !Number.isNaN(end) &&
        end <= start
      ) {
        alert(
          "Thời gian hết hạn phải lớn hơn thời gian bắt đầu."
        );

        return;
      }
    }

    // --------------------------------------------------------
    // LIMIT VALIDATION
    // --------------------------------------------------------

    if (
      usageLimit &&
      Number(
        usageLimit
      ) <= 0
    ) {
      alert(
        "Tổng số lượt dùng phải lớn hơn 0."
      );

      return;
    }

    if (
      Number(
        limitPerUser || 1
      ) <= 0
    ) {
      alert(
        "Lượt sử dụng mỗi người phải lớn hơn 0."
      );

      return;
    }

    // --------------------------------------------------------
    // MERCHANT SNAPSHOT
    // --------------------------------------------------------

    let finalMerchantId:
      | string
      | null = null;

    let finalMerchantName:
      | string
      | null = null;

    let finalMerchantCode:
      | string
      | null = null;

    let finalMerchantCommission:
      | number
      | null = null;

    if (
      targetType ===
      "MERCHANT"
    ) {
      finalMerchantId =
        selectedMerchantId;

      finalMerchantName =
        selectedMerchant?.shopName ||
        selectedMerchantName ||
        null;

      finalMerchantCode =
        selectedMerchant?.merchantCode ||
        selectedMerchantCode ||
        null;

      finalMerchantCommission =
        selectedMerchant?.commissionPercent ??
        selectedMerchantCommission ??
        null;
    }

    // --------------------------------------------------------
    // DATA
    // --------------------------------------------------------

    const voucherData = {
      code: cleanCode,

      title: cleanTitle,

      description:
        description.trim(),

      applyType,

      discountType,

      discountValue:
        numericDiscount,

      maxDiscount:
        discountType ===
          "PERCENTAGE" &&
        maxDiscount
          ? Number(
              maxDiscount
            )
          : null,

      minOrder:
        minOrder
          ? Number(
              minOrder
            )
          : 0,

      usageLimit:
        usageLimit
          ? Number(
              usageLimit
            )
          : null,

      limitPerUser:
        Number(
          limitPerUser || 1
        ),

      startDate:
        startDate
          ? new Date(
              startDate
            ).toISOString()
          : null,

      endDate:
        endDate
          ? new Date(
              endDate
            ).toISOString()
          : null,

      isActive,

      // ======================================================
      // TARGET SHOP
      // ======================================================

      targetType,

      merchantId:
        finalMerchantId,

      merchantName:
        finalMerchantName,

      merchantCode:
        finalMerchantCode,

      merchantCommissionPercent:
        finalMerchantCommission,
    };

    // --------------------------------------------------------
    // SAVE
    // --------------------------------------------------------

    setLoading(true);

    try {
      if (
        editingVoucherId
      ) {
        await updateDoc(
          doc(
            db,
            "vouchers",
            editingVoucherId
          ),
          voucherData
        );

        alert(
          "Đã cập nhật voucher thành công."
        );
      } else {
        await addDoc(
          collection(
            db,
            "vouchers"
          ),
          {
            ...voucherData,

            usedCount: 0,

            createdAt:
              serverTimestamp(),
          }
        );

        alert(
          targetType ===
            "MERCHANT"
            ? `Đã tạo voucher riêng cho ${finalMerchantName || "quán"}.`
            : "Đã tạo voucher toàn hệ thống thành công."
        );
      }

      resetForm();

      setActiveTab(
        "list"
      );
    } catch (error: any) {
      console.error(
        "❌ Lỗi lưu voucher:",
        error
      );

      alert(
        "Không thể lưu voucher: " +
          (error?.message ||
            "Lỗi không xác định")
      );
    } finally {
      setLoading(false);
    }
  };

  // ==========================================================
  // RESET FORM
  // ==========================================================

  const resetForm = () => {
    setEditingVoucherId(
      null
    );

    setCode("");
    setTitle("");
    setDescription("");

    setApplyType(
      "ORDER"
    );

    setDiscountType(
      "FIXED"
    );

    setDiscountValue("");
    setMaxDiscount("");
    setMinOrder("");
    setUsageLimit("");
    setLimitPerUser(
      "1"
    );

    setStartDate("");
    setEndDate("");

    setIsActive(true);

    setTargetType(
      "ALL"
    );

    setSelectedMerchantId(
      ""
    );

    setSelectedMerchantName(
      ""
    );

    setSelectedMerchantCode(
      ""
    );

    setSelectedMerchantCommission(
      null
    );
  };

  // ==========================================================
  // QUICK DATE
  // ==========================================================

  const setQuickDate = (
    days: number
  ) => {
    const now =
      new Date();

    const future =
      new Date(
        now.getTime() +
          days *
            24 *
            60 *
            60 *
            1000
      );

    setStartDate(
      now
        .toISOString()
        .slice(0, 16)
    );

    setEndDate(
      future
        .toISOString()
        .slice(0, 16)
    );
  };

  // ==========================================================
  // IF CLOSED
  // ==========================================================

  if (!isOpen) {
    return null;
  }

  // ==========================================================
  // TARGET LABEL
  // ==========================================================

  const getTargetLabel = (
    voucher: Voucher
  ) => {
    const isMerchant =
      voucher.targetType ===
        "MERCHANT" ||
      Boolean(
        voucher.merchantId
      );

    if (
      !isMerchant
    ) {
      return "Toàn hệ thống";
    }

    return (
      voucher.merchantName ||
      "Một quán cụ thể"
    );
  };

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="relative my-4 w-full max-w-4xl max-h-[94vh] overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 text-slate-100 shadow-2xl flex flex-col">

        {/* ====================================================
            HEADER
        ==================================================== */}

        <div className="shrink-0 border-b border-slate-800 bg-slate-950 px-4 sm:px-6 py-4">

          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  🎫
                </div>

                <div>
                  <h3 className="text-base sm:text-lg font-black text-white">
                    Quản lý Voucher
                  </h3>

                  <p className="mt-0.5 text-[10px] sm:text-xs text-slate-500">
                    Tạo mã giảm giá toàn hệ thống hoặc dành riêng cho từng quán.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition"
              aria-label="Đóng"
            >
              ✕
            </button>
          </div>

          {/* ==================================================
              TABS
          ================================================== */}

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() =>
                setActiveTab(
                  "list"
                )
              }
              className={[
                "rounded-xl px-3 py-2.5 text-[10px] sm:text-xs font-bold transition",
                activeTab ===
                "list"
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-900/20"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white",
              ].join(" ")}
            >
              Danh sách
              <span className="ml-1 opacity-70">
                ({vouchers.length})
              </span>
            </button>

            <button
              type="button"
              onClick={
                handleOpenCreateForm
              }
              className={[
                "rounded-xl px-3 py-2.5 text-[10px] sm:text-xs font-bold transition",
                activeTab ===
                  "form" &&
                !editingVoucherId
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-900/20"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white",
              ].join(" ")}
            >
              + Tạo Voucher
            </button>
          </div>
        </div>

        {/* ====================================================
            CONTENT
        ==================================================== */}

        <div className="flex-1 overflow-y-auto overscroll-contain">

          {/* ==================================================
              LIST
          ================================================== */}

          {activeTab ===
            "list" && (
            <div className="p-4 sm:p-6">

              {fetchingList ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="h-7 w-7 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />

                  <p className="mt-3 text-[10px] text-slate-500">
                    Đang tải voucher...
                  </p>
                </div>
              ) : vouchers.length ===
                0 ? (
                <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 py-16 text-center">
                  <div className="text-3xl">
                    🎫
                  </div>

                  <p className="mt-3 text-xs font-bold text-slate-300">
                    Chưa có voucher nào
                  </p>

                  <p className="mt-1 text-[10px] text-slate-500">
                    Tạo voucher đầu tiên cho hệ thống hoặc một quán cụ thể.
                  </p>

                  <button
                    type="button"
                    onClick={
                      handleOpenCreateForm
                    }
                    className="mt-4 rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-500 transition"
                  >
                    + Tạo voucher
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {vouchers.map(
                    (voucher) => {
                      const isMerchantVoucher =
                        voucher.targetType ===
                          "MERCHANT" ||
                        Boolean(
                          voucher.merchantId
                        );

                      return (
                        <div
                          key={
                            voucher.id
                          }
                          className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 hover:border-slate-700 transition"
                        >
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

                            {/* INFO */}
                            <div className="min-w-0 flex-1">

                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-lg border border-purple-500/20 bg-purple-500/10 px-2 py-1 font-mono text-[10px] font-bold uppercase text-purple-300">
                                  {voucher.code}
                                </span>

                                <span className="text-[13px] font-bold text-white">
                                  {voucher.title}
                                </span>

                                <span
                                  className={[
                                    "rounded-full px-2 py-0.5 text-[9px] font-bold",
                                    voucher.isActive
                                      ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                                      : "bg-rose-500/10 text-rose-300 border border-rose-500/20",
                                  ].join(
                                    " "
                                  )}
                                >
                                  {voucher.isActive
                                    ? "Đang bật"
                                    : "Đã tắt"}
                                </span>
                              </div>

                              {voucher.description && (
                                <p className="mt-2 text-[10px] leading-4 text-slate-500">
                                  {
                                    voucher.description
                                  }
                                </p>
                              )}

                              {/* DETAILS */}
                              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">

                                {/* Discount */}
                                <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-2.5">
                                  <div className="text-[8px] uppercase tracking-wide text-slate-600">
                                    Mức giảm
                                  </div>

                                  <div className="mt-1 text-[11px] font-bold text-emerald-400">
                                    {voucher.discountType ===
                                    "FIXED"
                                      ? formatCurrency(
                                          voucher.discountValue
                                        )
                                      : `${voucher.discountValue}%`}
                                  </div>

                                  <div className="mt-0.5 text-[8px] text-slate-600">
                                    {voucher.applyType ===
                                    "SHIPPING"
                                      ? "Phí vận chuyển"
                                      : "Giá trị đơn hàng"}
                                  </div>
                                </div>

                                {/* Target */}
                                <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-2.5">
                                  <div className="text-[8px] uppercase tracking-wide text-slate-600">
                                    Áp dụng cho
                                  </div>

                                  <div className="mt-1 truncate text-[10px] font-bold text-white">
                                    {getTargetLabel(
                                      voucher
                                    )}
                                  </div>

                                  {isMerchantVoucher &&
                                    voucher.merchantCommissionPercent !==
                                      null &&
                                    voucher.merchantCommissionPercent !==
                                      undefined && (
                                      <div className="mt-0.5 text-[8px] text-orange-400">
                                        Chiết khấu Sàn:{" "}
                                        {
                                          voucher.merchantCommissionPercent
                                        }
                                        %
                                      </div>
                                    )}
                                </div>

                                {/* Usage */}
                                <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-2.5">
                                  <div className="text-[8px] uppercase tracking-wide text-slate-600">
                                    Đã sử dụng
                                  </div>

                                  <div className="mt-1 text-[11px] font-bold text-indigo-300">
                                    {voucher.usedCount ||
                                      0}

                                    {voucher.usageLimit
                                      ? ` / ${voucher.usageLimit}`
                                      : " lượt"}
                                  </div>

                                  <div className="mt-0.5 text-[8px] text-slate-600">
                                    {voucher.limitPerUser ||
                                      1}{" "}
                                    lượt/người
                                  </div>
                                </div>

                                {/* Min order */}
                                <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-2.5">
                                  <div className="text-[8px] uppercase tracking-wide text-slate-600">
                                    Đơn tối thiểu
                                  </div>

                                  <div className="mt-1 text-[10px] font-bold text-amber-300">
                                    {voucher.minOrder
                                      ? formatCurrency(
                                          voucher.minOrder
                                        )
                                      : "Không yêu cầu"}
                                  </div>

                                  <div className="mt-0.5 text-[8px] text-slate-600">
                                    Điều kiện đơn
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* ACTIONS */}
                            <div className="flex w-full lg:w-auto items-center gap-2 border-t border-slate-800 pt-3 lg:border-t-0 lg:pt-0">

                              <button
                                type="button"
                                onClick={() =>
                                  handleToggleActive(
                                    voucher
                                  )
                                }
                                className={[
                                  "flex-1 lg:flex-none rounded-xl px-3 py-2 text-[9px] font-bold border transition",
                                  voucher.isActive
                                    ? "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
                                    : "border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20",
                                ].join(
                                  " "
                                )}
                              >
                                {voucher.isActive
                                  ? "Tắt"
                                  : "Bật"}
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  handleEdit(
                                    voucher
                                  )
                                }
                                className="flex-1 lg:flex-none rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-3 py-2 text-[9px] font-bold text-indigo-300 hover:bg-indigo-500/20 transition"
                              >
                                Sửa
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  handleDelete(
                                    voucher.id,
                                    voucher.code
                                  )
                                }
                                className="flex-1 lg:flex-none rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-[9px] font-bold text-rose-300 hover:bg-rose-500/20 transition"
                              >
                                Xóa
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              )}
            </div>
          )}

          {/* ==================================================
              FORM
          ================================================== */}

          {activeTab ===
            "form" && (
            <form
              onSubmit={
                handleSubmit
              }
              className="p-4 sm:p-6 space-y-5"
            >

              {/* =================================================
                  MODE
              ================================================= */}

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-purple-500/20 bg-purple-500/5 p-3.5">
                <div>
                  <div className="text-[10px] font-bold text-purple-300">
                    {editingVoucherId
                      ? "Đang chỉnh sửa voucher"
                      : "Tạo voucher mới"}
                  </div>

                  <div className="mt-1 text-[9px] text-purple-200/50">
                    Cấu hình đối tượng, mức giảm và điều kiện áp dụng.
                  </div>
                </div>

                {editingVoucherId && (
                  <button
                    type="button"
                    onClick={
                      handleOpenCreateForm
                    }
                    className="self-start rounded-lg border border-purple-500/20 bg-purple-500/10 px-3 py-1.5 text-[9px] font-bold text-purple-300 hover:bg-purple-500/20 transition"
                  >
                    + Tạo voucher mới
                  </button>
                )}
              </div>

              {/* =================================================
                  BASIC INFO
              ================================================= */}

              <section className="space-y-3">
                <SectionTitle
                  number="01"
                  title="Thông tin voucher"
                  description="Thông tin cơ bản hiển thị cho người dùng."
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <FormField
                    label="Mã Voucher"
                    required
                  >
                    <input
                      type="text"
                      value={code}
                      onChange={(e) =>
                        setCode(
                          e.target.value.toUpperCase()
                        )
                      }
                      placeholder="VD: FREESHIP20"
                      className={inputClass(
                        "font-mono uppercase"
                      )}
                      required
                    />
                  </FormField>

                  <FormField
                    label="Tên chương trình"
                    required
                  >
                    <input
                      type="text"
                      value={title}
                      onChange={(e) =>
                        setTitle(
                          e.target.value
                        )
                      }
                      placeholder="VD: Giảm 20% phí ship"
                      className={inputClass()}
                      required
                    />
                  </FormField>
                </div>

                <FormField label="Mô tả">
                  <input
                    type="text"
                    value={description}
                    onChange={(e) =>
                      setDescription(
                        e.target.value
                      )
                    }
                    placeholder="VD: Giảm 20% phí vận chuyển cho đơn hàng tại Cafe Nắng."
                    className={inputClass()}
                  />
                </FormField>
              </section>

              {/* =================================================
                  TARGET
              ================================================= */}

              <section className="space-y-3">
                <SectionTitle
                  number="02"
                  title="Đối tượng áp dụng"
                  description="Xác định voucher dùng cho toàn hệ thống hay riêng một quán."
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

                  {/* ALL */}
                  <button
                    type="button"
                    onClick={() => {
                      setTargetType(
                        "ALL"
                      );

                      setSelectedMerchantId(
                        ""
                      );

                      setSelectedMerchantName(
                        ""
                      );

                      setSelectedMerchantCode(
                        ""
                      );

                      setSelectedMerchantCommission(
                        null
                      );
                    }}
                    className={[
                      "text-left rounded-2xl border p-4 transition",
                      targetType ===
                      "ALL"
                        ? "border-purple-500 bg-purple-500/10"
                        : "border-slate-800 bg-slate-900 hover:border-slate-700",
                    ].join(" ")}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={[
                          "h-9 w-9 rounded-xl flex items-center justify-center shrink-0",
                          targetType ===
                          "ALL"
                            ? "bg-purple-500 text-white"
                            : "bg-slate-800 text-slate-400",
                        ].join(
                          " "
                        )}
                      >
                        🌐
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-white">
                            Toàn hệ thống
                          </span>

                          {targetType ===
                            "ALL" && (
                            <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[7px] font-bold text-purple-300">
                              ĐANG CHỌN
                            </span>
                          )}
                        </div>

                        <p className="mt-1 text-[9px] leading-4 text-slate-500">
                          Voucher có thể áp dụng cho các quán đủ điều kiện trên Anvami.
                        </p>
                      </div>
                    </div>
                  </button>

                  {/* MERCHANT */}
                  <button
                    type="button"
                    onClick={() =>
                      setTargetType(
                        "MERCHANT"
                      )
                    }
                    className={[
                      "text-left rounded-2xl border p-4 transition",
                      targetType ===
                      "MERCHANT"
                        ? "border-orange-500 bg-orange-500/10"
                        : "border-slate-800 bg-slate-900 hover:border-slate-700",
                    ].join(" ")}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={[
                          "h-9 w-9 rounded-xl flex items-center justify-center shrink-0",
                          targetType ===
                          "MERCHANT"
                            ? "bg-orange-500 text-white"
                            : "bg-slate-800 text-slate-400",
                        ].join(
                          " "
                        )}
                      >
                        🏪
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-white">
                            Theo quán
                          </span>

                          {targetType ===
                            "MERCHANT" && (
                            <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-[7px] font-bold text-orange-300">
                              ĐANG CHỌN
                            </span>
                          )}
                        </div>

                        <p className="mt-1 text-[9px] leading-4 text-slate-500">
                          Voucher chỉ được áp dụng cho đơn hàng của một quán cụ thể.
                        </p>
                      </div>
                    </div>
                  </button>
                </div>

                {/* MERCHANT SELECTOR */}
                {targetType ===
                  "MERCHANT" && (
                  <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-4 space-y-3">

                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-bold text-orange-200">
                          Chọn quán
                        </div>

                        <div className="mt-0.5 text-[8px] text-orange-200/40">
                          Voucher sẽ được gắn trực tiếp với Merchant ID của quán.
                        </div>
                      </div>

                      {fetchingMerchants && (
                        <div className="h-4 w-4 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
                      )}
                    </div>

                    <select
                      value={
                        selectedMerchantId
                      }
                      onChange={(e) =>
                        handleMerchantChange(
                          e.target.value
                        )
                      }
                      disabled={
                        fetchingMerchants
                      }
                      className={inputClass()}
                    >
                      <option value="">
                        -- Chọn quán áp dụng --
                      </option>

                      {/* Fallback option khi merchant cũ không còn trong list */}
                      {selectedMerchantId &&
                        !merchants.some(
                          (merchant) =>
                            merchant.id ===
                            selectedMerchantId
                        ) && (
                          <option
                            value={
                              selectedMerchantId
                            }
                          >
                            {selectedMerchantName ||
                              "Quán đã lưu trước đó"}
                          </option>
                        )}

                      {merchants.map(
                        (merchant) => (
                          <option
                            key={
                              merchant.id
                            }
                            value={
                              merchant.id
                            }
                          >
                            {merchant.shopName}
                            {merchant.merchantCode
                              ? ` • #${merchant.merchantCode}`
                              : ""}{" "}
                            • Chiết khấu{" "}
                            {
                              merchant.commissionPercent
                            }
                            %
                          </option>
                        )
                      )}
                    </select>

                    {/* Merchant summary */}
                    {(selectedMerchant ||
                      selectedMerchantId) && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">

                        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                          <div className="text-[8px] uppercase tracking-wide text-slate-600">
                            Gian hàng
                          </div>

                          <div className="mt-1 truncate text-[10px] font-bold text-white">
                            {selectedMerchant?.shopName ||
                              selectedMerchantName ||
                              "Đã chọn quán"}
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                          <div className="text-[8px] uppercase tracking-wide text-slate-600">
                            Mã Merchant
                          </div>

                          <div className="mt-1 truncate font-mono text-[10px] font-bold text-purple-300">
                            {selectedMerchant?.merchantCode ||
                              selectedMerchantCode ||
                              selectedMerchantId}
                          </div>
                        </div>

                        <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-3">
                          <div className="text-[8px] uppercase tracking-wide text-orange-300/50">
                            Chiết khấu Sàn
                          </div>

                          <div className="mt-1 text-[15px] font-black text-orange-400">
                            {selectedMerchant?.commissionPercent ??
                              selectedMerchantCommission ??
                              "--"}
                            %
                          </div>
                        </div>
                      </div>
                    )}

                    {!fetchingMerchants &&
                      merchants.length ===
                        0 && (
                        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-[9px] leading-4 text-amber-300">
                          Chưa tìm thấy quán khả dụng trong hệ thống.
                        </div>
                      )}
                  </div>
                )}
              </section>

              {/* =================================================
                  DISCOUNT
              ================================================= */}

              <section className="space-y-3">
                <SectionTitle
                  number="03"
                  title="Hình thức khuyến mãi"
                  description="Cấu hình voucher giảm trên đơn hàng hoặc phí vận chuyển."
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

                  <FormField
                    label="Phạm vi giảm"
                  >
                    <select
                      value={
                        applyType
                      }
                      onChange={(e) =>
                        setApplyType(
                          e.target.value as VoucherApplyType
                        )
                      }
                      className={inputClass()}
                    >
                      <option value="ORDER">
                        Giảm giá đơn hàng
                      </option>

                      <option value="SHIPPING">
                        Giảm phí vận chuyển
                      </option>
                    </select>
                  </FormField>

                  <FormField
                    label="Hình thức giảm"
                  >
                    <select
                      value={
                        discountType
                      }
                      onChange={(e) =>
                        setDiscountType(
                          e.target.value as VoucherDiscountType
                        )
                      }
                      className={inputClass()}
                    >
                      <option value="FIXED">
                        Số tiền cố định (VNĐ)
                      </option>

                      <option value="PERCENTAGE">
                        Theo phần trăm (%)
                      </option>
                    </select>
                  </FormField>
                </div>

                {/* EXAMPLE */}
                {applyType ===
                  "SHIPPING" &&
                  discountType ===
                    "PERCENTAGE" && (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                    <div className="flex items-start gap-2">
                      <span className="text-sm">
                        💡
                      </span>

                      <div>
                        <div className="text-[9px] font-bold text-emerald-300">
                          Ví dụ
                        </div>

                        <div className="mt-0.5 text-[9px] leading-4 text-emerald-200/60">
                          Nhập{" "}
                          <strong className="text-emerald-300">
                            20
                          </strong>{" "}
                          ở mức giảm để tạo voucher giảm{" "}
                          <strong className="text-emerald-300">
                            20% phí vận chuyển
                          </strong>
                          .
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <FormField
                    label={
                      discountType ===
                      "FIXED"
                        ? "Mức giảm (VNĐ)"
                        : "Mức giảm (%)"
                    }
                    required
                  >
                    <input
                      type="number"
                      min="0"
                      max={
                        discountType ===
                        "PERCENTAGE"
                          ? 100
                          : undefined
                      }
                      value={
                        discountValue
                      }
                      onChange={(e) =>
                        setDiscountValue(
                          e.target.value
                        )
                      }
                      placeholder={
                        discountType ===
                        "FIXED"
                          ? "VD: 20000"
                          : "VD: 20"
                      }
                      className={inputClass(
                        discountType ===
                          "PERCENTAGE"
                          ? "font-bold text-emerald-300"
                          : "font-bold text-emerald-300"
                      )}
                      required
                    />
                  </FormField>

                  {discountType ===
                    "PERCENTAGE" && (
                    <FormField
                      label="Giảm tối đa (VNĐ)"
                      hint="Để trống nếu không giới hạn."
                    >
                      <input
                        type="number"
                        min="0"
                        value={
                          maxDiscount
                        }
                        onChange={(e) =>
                          setMaxDiscount(
                            e.target.value
                          )
                        }
                        placeholder="VD: 50.000"
                        className={inputClass(
                          "font-bold text-amber-300"
                        )}
                      />
                    </FormField>
                  )}
                </div>
              </section>

              {/* =================================================
                  CONDITIONS
              ================================================= */}

              <section className="space-y-3">
                <SectionTitle
                  number="04"
                  title="Điều kiện sử dụng"
                  description="Thiết lập giá trị đơn tối thiểu và giới hạn sử dụng."
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

                  <FormField
                    label="Đơn tối thiểu"
                    hint="0 = không yêu cầu."
                  >
                    <input
                      type="number"
                      min="0"
                      value={
                        minOrder
                      }
                      onChange={(e) =>
                        setMinOrder(
                          e.target.value
                        )
                      }
                      placeholder="VD: 100000"
                      className={inputClass()}
                    />
                  </FormField>

                  <FormField
                    label="Tổng lượt sử dụng"
                    hint="Để trống = không giới hạn."
                  >
                    <input
                      type="number"
                      min="1"
                      value={
                        usageLimit
                      }
                      onChange={(e) =>
                        setUsageLimit(
                          e.target.value
                        )
                      }
                      placeholder="VD: 500"
                      className={inputClass()}
                    />
                  </FormField>

                  <FormField
                    label="Lượt / người dùng"
                  >
                    <input
                      type="number"
                      min="1"
                      value={
                        limitPerUser
                      }
                      onChange={(e) =>
                        setLimitPerUser(
                          e.target.value
                        )
                      }
                      placeholder="Mặc định: 1"
                      className={inputClass()}
                    />
                  </FormField>
                </div>
              </section>

              {/* =================================================
                  DATE
              ================================================= */}

              <section className="space-y-3">
                <SectionTitle
                  number="05"
                  title="Thời gian hiệu lực"
                  description="Thiết lập thời gian bắt đầu và kết thúc của voucher."
                />

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setQuickDate(
                        7
                      )
                    }
                    className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-[9px] font-bold text-slate-300 hover:bg-slate-700 transition"
                  >
                    +7 ngày
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setQuickDate(
                        30
                      )
                    }
                    className="rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-1.5 text-[9px] font-bold text-indigo-300 hover:bg-indigo-500/20 transition"
                  >
                    +30 ngày
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStartDate(
                        ""
                      );
                      setEndDate(
                        ""
                      );
                    }}
                    className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-2.5 py-1.5 text-[9px] font-bold text-rose-300 hover:bg-rose-500/20 transition"
                  >
                    Xóa thời gian
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <FormField label="Bắt đầu">
                    <input
                      type="datetime-local"
                      value={
                        startDate
                      }
                      onChange={(e) =>
                        setStartDate(
                          e.target.value
                        )
                      }
                      className={inputClass(
                        "[color-scheme:dark]"
                      )}
                    />
                  </FormField>

                  <FormField label="Hết hạn">
                    <input
                      type="datetime-local"
                      value={
                        endDate
                      }
                      onChange={(e) =>
                        setEndDate(
                          e.target.value
                        )
                      }
                      className={inputClass(
                        "[color-scheme:dark]"
                      )}
                    />
                  </FormField>
                </div>
              </section>

              {/* =================================================
                  PREVIEW
              ================================================= */}

              <section className="space-y-3">
                <SectionTitle
                  number="06"
                  title="Xác nhận trước khi phát hành"
                  description="Kiểm tra nhanh phạm vi và ưu đãi của voucher."
                />

                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-lg bg-purple-500/10 border border-purple-500/20 px-2 py-1 font-mono text-[10px] font-bold text-purple-300">
                          {code
                            ? code.toUpperCase()
                            : "MÃ VOUCHER"}
                        </span>

                        <span className="text-[11px] font-bold text-white">
                          {title ||
                            "Tên chương trình"}
                        </span>
                      </div>

                      <div className="mt-2 text-[9px] text-slate-500">
                        {targetType ===
                        "MERCHANT"
                          ? `Áp dụng riêng cho ${
                              selectedMerchant?.shopName ||
                              selectedMerchantName ||
                              "quán đã chọn"
                            }`
                          : "Áp dụng toàn hệ thống"}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="text-[20px] font-black text-emerald-400">
                          {discountValue ||
                            "0"}
                          {discountType ===
                          "PERCENTAGE"
                            ? "%"
                            : "đ"}
                        </div>

                        <div className="text-[8px] text-slate-600 mt-0.5">
                          {applyType ===
                          "SHIPPING"
                            ? "phí vận chuyển"
                            : "đơn hàng"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ACTIVE */}
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-3.5">
                  <input
                    type="checkbox"
                    checked={
                      isActive
                    }
                    onChange={(e) =>
                      setIsActive(
                        e.target
                          .checked
                      )
                    }
                    className="mt-0.5 h-4 w-4 accent-purple-600"
                  />

                  <div>
                    <div className="text-[10px] font-bold text-white">
                      Kích hoạt voucher ngay
                    </div>

                    <div className="mt-0.5 text-[8px] leading-4 text-slate-500">
                      Người dùng có thể nhìn thấy và áp dụng mã ngay khi voucher còn hiệu lực.
                    </div>
                  </div>
                </label>
              </section>

              {/* =================================================
                  FOOTER
              ================================================= */}

              <div className="sticky bottom-0 -mx-4 sm:-mx-6 -mb-4 sm:-mb-6 border-t border-slate-800 bg-slate-950/95 backdrop-blur px-4 sm:px-6 py-3">
                <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2">

                  <button
                    type="button"
                    onClick={() =>
                      setActiveTab(
                        "list"
                      )
                    }
                    className="w-full sm:w-auto rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-[9px] font-bold text-slate-300 hover:bg-slate-700 transition"
                  >
                    Quay lại
                  </button>

                  <button
                    type="submit"
                    disabled={
                      loading
                    }
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-[9px] font-bold text-white hover:bg-purple-500 disabled:cursor-wait disabled:opacity-50 transition"
                  >
                    {loading
                      ? "Đang lưu..."
                      : editingVoucherId
                      ? "Lưu cập nhật"
                      : "Phát hành Voucher"}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SECTION TITLE
// ============================================================

function SectionTitle({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-[8px] font-black text-slate-400">
        {number}
      </div>

      <div>
        <h4 className="text-[11px] font-extrabold text-white">
          {title}
        </h4>

        <p className="mt-0.5 text-[8px] leading-4 text-slate-600">
          {description}
        </p>
      </div>
    </div>
  );
}

// ============================================================
// FORM FIELD
// ============================================================

function FormField({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label className="text-[9px] font-bold text-slate-300">
          {label}

          {required && (
            <span className="ml-1 text-rose-400">
              *
            </span>
          )}
        </label>

        {hint && (
          <span className="text-[8px] text-slate-600">
            {hint}
          </span>
        )}
      </div>

      {children}
    </div>
  );
}

// ============================================================
// INPUT CLASS
// ============================================================

function inputClass(
  extraClass = ""
) {
  return [
    "w-full rounded-xl border border-slate-800 bg-slate-900",
    "px-3 py-2.5 text-[10px] text-white",
    "outline-none transition",
    "placeholder:text-slate-600",
    "focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10",
    extraClass,
  ].join(" ");
}