"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const menuItems = [
  { label: "Quản lý Tài khoản", href: "/users", icon: "👥" },
  { label: "Quản lý Đơn hàng", href: "/orders", icon: "📦" },
  { label: "Báo cáo & Tài chính", href: "/finance", icon: "📊" },
  { label: "Cấu hình Hệ thống", href: "/settings", icon: "⚙️" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 min-h-screen p-4 flex flex-col justify-between">
      <div className="space-y-6">
        {/* Logo / Header */}
        <div className="px-3 py-2">
          <h2 className="text-lg font-black text-white tracking-wider">ADMIN PORTAL</h2>
          <p className="text-[10px] text-slate-400 font-medium">Hệ thống Quản trị & Điều hành</p>
        </div>

        {/* Menu Links */}
        <nav className="space-y-1">
          {menuItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-xs transition ${
                  isActive
                    ? "bg-emerald-600 text-white shadow-md"
                    : "hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                <span className="text-base">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-slate-800 pt-4 px-3 text-[11px] text-slate-500 font-medium">
        System v1.0.0
      </div>
    </aside>
  );
}