"use client";

import { UserProfile, UserRole, UserStatus } from "@/types/user";
import { UserStatusBadge } from "./UserStatusBadge";

interface UserTableProps {
  users: UserProfile[];
  onUpdateStatus: (uid: string, status: UserStatus) => void;
  onUpdateRole: (uid: string, role: UserRole) => void;
}

export function UserTable({ users, onUpdateStatus, onUpdateRole }: UserTableProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500 font-extrabold border-b border-slate-200/80 uppercase tracking-wider">
              <th className="p-4">Người Dùng</th>
              <th className="p-4">Số CCCD</th>
              <th className="p-4">Phân Quyền (Role)</th>
              <th className="p-4">Trạng Thái</th>
              <th className="p-4 text-center">Thao Tác Duyệt / Khóa</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-400 font-bold">
                  Không tìm thấy người dùng nào
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.uid} className="hover:bg-slate-50 transition">
                  {/* Họ tên & SĐT */}
                  <td className="p-4">
                    <p className="font-bold text-slate-900">{u.fullName || "Chưa cập nhật"}</p>
                    <p className="text-slate-400 text-[11px] font-mono">{u.phone}</p>
                  </td>

                  {/* Số CCCD */}
                  <td className="p-4 font-mono font-bold text-slate-800">
                    {u.idCardNumber || "—"}
                  </td>

                  {/* Phân Quyền */}
                  <td className="p-4">
                    <select
                      value={u.role}
                      onChange={(e) => onUpdateRole(u.uid, e.target.value as UserRole)}
                      className="bg-slate-100 font-bold text-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none cursor-pointer"
                    >
                      <option value="CUSTOMER">Khách Hàng</option>
                      <option value="SHIPPER">Shipper</option>
                      <option value="ADMIN">Admin Tổng</option>
                      <option value="OPERATOR">NV Vận Hành</option>
                      <option value="SUPPORT">Support / CSKH</option>
                    </select>
                  </td>

                  {/* Trạng thái Badge */}
                  <td className="p-4">
                    <UserStatusBadge status={u.status} />
                  </td>

                  {/* Thao Tác Duyệt / Khóa */}
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-2">
                      {u.status === "PENDING" && (
                        <>
                          <button
                            onClick={() => onUpdateStatus(u.uid, "ACTIVE")}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-3 py-1.5 rounded-xl transition active:scale-95 cursor-pointer shadow-xs"
                          >
                            Duyệt Hồ Sơ
                          </button>
                          <button
                            onClick={() => onUpdateStatus(u.uid, "REJECTED")}
                            className="bg-rose-100 text-rose-600 hover:bg-rose-200 font-extrabold px-3 py-1.5 rounded-xl transition active:scale-95 cursor-pointer"
                          >
                            Từ Chối
                          </button>
                        </>
                      )}

                      {u.status === "ACTIVE" && (
                        <button
                          onClick={() => onUpdateStatus(u.uid, "BLOCKED")}
                          className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold px-3 py-1.5 rounded-xl transition active:scale-95 cursor-pointer shadow-xs"
                        >
                          Khóa Tài Khoản
                        </button>
                      )}

                      {u.status === "BLOCKED" && (
                        <button
                          onClick={() => onUpdateStatus(u.uid, "ACTIVE")}
                          className="bg-slate-800 hover:bg-slate-900 text-white font-extrabold px-3 py-1.5 rounded-xl transition active:scale-95 cursor-pointer shadow-xs"
                        >
                          Mở Khóa
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}