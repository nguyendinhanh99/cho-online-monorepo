import type { Metadata } from "next";
import "./globals.css";

import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { CartDrawer } from "@/components/CartDrawer";
import CustomerNotification from "@/components/CustomerNotification";

// ========================================================
// SEO + SALES METADATA
// ========================================================

export const metadata: Metadata = {
  metadataBase: new URL("https://www.anvami.com"),

  title: {
    default: "ANVAMI – Đặt đồ ăn Hà Tĩnh | Ưu đãi mỗi ngày",
    template: "%s | ANVAMI",
  },

  description:
    "Đặt món ngon từ các quán địa phương trên ANVAMI. Nhiều ưu đãi hấp dẫn, đặt nhanh, phí giao hàng rõ ràng và giao tận nơi tại Hà Tĩnh.",

  applicationName: "ANVAMI",

  alternates: {
    canonical: "https://www.anvami.com/",
  },

  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },

  openGraph: {
    type: "website",
    locale: "vi_VN",

    url: "https://www.anvami.com/",
    siteName: "ANVAMI",

    title: "ANVAMI – Đặt đồ ăn Hà Tĩnh | Ưu đãi mỗi ngày",

    description:
      "Khám phá món ngon quanh bạn, săn ưu đãi và đặt giao tận nơi cùng ANVAMI.",

    images: [
      {
        url: "/og-anvami.jpg",
        width: 1200,
        height: 630,
        alt: "ANVAMI - Đặt đồ ăn và mua sắm tại Hà Tĩnh",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",

    title: "ANVAMI – Đặt đồ ăn Hà Tĩnh",

    description:
      "Món ngon địa phương, ưu đãi hấp dẫn và giao tận nơi cùng ANVAMI.",

    images: ["/og-anvami.jpg"],
  },

  robots: {
    index: true,
    follow: true,

    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

// ========================================================
// STRUCTURED DATA
// ========================================================

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://www.anvami.com/#website",

      url: "https://www.anvami.com/",
      name: "ANVAMI",
      alternateName: "Anvami",

      description:
        "Nền tảng đặt đồ ăn, mua sắm và giao hàng địa phương tại Hà Tĩnh.",

      inLanguage: "vi-VN",

      publisher: {
        "@id": "https://www.anvami.com/#organization",
      },
    },

    {
      "@type": "Organization",
      "@id": "https://www.anvami.com/#organization",

      name: "ANVAMI",

      url: "https://www.anvami.com/",

      logo: {
        "@type": "ImageObject",
        url: "https://www.anvami.com/logo.png",
      },

      description:
        "ANVAMI là nền tảng thương mại điện tử và giao hàng địa phương tại Hà Tĩnh, kết nối khách hàng với nhà hàng, quán ăn, cửa hàng và đối tác giao hàng.",

      founder: {
        "@type": "Person",
        name: "Nguyễn Đình Anh",
      },

      areaServed: {
        "@type": "AdministrativeArea",
        name: "Hà Tĩnh",
      },
    },
  ],
};

// ========================================================
// ROOT LAYOUT
// ========================================================

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <head>
        {/* ========================================================
            GOOGLE STRUCTURED DATA
        ======================================================== */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData),
          }}
        />
      </head>

      <body className="bg-stone-100 min-h-screen text-stone-800 antialiased font-sans flex justify-center">
        <div className="w-full max-w-lg bg-white min-h-screen shadow-2xl flex flex-col relative pb-20">

          {/* HEADER */}
          <AppHeader />

          {/* PAGE CONTENT */}
          <main className="flex-1">
            {children}
          </main>

          {/* BOTTOM NAVIGATION */}
          <BottomNav />

          {/* CART */}
          <CartDrawer />
        </div>

        {/* CUSTOMER NOTIFICATION */}
        <CustomerNotification />
      </body>
    </html>
  );
}