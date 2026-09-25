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
    const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL
      ? (() => {
          try {
            return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin;
          } catch {
            return "";
          }
        })()
      : "";
    const connect = ["'self'", "https://*.supabase.co", "wss://*.supabase.co", supabaseOrigin]
      .filter(Boolean)
      .join(" ");
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(self), microphone=(), geolocation=()",
      },
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob: https:",
          "font-src 'self' data:",
          `connect-src ${connect}`,
          "worker-src 'self' blob:",
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "form-action 'self'",
          "object-src 'none'",
        ].join("; "),
      },
    ];
    if (process.env.NEXT_PUBLIC_APP_ENV === "production") {
      securityHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains",
      });
    }
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default withSerwist(nextConfig);
