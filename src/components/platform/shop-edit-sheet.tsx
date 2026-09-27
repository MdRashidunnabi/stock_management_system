"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { TenantAdminPanel } from "@/components/platform/tenant-admin-panel";
import { PlatformTillsPanel } from "@/components/license/platform-tills-panel";
import { PlatformTeamCreateForm } from "@/components/platform/platform-team-create-form";
import { PlatformTeamMemberRow } from "@/components/platform/platform-team-member-row";
import { loadShopEditData, type ShopEditPayload } from "@/lib/platform/shop-edit-data";

export function ShopEditSheet({
  tenantId,
  shopName,
  open,
  onOpenChange,
}: {
  tenantId: string | null;
  shopName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [payload, setPayload] = useState<ShopEditPayload | null>(null);

  useEffect(() => {
    if (!open || !tenantId) return;
    let cancelled = false;
    void loadShopEditData(tenantId)
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          toast.error("Could not load shop controls.");
          onOpenChange(false);
          return;
        }
        setPayload(data);
      })
      .catch(() => {
        if (!cancelled) toast.error("Could not load shop controls.");
      });
    return () => {
      cancelled = true;
    };
    // onOpenChange is a parent setter; omitting it avoids reload loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tenantId]);

  async function reload() {
    if (!tenantId) return;
    const data = await loadShopEditData(tenantId);
    if (data) setPayload(data);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="pointer-events-auto overflow-y-auto pb-24 sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{payload?.displayName ?? shopName ?? "Shop"}</SheetTitle>
          <SheetDescription>
            Extra controls for status, billing, tills, and team. The table row already shows the
            live summary.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-6 px-4 pb-6">
          {open && !payload ? (
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" />
              Loading…
            </div>
          ) : payload ? (
            <>
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Billing and access</h3>
                <TenantAdminPanel
                  tenantId={payload.tenantId}
                  status={payload.status}
                  embedded
                  onUpdated={(status) => {
                    setPayload((prev) => (prev ? { ...prev, status } : prev));
                    void reload();
                  }}
                />
              </section>
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Tills</h3>
                <PlatformTillsPanel
                  tenantId={payload.tenantId}
                  devices={payload.devices}
                  embedded
                  onUpdated={() => void reload()}
                />
              </section>
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Team</h3>
                {payload.members.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No team members.</p>
                ) : (
                  <ul className="text-sm">
                    {payload.members.map((m) => (
                      <PlatformTeamMemberRow
                        key={`${m.user_id}-${m.role}-${m.is_active}`}
                        tenantId={payload.tenantId}
                        member={m}
                        lastOwner={
                          m.role === "owner" &&
                          m.is_active &&
                          payload.members.filter((x) => x.role === "owner" && x.is_active).length <=
                            1
                        }
                        onUpdated={() => void reload()}
                      />
                    ))}
                  </ul>
                )}
                <PlatformTeamCreateForm
                  tenantId={payload.tenantId}
                  onCreated={() => void reload()}
                />
              </section>
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
