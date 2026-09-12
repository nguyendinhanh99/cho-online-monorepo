import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import GlobalNotification from "@/components/GlobalNotification";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 🟢 CẬP NHẬT METADATA CÓ CHỨA ICONS / FAVICON
export const metadata: Metadata = {
  title: "anvami - Shipper",
  description: "Ứng dụng giao hàng của Anvami",
  icons: {
    icon: "/logo.png", // Đường dẫn đến logo trong thư mục public
    shortcut: "/logo.png",
    apple: "/logo.png", // Icon hiển thị khi lưu app ra màn hình chính trên iOS (iPhone/iPad)
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Đặt ở đây để khởi chạy 1 lần duy nhất trên toàn bộ trang web */}
        <GlobalNotification />
        {children}
      </body>
    </html>
  );
}