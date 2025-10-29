import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true, // ✅ build won’t fail on ESLint errors
  },
};

export default nextConfig;
