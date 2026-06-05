"use client";

import { useEffect } from "react";
import { isKioskMode, isShopOSDesktop } from "@/lib/desktop/client";

/**
 * Enables till-friendly layout: hide sidebar, widen POS content.
 * Active when running in Electron or when `?kiosk=1` is in the URL.
 */
export function DesktopShell() {
  useEffect(() => {
    const kiosk = isKioskMode();
    const desktop = isShopOSDesktop();
    if (kiosk) {
      document.documentElement.dataset.shoposKiosk = "true";
    } else {
      delete document.documentElement.dataset.shoposKiosk;
    }
    if (desktop) {
      document.documentElement.dataset.shoposDesktop = "true";
    } else {
      delete document.documentElement.dataset.shoposDesktop;
    }
    return () => {
      delete document.documentElement.dataset.shoposKiosk;
      delete document.documentElement.dataset.shoposDesktop;
    };
  }, []);

  return null;
}
