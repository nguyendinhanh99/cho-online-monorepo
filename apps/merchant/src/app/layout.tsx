import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import GlobalNotification from "@/components/GlobalNotification";
import AuthGuard from "@/components/AuthGuard";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 🟢 CẬP NHẬT METADATA, MANIFEST VÀ FAVICON CHO MERCHANT APP
export const metadata: Metadata = {
  title: "TiGo - Quản lý Cửa hàng",
  description: "Kênh quản lý cửa hàng Chợ Online",
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.png", // Đường dẫn logo trong thư mục apps/merchant/public/logo.png
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <GlobalNotification />
        <AuthGuard>{children}</AuthGuard>
      </body>
    </html>
  );
}