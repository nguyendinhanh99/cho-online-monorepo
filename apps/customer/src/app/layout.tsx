import type { Metadata } from "next";
import "./globals.css";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { CartDrawer } from "@/components/CartDrawer";
import CustomerNotification from "@/components/CustomerNotification";

// 🟢 CẬP NHẬT METADATA VÀ ICONS/FAVICON CHO CUSTOMER APP
export const metadata: Metadata = {
  title: "TiGo - Mua Sắm Online",
  description: "Đặt nhanh hơn - Giá tốt hơn - Giao nhanh hơn.",
  icons: {
    icon: "/logo.png", // Đường dẫn logo trong thư mục apps/customer/public/logo.png
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className="bg-stone-100 min-h-screen text-stone-800 antialiased font-sans flex justify-center">
        <div className="w-full max-w-lg bg-white min-h-screen shadow-2xl flex flex-col relative pb-20">
          <AppHeader />
          <main className="flex-1">{children}</main>
          <BottomNav />
          
          {/* HIỂN THỊ CỬA SỔ GIỎ HÀNG TẠI ĐÂY */}
          <CartDrawer />
        </div>
        <CustomerNotification />
      </body>
    </html>
  );
}