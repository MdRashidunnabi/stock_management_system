import type { Metadata, Viewport } from "next";
import { SerwistProvider } from "@serwist/turbopack/react";
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
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ShopOS",
  },
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/icon.svg",
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
        <SerwistProvider swUrl="/serwist/sw.js">
          <Providers>{children}</Providers>
        </SerwistProvider>
        <Toaster richColors position="top-right" closeButton />
      </body>
    </html>
  );
}
