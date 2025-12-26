import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    browserDebugInfoInTerminal: true,
    mcpServer: true,
  },
  /* config options here */
};

export default nextConfig;
