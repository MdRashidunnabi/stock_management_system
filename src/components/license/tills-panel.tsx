"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Monitor, ShieldOff, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { restoreTillAction, revokeTillAction } from "@/lib/license/actions";
import type { PosDeviceRow } from "@/lib/license/types";
import { getSafeActionError } from "@/lib/parse-safe-action-result";
import { formatTillLabel } from "@/lib/pos/shifts";

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function TillsPanel({ devices }: { devices: PosDeviceRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(kind: "revoke" | "restore", deviceId: string) {
    startTransition(async () => {
      const res =
        kind === "revoke"
          ? await revokeTillAction({ deviceId })
          : await restoreTillAction({ deviceId });
      const err = getSafeActionError(res);
      if (err) {
        toast.error(err);
        return;
      }
      toast.success(kind === "revoke" ? "Till revoked" : "Till restored");
      router.refresh();
    });
  }

  if (devices.length === 0) {
    return <p className="text-muted-foreground text-sm">No tills yet.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Till</TableHead>
          <TableHead>Last check-in</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {devices.map((row) => {
          const revoked = Boolean(row.revoked_at);
          return (
            <TableRow key={row.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Monitor className="text-muted-foreground size-4 shrink-0" />
                  <div>
                    <p className="font-medium">{formatTillLabel(row.till_number)}</p>
                    <p className="text-muted-foreground font-mono text-[11px]">
                      {row.device_id.slice(0, 8)}…
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {formatWhen(row.last_heartbeat_at)}
              </TableCell>
              <TableCell>
                {revoked ? (
                  <Badge variant="destructive">Revoked</Badge>
                ) : (
                  <Badge variant="secondary">Active</Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
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
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
