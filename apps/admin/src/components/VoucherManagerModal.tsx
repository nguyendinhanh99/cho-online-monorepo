"use client";

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

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

type CommissionTier = "ALL" | "STANDARD" | "PREMIUM";

type FundingType = "PLATFORM" | "MERCHANT" | "SHARED";

type CampaignType =
  | "WELCOME"
  | "FREESHIP"
  | "ORDER_DISCOUNT"
  | "WEEKEND"
  | "FLASH_SALE"
  | "PREMIUM";

// ============================================================
// COMMISSION TIER
// ============================================================

function normalizeCommissionTier(
  commissionPercent: number,
  explicitTier?: string | null
): Exclude<CommissionTier, "ALL"> {
  if (explicitTier === "PREMIUM") {
    return "PREMIUM";
  }

  if (explicitTier === "STANDARD") {
    return "STANDARD";
  }

  // Backward compatibility:
  // hệ thống hiện tại dùng 15% / 20%.
  return commissionPercent >= 20
    ? "PREMIUM"
    : "STANDARD";
}

function getCommissionTierLabel(
  tier?: CommissionTier | null
) {
  switch (tier) {
    case "PREMIUM":
      return "PREMIUM · 20%";

    case "STANDARD":
      return "STANDARD · 15%";

    default:
      return "Tất cả gói";
  }
}

function getCommissionTierDescription(
  tier?: CommissionTier | null
) {
  switch (tier) {
    case "PREMIUM":
      return "Gói Premium: được hưởng các chiến dịch và voucher Premium.";

    case "STANDARD":
      return "Gói Standard: các voucher và campaign cơ bản.";

    default:
      return "Voucher dùng được cho cả quán Standard và Premium.";
  }
}

// ============================================================
// FUNDING
// ============================================================

function getFundingLabel(
  fundingType?: FundingType,
  platformPercent?: number | null,
  merchantPercent?: number | null
) {
  switch (fundingType) {
    case "MERCHANT":
      return "Quán tài trợ";

    case "SHARED":
      return `Chia sẻ ${Number(
        platformPercent ?? 50
      )}% / ${Number(
        merchantPercent ?? 50
      )}%`;

    default:
      return "Sàn tài trợ";
  }
}

// ============================================================
// CAMPAIGN
// ============================================================

function getCampaignLabel(
  campaignType?: CampaignType | null
) {
  switch (campaignType) {
    case "WELCOME":
      return "Khách hàng mới";

    case "FREESHIP":
      return "Freeship";

    case "ORDER_DISCOUNT":
      return "Giảm đơn hàng";

    case "WEEKEND":
      return "Cuối tuần";

    case "FLASH_SALE":
      return "Flash Sale";

    case "PREMIUM":
      return "Premium";

    default:
      return "Khác";
  }
}

// ============================================================
// VOUCHER
// ============================================================

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

  // ==========================================================
  // COMMISSION TIER
  // ==========================================================

  eligibleCommissionTier?: CommissionTier;

  // ==========================================================
  // FUNDING
  // ==========================================================

  fundingType?: FundingType;

  platformFundingPercent?: number | null;

  merchantFundingPercent?: number | null;

  // ==========================================================
  // CAMPAIGN
  // ==========================================================

  campaignType?: CampaignType | null;
}

// ============================================================
// MERCHANT
// ============================================================

interface MerchantOption {
  id: string;

  shopName: string;

  merchantCode?: string;

  commissionPercent: number;

  commissionTier: Exclude<
    CommissionTier,
    "ALL"
  >;

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

  const [code, setCode] =
    useState("");

  const [title, setTitle] =
    useState("");

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

  // ==========================================================
  // IMPORTANT:
  // ĐIỀU KIỆN ĐƠN TỐI THIỂU
  // ==========================================================

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
  // COMMISSION TIER
  // ==========================================================

  const [
    eligibleCommissionTier,
    setEligibleCommissionTier,
  ] = useState<CommissionTier>("ALL");

  // ==========================================================
  // FUNDING
  // ==========================================================

  const [fundingType, setFundingType] =
    useState<FundingType>("PLATFORM");

  const [
    platformFundingPercent,
    setPlatformFundingPercent,
  ] = useState("100");

  const [
    merchantFundingPercent,
    setMerchantFundingPercent,
  ] = useState("0");

  // ==========================================================
  // CAMPAIGN
  // ==========================================================

  const [campaignType, setCampaignType] =
    useState<CampaignType>(
      "ORDER_DISCOUNT"
    );

  // ==========================================================
  // TARGET
  // ==========================================================

  const [targetType, setTargetType] =
    useState<VoucherTargetType>("ALL");

  const [
    selectedMerchantId,
    setSelectedMerchantId,
  ] = useState("");

  // ==========================================================
  // FALLBACK MERCHANT INFO
  // ==========================================================

  const [
    selectedMerchantName,
    setSelectedMerchantName,
  ] = useState("");

  const [
    selectedMerchantCode,
    setSelectedMerchantCode,
  ] = useState("");

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
    if (!isOpen) {
      return;
    }

    setFetchingList(true);

    const q = query(
      collection(
        db,
        "vouchers"
      ),
      orderBy(
        "createdAt",
        "desc"
      )
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

                  code: String(
                    data.code || ""
                  ),

                  title: String(
                    data.title || ""
                  ),

                  description: String(
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

                  // =================================================
                  // MIN ORDER
                  // =================================================

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
                      : 0,

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

                  // =================================================
                  // TARGET
                  // =================================================

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

                  // =================================================
                  // COMMISSION TIER
                  // =================================================

                  eligibleCommissionTier:
                    data.eligibleCommissionTier ===
                      "PREMIUM" ||
                    data.eligibleCommissionTier ===
                      "STANDARD" ||
                    data.eligibleCommissionTier ===
                      "ALL"
                      ? data.eligibleCommissionTier
                      : data.merchantCommissionPercent !==
                          undefined &&
                        data.merchantCommissionPercent !==
                          null
                      ? normalizeCommissionTier(
                          Number(
                            data.merchantCommissionPercent
                          )
                        )
                      : "ALL",

                  // =================================================
                  // FUNDING
                  // =================================================

                  fundingType:
                    data.fundingType ===
                      "MERCHANT" ||
                    data.fundingType ===
                      "SHARED"
                      ? data.fundingType
                      : "PLATFORM",

                  platformFundingPercent:
                    data.platformFundingPercent !==
                      undefined &&
                    data.platformFundingPercent !==
                      null
                      ? Number(
                          data.platformFundingPercent
                        )
                      : data.fundingType ===
                        "MERCHANT"
                      ? 0
                      : data.fundingType ===
                        "SHARED"
                      ? 50
                      : 100,

                  merchantFundingPercent:
                    data.merchantFundingPercent !==
                      undefined &&
                    data.merchantFundingPercent !==
                      null
                      ? Number(
                          data.merchantFundingPercent
                        )
                      : data.fundingType ===
                        "MERCHANT"
                      ? 100
                      : data.fundingType ===
                        "SHARED"
                      ? 50
                      : 0,

                  // =================================================
                  // CAMPAIGN
                  // =================================================

                  campaignType:
                    data.campaignType ===
                      "WELCOME" ||
                    data.campaignType ===
                      "FREESHIP" ||
                    data.campaignType ===
                      "ORDER_DISCOUNT" ||
                    data.campaignType ===
                      "WEEKEND" ||
                    data.campaignType ===
                      "FLASH_SALE" ||
                    data.campaignType ===
                      "PREMIUM"
                      ? data.campaignType
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

    return () =>
      unsubscribe();
  }, [isOpen]);

  // ==========================================================
  // FETCH MERCHANTS
  // ==========================================================

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setFetchingMerchants(true);

    const merchantCollection =
      collection(
        db,
        "merchants"
      );

    const unsubscribe =
      onSnapshot(
        merchantCollection,
        (snapshot) => {
          const list: MerchantOption[] =
            [];

          snapshot.docs.forEach(
            (docSnap) => {
              const data =
                docSnap.data();

              const status =
                String(
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

              const parsedCommission =
                Number(
                  data.commissionPercent ??
                    10
                );

              const commissionPercent =
                Number.isFinite(
                  parsedCommission
                ) &&
                parsedCommission >=
                  0 &&
                parsedCommission <=
                  100
                  ? parsedCommission
                  : 10;

              const commissionTier =
                normalizeCommissionTier(
                  commissionPercent,
                  data.commissionTier
                );

              const merchant: MerchantOption =
                {
                  id: docSnap.id,

                  shopName: String(
                    data.shopName ||
                      data.storeName ||
                      data.name ||
                      "Gian hàng"
                  ),

                  merchantCode:
                    data.merchantCode
                      ? String(
                          data.merchantCode
                        )
                      : undefined,

                  commissionPercent,

                  commissionTier,

                  status:
                    status ||
                    "APPROVED",
                };

              list.push(
                merchant
              );
            }
          );

          list.sort(
            (a, b) =>
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

    return () =>
      unsubscribe();
  }, [isOpen]);

  // ==========================================================
  // FORMAT DATE
  // ==========================================================

  const formatISOToInput = (
    isoStr?: string | null
  ) => {
    if (!isoStr) {
      return "";
    }

    try {
      const date =
        new Date(
          isoStr
        );

      if (
        Number.isNaN(
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
    ).format(
      Number(value) || 0
    );

  // ==========================================================
  // SELECTED MERCHANT
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
  // MERCHANT CHANGE
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

    // Voucher riêng quán luôn theo đúng tier.
    setEligibleCommissionTier(
      merchant.commissionTier
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

    // ==========================================================
    // LOAD MIN ORDER
    // ==========================================================

    setMinOrder(
      voucher.minOrder !==
        null &&
      voucher.minOrder !==
        undefined &&
      voucher.minOrder > 0
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

    // ==========================================================
    // COMMISSION TIER
    // ==========================================================

    const storedTier =
      voucher.eligibleCommissionTier &&
      [
        "ALL",
        "STANDARD",
        "PREMIUM",
      ].includes(
        voucher.eligibleCommissionTier
      )
        ? voucher.eligibleCommissionTier
        : "ALL";

    setEligibleCommissionTier(
      storedTier as CommissionTier
    );

    // ==========================================================
    // FUNDING
    // ==========================================================

    const storedFunding =
      voucher.fundingType ===
        "MERCHANT" ||
      voucher.fundingType ===
        "SHARED"
        ? voucher.fundingType
        : "PLATFORM";

    setFundingType(
      storedFunding
    );

    setPlatformFundingPercent(
      String(
        voucher.platformFundingPercent ??
          (storedFunding ===
          "MERCHANT"
            ? 0
            : storedFunding ===
              "SHARED"
            ? 50
            : 100)
      )
    );

    setMerchantFundingPercent(
      String(
        voucher.merchantFundingPercent ??
          (storedFunding ===
          "MERCHANT"
            ? 100
            : storedFunding ===
              "SHARED"
            ? 50
            : 0)
      )
    );

    // ==========================================================
    // CAMPAIGN
    // ==========================================================

    setCampaignType(
      voucher.campaignType ||
        "ORDER_DISCOUNT"
    );

    // ==========================================================
    // TARGET
    // ==========================================================

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

      const matchedMerchant =
        merchants.find(
          (merchant) =>
            merchant.id ===
            voucher.merchantId
        );

      setEligibleCommissionTier(
        matchedMerchant?.commissionTier ||
          normalizeCommissionTier(
            voucher.merchantCommissionPercent ??
              15
          )
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

      if (
        !voucher.eligibleCommissionTier
      ) {
        setEligibleCommissionTier(
          "ALL"
        );
      }
    }

    setActiveTab(
      "form"
    );
  };

  // ==========================================================
  // CREATE
  // ==========================================================

  const handleOpenCreateForm = () => {
    resetForm();

    setEditingVoucherId(
      null
    );

    setActiveTab(
      "form"
    );
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
  // FUNDING TYPE
  // ==========================================================

  const handleFundingTypeChange = (
    nextType: FundingType
  ) => {
    setFundingType(
      nextType
    );

    if (
      nextType ===
      "PLATFORM"
    ) {
      setPlatformFundingPercent(
        "100"
      );

      setMerchantFundingPercent(
        "0"
      );

      return;
    }

    if (
      nextType ===
      "MERCHANT"
    ) {
      setPlatformFundingPercent(
        "0"
      );

      setMerchantFundingPercent(
        "100"
      );

      return;
    }

    setPlatformFundingPercent(
      "50"
    );

    setMerchantFundingPercent(
      "50"
    );
  };

  // ==========================================================
  // SUBMIT
  // ==========================================================

  const handleSubmit = async (
    e: FormEvent
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
    // MAX DISCOUNT
    // --------------------------------------------------------

    const numericMaxDiscount =
      maxDiscount
        ? Number(
            maxDiscount
          )
        : null;

    if (
      numericMaxDiscount !==
        null &&
      (!Number.isFinite(
        numericMaxDiscount
      ) ||
        numericMaxDiscount <=
          0)
    ) {
      alert(
        "Mức giảm tối đa không hợp lệ."
      );

      return;
    }

    // --------------------------------------------------------
    // TARGET
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
    // MIN ORDER
    // ========================================================
    // Ví dụ:
    // minOrder = 70000
    // => khách phải có đơn >= 70.000đ
    // --------------------------------------------------------

    const numericMinOrder =
      minOrder
        ? Number(
            minOrder
          )
        : 0;

    if (
      !Number.isFinite(
        numericMinOrder
      ) ||
      numericMinOrder <
        0
    ) {
      alert(
        "Giá trị đơn tối thiểu không hợp lệ."
      );

      return;
    }

    // ========================================================
    // Không cho maxDiscount nhỏ hơn 0
    // ========================================================

    if (
      discountType ===
        "PERCENTAGE" &&
      numericMaxDiscount !==
        null &&
      numericMaxDiscount <= 0
    ) {
      alert(
        "Mức giảm tối đa phải lớn hơn 0."
      );

      return;
    }

    // --------------------------------------------------------
    // DATE
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
        !Number.isNaN(
          start
        ) &&
        !Number.isNaN(
          end
        ) &&
        end <= start
      ) {
        alert(
          "Thời gian hết hạn phải lớn hơn thời gian bắt đầu."
        );

        return;
      }
    }

    // --------------------------------------------------------
    // USAGE LIMIT
    // --------------------------------------------------------

    const numericUsageLimit =
      usageLimit
        ? Number(
            usageLimit
          )
        : null;

    const numericLimitPerUser =
      Number(
        limitPerUser || 1
      );

    if (
      numericUsageLimit !==
        null &&
      (!Number.isFinite(
        numericUsageLimit
      ) ||
        numericUsageLimit <= 0)
    ) {
      alert(
        "Tổng số lượt dùng phải lớn hơn 0."
      );

      return;
    }

    if (
      !Number.isFinite(
        numericLimitPerUser
      ) ||
      numericLimitPerUser <=
        0
    ) {
      alert(
        "Lượt sử dụng mỗi người phải lớn hơn 0."
      );

      return;
    }

    // --------------------------------------------------------
    // FUNDING
    // --------------------------------------------------------

    const numericPlatformFunding =
      Number(
        platformFundingPercent || 0
      );

    const numericMerchantFunding =
      Number(
        merchantFundingPercent || 0
      );

    if (
      !Number.isFinite(
        numericPlatformFunding
      ) ||
      !Number.isFinite(
        numericMerchantFunding
      ) ||
      numericPlatformFunding <
        0 ||
      numericMerchantFunding <
        0 ||
      numericPlatformFunding >
        100 ||
      numericMerchantFunding >
        100 ||
      Math.abs(
        numericPlatformFunding +
          numericMerchantFunding -
          100
      ) > 0.001
    ) {
      alert(
        "Tỷ lệ tài trợ voucher phải hợp lệ và tổng Sàn + Quán phải bằng 100%."
      );

      return;
    }

    // --------------------------------------------------------
    // MERCHANT COMMISSION TIER
    // --------------------------------------------------------

    let finalMerchantTier:
      | Exclude<
          CommissionTier,
          "ALL"
        >
      | null = null;

    if (
      targetType ===
      "MERCHANT"
    ) {
      const merchantTier =
        selectedMerchant?.commissionTier ||
        (selectedMerchantCommission !==
        null
          ? normalizeCommissionTier(
              selectedMerchantCommission
            )
          : null);

      if (!merchantTier) {
        alert(
          "Không xác định được gói hoa hồng của quán. Vui lòng chọn lại quán."
        );

        return;
      }

      finalMerchantTier =
        merchantTier;

      if (
        eligibleCommissionTier !==
          "ALL" &&
        eligibleCommissionTier !==
          merchantTier
      ) {
        alert(
          `Voucher riêng cho quán phải dùng đúng gói ${getCommissionTierLabel(
            merchantTier
          )}.`
        );

        return;
      }

      setEligibleCommissionTier(
        merchantTier
      );
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

    let finalEligibleCommissionTier: CommissionTier =
      eligibleCommissionTier;

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

      finalEligibleCommissionTier =
        finalMerchantTier ||
        selectedMerchant?.commissionTier ||
        (finalMerchantCommission !==
        null
          ? normalizeCommissionTier(
              finalMerchantCommission
            )
          : eligibleCommissionTier);
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
          "PERCENTAGE"
          ? numericMaxDiscount
          : null,

      // ======================================================
      // ĐIỀU KIỆN ĐƠN TỐI THIỂU
      // ======================================================

      minOrder:
        numericMinOrder,

      usageLimit:
        numericUsageLimit,

      limitPerUser:
        numericLimitPerUser,

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
      // TARGET
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

      // ======================================================
      // COMMISSION
      // ======================================================

      eligibleCommissionTier:
        finalEligibleCommissionTier,

      // ======================================================
      // FUNDING
      // ======================================================

      fundingType,

      platformFundingPercent:
        numericPlatformFunding,

      merchantFundingPercent:
        numericMerchantFunding,

      // ======================================================
      // CAMPAIGN
      // ======================================================

      campaignType,
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
            ? `Đã tạo voucher riêng cho ${
                finalMerchantName ||
                "quán"
              }.`
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
  // RESET
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

    // ========================================================
    // RESET ĐIỀU KIỆN
    // ========================================================

    setMinOrder("");

    setUsageLimit("");

    setLimitPerUser(
      "1"
    );

    setStartDate("");

    setEndDate("");

    setIsActive(true);

    setEligibleCommissionTier(
      "ALL"
    );

    setFundingType(
      "PLATFORM"
    );

    setPlatformFundingPercent(
      "100"
    );

    setMerchantFundingPercent(
      "0"
    );

    setCampaignType(
      "ORDER_DISCOUNT"
    );

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
  // CLOSED
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
                    Quản lý voucher theo gói Standard 15%, Premium 20% và ngân sách tài trợ.
                  </p>

                  <div className="mt-2 flex flex-wrap gap-1.5">

                    <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[8px] font-bold text-sky-300">
                      STANDARD · 15%
                    </span>

                    <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[8px] font-bold text-amber-300">
                      PREMIUM · 20%
                    </span>

                  </div>
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
                                  {
                                    voucher.title
                                  }
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

                                <span
                                  className={[
                                    "rounded-full px-2 py-0.5 text-[9px] font-bold border",
                                    voucher.eligibleCommissionTier ===
                                    "PREMIUM"
                                      ? "border-amber-500/20 bg-amber-500/10 text-amber-300"
                                      : voucher.eligibleCommissionTier ===
                                        "STANDARD"
                                      ? "border-sky-500/20 bg-sky-500/10 text-sky-300"
                                      : "border-violet-500/20 bg-violet-500/10 text-violet-300",
                                  ].join(
                                    " "
                                  )}
                                >
                                  {getCommissionTierLabel(
                                    voucher.eligibleCommissionTier
                                  )}
                                </span>

                                <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-[9px] font-bold text-indigo-300">
                                  {getCampaignLabel(
                                    voucher.campaignType
                                  )}
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

                              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2">

                                {/* DISCOUNT */}

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

                                {/* TARGET */}

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

                                {/* MIN ORDER */}

                                <div className="rounded-xl bg-slate-950/70 border border-amber-500/10 p-2.5">

                                  <div className="text-[8px] uppercase tracking-wide text-slate-600">
                                    Điều kiện đơn
                                  </div>

                                  <div className="mt-1 text-[10px] font-bold text-amber-300">
                                    {voucher.minOrder &&
                                    voucher.minOrder >
                                      0
                                      ? `Đơn từ ${formatCurrency(
                                          voucher.minOrder
                                        )}`
                                      : "Không yêu cầu"}
                                  </div>

                                  <div className="mt-0.5 text-[8px] text-slate-600">
                                    Giá trị tối thiểu
                                  </div>

                                </div>

                                {/* USAGE */}

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

                                {/* FUNDING */}

                                <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-2.5">

                                  <div className="text-[8px] uppercase tracking-wide text-slate-600">
                                    Tài trợ
                                  </div>

                                  <div className="mt-1 text-[10px] font-bold text-violet-300">
                                    {getFundingLabel(
                                      voucher.fundingType,
                                      voucher.platformFundingPercent,
                                      voucher.merchantFundingPercent
                                    )}
                                  </div>

                                  <div className="mt-0.5 text-[8px] text-slate-600">
                                    Chi phí voucher
                                  </div>

                                </div>

                                {/* CAMPAIGN */}

                                <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-2.5">

                                  <div className="text-[8px] uppercase tracking-wide text-slate-600">
                                    Campaign
                                  </div>

                                  <div className="mt-1 text-[10px] font-bold text-indigo-300">
                                    {getCampaignLabel(
                                      voucher.campaignType
                                    )}
                                  </div>

                                  <div className="mt-0.5 text-[8px] text-slate-600">
                                    Chương trình
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
                    value={
                      description
                    }
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

                      setEligibleCommissionTier(
                        "ALL"
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
                    onClick={() => {
                      setTargetType(
                        "MERCHANT"
                      );

                      if (
                        selectedMerchant
                      ) {
                        setEligibleCommissionTier(
                          selectedMerchant.commissionTier
                        );
                      }
                    }}
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
                            {
                              merchant.shopName
                            }

                            {merchant.merchantCode
                              ? ` • #${merchant.merchantCode}`
                              : ""}

                            {" "}•
                            {
                              merchant.commissionPercent
                            }%
                            {" · "}
                            {getCommissionTierLabel(
                              merchant.commissionTier
                            )}
                          </option>
                        )
                      )}

                    </select>

                    {/* MERCHANT SUMMARY */}

                    {(selectedMerchant ||
                      selectedMerchantId) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">

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

                        <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3">

                          <div className="text-[8px] uppercase tracking-wide text-violet-300/50">
                            Gói quyền lợi
                          </div>

                          <div className="mt-1 text-[11px] font-black text-violet-300">
                            {getCommissionTierLabel(
                              selectedMerchant?.commissionTier ||
                                (selectedMerchantCommission !==
                                null
                                  ? normalizeCommissionTier(
                                      selectedMerchantCommission
                                    )
                                  : null)
                            )}
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
                  COMMISSION TIER
              ================================================= */}

              <section className="space-y-3">

                <SectionTitle
                  number="03"
                  title="Gói hoa hồng & quyền lợi"
                  description="Phân biệt voucher theo gói Standard 15% và Premium 20%."
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

                  {/* ALL */}

                  <button
                    type="button"
                    disabled={
                      targetType ===
                      "MERCHANT"
                    }
                    onClick={() =>
                      setEligibleCommissionTier(
                        "ALL"
                      )
                    }
                    className={[
                      "text-left rounded-2xl border p-4 transition",
                      eligibleCommissionTier ===
                      "ALL"
                        ? "border-purple-500 bg-purple-500/10"
                        : "border-slate-800 bg-slate-900 hover:border-slate-700",
                      targetType ===
                      "MERCHANT"
                        ? "cursor-not-allowed opacity-60"
                        : "",
                    ].join(
                      " "
                    )}
                  >

                    <div className="text-[10px] font-black text-white">
                      🌐 Tất cả gói
                    </div>

                    <div className="mt-1 text-[8px] leading-4 text-slate-500">
                      Standard 15% và Premium 20% đều có thể sử dụng.
                    </div>

                  </button>

                  {/* STANDARD */}

                  <button
                    type="button"
                    disabled={
                      targetType ===
                      "MERCHANT"
                    }
                    onClick={() =>
                      setEligibleCommissionTier(
                        "STANDARD"
                      )
                    }
                    className={[
                      "text-left rounded-2xl border p-4 transition",
                      eligibleCommissionTier ===
                      "STANDARD"
                        ? "border-sky-500 bg-sky-500/10"
                        : "border-slate-800 bg-slate-900 hover:border-slate-700",
                      targetType ===
                      "MERCHANT"
                        ? "cursor-not-allowed opacity-60"
                        : "",
                    ].join(
                      " "
                    )}
                  >

                    <div className="flex items-center gap-2">

                      <span className="text-[10px] font-black text-white">
                        🔹 STANDARD · 15%
                      </span>

                      {eligibleCommissionTier ===
                        "STANDARD" && (
                        <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[7px] font-bold text-sky-300">
                          ĐANG CHỌN
                        </span>
                      )}

                    </div>

                    <div className="mt-1 text-[8px] leading-4 text-slate-500">
                      Voucher và campaign cơ bản.
                    </div>

                  </button>

                  {/* PREMIUM */}

                  <button
                    type="button"
                    disabled={
                      targetType ===
                      "MERCHANT"
                    }
                    onClick={() =>
                      setEligibleCommissionTier(
                        "PREMIUM"
                      )
                    }
                    className={[
                      "text-left rounded-2xl border p-4 transition",
                      eligibleCommissionTier ===
                      "PREMIUM"
                        ? "border-amber-500 bg-amber-500/10"
                        : "border-slate-800 bg-slate-900 hover:border-slate-700",
                      targetType ===
                      "MERCHANT"
                        ? "cursor-not-allowed opacity-60"
                        : "",
                    ].join(
                      " "
                    )}
                  >

                    <div className="flex items-center gap-2">

                      <span className="text-[10px] font-black text-white">
                        ⭐ PREMIUM · 20%
                      </span>

                      {eligibleCommissionTier ===
                        "PREMIUM" && (
                        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[7px] font-bold text-amber-300">
                          ĐANG CHỌN
                        </span>
                      )}

                    </div>

                    <div className="mt-1 text-[8px] leading-4 text-slate-500">
                      Voucher mạnh hơn và campaign Premium.
                    </div>

                  </button>

                </div>

                <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-3.5">

                  <div className="flex items-start gap-3">

                    <div className="text-lg">
                      🎯
                    </div>

                    <div className="min-w-0">

                      <div className="text-[10px] font-bold text-violet-300">
                        {getCommissionTierLabel(
                          eligibleCommissionTier
                        )}
                      </div>

                      <div className="mt-1 text-[8px] leading-4 text-violet-200/50">
                        {targetType ===
                          "MERCHANT" &&
                        selectedMerchant
                          ? `Voucher riêng cho ${selectedMerchant.shopName} sẽ tự động theo ${getCommissionTierLabel(
                              selectedMerchant.commissionTier
                            )}.`
                          : getCommissionTierDescription(
                              eligibleCommissionTier
                            )}
                      </div>

                    </div>

                  </div>

                </div>

              </section>

              {/* =================================================
                  DISCOUNT
              ================================================= */}

              <section className="space-y-3">

                <SectionTitle
                  number="04"
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
                      step={
                        discountType ===
                        "FIXED"
                          ? "1000"
                          : "1"
                      }
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
                        "font-bold text-emerald-300"
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
                        step="1000"
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
                  number="05"
                  title="Điều kiện sử dụng"
                  description="Thiết lập giá trị đơn tối thiểu và giới hạn sử dụng."
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

                  {/* =================================================
                      MIN ORDER
                  ================================================= */}

                  <FormField
                    label="Giá trị đơn tối thiểu"
                    hint="Đơn phải đạt mức này mới dùng được."
                  >

                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={
                        minOrder
                      }
                      onChange={(e) =>
                        setMinOrder(
                          e.target.value
                        )
                      }
                      placeholder="VD: 70000"
                      className={inputClass(
                        "font-bold text-amber-300"
                      )}
                    />

                    {/* QUICK CONDITIONS */}

                    <div className="mt-2 flex flex-wrap gap-1.5">

                      {[50000, 70000, 100000, 150000, 200000].map(
                        (amount) => {

                          const isSelected =
                            Number(
                              minOrder || 0
                            ) === amount;

                          return (
                            <button
                              key={
                                amount
                              }
                              type="button"
                              onClick={() =>
                                setMinOrder(
                                  String(
                                    amount
                                  )
                                )
                              }
                              className={[
                                "rounded-lg border px-2 py-1 text-[8px] font-bold transition",
                                isSelected
                                  ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                                  : "border-slate-700 bg-slate-800 text-slate-400 hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-300",
                              ].join(
                                " "
                              )}
                            >
                              {amount /
                                1000}
                              K
                            </button>
                          );
                        }
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          setMinOrder(
                            ""
                          )
                        }
                        className={[
                          "rounded-lg border px-2 py-1 text-[8px] font-bold transition",
                          !minOrder ||
                          Number(
                            minOrder
                          ) === 0
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                            : "border-rose-500/20 bg-rose-500/5 text-rose-300 hover:bg-rose-500/10",
                        ].join(
                          " "
                        )}
                      >
                        Không điều kiện
                      </button>

                    </div>

                    {/* CURRENT CONDITION */}

                    {minOrder &&
                      Number(
                        minOrder
                      ) > 0 && (
                        <div className="mt-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2">

                          <div className="text-[8px] uppercase tracking-wide text-amber-300/50">
                            Điều kiện hiện tại
                          </div>

                          <div className="mt-1 text-[10px] font-bold text-amber-300">
                            🛒 Đơn từ{" "}
                            {formatCurrency(
                              Number(
                                minOrder
                              )
                            )}
                          </div>

                        </div>
                      )}

                  </FormField>

                  {/* =================================================
                      USAGE LIMIT
                  ================================================= */}

                  <FormField
                    label="Tổng lượt sử dụng"
                    hint="Để trống = không giới hạn."
                  >

                    <input
                      type="number"
                      min="1"
                      step="1"
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

                    <div className="mt-2 text-[8px] text-slate-600">
                      Ví dụ: 500 lượt cho toàn bộ khách hàng.
                    </div>

                  </FormField>

                  {/* =================================================
                      USER LIMIT
                  ================================================= */}

                  <FormField
                    label="Lượt sử dụng / người"
                    hint="Giới hạn cho từng khách."
                  >

                    <input
                      type="number"
                      min="1"
                      step="1"
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

                    <div className="mt-2 text-[8px] text-slate-600">
                      Ví dụ: mỗi khách chỉ được dùng 1 lần.
                    </div>

                  </FormField>

                </div>

                {/* =================================================
                    CONDITION SUMMARY
                ================================================= */}

                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-3.5">

                  <div className="text-[8px] uppercase tracking-wide text-slate-600">
                    Điều kiện voucher
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">

                    {minOrder &&
                    Number(
                      minOrder
                    ) > 0 ? (
                      <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[8px] font-bold text-amber-300">
                        🛒 Đơn từ{" "}
                        {formatCurrency(
                          Number(
                            minOrder
                          )
                        )}
                      </span>
                    ) : (
                      <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[8px] font-bold text-emerald-300">
                        ✓ Không yêu cầu giá trị đơn tối thiểu
                      </span>
                    )}

                    <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-1 text-[8px] font-bold text-indigo-300">
                      👤{" "}
                      {limitPerUser ||
                        1}{" "}
                      lượt/người
                    </span>

                    {usageLimit && (
                      <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-2.5 py-1 text-[8px] font-bold text-purple-300">
                        🎫 Tối đa{" "}
                        {
                          usageLimit
                        }{" "}
                        lượt
                      </span>
                    )}

                  </div>
                </div>

                {/* =================================================
                    REAL EXAMPLE
                ================================================= */}

                <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-3.5">

                  <div className="flex items-start gap-3">

                    <div className="text-lg">
                      💡
                    </div>

                    <div>

                      <div className="text-[10px] font-bold text-sky-300">
                        Ví dụ điều kiện
                      </div>

                      <div className="mt-1 text-[9px] leading-5 text-sky-200/60">
                        Voucher giảm{" "}
                        <strong className="text-sky-300">
                          {discountType ===
                          "FIXED"
                            ? formatCurrency(
                                Number(
                                  discountValue ||
                                    0
                                )
                              )
                            : `${discountValue || 0}%`}
                        </strong>{" "}
                        cho{" "}
                        <strong className="text-sky-300"/>
                          {applyType ===
                          "SHIPPING"
                            ? "phí vận chuyển"
                            : "đơn hàng"}
                        .
                        {" "}
                        {Number(
                          minOrder || 0
                        ) > 0 ? (
                          <>
                            Khách phải có đơn từ{" "}
                            <strong className="text-amber-300">
                              {formatCurrency(
                                Number(
                                  minOrder
                                )
                              )}
                            </strong>
                            .
                          </>
                        ) : (
                          <>
                            Không yêu cầu giá trị đơn tối thiểu.
                          </>
                        )}
                      </div>

                    </div>
                  </div>

                </div>

              </section>

              {/* =================================================
                  FUNDING / CAMPAIGN
              ================================================= */}

              <section className="space-y-3">

                <SectionTitle
                  number="06"
                  title="Ngân sách voucher & Campaign"
                  description="Xác định ai tài trợ voucher và voucher thuộc chương trình nào."
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

                  <FormField
                    label="Ai tài trợ voucher"
                  >

                    <select
                      value={
                        fundingType
                      }
                      onChange={(e) =>
                        handleFundingTypeChange(
                          e.target.value as FundingType
                        )
                      }
                      className={inputClass()}
                    >

                      <option value="PLATFORM">
                        Sàn tài trợ · 100%
                      </option>

                      <option value="MERCHANT">
                        Quán tài trợ · 100%
                      </option>

                      <option value="SHARED">
                        Chia sẻ chi phí · Sàn + Quán
                      </option>

                    </select>

                  </FormField>

                  <FormField
                    label="Loại Campaign"
                  >

                    <select
                      value={
                        campaignType
                      }
                      onChange={(e) =>
                        setCampaignType(
                          e.target.value as CampaignType
                        )
                      }
                      className={inputClass()}
                    >

                      <option value="ORDER_DISCOUNT">
                        Giảm đơn hàng
                      </option>

                      <option value="FREESHIP">
                        Freeship
                      </option>

                      <option value="WELCOME">
                        Khách hàng mới
                      </option>

                      <option value="WEEKEND">
                        Cuối tuần
                      </option>

                      <option value="FLASH_SALE">
                        Flash Sale
                      </option>

                      <option value="PREMIUM">
                        Premium
                      </option>

                    </select>

                  </FormField>

                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

                  <FormField
                    label="Sàn tài trợ (%)"
                    hint="Tổng Sàn + Quán = 100%"
                  >

                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={
                        platformFundingPercent
                      }
                      onChange={(e) =>
                        setPlatformFundingPercent(
                          e.target.value
                        )
                      }
                      disabled={
                        fundingType !==
                        "SHARED"
                      }
                      className={inputClass(
                        "font-bold text-violet-300"
                      )}
                    />

                  </FormField>

                  <FormField
                    label="Quán tài trợ (%)"
                    hint="Tổng Sàn + Quán = 100%"
                  >

                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={
                        merchantFundingPercent
                      }
                      onChange={(e) =>
                        setMerchantFundingPercent(
                          e.target.value
                        )
                      }
                      disabled={
                        fundingType !==
                        "SHARED"
                      }
                      className={inputClass(
                        "font-bold text-orange-300"
                      )}
                    />

                  </FormField>

                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-3.5">

                  <div className="flex flex-wrap items-center justify-between gap-2">

                    <div>

                      <div className="text-[9px] uppercase tracking-wide text-slate-600">
                        Cách phân bổ chi phí
                      </div>

                      <div className="mt-1 text-[11px] font-black text-white">
                        {getFundingLabel(
                          fundingType,
                          Number(
                            platformFundingPercent ||
                              0
                          ),
                          Number(
                            merchantFundingPercent ||
                              0
                          )
                        )}
                      </div>

                    </div>

                    <div className="text-right">

                      <div className="text-[8px] text-slate-600">
                        Campaign
                      </div>

                      <div className="mt-1 text-[10px] font-bold text-indigo-300">
                        {getCampaignLabel(
                          campaignType
                        )}
                      </div>

                    </div>

                  </div>
                </div>

              </section>

              {/* =================================================
                  DATE
              ================================================= */}

              <section className="space-y-3">

                <SectionTitle
                  number="07"
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
                  number="08"
                  title="Xác nhận trước khi phát hành"
                  description="Kiểm tra nhanh phạm vi, mức giảm và điều kiện của voucher."
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

                      {/* =================================================
                          CONDITION BADGES
                      ================================================= */}

                      <div className="mt-2 flex flex-wrap gap-1.5">

                        {minOrder &&
                        Number(
                          minOrder
                        ) > 0 ? (
                          <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[8px] font-bold text-amber-300">
                            🛒 Đơn từ{" "}
                            {formatCurrency(
                              Number(
                                minOrder
                              )
                            )}
                          </span>
                        ) : (
                          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[8px] font-bold text-emerald-300">
                            ✓ Không điều kiện tối thiểu
                          </span>
                        )}

                        <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-[8px] font-bold text-indigo-300">
                          👤{" "}
                          {limitPerUser ||
                            1}{" "}
                          lượt/người
                        </span>

                        {usageLimit && (
                          <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 text-[8px] font-bold text-purple-300">
                            🎫 Tối đa{" "}
                            {
                              usageLimit
                            }{" "}
                            lượt
                          </span>
                        )}

                      </div>

                      {/* =================================================
                          TIER / CAMPAIGN / FUNDING
                      ================================================= */}

                      <div className="mt-2 flex flex-wrap gap-1.5">

                        <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-[8px] font-bold text-violet-300">
                          {targetType ===
                            "MERCHANT" &&
                          selectedMerchant
                            ? getCommissionTierLabel(
                                selectedMerchant.commissionTier
                              )
                            : getCommissionTierLabel(
                                eligibleCommissionTier
                              )}
                        </span>

                        <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-[8px] font-bold text-indigo-300">
                          {getCampaignLabel(
                            campaignType
                          )}
                        </span>

                        <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-[8px] font-bold text-slate-300">
                          {getFundingLabel(
                            fundingType,
                            Number(
                              platformFundingPercent ||
                                0
                            ),
                            Number(
                              merchantFundingPercent ||
                                0
                            )
                          )}
                        </span>

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

                {/* =================================================
                    ACTIVE
                ================================================= */}

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
  children: ReactNode;
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