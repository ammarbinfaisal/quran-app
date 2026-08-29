import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  allowedDevOrigins: ["127.0.0.1", "localhost", "acer"],
  // /api/search reads the precomputed index from disk; make sure it ships in the function bundle.
  outputFileTracingIncludes: {
    "/api/search": ["./public/data/search-index.bin"],
  },
};

export default nextConfig;
