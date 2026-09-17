"use client";

import { useState } from "react";
import MerchantHeader from "@/components/merchant/MerchantHeader";
import NavigationTabs, { TabType } from "@/components/merchant/NavigationTabs";
import OverviewTab from "@/components/merchant/OverviewTab";
import OrdersTab, { Order } from "@/components/merchant/OrdersTab";
import ProductsTab, { Product } from "@/components/merchant/ProductsTab";
import SettingsTab from "@/components/merchant/SettingsTab";
import AccountTab from "@/components/merchant/AccountTab";
import GlobalNotification from "@/components/GlobalNotification";

export default function MerchantDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [isOpenShop, setIsOpenShop] = useState<boolean>(true);

  // Khởi tạo danh sách rỗng, loại bỏ hoàn toàn data demo
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const pendingCount = orders.filter((o) => (o.status as string) === "pending").length;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount || 0);
  };

  const handleUpdateOrderStatus = (orderId: string, nextStatus: any) => {
    setOrders((prev) =>
      prev.map((ord) => (ord.id === orderId ? { ...ord, status: nextStatus } : ord))
    );
  };

  const toggleProductStock = (productId: string) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, isAvailable: !p.isAvailable } : p))
    );
  };

  return (
    <div className="bg-[#f4f5f7] min-h-screen pb-12 font-sans text-stone-800">
      {/* Thông báo ngầm & chuông báo đơn mới 15s toàn ứng dụng */}
      <GlobalNotification />

      <MerchantHeader isOpenShop={isOpenShop} onToggleOpen={() => setIsOpenShop(!isOpenShop)} />

      <div className="max-w-md mx-auto p-3 space-y-4">
        <NavigationTabs activeTab={activeTab} setActiveTab={setActiveTab} pendingCount={pendingCount} />

        {activeTab === "overview" && (
          <OverviewTab
            formatCurrency={formatCurrency}
            onNavigateToTab={(tab: string) => setActiveTab(tab as TabType)}
          />
        )}
        {activeTab === "orders" && (
          <OrdersTab
            {...({
              orders,
              onUpdateStatus: handleUpdateOrderStatus,
              formatCurrency,
            } as any)}
          />
        )}
        {activeTab === "products" && (
          <ProductsTab
            {...({
              products,
              onToggleStock: toggleProductStock,
              formatCurrency,
            } as any)}
          />
        )}
        {activeTab === "settings" && <SettingsTab />}
        {activeTab === "account" && <AccountTab />}
      </div>
    </div>
  );
}