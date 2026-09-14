import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Keep Turbopack rooted on this app. The parent Desktop folder is not a JS workspace.
    root: path.join(__dirname),
  },
  transpilePackages: ["three"],
  async redirects() {
    return [
      {
        source: "/download",
        destination: "/download.html",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
