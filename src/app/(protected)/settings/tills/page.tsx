import type { Metadata } from "next";
import { Monitor } from "lucide-react";
import { requireRole } from "@/lib/auth/tenant";
import { listPosDevices } from "@/lib/license/issue";
import { TillsPanel } from "@/components/license/tills-panel";
import { MAX_TILLS_PER_BRANCH } from "@/lib/pos/shifts";

export const metadata: Metadata = { title: "Tills" };

export default async function TillsSettingsPage() {
  const tenant = await requireRole(["owner", "manager"]);
  const devices = await listPosDevices(tenant.tenantId);
  const cap = MAX_TILLS_PER_BRANCH;
  const active = devices.filter((d) => !d.revoked_at).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold" data-guide="tills">
          <Monitor className="size-6" />
          Tills
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {active} of {cap} per branch
        </p>
      </div>
      <TillsPanel devices={devices} />
    </div>
  );
}
