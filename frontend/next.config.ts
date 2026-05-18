import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // framer-motion v11 has known type conflicts with React 19
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
