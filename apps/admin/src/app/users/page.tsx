"use client";

import { useEffect, useMemo, useState } from "react";
import { UserDetailModal } from "@/components/UserDetailModal";

const ROLES = [
  { key: "ALL", label: "Tất Cả" },
  { key: "ADMIN", label: "Admin" },
  { key: "OPERATOR", label: "Vận Hành" },
  { key: "SUPPORT", label: "CSKH" },
  { key: "MERCHANT", label: "Gian Hàng" },
  { key: "SHIPPER", label: "Shipper" },
  { key: "CUSTOMER", label: "Khách Hàng" },
];

type CommissionEditState = {
  userId: string;
  value: string;
} | null;

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedRole, setSelectedRole] =
    useState("ALL");

  const [selectedUser, setSelectedUser] =
    useState<any>(null);

  const [search, setSearch] =
    useState("");

  // =========================================================
  // COMMISSION
  // =========================================================

  const [editingCommission, setEditingCommission] =
    useState<CommissionEditState>(null);

  const [savingCommissionId, setSavingCommissionId] =
    useState<string | null>(null);

  // =========================================================
  // FETCH USERS
  // =========================================================

  const fetchUsers = async () => {
    setLoading(true);

    try {
      const res = await fetch(
        `/api/users?role=${selectedRole}`,
        {
          cache: "no-store",
        }
      );

      const data = await res.json();

      if (!data.success) {
        console.error(
          "API Users trả về lỗi:",
          data.message
        );

        setUsers([]);
        return;
      }

      setUsers(
        Array.isArray(data.data)
          ? data.data
          : []
      );
    } catch (error) {
      console.error(
        "❌ Lỗi tải danh sách người dùng:",
        error
      );

      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [selectedRole]);

  // =========================================================
  // UPDATE STATUS
  // =========================================================

  const handleUpdateStatus = async (
    userId: string,
    newStatus: string,
    role: string
  ) => {
    try {
      const res = await fetch(
        "/api/users",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            userId,
            status: newStatus,
            role,
          }),
        }
      );

      const data = await res.json();

      if (data.success) {
        setSelectedUser(null);
        await fetchUsers();
      } else {
        alert(
          data.message ||
            "Không thể cập nhật trạng thái"
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
    }
  };

  // =========================================================
  // GET COMMISSION
  // =========================================================

  const getCommissionPercent = (
    user: any
  ): number => {
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
  };

  // =========================================================
  // START EDIT COMMISSION
  // =========================================================

  const startEditCommission = (
    user: any
  ) => {
    const userId =
      user?.uid ||
      user?.id ||
      "";

    if (!userId) {
      alert(
        "Không xác định được ID Merchant."
      );
      return;
    }

    setEditingCommission({
      userId,
      value:
        getCommissionPercent(
          user
        ).toString(),
    });
  };

  // =========================================================
  // CANCEL COMMISSION EDIT
  // =========================================================

  const cancelEditCommission = () => {
    if (
      savingCommissionId
    ) {
      return;
    }

    setEditingCommission(null);
  };

  // =========================================================
  // SAVE COMMISSION
  // =========================================================

  const saveCommission = async (
    user: any
  ) => {
    const userId =
      user?.uid ||
      user?.id ||
      "";

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

    try {
      setSavingCommissionId(
        userId
      );

      const res = await fetch(
        "/api/users",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            userId,
            role:
              user?.role ||
              "MERCHANT",
            commissionPercent:
              normalizedCommission,
            updateType:
              "MERCHANT_COMMISSION",
          }),
        }
      );

      const data = await res.json();

      if (!data.success) {
        throw new Error(
          data.message ||
            "Không thể cập nhật chiết khấu"
        );
      }

      console.log(
        "✅ Cập nhật chiết khấu Merchant:",
        {
          userId,
          merchant:
            user?.shopName ||
            user?.ownerName ||
            user?.fullName ||
            "Merchant",
          commissionPercent:
            normalizedCommission,
        }
      );

      // Đóng chế độ chỉnh sửa
      setEditingCommission(null);

      // Refresh dữ liệu thật từ backend
      await fetchUsers();

      // Nếu modal UserDetailModal đang mở,
      // cập nhật dữ liệu local trong modal.
      if (selectedUser) {
        const selectedUserId =
          selectedUser?.uid ||
          selectedUser?.id ||
          "";

        if (
          selectedUserId ===
          userId
        ) {
          setSelectedUser({
            ...selectedUser,
            commissionPercent:
              normalizedCommission,
          });
        }
      }
    } catch (error: any) {
      console.error(
        "❌ Lỗi cập nhật chiết khấu:",
        error
      );

      alert(
        error?.message ||
          "Không thể cập nhật chiết khấu Merchant."
      );
    } finally {
      setSavingCommissionId(null);
    }
  };

  // =========================================================
  // SEARCH
  // =========================================================

  const filteredUsers = useMemo(() => {
    const keyword =
      search
        .toLowerCase()
        .trim();

    if (!keyword) {
      return users;
    }

    return users.filter(
      (user) => {
        const name = String(
          user?.fullName ||
            user?.ownerName ||
            user?.shopName ||
            ""
        ).toLowerCase();

        const phone = String(
          user?.phone ||
            user?.phoneNumber ||
            ""
        ).toLowerCase();

        const idCard = String(
          user?.identityCardNumber ||
            user?.idCardNumber ||
            ""
        ).toLowerCase();

        const merchantCode =
          String(
            user?.merchantCode ||
              ""
          ).toLowerCase();

        return (
          name.includes(
            keyword
          ) ||
          phone.includes(
            keyword
          ) ||
          idCard.includes(
            keyword
          ) ||
          merchantCode.includes(
            keyword
          )
        );
      }
    );
  }, [
    users,
    search,
  ]);

  // =========================================================
  // KPI
  // =========================================================

  const totalUsers =
    users.length;

  const pendingCount =
    users.filter(
      (user) => {
        const status =
          String(
            user?.status || ""
          ).toUpperCase();

        return (
          status === "PENDING" ||
          status ===
            "PENDING_APPROVAL"
        );
      }
    ).length;

  const activeCount =
    users.filter(
      (user) => {
        const status =
          String(
            user?.status || ""
          ).toUpperCase();

        return (
          status === "APPROVED" ||
          status === "ACTIVE"
        );
      }
    ).length;

  const blockedCount =
    users.filter(
      (user) => {
        const status =
          String(
            user?.status || ""
          ).toUpperCase();

        return (
          status === "BLOCKED" ||
          status === "REJECTED"
        );
      }
    ).length;

  // =========================================================
  // ROLE
  // =========================================================

  const isMerchant = (
    user: any
  ) => {
    return (
      String(
        user?.role || ""
      ).toUpperCase() ===
      "MERCHANT"
    );
  };

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 md:p-8 space-y-6">
      {/* =====================================================
          HEADER
      ====================================================== */}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-2">
            <span>👥</span>
            Quản Lý Người Dùng & Phân Quyền
          </h1>

          <p className="text-xs md:text-sm text-slate-400 mt-1">
            Theo dõi người dùng, Merchant,
            Shipper và cấu hình chính sách
            theo từng gian hàng.
          </p>
        </div>

        <button
          onClick={
            fetchUsers
          }
          disabled={loading}
          className="self-start md:self-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 text-xs font-semibold rounded-xl transition flex items-center gap-2 cursor-pointer"
        >
          🔄{" "}
          {loading
            ? "Đang tải..."
            : "Làm mới dữ liệu"}
        </button>
      </div>

      {/* =====================================================
          KPI
      ====================================================== */}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800/60 border border-slate-700/60 p-4 rounded-2xl backdrop-blur-md">
          <p className="text-xs font-semibold text-slate-400">
            Tổng Người Dùng
          </p>

          <p className="text-2xl font-black text-white mt-1">
            {totalUsers}
          </p>
        </div>

        <div className="bg-amber-950/30 border border-amber-800/40 p-4 rounded-2xl backdrop-blur-md">
          <p className="text-xs font-semibold text-amber-400">
            ⏳ Chờ Duyệt Hồ Sơ
          </p>

          <p className="text-2xl font-black text-amber-300 mt-1">
            {pendingCount}
          </p>
        </div>

        <div className="bg-emerald-950/30 border border-emerald-800/40 p-4 rounded-2xl backdrop-blur-md">
          <p className="text-xs font-semibold text-emerald-400">
            🟢 Hoạt Động
          </p>

          <p className="text-2xl font-black text-emerald-300 mt-1">
            {activeCount}
          </p>
        </div>

        <div className="bg-rose-950/30 border border-rose-800/40 p-4 rounded-2xl backdrop-blur-md">
          <p className="text-xs font-semibold text-rose-400">
            🔴 Đã Khóa / Từ Chối
          </p>

          <p className="text-2xl font-black text-rose-300 mt-1">
            {blockedCount}
          </p>
        </div>
      </div>

      {/* =====================================================
          FILTER
      ====================================================== */}

      <div className="bg-slate-800/80 border border-slate-700/80 p-3 rounded-2xl shadow-lg flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
          {ROLES.map(
            (role) => (
              <button
                key={
                  role.key
                }
                onClick={() =>
                  setSelectedRole(
                    role.key
                  )
                }
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  selectedRole ===
                  role.key
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                    : "bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                }`}
              >
                {
                  role.label
                }
              </button>
            )
          )}
        </div>

        <div className="relative min-w-[280px]">
          <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 text-xs">
            🔍
          </span>

          <input
            type="text"
            placeholder="Tìm Tên, SĐT, CCCD, mã Merchant..."
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value
              )
            }
            className="w-full bg-slate-900/90 border border-slate-700 focus:border-indigo-500 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 font-medium outline-none transition"
          />
        </div>
      </div>

      {/* =====================================================
          TABLE
      ====================================================== */}

      <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
        {loading ? (
          <div className="p-16 text-center text-slate-400 text-sm font-semibold animate-pulse">
            ⚡ Đang tải dữ liệu hệ thống...
          </div>
        ) : filteredUsers.length ===
          0 ? (
          <div className="p-16 text-center text-slate-400 text-sm font-semibold">
            🚫 Không tìm thấy tài khoản phù hợp
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900/80 text-slate-400 font-bold border-b border-slate-700/80 uppercase tracking-wider text-[11px]">
                  <th className="p-4">
                    Người Dùng / Cửa Hàng
                  </th>

                  <th className="p-4">
                    Liên Hệ / Giấy Tờ
                  </th>

                  <th className="p-4">
                    Vai Trò
                  </th>

                  <th className="p-4">
                    Chiết Khấu Sàn
                  </th>

                  <th className="p-4">
                    Trạng Thái
                  </th>

                  <th className="p-4 text-right">
                    Thao Tác
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-700/40 text-slate-300 font-medium">
                {filteredUsers.map(
                  (
                    user,
                    index
                  ) => {
                    const userId =
                      user?.uid ||
                      user?.id ||
                      `user-${index}`;

                    const name =
                      user?.fullName ||
                      user?.ownerName ||
                      user?.shopName ||
                      "Chưa đặt tên";

                    const phone =
                      user?.phone ||
                      user?.phoneNumber ||
                      "N/A";

                    const idCard =
                      user?.identityCardNumber ||
                      user?.idCardNumber ||
                      "N/A";

                    const avatar =
                      user?.avatar ||
                      user?.avatarUrl ||
                      "";

                    const status =
                      String(
                        user?.status ||
                          ""
                      ).toUpperCase();

                    const role =
                      String(
                        user?.role ||
                          "CUSTOMER"
                      ).toUpperCase();

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
                      status === "PENDING" ||
                      status ===
                        "PENDING_APPROVAL";

                    const isBlockedStatus =
                      status === "BLOCKED" ||
                      status ===
                        "REJECTED";

                    return (
                      <tr
                        key={userId}
                        className="hover:bg-slate-700/30 transition"
                      >
                        {/* USER */}

                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            {avatar ? (
                              <img
                                src={
                                  avatar
                                }
                                alt="avatar"
                                className="w-9 h-9 rounded-full object-cover border border-slate-600"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center font-bold text-slate-300">
                                {name
                                  .charAt(
                                    0
                                  )
                                  .toUpperCase()}
                              </div>
                            )}

                            <div className="min-w-0">
                              <div className="font-bold text-slate-100 text-sm truncate max-w-[240px]">
                                {
                                  name
                                }
                              </div>

                              {merchant &&
                                user?.shopName && (
                                  <div className="text-[11px] text-indigo-400 font-semibold">
                                    🏪{" "}
                                    {
                                      user.shopName
                                    }
                                  </div>
                                )}

                              {merchant &&
                                user?.merchantCode && (
                                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                    {
                                      user.merchantCode
                                    }
                                  </div>
                                )}
                            </div>
                          </div>
                        </td>

                        {/* CONTACT */}

                        <td className="p-4">
                          <div className="font-semibold text-slate-200">
                            {
                              phone
                            }
                          </div>

                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            CCCD:{" "}
                            {
                              idCard
                            }
                          </div>
                        </td>

                        {/* ROLE */}

                        <td className="p-4">
                          <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 font-extrabold text-[10px] tracking-wide">
                            {
                              role
                            }
                          </span>
                        </td>

                        {/* COMMISSION */}

                        <td className="p-4">
                          {merchant ? (
                            <div className="flex items-center gap-2">
                              {isEditing ? (
                                <>
                                  <div className="relative w-[100px]">
                                    <input
                                      type="number"
                                      min={0}
                                      max={100}
                                      step={0.1}
                                      value={
                                        editingCommission?.value ??
                                        ""
                                      }
                                      onChange={(
                                        event
                                      ) => {
                                        setEditingCommission(
                                          {
                                            userId,
                                            value:
                                              event
                                                .target
                                                .value,
                                          }
                                        );
                                      }}
                                      disabled={
                                        isSaving
                                      }
                                      autoFocus
                                      className="w-full bg-slate-900 border border-indigo-500 focus:border-indigo-400 rounded-lg px-2.5 py-1.5 pr-7 text-xs text-white outline-none"
                                    />

                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-bold">
                                      %
                                    </span>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      saveCommission(
                                        user
                                      )
                                    }
                                    disabled={
                                      isSaving
                                    }
                                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-[10px] font-bold transition cursor-pointer"
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
                                    className="px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 text-[10px] font-bold transition cursor-pointer"
                                  >
                                    Hủy
                                  </button>
                                </>
                              ) : (
                                <>
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 font-black text-[11px] min-w-[60px] justify-center">
                                    {
                                      commission
                                    }
                                    %
                                  </span>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      startEditCommission(
                                        user
                                      )
                                    }
                                    className="px-2.5 py-1.5 rounded-lg bg-slate-700/70 hover:bg-indigo-600/30 text-slate-300 hover:text-indigo-300 border border-slate-600 hover:border-indigo-500/40 text-[10px] font-bold transition cursor-pointer"
                                  >
                                    ✏️
                                    Sửa
                                  </button>
                                </>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-600">
                              —
                            </span>
                          )}
                        </td>

                        {/* STATUS */}

                        <td className="p-4">
                          {isPendingStatus ? (
                            <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-extrabold text-[11px] inline-flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                              Chờ Duyệt
                            </span>
                          ) : isBlockedStatus ? (
                            <span className="px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 font-extrabold text-[11px] inline-flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />

                              {status ===
                              "REJECTED"
                                ? "Đã Từ Chối"
                                : "Đã Khóa"}
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-extrabold text-[11px] inline-flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              Hoạt Động
                            </span>
                          )}
                        </td>

                        {/* ACTION */}

                        <td className="p-4 text-right">
                          <button
                            onClick={() =>
                              setSelectedUser(
                                user
                              )
                            }
                            className="px-3.5 py-1.5 bg-indigo-600/80 hover:bg-indigo-600 text-white font-bold rounded-xl transition text-[11px] border border-indigo-500/50 shadow-sm cursor-pointer"
                          >
                            Quản Lý
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
      </div>

      {/* =====================================================
          DETAIL MODAL
      ====================================================== */}

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
    </div>
  );
}