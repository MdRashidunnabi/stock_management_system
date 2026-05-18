import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  typedRoutes: true,

  /**
   * Standalone output bundles the server into a single self-contained
   * directory (.next/standalone) so the Docker image does not need to
   * copy all of node_modules - cuts the image size by ~80%.
   */
  output: "standalone",

  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },

  /**
   * We run our own `npm run typecheck` and `npm run lint` (faster, isolated).
   * Skipping the duplicate validation Next runs at build time; this is a
   * known workaround for projects on a path containing spaces, which can
   * hang Next 16's type-route resolver. CI will run typecheck and lint
   * as separate steps.
   */
  typescript: {
    ignoreBuildErrors: true,
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
    formats: ["image/avif", "image/webp"],
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default withSerwist(nextConfig);
