import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Security headers
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
  
  // Image optimization
  images: {
    remotePatterns: [
      { hostname: "avatars.githubusercontent.com" },
      { hostname: "*.githubusercontent.com" },
    ],
  },
  
  // Enable strict mode
  reactStrictMode: true,
  
  // Optimize bundle
  experimental: {
    optimizePackageImports: ["recharts", "@tanstack/react-query"],
  },
};

export default nextConfig;
