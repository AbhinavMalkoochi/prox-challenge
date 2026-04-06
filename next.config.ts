import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/manuals/[manualId]/pdf": ["./files/**/*"],
    "/api/chat": ["./data/manual/**/*"],
    "/source/[manualId]/[pageNumber]": ["./data/manual/**/*"],
  },
  images: {
    localPatterns: [
      {
        pathname: "/**"
      }
    ]
  }
};

export default nextConfig;
