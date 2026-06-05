/** Bridge exposed by `apps/desktop/preload.mjs` */
export type ShopOSDesktopBridge = {
  version: string;
  platform: string;
  isDesktop: true;
};

declare global {
  interface Window {
    shopOSDesktop?: ShopOSDesktopBridge;
  }
}

export function isShopOSDesktop(): boolean {
  return typeof window !== "undefined" && window.shopOSDesktop?.isDesktop === true;
}

export function getShopOSDesktopVersion(): string | null {
  return window.shopOSDesktop?.version ?? null;
}

export function isKioskMode(): boolean {
  if (typeof window === "undefined") return false;
  if (isShopOSDesktop()) return true;
  return new URLSearchParams(window.location.search).get("kiosk") === "1";
}
