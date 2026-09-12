"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@cho-online/firebase";

import OverviewTab from "@/components/OverviewTab";
import OrdersTab from "@/components/OrdersTab";
import WalletTab from "@/components/WalletTab";
import BottomNav from "@/components/BottomNav";
import GlobalNotification from "@/components/GlobalNotification";

export default function ShipperDashboard() {
  const [activeTab, setActiveTab] = useState<"home" | "orders" | "wallet">("home");
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace("/login");
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <div className="h-screen w-full bg-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-[#ee4d2d] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-slate-500">Đang kiểm tra đăng nhập...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-slate-100 flex items-center justify-center font-sans overflow-hidden">
      {/* GlobalNotification luôn chạy ngầm liên tục ở cấp Root, không bị unmount khi đổi tab */}
      <GlobalNotification />

      <div className="w-full max-w-md h-full bg-white flex flex-col relative overflow-hidden shadow-sm">
        {/* Render nội dung Tab */}
        <div className="flex-1 overflow-hidden relative">
          {activeTab === "home" && <OverviewTab />}
          {activeTab === "orders" && <OrdersTab />}
          {activeTab === "wallet" && <WalletTab />}
        </div>

        {/* Thanh Điều Hướng Bên Dưới */}
        <BottomNav activeTab={activeTab} onChangeTab={setActiveTab} />
      </div>
    </div>
  );
}