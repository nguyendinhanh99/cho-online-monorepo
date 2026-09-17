"use client";

import { useState, useEffect } from "react";

export default function SettingsTab() {
  const [isNotiEnabled, setIsNotiEnabled] = useState(false);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "granted") {
      setIsNotiEnabled(true);
    }
  }, []);

  return (
    <div className="space-y-4 text-xs">
      <div className="bg-white p-4 rounded-xl border border-stone-200/80 shadow-xs space-y-3">
        <h2 className="font-bold text-stone-800 border-b border-stone-100 pb-2">
          Trạng thái thông báo thiết bị
        </h2>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-stone-700">
              Hệ thống nhận thông báo tự động
            </p>
            <p className="text-[10px] text-stone-400">
              Thiết bị này luôn sẵn sàng nhận đơn hàng ở mọi màn hình
            </p>
          </div>

          <div className="flex items-center gap-1.5 font-bold">
            {isNotiEnabled ? (
              <span className="text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Đang hoạt động
              </span>
            ) : (
              <span className="text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                Chưa cấp quyền
              </span>
            )}
          </div>
        </div>

        <div className="pt-2 border-t border-stone-100 flex justify-end">
          <button
            type="button"
            onClick={() => {
              const audio = new Audio("/notification.mp3");
              audio
                .play()
                .then(() => alert("Âm thanh thiết bị hoạt động bình thường!"))
                .catch((err) =>
                  alert("Lỗi phát âm thanh: " + err.message)
                );
            }}
            className="text-[11px] text-emerald-600 font-medium hover:underline cursor-pointer"
          >
            🔊 Bấm để nghe thử chuông báo
          </button>
        </div>
      </div>
    </div>
  );
}