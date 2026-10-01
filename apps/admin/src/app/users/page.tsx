"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { onAuthStateChanged } from "firebase/auth";

import { UserDetailModal } from "@/components/UserDetailModal";
import { auth } from "@cho-online/firebase";

/* ============================================================
   TYPES
============================================================ */

type RoleKey =
  | "ALL"
  | "ADMIN"
  | "OPERATOR"
  | "SUPPORT"
  | "MERCHANT"
  | "SHIPPER"
  | "CUSTOMER";

type UserRecord = {
  id?: string;
  uid?: string;

  role?: string;
  status?: string;

  fullName?: string;
  ownerName?: string;
  shopName?: string;

  phone?: string;
  phoneNumber?: string;

  identityCardNumber?: string;
  idCardNumber?: string;

  merchantCode?: string;

  avatar?: string;
  avatarUrl?: string;

  commissionPercent?: number | string;
  platformCommissionPercent?: number | string;
  merchantCommissionPercent?: number | string;
  platformFeePercent?: number | string;

  [key: string]: any;
};

type CommissionEditState =
  | {
      userId: string;
      value: string;
    }
  | null;

type PasswordResetStatus =
  | "PENDING"
  | "PROCESSING"
  | "RESOLVED"
  | "REJECTED"
  | string;

type PasswordResetRequest = {
  id: string;
  requestId?: string;

  userType?: string;
  userId: string;

  phone: string;
  customerName?: string;

  status: PasswordResetStatus;
  source?: string;

  requestCount?: number;

  requestedAt?: string | null;
  lastRequestedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;

  resolvedAt?: string | null;
  resolvedBy?: string | null;

  rejectedAt?: string | null;
  rejectedBy?: string | null;
};

type TemporaryPasswordState =
  | {
      requestId: string;
      userId: string;
      customerName: string;
      phone: string;
      temporaryPassword: string;
    }
  | null;

/* ============================================================
   CONSTANTS
============================================================ */

const ROLES: Array<{
  key: RoleKey;
  label: string;
}> = [
  { key: "ALL", label: "Tất cả" },
  { key: "ADMIN", label: "Admin" },
  { key: "OPERATOR", label: "Vận hành" },
  { key: "SUPPORT", label: "CSKH" },
  { key: "MERCHANT", label: "Gian hàng" },
  { key: "SHIPPER", label: "Shipper" },
  { key: "CUSTOMER", label: "Khách hàng" },
];

/* ============================================================
   SMALL ICONS
============================================================ */

function UsersIcon({
  className = "h-5 w-5",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function RefreshIcon({
  className = "h-4 w-4",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M20 6v6h-6" />
      <path d="M4 18v-6h6" />
      <path d="M5.6 9A8 8 0 0 1 19 6l1 6" />
      <path d="M18.4 15A8 8 0 0 1 5 18l-1-6" />
    </svg>
  );
}

function SearchIcon({
  className = "h-4 w-4",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function LockIcon({
  className = "h-5 w-5",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      <path d="M12 14v3" />
    </svg>
  );
}

function CopyIcon({
  className = "h-4 w-4",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon({
  className = "h-4 w-4",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

function CloseIcon({
  className = "h-4 w-4",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function PencilIcon({
  className = "h-3.5 w-3.5",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function ShieldIcon({
  className = "h-5 w-5",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

/* ============================================================
   HELPERS
============================================================ */

function getUserId(
  user: UserRecord,
  fallback = ""
): string {
  return String(
    user?.uid ||
      user?.id ||
      fallback
  ).trim();
}

function getRole(user: UserRecord): string {
  return String(
    user?.role ||
      "CUSTOMER"
  )
    .trim()
    .toUpperCase();
}

function getStatus(user: UserRecord): string {
  return String(
    user?.status ||
      ""
  )
    .trim()
    .toUpperCase();
}

function getDisplayName(
  user: UserRecord
): string {
  return String(
    user?.fullName ||
      user?.ownerName ||
      user?.shopName ||
      "Chưa đặt tên"
  );
}

function getPhone(
  user: UserRecord
): string {
  return String(
    user?.phone ||
      user?.phoneNumber ||
      "N/A"
  );
}

function getAvatar(
  user: UserRecord
): string {
  return String(
    user?.avatar ||
      user?.avatarUrl ||
      ""
  );
}

function getCommissionPercent(
  user: UserRecord
): number {
  const value =
    user?.commissionPercent ??
    user?.platformCommissionPercent ??
    user?.merchantCommissionPercent ??
    user?.platformFeePercent ??
    0;

  const number =
    Number(value);

  if (
    !Number.isFinite(
      number
    )
  ) {
    return 0;
  }

  return Math.min(
    100,
    Math.max(
      0,
      number
    )
  );
}

function isMerchant(
  user: UserRecord
): boolean {
  return (
    getRole(user) ===
    "MERCHANT"
  );
}

function formatRequestTime(
  value?: string | null
): string {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "vi-VN",
    {
      timeZone:
        "Asia/Ho_Chi_Minh",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(date);
}

async function readApiJson(
  response: Response
): Promise<any> {
  const raw =
    await response.text();

  if (!raw.trim()) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    console.error(
      "[ADMIN USERS] API response không phải JSON:",
      {
        status:
          response.status,
        statusText:
          response.statusText,
        body:
          raw.slice(
            0,
            500
          ),
      }
    );

    return null;
  }
}

function getRoleBadgeClass(
  role: string
): string {
  switch (role) {
    case "ADMIN":
      return "border-violet-500/25 bg-violet-500/10 text-violet-300";
    case "OPERATOR":
      return "border-cyan-500/25 bg-cyan-500/10 text-cyan-300";
    case "SUPPORT":
      return "border-blue-500/25 bg-blue-500/10 text-blue-300";
    case "MERCHANT":
      return "border-indigo-500/25 bg-indigo-500/10 text-indigo-300";
    case "SHIPPER":
      return "border-amber-500/25 bg-amber-500/10 text-amber-300";
    case "CUSTOMER":
      return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
    default:
      return "border-slate-600 bg-slate-800 text-slate-300";
  }
}

/* ============================================================
   PAGE
============================================================ */

export default function UsersPage() {
  const [
    users,
    setUsers,
  ] =
    useState<UserRecord[]>(
      []
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    selectedRole,
    setSelectedRole,
  ] =
    useState<RoleKey>(
      "ALL"
    );

  const [
    selectedUser,
    setSelectedUser,
  ] =
    useState<UserRecord | null>(
      null
    );

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    editingCommission,
    setEditingCommission,
  ] =
    useState<CommissionEditState>(
      null
    );

  const [
    savingCommissionId,
    setSavingCommissionId,
  ] =
    useState<string | null>(
      null
    );

  const [
    passwordResetRequests,
    setPasswordResetRequests,
  ] =
    useState<
      PasswordResetRequest[]
    >([]);

  const [
    loadingPasswordRequests,
    setLoadingPasswordRequests,
  ] =
    useState(false);

  const [
    processingPasswordRequestId,
    setProcessingPasswordRequestId,
  ] =
    useState<string | null>(
      null
    );

  const [
    temporaryPasswordState,
    setTemporaryPasswordState,
  ] =
    useState<TemporaryPasswordState>(
      null
    );

  const [
    passwordCopied,
    setPasswordCopied,
  ] =
    useState(false);

  /* ==========================================================
     FETCH USERS
  ========================================================== */

  const fetchUsers =
    useCallback(
      async () => {
        setLoading(true);

        try {
          const response =
            await fetch(
              `/api/users?role=${encodeURIComponent(
                selectedRole
              )}`,
              {
                cache:
                  "no-store",
              }
            );

          const data =
            await readApiJson(
              response
            );

          if (
            !response.ok ||
            !data?.success
          ) {
            throw new Error(
              data?.message ||
                `Không thể tải danh sách người dùng (HTTP ${response.status}).`
            );
          }

          const nextUsers:
            UserRecord[] =
            Array.isArray(
              data.data
            )
              ? data.data
              : [];

          if (
            process.env
              .NODE_ENV ===
            "development"
          ) {
            const seen =
              new Set<string>();

            const duplicates:
              string[] = [];

            nextUsers.forEach(
              (
                user
              ) => {
                const uid =
                  getUserId(
                    user
                  );

                if (!uid) {
                  return;
                }

                const key =
                  `${getRole(
                    user
                  )}:${uid}`;

                if (
                  seen.has(
                    key
                  )
                ) {
                  duplicates.push(
                    key
                  );
                } else {
                  seen.add(
                    key
                  );
                }
              }
            );

            if (
              duplicates.length >
              0
            ) {
              console.warn(
                "⚠️ /api/users đang trả dữ liệu trùng:",
                Array.from(
                  new Set(
                    duplicates
                  )
                )
              );
            }
          }

          setUsers(
            nextUsers
          );
        } catch (
          error
        ) {
          console.error(
            "❌ Lỗi tải danh sách người dùng:",
            error
          );

          setUsers([]);
        } finally {
          setLoading(
            false
          );
        }
      },
      [selectedRole]
    );

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  /* ==========================================================
     USER STATUS
  ========================================================== */

  const handleUpdateStatus =
    useCallback(
      async (
        userId: string,
        newStatus: string,
        role: string
      ) => {
        try {
          const response =
            await fetch(
              "/api/users",
              {
                method:
                  "PATCH",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body:
                  JSON.stringify(
                    {
                      userId,
                      status:
                        newStatus,
                      role,
                    }
                  ),
              }
            );

          const data =
            await readApiJson(
              response
            );

          if (
            !response.ok ||
            !data?.success
          ) {
            throw new Error(
              data?.message ||
                "Không thể cập nhật trạng thái."
            );
          }

          setSelectedUser(
            null
          );

          await fetchUsers();
        } catch (
          error: any
        ) {
          console.error(
            "❌ Lỗi cập nhật trạng thái:",
            error
          );

          alert(
            error?.message ||
              "Lỗi kết nối máy chủ."
          );
        }
      },
      [fetchUsers]
    );

  /* ==========================================================
     MERCHANT COMMISSION
  ========================================================== */

  const startEditCommission =
    (
      user: UserRecord
    ) => {
      const userId =
        getUserId(
          user
        );

      if (!userId) {
        alert(
          "Không xác định được ID Merchant."
        );
        return;
      }

      setEditingCommission(
        {
          userId,
          value:
            getCommissionPercent(
              user
            ).toString(),
        }
      );
    };

  const cancelEditCommission =
    () => {
      if (
        savingCommissionId
      ) {
        return;
      }

      setEditingCommission(
        null
      );
    };

  const saveCommission =
    async (
      user: UserRecord
    ) => {
      const userId =
        getUserId(
          user
        );

      if (!userId) {
        alert(
          "Không xác định được Merchant."
        );
        return;
      }

      if (
        !editingCommission ||
        editingCommission.userId !==
          userId
      ) {
        return;
      }

      const rawValue =
        editingCommission.value
          .replace(
            ",",
            "."
          )
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
          commission.toFixed(
            2
          )
        );

      try {
        setSavingCommissionId(
          userId
        );

        const response =
          await fetch(
            "/api/users",
            {
              method:
                "PATCH",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body:
                JSON.stringify(
                  {
                    userId,
                    role:
                      user?.role ||
                      "MERCHANT",
                    commissionPercent:
                      normalizedCommission,
                    updateType:
                      "MERCHANT_COMMISSION",
                  }
                ),
            }
          );

        const data =
          await readApiJson(
            response
          );

        if (
          !response.ok ||
          !data?.success
        ) {
          throw new Error(
            data?.message ||
              "Không thể cập nhật chiết khấu."
          );
        }

        setEditingCommission(
          null
        );

        await fetchUsers();

        if (
          selectedUser &&
          getUserId(
            selectedUser
          ) === userId
        ) {
          setSelectedUser(
            {
              ...selectedUser,
              commissionPercent:
                normalizedCommission,
            }
          );
        }
      } catch (
        error: any
      ) {
        console.error(
          "❌ Lỗi cập nhật chiết khấu:",
          error
        );

        alert(
          error?.message ||
            "Không thể cập nhật chiết khấu Merchant."
        );
      } finally {
        setSavingCommissionId(
          null
        );
      }
    };

  /* ==========================================================
     PASSWORD RESET REQUESTS
  ========================================================== */

  const getAdminIdToken =
    useCallback(
      async (): Promise<string> => {
        const currentUser =
          auth.currentUser;

        if (
          !currentUser
        ) {
          throw new Error(
            "Phiên đăng nhập Admin không còn hợp lệ."
          );
        }

        return currentUser.getIdToken();
      },
      []
    );

  const fetchPasswordResetRequests =
    useCallback(
      async () => {
        const currentUser =
          auth.currentUser;

        if (
          !currentUser
        ) {
          setPasswordResetRequests(
            []
          );
          setLoadingPasswordRequests(
            false
          );
          return;
        }

        setLoadingPasswordRequests(
          true
        );

        try {
          const token =
            await currentUser.getIdToken();

          const response =
            await fetch(
              "/api/users/reset-password",
              {
                method:
                  "GET",
                cache:
                  "no-store",
                headers: {
                  Authorization:
                    `Bearer ${token}`,
                },
              }
            );

          const data =
            await readApiJson(
              response
            );

          if (
            !response.ok ||
            !data?.success
          ) {
            throw new Error(
              data?.message ||
                `Không thể tải yêu cầu cấp lại mật khẩu (HTTP ${response.status}).`
            );
          }

          setPasswordResetRequests(
            Array.isArray(
              data.data
            )
              ? data.data
              : []
          );
        } catch (
          error
        ) {
          console.error(
            "❌ Lỗi tải yêu cầu cấp lại mật khẩu:",
            error
          );

          setPasswordResetRequests(
            []
          );
        } finally {
          setLoadingPasswordRequests(
            false
          );
        }
      },
      []
    );

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        (
          currentUser
        ) => {
          if (
            currentUser
          ) {
            void fetchPasswordResetRequests();
          } else {
            setPasswordResetRequests(
              []
            );

            setLoadingPasswordRequests(
              false
            );
          }
        }
      );

    return () =>
      unsubscribe();
  }, [
    fetchPasswordResetRequests,
  ]);

  const pendingPasswordResetRequests =
    useMemo(
      () =>
        passwordResetRequests.filter(
          (
            item
          ) => {
            const status =
              String(
                item.status ||
                  ""
              )
                .trim()
                .toUpperCase();

            return (
              status ===
                "PENDING" ||
              status ===
                "PROCESSING"
            );
          }
        ),
      [
        passwordResetRequests,
      ]
    );

  const handleResolvePasswordReset =
    async (
      requestItem:
        PasswordResetRequest
    ) => {
      if (
        processingPasswordRequestId
      ) {
        return;
      }

      const confirmed =
        window.confirm(
          `Tạo mật khẩu tạm cho ${
            requestItem.customerName ||
            "khách hàng"
          } (${requestItem.phone})?\n\n` +
            "Mật khẩu hiện tại sẽ không còn sử dụng được. " +
            "Các phiên đăng nhập cũ cũng sẽ bị thu hồi."
        );

      if (!confirmed) {
        return;
      }

      try {
        setProcessingPasswordRequestId(
          requestItem.id
        );

        const token =
          await getAdminIdToken();

        const response =
          await fetch(
            "/api/users/reset-password",
            {
              method:
                "POST",
              headers: {
                "Content-Type":
                  "application/json",
                Authorization:
                  `Bearer ${token}`,
              },
              body:
                JSON.stringify(
                  {
                    requestId:
                      requestItem.id,
                    action:
                      "RESET",
                  }
                ),
            }
          );

        const data =
          await readApiJson(
            response
          );

        if (
          !response.ok ||
          !data?.success ||
          !data?.temporaryPassword
        ) {
          throw new Error(
            data?.message ||
              "Không thể tạo mật khẩu tạm."
          );
        }

        setPasswordCopied(
          false
        );

        setTemporaryPasswordState(
          {
            requestId:
              requestItem.id,
            userId:
              String(
                data?.resolvedUserId ||
                  requestItem.userId ||
                  ""
              ),
            customerName:
              requestItem.customerName ||
              "Khách hàng",
            phone:
              requestItem.phone,
            temporaryPassword:
              data.temporaryPassword,
          }
        );

        await Promise.all([
          fetchPasswordResetRequests(),
          fetchUsers(),
        ]);
      } catch (
        error: any
      ) {
        console.error(
          "❌ Lỗi reset password:",
          error
        );

        alert(
          error?.message ||
            "Không thể đặt lại mật khẩu."
        );
      } finally {
        setProcessingPasswordRequestId(
          null
        );
      }
    };

  const handleRejectPasswordReset =
    async (
      requestItem:
        PasswordResetRequest
    ) => {
      if (
        processingPasswordRequestId
      ) {
        return;
      }

      const confirmed =
        window.confirm(
          `Từ chối yêu cầu cấp lại mật khẩu của ${
            requestItem.customerName ||
            "khách hàng"
          } (${requestItem.phone})?`
        );

      if (!confirmed) {
        return;
      }

      try {
        setProcessingPasswordRequestId(
          requestItem.id
        );

        const token =
          await getAdminIdToken();

        const response =
          await fetch(
            "/api/users/reset-password",
            {
              method:
                "POST",
              headers: {
                "Content-Type":
                  "application/json",
                Authorization:
                  `Bearer ${token}`,
              },
              body:
                JSON.stringify(
                  {
                    requestId:
                      requestItem.id,
                    action:
                      "REJECT",
                  }
                ),
            }
          );

        const data =
          await readApiJson(
            response
          );

        if (
          !response.ok ||
          !data?.success
        ) {
          throw new Error(
            data?.message ||
              "Không thể từ chối yêu cầu."
          );
        }

        await fetchPasswordResetRequests();
      } catch (
        error: any
      ) {
        console.error(
          "❌ Lỗi từ chối yêu cầu:",
          error
        );

        alert(
          error?.message ||
            "Không thể từ chối yêu cầu."
        );
      } finally {
        setProcessingPasswordRequestId(
          null
        );
      }
    };

  const copyTemporaryPassword =
    async () => {
      if (
        !temporaryPasswordState
      ) {
        return;
      }

      try {
        await navigator.clipboard.writeText(
          temporaryPasswordState
            .temporaryPassword
        );

        setPasswordCopied(
          true
        );

        window.setTimeout(
          () =>
            setPasswordCopied(
              false
            ),
          2000
        );
      } catch {
        alert(
          "Không thể sao chép tự động. Vui lòng sao chép thủ công."
        );
      }
    };

  /* ==========================================================
     DEDUPLICATE USERS
  ========================================================== */

  const {
    uniqueUsers,
    duplicateCount,
  } =
    useMemo(() => {
      const map =
        new Map<
          string,
          UserRecord
        >();

      let duplicates = 0;

      users.forEach(
        (
          user,
          index
        ) => {
          const uid =
            getUserId(
              user
            );

          const role =
            getRole(
              user
            );

          const phone =
            getPhone(
              user
            )
              .replace(
                /\s+/g,
                ""
              )
              .trim();

          const merchantCode =
            String(
              user?.merchantCode ||
                ""
            )
              .trim()
              .toUpperCase();

          const identityKey =
            uid
              ? `${role}:uid:${uid}`
              : merchantCode
              ? `${role}:merchant:${merchantCode}`
              : phone &&
                phone !==
                  "N/A"
              ? `${role}:phone:${phone}`
              : `${role}:fallback:${index}`;

          const existing =
            map.get(
              identityKey
            );

          if (
            !existing
          ) {
            map.set(
              identityKey,
              user
            );
            return;
          }

          duplicates += 1;

          map.set(
            identityKey,
            {
              ...existing,
              ...user,

              uid:
                user?.uid ||
                existing?.uid,

              id:
                user?.id ||
                existing?.id,

              phone:
                user?.phone ||
                existing?.phone,

              phoneNumber:
                user?.phoneNumber ||
                existing?.phoneNumber,

              merchantCode:
                user?.merchantCode ||
                existing?.merchantCode,
            }
          );
        }
      );

      return {
        uniqueUsers:
          Array.from(
            map.values()
          ),
        duplicateCount:
          duplicates,
      };
    }, [users]);

  /* ==========================================================
     SEARCH + KPI
  ========================================================== */

  const filteredUsers =
    useMemo(() => {
      const keyword =
        search
          .toLowerCase()
          .trim();

      if (!keyword) {
        return uniqueUsers;
      }

      return uniqueUsers.filter(
        (
          user
        ) => {
          const haystack =
            [
              user?.fullName,
              user?.ownerName,
              user?.shopName,
              user?.phone,
              user?.phoneNumber,
              user?.identityCardNumber,
              user?.idCardNumber,
              user?.merchantCode,
              user?.uid,
              user?.id,
            ]
              .map(
                (
                  value
                ) =>
                  String(
                    value ||
                      ""
                  ).toLowerCase()
              )
              .join(" ");

          return haystack.includes(
            keyword
          );
        }
      );
    }, [
      uniqueUsers,
      search,
    ]);

  const totalUsers =
    uniqueUsers.length;

  const pendingCount =
    uniqueUsers.filter(
      (
        user
      ) => {
        const status =
          getStatus(
            user
          );

        return (
          status ===
            "PENDING" ||
          status ===
            "PENDING_APPROVAL"
        );
      }
    ).length;

  const activeCount =
    uniqueUsers.filter(
      (
        user
      ) => {
        const status =
          getStatus(
            user
          );

        return (
          status ===
            "APPROVED" ||
          status ===
            "ACTIVE"
        );
      }
    ).length;

  const blockedCount =
    uniqueUsers.filter(
      (
        user
      ) => {
        const status =
          getStatus(
            user
          );

        return (
          status ===
            "BLOCKED" ||
          status ===
            "REJECTED"
        );
      }
    ).length;

  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <main className="min-h-screen bg-[#0b1120] text-slate-100">
      <div className="mx-auto w-full max-w-[1680px] space-y-5 p-4 sm:p-5 lg:p-7">
        {/* HEADER */}
        <section className="overflow-hidden rounded-[24px] border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-[#111827] shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
          <div className="flex flex-col gap-5 p-5 md:flex-row md:items-center md:justify-between lg:p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-orange-500/20 bg-orange-500/10 text-orange-300 shadow-inner">
                <UsersIcon className="h-6 w-6" />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl">
                    Người dùng & phân quyền
                  </h1>

                  <span className="rounded-full border border-slate-700 bg-slate-800/70 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
                    Anvami Admin
                  </span>
                </div>

                <p className="mt-1.5 max-w-2xl text-[11px] leading-relaxed text-slate-400 sm:text-xs">
                  Quản lý khách hàng, Merchant, Shipper, phân quyền tài khoản,
                  chiết khấu gian hàng và yêu cầu cấp lại mật khẩu.
                </p>

                {duplicateCount > 0 && (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[10px] font-semibold text-amber-200">
                    <ShieldIcon className="h-4 w-4" />
                    Đã tự gộp {duplicateCount} bản ghi trùng từ API để tránh lỗi React key.
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void Promise.all([
                    fetchUsers(),
                    fetchPasswordResetRequests(),
                  ]);
                }}
                disabled={
                  loading ||
                  loadingPasswordRequests
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-[11px] font-bold text-slate-200 transition hover:border-slate-600 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshIcon
                  className={`h-4 w-4 ${
                    loading ||
                    loadingPasswordRequests
                      ? "animate-spin"
                      : ""
                  }`}
                />
                Làm mới dữ liệu
              </button>
            </div>
          </div>
        </section>

        {/* KPI */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <KpiCard
            label="Tổng người dùng"
            value={totalUsers}
            tone="slate"
            icon={
              <UsersIcon className="h-5 w-5" />
            }
          />

          <KpiCard
            label="Chờ duyệt"
            value={pendingCount}
            tone="amber"
            icon={
              <span className="text-base">
                ⏳
              </span>
            }
          />

          <KpiCard
            label="Hoạt động"
            value={activeCount}
            tone="emerald"
            icon={
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.75)]" />
            }
          />

          <KpiCard
            label="Đã khóa / từ chối"
            value={blockedCount}
            tone="rose"
            icon={
              <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
            }
          />

          <KpiCard
            label="Yêu cầu mật khẩu"
            value={
              pendingPasswordResetRequests.length
            }
            tone="orange"
            icon={
              <LockIcon className="h-5 w-5" />
            }
          />
        </section>

        {/* PASSWORD RESET REQUESTS */}
        <section className="overflow-hidden rounded-[22px] border border-slate-800 bg-slate-900/85 shadow-xl">
          <div className="flex flex-col gap-3 border-b border-slate-800 p-4 sm:flex-row sm:items-center sm:justify-between lg:p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-orange-500/20 bg-orange-500/10 text-orange-300">
                <LockIcon className="h-5 w-5" />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-black text-white sm:text-base">
                    Yêu cầu cấp lại mật khẩu
                  </h2>

                  <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-2 py-0.5 text-[9px] font-black text-orange-300">
                    {pendingPasswordResetRequests.length} đang chờ
                  </span>
                </div>

                <p className="mt-1 text-[10px] leading-relaxed text-slate-500 sm:text-[11px]">
                  Yêu cầu từ khách hàng sẽ được xác minh trước khi hệ thống tạo mật khẩu tạm.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                void fetchPasswordResetRequests();
              }}
              disabled={
                loadingPasswordRequests
              }
              className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-[10px] font-bold text-slate-300 transition hover:bg-slate-700 disabled:opacity-50 sm:self-auto"
            >
              <RefreshIcon
                className={`h-3.5 w-3.5 ${
                  loadingPasswordRequests
                    ? "animate-spin"
                    : ""
                }`}
              />
              Làm mới yêu cầu
            </button>
          </div>

          {loadingPasswordRequests ? (
            <div className="flex min-h-[150px] items-center justify-center p-6">
              <div className="flex items-center gap-3 text-xs font-semibold text-slate-400">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-700 border-t-orange-400" />
                Đang tải yêu cầu hỗ trợ...
              </div>
            </div>
          ) : pendingPasswordResetRequests.length === 0 ? (
            <div className="flex min-h-[150px] flex-col items-center justify-center p-6 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                <CheckIcon className="h-5 w-5" />
              </div>

              <p className="mt-3 text-xs font-black text-slate-200">
                Không có yêu cầu nào đang chờ
              </p>

              <p className="mt-1 text-[10px] text-slate-500">
                Các yêu cầu mới sẽ xuất hiện tại đây.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/50 text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">
                    <th className="px-4 py-3">
                      Khách hàng
                    </th>
                    <th className="px-4 py-3">
                      Số điện thoại
                    </th>
                    <th className="px-4 py-3">
                      Thời gian
                    </th>
                    <th className="px-4 py-3 text-center">
                      Số lần
                    </th>
                    <th className="px-4 py-3">
                      Trạng thái
                    </th>
                    <th className="px-4 py-3 text-right">
                      Xử lý
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-800/80">
                  {pendingPasswordResetRequests.map(
                    (
                      requestItem
                    ) => {
                      const isProcessing =
                        processingPasswordRequestId ===
                        requestItem.id;

                      return (
                        <tr
                          key={
                            requestItem.id
                          }
                          className="transition hover:bg-slate-800/35"
                        >
                          <td className="px-4 py-3.5">
                            <p className="text-xs font-black text-slate-100">
                              {requestItem.customerName ||
                                "Khách hàng"}
                            </p>

                            <p className="mt-0.5 max-w-[250px] truncate font-mono text-[9px] text-slate-600">
                              {requestItem.userId ||
                                "—"}
                            </p>
                          </td>

                          <td className="px-4 py-3.5">
                            <span className="text-xs font-black text-slate-200">
                              {requestItem.phone}
                            </span>
                          </td>

                          <td className="px-4 py-3.5 text-[10px] text-slate-400">
                            {formatRequestTime(
                              requestItem.lastRequestedAt ||
                                requestItem.requestedAt
                            )}
                          </td>

                          <td className="px-4 py-3.5 text-center">
                            <span className="inline-flex min-w-8 justify-center rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-[10px] font-black text-slate-300">
                              {requestItem.requestCount ||
                                1}
                            </span>
                          </td>

                          <td className="px-4 py-3.5">
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[9px] font-black text-amber-300">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                              Chờ xử lý
                            </span>
                          </td>

                          <td className="px-4 py-3.5">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                disabled={
                                  isProcessing
                                }
                                onClick={() => {
                                  void handleRejectPasswordReset(
                                    requestItem
                                  );
                                }}
                                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-[9px] font-bold text-slate-300 transition hover:border-slate-600 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Từ chối
                              </button>

                              <button
                                type="button"
                                disabled={
                                  isProcessing
                                }
                                onClick={() => {
                                  void handleResolvePasswordReset(
                                    requestItem
                                  );
                                }}
                                className="rounded-lg border border-orange-500/30 bg-orange-600 px-3 py-1.5 text-[9px] font-black text-white shadow-sm transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {isProcessing
                                  ? "Đang xử lý..."
                                  : "Tạo mật khẩu tạm"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* FILTERS */}
        <section className="rounded-[22px] border border-slate-800 bg-slate-900/85 p-3.5 shadow-lg">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none xl:pb-0">
              {ROLES.map(
                (
                  role
                ) => {
                  const active =
                    selectedRole ===
                    role.key;

                  return (
                    <button
                      key={
                        role.key
                      }
                      type="button"
                      onClick={() =>
                        setSelectedRole(
                          role.key
                        )
                      }
                      className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-[10px] font-black transition ${
                        active
                          ? "bg-white text-slate-950 shadow-md"
                          : "border border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                      }`}
                    >
                      {role.label}
                    </button>
                  );
                }
              )}
            </div>

            <div className="relative w-full xl:w-[360px]">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

              <input
                type="search"
                value={search}
                onChange={(
                  event
                ) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Tìm tên, SĐT, CCCD, mã Merchant, UID..."
                className="w-full rounded-xl border border-slate-800 bg-slate-950/70 py-2.5 pl-9 pr-3 text-[11px] font-medium text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-orange-500/40 focus:ring-2 focus:ring-orange-500/10"
              />
            </div>
          </div>
        </section>

        {/* USERS TABLE */}
        <section className="overflow-hidden rounded-[22px] border border-slate-800 bg-slate-900/70 shadow-xl">
          <div className="flex flex-col gap-2 border-b border-slate-800 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xs font-black text-white">
                Danh sách người dùng
              </h2>

              <p className="mt-0.5 text-[9px] text-slate-500">
                Hiển thị {filteredUsers.length} / {totalUsers} tài khoản sau khi loại dữ liệu trùng.
              </p>
            </div>

            <span className="self-start rounded-full border border-slate-800 bg-slate-950 px-2.5 py-1 text-[9px] font-bold text-slate-500 sm:self-auto">
              Bộ lọc: {ROLES.find(
                (
                  item
                ) =>
                  item.key ===
                  selectedRole
              )?.label || "Tất cả"}
            </span>
          </div>

          {loading ? (
            <div className="flex min-h-[250px] items-center justify-center">
              <div className="flex items-center gap-3 text-xs font-semibold text-slate-400">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-700 border-t-white" />
                Đang tải dữ liệu hệ thống...
              </div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex min-h-[250px] flex-col items-center justify-center px-6 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-800 bg-slate-950 text-slate-500">
                <SearchIcon className="h-5 w-5" />
              </div>

              <p className="mt-3 text-xs font-black text-slate-300">
                Không tìm thấy tài khoản phù hợp
              </p>

              <p className="mt-1 text-[10px] text-slate-600">
                Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc vai trò.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/55 text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">
                    <th className="px-4 py-3">
                      Người dùng / cửa hàng
                    </th>

                    <th className="px-4 py-3">
                      Liên hệ / giấy tờ
                    </th>

                    <th className="px-4 py-3">
                      Vai trò
                    </th>

                    <th className="px-4 py-3">
                      Chiết khấu sàn
                    </th>

                    <th className="px-4 py-3">
                      Trạng thái
                    </th>

                    <th className="px-4 py-3 text-right">
                      Thao tác
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-800/70">
                  {filteredUsers.map(
                    (
                      user,
                      index
                    ) => {
                      const userId =
                        getUserId(
                          user,
                          `user-${index}`
                        );

                      const name =
                        getDisplayName(
                          user
                        );

                      const phone =
                        getPhone(
                          user
                        );

                      const idCard =
                        String(
                          user?.identityCardNumber ||
                            user?.idCardNumber ||
                            "N/A"
                        );

                      const avatar =
                        getAvatar(
                          user
                        );

                      const status =
                        getStatus(
                          user
                        );

                      const role =
                        getRole(
                          user
                        );

                      const merchant =
                        isMerchant(
                          user
                        );

                      const commission =
                        getCommissionPercent(
                          user
                        );

                      const isEditing =
                        editingCommission?.userId ===
                        userId;

                      const isSaving =
                        savingCommissionId ===
                        userId;

                      const isPendingStatus =
                        status ===
                          "PENDING" ||
                        status ===
                          "PENDING_APPROVAL";

                      const isBlockedStatus =
                        status ===
                          "BLOCKED" ||
                        status ===
                          "REJECTED";

                      return (
                        <tr
                          key={`${role}:${userId}`}
                          className="group transition hover:bg-slate-800/30"
                        >
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-3">
                              {avatar ? (
                                <img
                                  src={
                                    avatar
                                  }
                                  alt={
                                    name
                                  }
                                  className="h-9 w-9 shrink-0 rounded-xl border border-slate-700 object-cover"
                                />
                              ) : (
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-xs font-black text-slate-300">
                                  {name
                                    .charAt(
                                      0
                                    )
                                    .toUpperCase()}
                                </div>
                              )}

                              <div className="min-w-0">
                                <p className="max-w-[250px] truncate text-xs font-black text-slate-100">
                                  {name}
                                </p>

                                {merchant &&
                                  user?.shopName && (
                                    <p className="mt-0.5 max-w-[250px] truncate text-[9px] font-semibold text-indigo-300">
                                      {user.shopName}
                                    </p>
                                  )}

                                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                  {merchant &&
                                    user?.merchantCode && (
                                      <span className="rounded-md border border-slate-800 bg-slate-950 px-1.5 py-0.5 font-mono text-[8px] text-slate-500">
                                        {user.merchantCode}
                                      </span>
                                    )}

                                  <span className="max-w-[180px] truncate font-mono text-[8px] text-slate-600">
                                    {userId}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3.5">
                            <p className="text-[11px] font-bold text-slate-200">
                              {phone}
                            </p>

                            <p className="mt-1 text-[9px] text-slate-500">
                              CCCD:{" "}
                              <span className="font-mono">
                                {idCard}
                              </span>
                            </p>
                          </td>

                          <td className="px-4 py-3.5">
                            <span
                              className={`inline-flex rounded-lg border px-2.5 py-1 text-[9px] font-black tracking-wide ${getRoleBadgeClass(
                                role
                              )}`}
                            >
                              {role}
                            </span>
                          </td>

                          <td className="px-4 py-3.5">
                            {merchant ? (
                              <div className="flex items-center gap-2">
                                {isEditing ? (
                                  <>
                                    <div className="relative w-[92px]">
                                      <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        step={0.1}
                                        autoFocus
                                        disabled={
                                          isSaving
                                        }
                                        value={
                                          editingCommission?.value ??
                                          ""
                                        }
                                        onChange={(
                                          event
                                        ) =>
                                          setEditingCommission(
                                            {
                                              userId,
                                              value:
                                                event.target.value,
                                            }
                                          )
                                        }
                                        className="w-full rounded-lg border border-orange-500/40 bg-slate-950 py-1.5 pl-2.5 pr-7 text-[10px] font-bold text-white outline-none focus:ring-2 focus:ring-orange-500/10"
                                      />

                                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-600">
                                        %
                                      </span>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        void saveCommission(
                                          user
                                        );
                                      }}
                                      disabled={
                                        isSaving
                                      }
                                      className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[9px] font-black text-white transition hover:bg-emerald-500 disabled:opacity-50"
                                    >
                                      {isSaving
                                        ? "..."
                                        : "Lưu"}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={
                                        cancelEditCommission
                                      }
                                      disabled={
                                        isSaving
                                      }
                                      className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-[9px] font-bold text-slate-400 transition hover:bg-slate-700 disabled:opacity-50"
                                    >
                                      Hủy
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <span className="inline-flex min-w-[58px] justify-center rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-1 text-[10px] font-black text-indigo-300">
                                      {commission}%
                                    </span>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        startEditCommission(
                                          user
                                        )
                                      }
                                      className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-[9px] font-bold text-slate-400 transition hover:border-indigo-500/30 hover:text-indigo-300"
                                    >
                                      <PencilIcon />
                                      Sửa
                                    </button>
                                  </>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-700">
                                —
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3.5">
                            {isPendingStatus ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[9px] font-black text-amber-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                                Chờ duyệt
                              </span>
                            ) : isBlockedStatus ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-[9px] font-black text-rose-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                                {status ===
                                "REJECTED"
                                  ? "Đã từ chối"
                                  : "Đã khóa"}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[9px] font-black text-emerald-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                Hoạt động
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3.5 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedUser(
                                  user
                                )
                              }
                              className="rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-[9px] font-black text-slate-200 transition hover:border-slate-600 hover:bg-slate-700"
                            >
                              Quản lý
                            </button>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* TEMP PASSWORD MODAL */}
      {temporaryPasswordState && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-[28px] border border-slate-800 bg-slate-900 shadow-[0_30px_100px_rgba(0,0,0,0.55)]">
            <div className="border-b border-slate-800 bg-gradient-to-br from-orange-500/10 via-slate-900 to-slate-900 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-orange-500/20 bg-orange-500/10 text-orange-300">
                    <LockIcon className="h-5 w-5" />
                  </div>

                  <h3 className="mt-3 text-lg font-black text-white">
                    Mật khẩu tạm đã được tạo
                  </h3>

                  <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
                    Mật khẩu chỉ hiển thị trong lần xử lý này. Sao chép và gửi trực tiếp cho khách hàng.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setTemporaryPasswordState(
                      null
                    );
                    setPasswordCopied(
                      false
                    );
                  }}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-slate-500 transition hover:text-white"
                  aria-label="Đóng"
                >
                  <CloseIcon />
                </button>
              </div>
            </div>

            <div className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-3">
                <InfoBox
                  label="Khách hàng"
                  value={
                    temporaryPasswordState.customerName
                  }
                />

                <InfoBox
                  label="Số điện thoại"
                  value={
                    temporaryPasswordState.phone
                  }
                />
              </div>

              <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 p-4">
                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-orange-300">
                  Mật khẩu tạm
                </p>

                <div className="mt-2 flex items-stretch gap-2">
                  <code className="min-w-0 flex-1 break-all rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-center text-base font-black tracking-[0.16em] text-white">
                    {temporaryPasswordState.temporaryPassword}
                  </code>

                  <button
                    type="button"
                    onClick={() => {
                      void copyTemporaryPassword();
                    }}
                    className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-orange-600 px-3 text-[9px] font-black text-white transition hover:bg-orange-500"
                  >
                    {passwordCopied ? (
                      <>
                        <CheckIcon />
                        Đã chép
                      </>
                    ) : (
                      <>
                        <CopyIcon />
                        Sao chép
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-amber-500/15 bg-amber-500/10 p-3.5 text-[9px] leading-relaxed text-amber-200/90">
                Khách hàng phải đổi mật khẩu sau khi đăng nhập bằng mật khẩu tạm. Không lưu mật khẩu này trong ghi chú, Firestore hoặc trường dữ liệu khác.
              </div>

              <button
                type="button"
                onClick={() => {
                  setTemporaryPasswordState(
                    null
                  );
                  setPasswordCopied(
                    false
                  );
                }}
                className="w-full rounded-xl bg-white py-3 text-[10px] font-black text-slate-950 transition hover:bg-slate-100"
              >
                Hoàn tất
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {selectedUser && (
        <UserDetailModal
          user={selectedUser}
          onClose={() =>
            setSelectedUser(
              null
            )
          }
          onUpdateStatus={
            handleUpdateStatus
          }
          onRefresh={
            fetchUsers
          }
        />
      )}
    </main>
  );
}

/* ============================================================
   PRESENTATIONAL COMPONENTS
============================================================ */

function KpiCard({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number;
  tone:
    | "slate"
    | "amber"
    | "emerald"
    | "rose"
    | "orange";
  icon: React.ReactNode;
}) {
  const styles = {
    slate: {
      box:
        "border-slate-800 bg-slate-900/80",
      icon:
        "border-slate-700 bg-slate-800 text-slate-300",
      label:
        "text-slate-500",
      value:
        "text-white",
    },

    amber: {
      box:
        "border-amber-500/15 bg-amber-500/[0.06]",
      icon:
        "border-amber-500/20 bg-amber-500/10 text-amber-300",
      label:
        "text-amber-400/80",
      value:
        "text-amber-200",
    },

    emerald: {
      box:
        "border-emerald-500/15 bg-emerald-500/[0.06]",
      icon:
        "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
      label:
        "text-emerald-400/80",
      value:
        "text-emerald-200",
    },

    rose: {
      box:
        "border-rose-500/15 bg-rose-500/[0.06]",
      icon:
        "border-rose-500/20 bg-rose-500/10 text-rose-300",
      label:
        "text-rose-400/80",
      value:
        "text-rose-200",
    },

    orange: {
      box:
        "border-orange-500/15 bg-orange-500/[0.06]",
      icon:
        "border-orange-500/20 bg-orange-500/10 text-orange-300",
      label:
        "text-orange-400/80",
      value:
        "text-orange-200",
    },
  }[tone];

  return (
    <div
      className={`rounded-[20px] border p-4 shadow-sm ${styles.box}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className={`text-[9px] font-black uppercase tracking-[0.12em] ${styles.label}`}
          >
            {label}
          </p>

          <p
            className={`mt-2 text-2xl font-black tracking-tight ${styles.value}`}
          >
            {value}
          </p>
        </div>

        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${styles.icon}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function InfoBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
      <p className="text-[8px] font-black uppercase tracking-[0.12em] text-slate-600">
        {label}
      </p>

      <p className="mt-1 break-words text-[10px] font-black text-slate-200">
        {value}
      </p>
    </div>
  );
}
