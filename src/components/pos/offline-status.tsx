"use client";

import { Cloud, CloudOff, Loader2, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  online: boolean;
  pendingCount: number;
  cachedCount: number;
  flushing: boolean;
  onFlush: () => void;
}

/**
 * Always-visible status pill for the POS header. Shows three things at once:
 *   - whether the device is currently online,
 *   - how many products are cached for offline search,
 *   - how many sales are queued for sync, with a manual "Sync now" button.
 */
export function PosOfflineStatus({ online, pendingCount, cachedCount, flushing, onFlush }: Props) {
  const tone = online
    ? pendingCount > 0
      ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
      : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
    : "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400";
  const label = online ? (pendingCount > 0 ? "Sync pending" : "Online") : "Offline";
  const Icon = online ? (pendingCount > 0 ? Cloud : Wifi) : CloudOff;

  return (
    <div className={cn("flex items-center gap-2 rounded-md border px-2 py-1 text-xs", tone)}>
      <Icon className="size-3.5" aria-hidden />
      <span className="font-medium">{label}</span>
      <span className="text-muted-foreground hidden sm:inline">·</span>
      <span className="text-muted-foreground hidden sm:inline">
        {cachedCount.toLocaleString()} cached
      </span>
      {pendingCount > 0 ? (
        <>
          <span className="text-muted-foreground">·</span>
          <span>{pendingCount} queued</span>
          {online ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              disabled={flushing}
              onClick={onFlush}
            >
              {flushing ? <Loader2 className="size-3 animate-spin" /> : <span>Sync now</span>}
            </Button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
