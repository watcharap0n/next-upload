import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  // Enable standalone output for Docker optimization
  output: 'standalone',
};

export default nextConfig;
