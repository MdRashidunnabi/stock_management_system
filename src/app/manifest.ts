import type { MetadataRoute } from "next";

/**
 * PWA manifest. The shop's POS terminal is what we want installable on
 * the cashier's tablet, so `start_url` lands directly in `/pos`.
 *
 * Icons are SVG (`sizes: "any"`), which is supported by Chrome (Android
 * + desktop) and Edge. Before launching to iOS we should add raster
 * 192x192 and 512x512 PNG fallbacks (see Step 15 prep).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ShopOS - Retail Operating System",
    short_name: "ShopOS",
    description:
      "Retail POS, stock management, suppliers, and online sales for Irish independent shops.",
    start_url: "/pos",
    scope: "/",
    display: "standalone",
    orientation: "any",
    theme_color: "#0a0a0a",
    background_color: "#0a0a0a",
    lang: "en-IE",
    categories: ["business", "productivity", "shopping"],
    icons: [
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
