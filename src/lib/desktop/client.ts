/** Bridge exposed by `apps/desktop/preload.mjs` */
export type ShopOSDesktopBridge = {
  version: string;
  platform: string;
  isDesktop: true;
  openCashDrawer?: () => Promise<{ ok: boolean }> | { ok: boolean };
};

declare global {
  interface Window {
    shopOSDesktop?: ShopOSDesktopBridge;
    __SHOPOS_LICENSE_PUBKEY?: string;
  }
}

export function isShopOSDesktop(): boolean {
  return typeof window !== "undefined" && window.shopOSDesktop?.isDesktop === true;
}

export function getShopOSDesktopVersion(): string | null {
  if (typeof window === "undefined") return null;
  return window.shopOSDesktop?.version ?? null;
}

export function isKioskMode(): boolean {
  if (typeof window === "undefined") return false;
  if (isShopOSDesktop()) return true;
  return new URLSearchParams(window.location.search).get("kiosk") === "1";
}
