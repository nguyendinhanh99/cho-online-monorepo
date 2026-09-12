"use client";

import { useRouter, usePathname } from "next/navigation";

interface BottomNavProps {
  activeTab?: "home" | "orders" | "wallet";
  onChangeTab?: (tab: "home" | "orders" | "wallet") => void;
}

export default function BottomNav({ activeTab = "home", onChangeTab }: BottomNavProps) {
  const router = useRouter();
  const pathname = usePathname();

  const isProfilePage = pathname === "/profile";

  const handleTabClick = (tab: "home" | "orders" | "wallet") => {
    if (isProfilePage) {
      router.push("/");
    } else if (onChangeTab) {
      onChangeTab(tab);
    }
  };

  // Danh sách cấu hình các Tabs
  const navItems = [
    {
      id: "home" as const,
      label: "Trang chủ",
      isActive: !isProfilePage && activeTab === "home",
      onClick: () => handleTabClick("home"),
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      id: "orders" as const,
      label: "Đơn hàng",
      isActive: !isProfilePage && activeTab === "orders",
      onClick: () => handleTabClick("orders"),
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
    },
    {
      id: "wallet" as const,
      label: "Ví tiền",
      isActive: !isProfilePage && activeTab === "wallet",
      onClick: () => handleTabClick("wallet"),
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      ),
    },
    {
      id: "profile" as const,
      label: "Tài khoản",
      isActive: isProfilePage,
      onClick: () => router.push("/profile"),
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/95 backdrop-blur-md border-t border-slate-200/80 z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around px-2 py-1.5">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={item.onClick}
            className={`group relative flex flex-col items-center justify-center min-w-[68px] py-1 px-2 rounded-2xl transition-all duration-200 active:scale-95 cursor-pointer ${
              item.isActive
                ? "text-emerald-600 font-extrabold"
                : "text-slate-400 hover:text-slate-600 font-medium"
            }`}
          >
            {/* Nền hiệu ứng Pill highlight khi Tab đang active */}
            <span
              className={`flex items-center justify-center p-1.5 rounded-xl transition-all duration-300 ${
                item.isActive
                  ? "bg-emerald-50 text-emerald-600 scale-105 shadow-xs"
                  : "bg-transparent group-hover:bg-slate-100/80"
              }`}
            >
              {item.icon}
            </span>

            {/* Nhãn chữ bên dưới */}
            <span
              className={`text-[11px] leading-tight mt-0.5 tracking-tight transition-all duration-200 ${
                item.isActive ? "text-emerald-600 font-bold" : "text-slate-500 font-medium"
              }`}
            >
              {item.label}
            </span>

            {/* Dấu chấm nhỏ chỉ báo hoạt động (Active Dot) */}
            {item.isActive && (
              <span className="absolute -top-0.5 w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}