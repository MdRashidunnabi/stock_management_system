import { NextResponse } from "next/server";
import { getCurrentUser, getCurrentTenant } from "@/lib/auth/tenant";
import { issueDeviceLicense } from "@/lib/license/issue";
import { getLicensePublicKeySpkiB64 } from "@/lib/license/sign";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Sign in to activate this till." },
      { status: 401 },
    );
  }

  const tenant = await getCurrentTenant();
  if (!tenant) {
    return NextResponse.json({ ok: false, error: "No active shop." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    deviceId?: string;
    label?: string | null;
  } | null;

  const deviceId = typeof body?.deviceId === "string" ? body.deviceId.trim() : "";
  if (deviceId.length < 8) {
    return NextResponse.json(
      { ok: false, error: "This till could not be identified." },
      { status: 400 },
    );
  }

  try {
    const issued = await issueDeviceLicense({
      tenantId: tenant.tenantId,
      deviceId,
      label: typeof body?.label === "string" ? body.label.slice(0, 80) : "Till",
      userAgent: request.headers.get("user-agent"),
    });
    return NextResponse.json({
      ok: true,
      lease: issued.lease,
      signature: issued.signature,
      verifyKey: getLicensePublicKeySpkiB64(),
      canSell: issued.lease.canSell,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "This till could not be licensed.";
    const revoked = /revoked/i.test(message);
    return NextResponse.json(
      { ok: false, code: revoked ? "revoked" : "error", error: message },
      { status: revoked ? 403 : 400 },
    );
  }
}
