"use client";

export type TabType =
  | "overview"
  | "orders"
  | "products"
  | "settings"
  | "account";

interface NavigationTabsProps {
  activeTab: TabType;

  setActiveTab: (
    tab: TabType
  ) => void;

  pendingCount: number;
}

export default function NavigationTabs({
  activeTab,
  setActiveTab,
  pendingCount,
}: NavigationTabsProps) {
  const orderCount =
    Math.max(
      0,
      Number(
        pendingCount
      ) || 0
    );

  const hasOrders =
    orderCount > 0;

  const tabs: Array<{
    id: TabType;
    label: string;
    icon: string;
  }> = [
    {
      id: "overview",
      label: "Tổng Quan",
      icon: "📊",
    },
    {
      id: "orders",
      label: "Đơn Hàng",
      icon: "📦",
    },
    {
      id: "products",
      label: "Sản Phẩm",
      icon: "🍹",
    },
    {
      id: "settings",
      label: "Vouchers",
      icon: "⚙️",
    },
    {
      id: "account",
      label: "Tài Khoản",
      icon: "👤",
    },
  ];

  return (
    <div className="flex justify-between rounded-xl border border-stone-200/80 bg-white p-1 text-xs font-bold shadow-sm">
      {tabs.map(
        (tab) => {
          const isActive =
            activeTab ===
            tab.id;

          const isOrders =
            tab.id ===
            "orders";

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() =>
                setActiveTab(
                  tab.id
                )
              }
              className={`
                relative
                flex flex-1
                cursor-pointer
                flex-col
                items-center
                justify-center
                gap-0.5
                rounded-lg
                py-2
                transition-all
                duration-200

                ${
                  isActive
                    ? "bg-[#ee4d2d] text-white shadow-sm"
                    : "text-stone-600 hover:bg-stone-50"
                }

                ${
                  isOrders &&
                  hasOrders &&
                  !isActive
                    ? "bg-red-50/60"
                    : ""
                }
              `}
            >
              <div className="relative">
                <span className="block text-base leading-none">
                  {
                    tab.icon
                  }
                </span>

                {isOrders &&
                  hasOrders && (
                    <span
                      className={`
                        absolute
                        -right-4
                        -top-3

                        flex
                        min-w-[21px]
                        h-[21px]
                        items-center
                        justify-center

                        rounded-full
                        px-1

                        text-[9px]
                        font-black
                        leading-none

                        shadow-lg
                        ring-2

                        ${
                          isActive
                            ? "bg-white text-[#ee4d2d] ring-[#ee4d2d]"
                            : "bg-red-500 text-white ring-white"
                        }
                      `}
                    >
                      {orderCount >
                      99
                        ? "99+"
                        : orderCount}
                    </span>
                  )}
              </div>

              <span className="text-[10px] leading-tight">
                {
                  tab.label
                }
              </span>

              {isOrders &&
                hasOrders &&
                !isActive && (
                  <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-red-500">
                    <span className="absolute inset-0 animate-ping rounded-full bg-red-400 opacity-70" />
                  </span>
                )}
            </button>
          );
        }
      )}
    </div>
  );
}