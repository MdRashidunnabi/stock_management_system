"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Download, ExternalLink, Monitor, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isShopOSDesktop, getShopOSDesktopVersion } from "@/lib/desktop/client";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DOWNLOAD_URL = process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL?.trim() || "";

function readDesktopEnv() {
  return {
    inDesktop: isShopOSDesktop(),
    desktopVersion: getShopOSDesktopVersion(),
    pwaInstalled: window.matchMedia("(display-mode: standalone)").matches,
  };
}

export function DesktopAppPanel() {
  const [{ inDesktop, desktopVersion, pwaInstalled: initialPwaInstalled }] =
    useState(readDesktopEnv);
  const [pwaInstalled, setPwaInstalled] = useState(initialPwaInstalled);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onBip = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  const installPwa = useCallback(async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === "accepted") {
      setInstallEvent(null);
      setPwaInstalled(true);
    }
  }, [installEvent]);

  if (inDesktop) {
    return (
      <div className="space-y-3">
        <p className="text-muted-foreground text-sm">
          You are running <strong>ShopOS Desktop</strong>
          {desktopVersion ? ` v${desktopVersion}` : ""}. Updates to POS and stock sync when you are
          online; offline sales queue locally like the browser PWA.
        </p>
        <Button variant="outline" asChild>
          <Link href="/pos?kiosk=1">Open POS (kiosk)</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Monitor className="size-4" />
          Windows desktop app
        </p>
        <p className="text-muted-foreground text-sm">
          Install ShopOS on a till PC. Same login as the web app; opens POS in kiosk mode with
          barcode-friendly full screen.
        </p>
        {DOWNLOAD_URL ? (
          <Button asChild>
            <a href={DOWNLOAD_URL} download rel="noopener noreferrer">
              <Download className="size-4" />
              Download ShopOS for Windows (.exe)
            </a>
          </Button>
        ) : (
          <div className="space-y-2">
            <Button variant="outline" disabled>
              <Download className="size-4" />
              Download for Windows — build the installer first
            </Button>
            <p className="text-muted-foreground text-xs">
              Developers: see{" "}
              <code className="bg-muted rounded px-1 py-0.5 text-[11px]">
                apps/desktop/README.md
              </code>
              , then set{" "}
              <code className="bg-muted rounded px-1 py-0.5 text-[11px]">
                NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL
              </code>{" "}
              to the hosted installer URL.
            </p>
          </div>
        )}
      </div>

      <div className="border-border space-y-2 border-t pt-4">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Smartphone className="size-4" />
          Install as app (PWA)
        </p>
        <p className="text-muted-foreground text-sm">
          In Chrome or Edge on Windows, install ShopOS from the browser menu for a desktop shortcut
          without the .exe. Starts at <strong>/pos</strong> with offline support.
        </p>
        {pwaInstalled ? (
          <p className="text-sm text-emerald-700 dark:text-emerald-400">
            App is installed on this device.
          </p>
        ) : installEvent ? (
          <Button variant="secondary" onClick={() => void installPwa()}>
            Install ShopOS (PWA)
          </Button>
        ) : (
          <p className="text-muted-foreground text-xs">
            Open{" "}
            <Link href="/pos" className="text-primary underline">
              /pos
            </Link>{" "}
            in Chrome or Edge; use the install icon in the address bar when it appears.
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" asChild>
          <Link href="/pos">
            <ExternalLink className="size-4" />
            Open web POS
          </Link>
        </Button>
      </div>
    </div>
  );
}
