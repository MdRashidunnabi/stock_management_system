"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldOff, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { platformRestoreTillAction, platformRevokeTillAction } from "@/lib/license/actions";
import type { PosDeviceRow } from "@/lib/license/types";
import { getSafeActionError } from "@/lib/parse-safe-action-result";

export function PlatformTillsPanel({
  tenantId,
  devices,
}: {
  tenantId: string;
  devices: PosDeviceRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(kind: "revoke" | "restore", deviceId: string) {
    startTransition(async () => {
      const res =
        kind === "revoke"
          ? await platformRevokeTillAction({ tenantId, deviceId })
          : await platformRestoreTillAction({ tenantId, deviceId });
      const err = getSafeActionError(res);
      if (err) {
        toast.error(err);
        return;
      }
      toast.success(kind === "revoke" ? "Till revoked" : "Till restored");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registered tills</CardTitle>
        <p className="text-muted-foreground text-sm">
          Revoke a stolen or unpaid till. It cannot get a new sell lease until restored.
        </p>
      </CardHeader>
      <CardContent>
        {devices.length === 0 ? (
          <p className="text-muted-foreground text-sm">No tills have checked in.</p>
        ) : (
          <ul className="space-y-3">
            {devices.map((row) => {
              const revoked = Boolean(row.revoked_at);
              return (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{row.label || "Till"}</p>
                    <p className="text-muted-foreground font-mono text-[11px]">{row.device_id}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {revoked ? (
                      <Badge variant="destructive">Revoked</Badge>
                    ) : (
                      <Badge variant="secondary">Active</Badge>
                    )}
                    {revoked ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => run("restore", row.device_id)}
                      >
                        {pending ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="size-3.5" />
                        )}
                        Restore
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={pending}
                        onClick={() => run("revoke", row.device_id)}
                      >
                        {pending ? (
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
        )}
      </CardContent>
    </Card>
  );
}
