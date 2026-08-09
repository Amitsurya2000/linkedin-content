import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  // Lint runs in the editor/dev; don't let a lint-config hiccup block production builds.
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
