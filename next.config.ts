import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  experimental: {
    webpackBuildWorker: false,
  },
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
