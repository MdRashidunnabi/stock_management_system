import type { Metadata, Viewport } from "next";
import {
  Geist,
  Geist_Mono,
  Noto_Sans_Arabic,
  Noto_Sans_Bengali,
  Noto_Sans_Devanagari,
  Noto_Sans_SC,
} from "next/font/google";
import { SerwistProvider } from "@serwist/turbopack/react";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";
import { AssistantGate } from "@/components/assistant/assistant-gate";
import { getRequestLocale } from "@/lib/i18n/get-locale";
import { getMessages } from "@/lib/i18n/messages";
import { LOCALE_META } from "@/lib/i18n/config";
import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

const notoBengali = Noto_Sans_Bengali({
  subsets: ["bengali"],
  weight: ["400", "600", "700"],
  variable: "--font-bn",
  display: "swap",
});

const notoArabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "600", "700"],
  variable: "--font-ar",
  display: "swap",
});

const notoSc = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-zh",
  display: "swap",
});

const notoDeva = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  weight: ["400", "600", "700"],
  variable: "--font-hi",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "ShopOS",
    template: "%s | ShopOS",
  },
  description: "Till, stock, and online shop for retailers in any country.",
  applicationName: "ShopOS",
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
    { media: "(prefers-color-scheme: light)", color: "#059669" },
    { media: "(prefers-color-scheme: dark)", color: "#064e3b" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getRequestLocale();
  const messages = getMessages(locale);
  const meta = LOCALE_META[locale];

  return (
    <html
      lang={meta.htmlLang}
      dir={meta.dir}
      className={`${geistSans.variable} ${geistMono.variable} ${notoBengali.variable} ${notoArabic.variable} ${notoSc.variable} ${notoDeva.variable} locale-${locale}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <a href="#main" className="skip-link">
          {messages.common.skipToContent}
        </a>
        <SerwistProvider swUrl="/serwist/sw.js">
          <Providers locale={locale} messages={messages}>
            <div id="main">{children}</div>
            <AssistantGate />
          </Providers>
        </SerwistProvider>
        <Toaster richColors position={meta.dir === "rtl" ? "top-left" : "top-right"} closeButton />
      </body>
    </html>
  );
}
