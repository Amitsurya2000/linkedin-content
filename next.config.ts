import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  // Lint runs in the editor/dev; don't let a lint-config hiccup block production builds.
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Serverless runtimes ship no fonts, so librsvg silently drops SVG <text>.
  // Bundle the Poppins TTFs + fontconfig config into every serverless function
  // so src/instrumentation.ts can point fontconfig at them at startup.
  outputFileTracingIncludes: {
    "/*": ["./assets/fonts/**/*", "./fonts.conf"],
  },
};

export default nextConfig;
