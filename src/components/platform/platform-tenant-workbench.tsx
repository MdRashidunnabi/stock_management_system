"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ShopEditSheet } from "@/components/platform/shop-edit-sheet";
import { platformRestoreTillAction, platformRevokeTillAction } from "@/lib/license/actions";
import { getSafeActionError } from "@/lib/parse-safe-action-result";
import type { PosDeviceRow } from "@/lib/license/types";

type Member = { user_id: string; email: string | null; role: string };

export function PlatformTenantWorkbench({
  tenantId,
  displayName,
  slug,
  status,
  cardLabel,
  monthlyLabel,
  members,
  devices,
}: {
  tenantId: string;
  displayName: string;
  slug: string;
  status: string;
  cardLabel: string;
  monthlyLabel: string;
  members: Member[];
  devices: PosDeviceRow[];
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function tillAction(kind: "revoke" | "restore", deviceId: string) {
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
    <>
      <div className="border-border overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Details</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="bg-background sticky right-0 text-right"> </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="text-muted-foreground">Shop</TableCell>
              <TableCell>
                <p className="font-medium">{displayName}</p>
                <p className="text-muted-foreground text-xs">{slug}</p>
              </TableCell>
              <TableCell>
                {monthlyLabel}
                {cardLabel ? ` · ${cardLabel}` : ""}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="capitalize">
                  {status.replace("_", " ")}
                </Badge>
              </TableCell>
              <TableCell className="bg-background sticky right-0 text-right">
                <Button type="button" size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                  <Pencil className="size-3.5" />
                  Edit
                </Button>
              </TableCell>
            </TableRow>
            {devices.map((row) => {
              const revoked = Boolean(row.revoked_at);
              const name = `${row.label || "Till"}${row.till_number != null ? ` ${row.till_number}` : ""}`;
              return (
                <TableRow key={row.id}>
                  <TableCell className="text-muted-foreground">Till</TableCell>
                  <TableCell className="font-medium">{name}</TableCell>
                  <TableCell className="font-mono text-xs">{row.device_id}</TableCell>
                  <TableCell>
                    {revoked ? (
                      <Badge variant="destructive">Revoked</Badge>
                    ) : (
                      <Badge variant="secondary">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell className="bg-background sticky right-0 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" size="sm" variant="outline" disabled={pending}>
                          {pending ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Pencil className="size-3.5" />
                          )}
                          Edit
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {revoked ? (
                          <DropdownMenuItem onClick={() => tillAction("restore", row.device_id)}>
                            Restore till
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => tillAction("revoke", row.device_id)}>
                            Revoke till
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
            {members.map((m) => (
              <TableRow key={m.user_id}>
                <TableCell className="text-muted-foreground">Team</TableCell>
                <TableCell className="font-medium">{m.email ?? "—"}</TableCell>
                <TableCell className="capitalize">{m.role.replace("_", " ")}</TableCell>
                <TableCell>
                  <Badge variant="outline">Member</Badge>
                </TableCell>
                <TableCell className="bg-background sticky right-0 text-right">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setEditOpen(true)}
                  >
                    <Pencil className="size-3.5" />
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ShopEditSheet
        tenantId={tenantId}
        shopName={displayName}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </>
  );
}
