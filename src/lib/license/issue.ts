import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantSubscriptionAccess } from "@/lib/billing/queries";
import { LICENSE_GRACE_DAYS, LICENSE_LEASE_HOURS, type LicenseLease } from "@/lib/license/lease";
import { signLicenseLease } from "@/lib/license/sign";
import type { PosDeviceRow } from "@/lib/license/types";
import { MAX_TILLS_PER_BRANCH } from "@/lib/pos/shifts";

export type IssuedLicense = {
  lease: LicenseLease;
  signature: string;
};

export type { PosDeviceRow };

function devices() {
  return createAdminClient().from("pos_devices");
}

export async function issueDeviceLicense(input: {
  tenantId: string;
  deviceId: string;
  label?: string | null;
  userAgent?: string | null;
  branchId?: string | null;
}): Promise<IssuedLicense> {
  const deviceId = input.deviceId.trim().slice(0, 80);
  if (deviceId.length < 8) {
    throw new Error("This till could not be identified.");
  }

  const maxDevices = MAX_TILLS_PER_BRANCH;
  const access = await getTenantSubscriptionAccess(input.tenantId);
  const { data: existing, error: listError } = await devices()
    .select("id, device_id, revoked_at, branch_id")
    .eq("tenant_id", input.tenantId);
  if (listError) throw new Error(listError.message);

  const rows = existing ?? [];
  const thisRow = rows.find((r) => r.device_id === deviceId);
  if (thisRow?.revoked_at) {
    throw new Error("This till was revoked. Ask the shop owner to restore it.");
  }

  const branchId = input.branchId?.trim() || thisRow?.branch_id || null;
  if (branchId) {
    const activeOnBranch = rows.filter(
      (r) => r.device_id !== deviceId && !r.revoked_at && r.branch_id === branchId,
    );
    if (!thisRow && activeOnBranch.length >= maxDevices) {
      throw new Error(
        `This branch already has ${maxDevices} tills. Revoke one in Settings before adding another.`,
      );
    }
    if (thisRow && thisRow.branch_id !== branchId && activeOnBranch.length >= maxDevices) {
      throw new Error(
        `This branch already has ${maxDevices} tills. Revoke one in Settings before adding another.`,
      );
    }
  }

  const nowIso = new Date().toISOString();
  if (thisRow) {
    const { error } = await devices()
      .update({
        last_heartbeat_at: nowIso,
        user_agent: input.userAgent ?? null,
        ...(input.label ? { label: input.label } : {}),
        ...(branchId ? { branch_id: branchId } : {}),
      })
      .eq("id", thisRow.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await devices().insert({
      tenant_id: input.tenantId,
      device_id: deviceId,
      label: input.label || "Till",
      user_agent: input.userAgent ?? null,
      last_heartbeat_at: nowIso,
      branch_id: branchId,
    });
    if (error) {
      if (error.code === "23505") {
        const { error: updErr } = await devices()
          .update({
            last_heartbeat_at: nowIso,
            user_agent: input.userAgent ?? null,
            ...(input.label ? { label: input.label } : {}),
            ...(branchId ? { branch_id: branchId } : {}),
          })
          .eq("tenant_id", input.tenantId)
          .eq("device_id", deviceId);
        if (updErr) throw new Error(updErr.message);
      } else {
        throw new Error(error.message);
      }
    }
  }

  const canSell = Boolean(access?.canUseApp);
  const now = Date.now();
  const lease: LicenseLease = {
    v: 1,
    tenantId: input.tenantId,
    deviceId,
    status: access?.status ?? "unknown",
    canSell,
    issuedAt: now,
    validUntil: canSell ? now + LICENSE_LEASE_HOURS * 60 * 60 * 1000 : now,
    graceUntil: canSell ? now + LICENSE_GRACE_DAYS * 24 * 60 * 60 * 1000 : now,
    reason: canSell
      ? (access?.reason ?? null)
      : (access?.reason ?? "This shop is not licensed. Pay the ShopOS subscription to continue."),
  };

  return { lease, signature: signLicenseLease(lease) };
}

export async function listPosDevices(tenantId: string): Promise<PosDeviceRow[]> {
  const { data, error } = await devices()
    .select(
      "id, tenant_id, device_id, label, user_agent, last_heartbeat_at, revoked_at, created_at, branch_id, till_number",
    )
    .eq("tenant_id", tenantId)
    .order("last_heartbeat_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function revokePosDevice(tenantId: string, deviceId: string): Promise<void> {
  const { error } = await devices()
    .update({ revoked_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("device_id", deviceId);
  if (error) throw new Error(error.message);
}

export async function restorePosDevice(tenantId: string, deviceId: string): Promise<void> {
  const { error } = await devices()
    .update({ revoked_at: null })
    .eq("tenant_id", tenantId)
    .eq("device_id", deviceId);
  if (error) throw new Error(error.message);
}

export async function isPosDeviceRevoked(tenantId: string, deviceId: string): Promise<boolean> {
  const { data, error } = await devices()
    .select("revoked_at")
    .eq("tenant_id", tenantId)
    .eq("device_id", deviceId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data?.revoked_at);
}
