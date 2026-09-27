"use client";

import Link from "next/link";
import { KeyRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTillLicense } from "@/components/license/license-heartbeat";
import { formatDateTime, formatMoney } from "@/lib/utils";
import { formatShiftLabel, formatTillLabel } from "@/lib/pos/shifts";
import { interpolate } from "@/lib/i18n/messages";
import type { OpenTillSession } from "@/lib/pos/sessions/schemas";

export function ThisTillBanner({
  sessions,
  defaultBranchId,
  timezone,
  locale,
  currency,
  labels,
}: {
  sessions: OpenTillSession[];
  defaultBranchId: string | null;
  timezone: string;
  locale: string;
  currency: string;
  labels: { tillOpen: string; openTill: string; since: string };
}) {
  const { deviceId, ready } = useTillLicense();
  const mine = ready && deviceId ? sessions.find((s) => s.device_id === deviceId) : undefined;

  if (!ready) {
    return <div className="h-10 w-40" aria-hidden />;
  }

  if (mine) {
    return (
      <Link
        href={`/sessions/${mine.id}`}
        className="border-border bg-card hover:bg-accent flex items-center gap-3 rounded-md border px-3 py-2 text-xs"
      >
        <Badge variant="default">{labels.tillOpen}</Badge>
        <span className="text-muted-foreground">
          {formatTillLabel(mine.till_number)} · {formatShiftLabel(mine.shift_code)} ·{" "}
          {interpolate(labels.since, {
            when: formatDateTime(mine.opened_at, timezone, locale),
            amount: formatMoney(mine.opening_cash, currency, locale),
          })}
        </span>
      </Link>
    );
  }

  return (
    <Link
      href={`/sessions/open${defaultBranchId ? `?branch=${defaultBranchId}` : ""}`}
      className="border-input bg-card hover:bg-accent inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium"
    >
      <KeyRound className="size-4" /> {labels.openTill}
    </Link>
  );
}
