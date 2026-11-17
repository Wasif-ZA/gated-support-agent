import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: { "/**": ["./tests/fixtures/replies.json"] },
};

export default nextConfig;
