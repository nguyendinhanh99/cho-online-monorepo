import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cấu hình chính xác cho Turbopack trong Next.js 16
  turbopack: {
    root: path.resolve(__dirname, "../../"),
  },
};

export default nextConfig;