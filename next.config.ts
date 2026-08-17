import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: false,
  // Required for PDF generation on Vercel: Chromium is loaded from node_modules, not bundled.
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    ignoreBuildErrors: true,
  },
  // eslint block is REMOVED because it causes the error in Next.js 16+
};

export default nextConfig;
