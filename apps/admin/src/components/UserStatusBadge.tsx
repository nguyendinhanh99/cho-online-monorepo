import { UserStatus } from "@/types/user";

export function UserStatusBadge({ status }: { status: UserStatus }) {
  switch (status) {
    case "ACTIVE":
      return (
        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full font-black text-[10px] inline-block">
          HOẠT ĐỘNG
        </span>
      );
    case "PENDING":
      return (
        <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full font-black text-[10px] inline-block">
          CHỜ DUYỆT
        </span>
      );
    case "BLOCKED":
      return (
        <span className="bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-full font-black text-[10px] inline-block">
          ĐÃ KHÓA
        </span>
      );
    case "REJECTED":
      return (
        <span className="bg-slate-100 text-slate-600 border border-slate-300 px-2.5 py-1 rounded-full font-black text-[10px] inline-block">
          TỪ CHỐI
        </span>
      );
    default:
      return null;
  }
}