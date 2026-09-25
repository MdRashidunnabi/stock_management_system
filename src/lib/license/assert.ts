import "server-only";

import { ActionError } from "@/lib/safe-action";
import { getTenantSubscriptionAccess } from "@/lib/billing/queries";
import { isPosDeviceRevoked } from "@/lib/license/issue";

export async function assertTenantCanSell(tenantId: string): Promise<void> {
  const access = await getTenantSubscriptionAccess(tenantId);
  if (!access?.canUseApp) {
    throw new ActionError(
      access?.reason ?? "This shop is not licensed. Pay the ShopOS subscription to continue.",
    );
  }
}

export async function assertTillMaySell(tenantId: string, deviceId?: string | null): Promise<void> {
  await assertTenantCanSell(tenantId);
  const id = deviceId?.trim();
  if (!id) return;
  if (await isPosDeviceRevoked(tenantId, id)) {
    throw new ActionError("This till was revoked. Ask the shop owner to restore it.");
  }
}
