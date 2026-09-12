"use client";

import Link from "next/link";

export default function PendingApprovalPage() {
  return (
    <main className="min-h-screen bg-stone-100 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-sm bg-white rounded-3xl border border-stone-200 shadow-md p-6 text-center space-y-4">
        <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-3xl mx-auto animate-bounce">
          ⏳
        </div>

        <div className="space-y-1">
          <h1 className="text-base font-extrabold text-stone-800">Hồ Sơ Đang Được Kiểm Tra</h1>
          <p className="text-xs text-stone-500 leading-relaxed">
            Hồ sơ xác minh (CCCD, Bằng lái xe) của bạn đã được gửi tới Ban Quản Trị. 
            Chúng tôi sẽ tiến hành đối soát và kích hoạt tài khoản cho bạn trong vòng **24 giờ**.
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200/80 p-3 rounded-xl text-left text-[11px] text-amber-900 space-y-1">
          <div className="font-bold flex items-center gap-1">
            <span>💡</span> Thông tin đăng ký:
          </div>
          <div>• Trạng thái: <strong className="text-amber-700">Chờ duyệt (Pending)</strong></div>
          <div>• Thời gian dự kiến: Trong ngày hôm nay</div>
        </div>

        <Link
          href="/login"
          className="block w-full bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold py-2.5 rounded-xl text-xs transition"
        >
          Quay lại Đăng nhập
        </Link>
      </div>
    </main>
  );
}