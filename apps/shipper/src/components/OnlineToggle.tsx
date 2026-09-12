interface OnlineToggleProps {
  isOnline: boolean;
  onToggle: () => void;
}

export default function OnlineToggle({ isOnline, onToggle }: OnlineToggleProps) {
  return (
    <div className={`p-4 rounded-3xl transition-all duration-300 border ${
      isOnline ? "bg-emerald-500/10 border-emerald-200" : "bg-stone-100 border-stone-200"
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{isOnline ? "🟢" : "⚪"}</span>
          <span className="font-extrabold text-xs text-stone-800">
            {isOnline ? "TRẠNG THÁI: ONLINE" : "TRẠNG THÁI: OFFLINE"}
          </span>
        </div>

        <button
          onClick={onToggle}
          className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer active:scale-95 ${
            isOnline
              ? "bg-stone-800 text-white hover:bg-stone-900"
              : "bg-emerald-600 text-white hover:bg-emerald-700"
          }`}
        >
          {isOnline ? "TẮT HOẠT ĐỘNG" : "BẬT KIẾM TIỀN"}
        </button>
      </div>
    </div>
  );
}