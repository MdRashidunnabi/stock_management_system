import type { LicenseLease } from "@/lib/license/lease";

export type HeartbeatOk = {
  ok: true;
  lease: LicenseLease;
  signature: string;
  verifyKey: string;
  canSell: boolean;
};

export type HeartbeatErr = {
  ok: false;
  code?: string;
  error: string;
};

export async function heartbeatTill(input: {
  deviceId: string;
  label?: string;
}): Promise<HeartbeatOk | HeartbeatErr> {
  const res = await fetch("/api/license/heartbeat", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      deviceId: input.deviceId,
      label: input.label ?? null,
    }),
  });
  const body = (await res.json().catch(() => null)) as HeartbeatOk | HeartbeatErr | null;
  if (!body) {
    return { ok: false, error: "Could not reach ShopOS to activate this till." };
  }
  if (!res.ok && body.ok !== true) {
    return {
      ok: false,
      code: "code" in body ? body.code : undefined,
      error: "error" in body ? body.error : "This till could not be licensed.",
    };
  }
  return body;
}
