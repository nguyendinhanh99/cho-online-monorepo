interface HeaderProfileProps {
  fullName: string;
  avatarUrl: string;
  isOnline: boolean;
}

export default function HeaderProfile({ fullName, avatarUrl, isOnline }: HeaderProfileProps) {
  return (
    <div className="flex items-center justify-between bg-white p-4 rounded-3xl border border-stone-200/80 shadow-xs">
      <div className="flex items-center gap-3">
        <div className="relative">
          <img
            src={avatarUrl || "https://via.placeholder.com/150"}
            alt="Avatar"
            className="w-12 h-12 rounded-2xl object-cover border-2 border-stone-100"
          />
          <span
            className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
              isOnline ? "bg-emerald-500" : "bg-stone-300"
            }`}
          />
        </div>
        <div>
          <h2 className="font-extrabold text-stone-800 text-sm leading-tight">{fullName}</h2>
          <p className="text-[11px] font-medium text-stone-400">
            {isOnline ? "Đang sẵn sàng nhận đơn" : "Đang ngoại tuyến"}
          </p>
        </div>
      </div>

      <div className="bg-stone-100 p-2 rounded-2xl text-lg cursor-pointer hover:bg-stone-200 transition">
        🔔
      </div>
    </div>
  );
}