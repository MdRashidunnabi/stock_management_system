"use server";

import { requirePlatformStaff } from "@/lib/platform/auth";
import { getPlatformTenantDetail } from "@/lib/billing/queries";
import { listPosDevices } from "@/lib/license/issue";
import type { PosDeviceRow } from "@/lib/license/types";

export type ShopEditPayload = {
  tenantId: string;
  displayName: string;
  slug: string;
  status: string;
  members: { user_id: string; email: string | null; role: string; is_active: boolean }[];
  devices: PosDeviceRow[];
};

export async function loadShopEditData(tenantId: string): Promise<ShopEditPayload | null> {
  await requirePlatformStaff();
  const detail = await getPlatformTenantDetail(tenantId);
  if (!detail) return null;
  const devices = await listPosDevices(tenantId);
  return {
    tenantId: detail.tenant.id,
    displayName: detail.tenant.display_name,
    slug: detail.tenant.slug,
    status: detail.tenant.status,
    members: detail.members.map((m) => ({
      user_id: m.user_id,
      email: m.email,
      role: m.role,
      is_active: m.is_active,
    })),
    devices,
  };
}
