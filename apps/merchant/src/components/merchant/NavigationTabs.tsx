"use client";

export type TabType = "overview" | "orders" | "products" | "settings" | "account";

interface NavigationTabsProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  pendingCount: number;
}

export default function NavigationTabs({ activeTab, setActiveTab, pendingCount }: NavigationTabsProps) {
  const tabs = [
    { id: "overview", label: "Tổng Quan", icon: "📊" },
    { id: "orders", label: `Đơn (${pendingCount})`, icon: "📦" },
    { id: "products", label: "Sản Phẩm", icon: "🍹" },
    { id: "settings", label: "Cài Đặt", icon: "⚙️" },
    { id: "account", label: "Tài Khoản", icon: "👤" },
  ];

  return (
    <div className="bg-white p-1 rounded-xl shadow-xs border border-stone-200/80 flex justify-between text-xs font-bold">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id as TabType)}
          className={`flex-1 py-2 rounded-lg flex flex-col items-center gap-0.5 transition cursor-pointer ${
            activeTab === tab.id
              ? "bg-[#ee4d2d] text-white shadow-xs"
              : "text-stone-600 hover:bg-stone-50"
          }`}
        >
          <span>{tab.icon}</span>
          <span className="text-[10px]">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}