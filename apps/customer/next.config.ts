import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /* Cấu hình root directory chuẩn cho Turbopack trên Next.js 16 */
  turbopack: {
    root: path.resolve(__dirname, "../../"),
  },

  /* Cho phép Ngrok, LAN IP và Localhost thực hiện Server Actions & WebSocket */
  experimental: {
    serverActions: {
      allowedOrigins: [
        "thrower-skittle-quail.ngrok-free.dev",
        "192.168.1.13:3003",
        "localhost:3003",
      ],
    },
  },

  /* Bỏ qua cảnh báo CORS & cho phép tải Static Assets từ môi trường bên ngoài */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PUT,DELETE,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "*" },
          { key: "ngrok-skip-browser-warning", value: "true" },
        ],
      },
    ];
  },
};

export default nextConfig;