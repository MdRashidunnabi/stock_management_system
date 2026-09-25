"use client";

import { Lock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useTillLicense } from "@/components/license/license-heartbeat";

export function TillLockedNotice() {
  const { ready, canSell, reason, refreshing, refresh } = useTillLicense();
  if (!ready || canSell) return null;

  return (
    <Alert variant="destructive">
      <Lock className="size-4" />
      <AlertTitle>Till locked</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
        <span>{reason}</span>
        <Button size="sm" variant="secondary" disabled={refreshing} onClick={() => void refresh()}>
          Try again
        </Button>
      </AlertDescription>
    </Alert>
  );
}
