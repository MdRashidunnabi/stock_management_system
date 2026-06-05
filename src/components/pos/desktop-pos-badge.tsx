"use client";

import { useState } from "react";
import { Monitor } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getShopOSDesktopVersion, isShopOSDesktop } from "@/lib/desktop/client";

function desktopLabel(): string | null {
  if (!isShopOSDesktop()) return null;
  const v = getShopOSDesktopVersion();
  return v ? `Desktop v${v}` : "Desktop";
}

export function DesktopPosBadge() {
  const [label] = useState(desktopLabel);

  if (!label) return null;

  return (
    <Badge variant="secondary" className="gap-1 font-normal">
      <Monitor className="size-3" />
      {label}
    </Badge>
  );
}
