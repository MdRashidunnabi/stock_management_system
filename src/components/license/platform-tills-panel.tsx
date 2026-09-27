"use client";

import { useState, useTransition } from "react";
import { Loader2, ShieldOff, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { platformRestoreTillAction, platformRevokeTillAction } from "@/lib/license/actions";
import type { PosDeviceRow } from "@/lib/license/types";
import { getSafeActionData, getSafeActionError } from "@/lib/parse-safe-action-result";

export function PlatformTillsPanel({
  tenantId,
  devices,
  embedded = false,
  onUpdated,
}: {
  tenantId: string;
  devices: PosDeviceRow[];
  embedded?: boolean;
  onUpdated?: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  function run(kind: "revoke" | "restore", deviceId: string) {
    setNotice(null);
    setBusyId(deviceId);
    startTransition(async () => {
      try {
        const res =
          kind === "revoke"
            ? await platformRevokeTillAction({ tenantId, deviceId })
            : await platformRestoreTillAction({ tenantId, deviceId });
        const err = getSafeActionError(res);
        if (err) {
          setNotice({ ok: false, text: err });
          toast.error(err);
          return;
        }
        const data = getSafeActionData<{ ok: true; message?: string }>(res);
        const text =
          data?.message ?? (kind === "revoke" ? "Till revoked." : "Till restored.");
        setNotice({ ok: true, text });
        toast.success(text);
        onUpdated?.();
      } finally {
        setBusyId(null);
      }
    });
  }

  const list =
    devices.length === 0 ? (
      <p className="text-muted-foreground text-sm">No tills have checked in.</p>
    ) : (
      <div className="relative z-10 space-y-3 pointer-events-auto">
        {notice ? (
          <Alert variant={notice.ok ? "default" : "destructive"}>
            <AlertDescription>{notice.text}</AlertDescription>
          </Alert>
        ) : null}
        <ul className="space-y-3">
          {devices.map((row) => {
            const revoked = Boolean(row.revoked_at);
            const busy = pending && busyId === row.device_id;
            return (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2"
              >
                <div>
                  <p className="text-sm font-medium">
                    {row.label || "Till"}
                    {row.till_number != null ? ` ${row.till_number}` : ""}
                  </p>
                  <p className="text-muted-foreground font-mono text-[11px]">{row.device_id}</p>
                </div>
                <div className="relative z-10 flex items-center gap-2">
                  {revoked ? (
                    <Badge variant="destructive">Revoked</Badge>
                  ) : (
                    <Badge variant="secondary">Active</Badge>
                  )}
                  {revoked ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => run("restore", row.device_id)}
                    >
                      {busy ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="size-3.5" />
                      )}
                      Restore
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={busy}
                      onClick={() => run("revoke", row.device_id)}
                    >
                      {busy ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <ShieldOff className="size-3.5" />
                      )}
                      Revoke
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );

  if (embedded) return list;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registered tills</CardTitle>
        <p className="text-muted-foreground text-sm">
          Revoke a stolen or unpaid till. It cannot get a new sell lease until restored.
        </p>
      </CardHeader>
      <CardContent>{list}</CardContent>
    </Card>
  );
}
