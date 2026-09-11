import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "a.espncdn.com" }],
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
