import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Kolam photos can be up to 10 MB; leave headroom for the multipart envelope.
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
