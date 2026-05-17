import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ShopOS - Retail Operating System",
    template: "%s | ShopOS",
  },
  description:
    "ShopOS is the Retail Business Operating System for Irish independent shops: POS, stock, suppliers, branches, and online sales in one place.",
  applicationName: "ShopOS",
  authors: [{ name: "ShopOS" }],
  keywords: [
    "POS",
    "stock management",
    "retail",
    "Ireland",
    "small business",
    "SaaS",
    "inventory",
    "online store",
  ],
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IE" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
        <Toaster richColors position="top-right" closeButton />
      </body>
    </html>
  );
}
