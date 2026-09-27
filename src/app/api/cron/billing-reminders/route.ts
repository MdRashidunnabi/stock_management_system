import { NextResponse } from "next/server";
import { runExpiryReminders } from "@/lib/billing/run-expiry-reminders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization");
  if (secret && auth === `Bearer ${secret}`) return true;
  if (request.headers.get("x-vercel-cron") === "1") return true;
  return false;
}

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runExpiryReminders();
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json({ error: "Reminder run failed." }, { status: 500 });
  }
}
