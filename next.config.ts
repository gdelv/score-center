import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "a.espncdn.com" }],
  },
  // /predictions was removed; send old links to the scores board rather than
  // a 404. Not permanent, so browsers won't cache it if the page comes back.
  async redirects() {
    return [{ source: "/predictions", destination: "/", permanent: false }];
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
