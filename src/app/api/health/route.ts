import { NextResponse } from "next/server";

/**
 * Public health endpoint. Used by monitoring (UptimeRobot, Better Uptime, etc.)
 * and by Vercel's health checks. Does not check the database (we will add a
 * separate /api/health/db endpoint later).
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "shopos",
      time: new Date().toISOString(),
      env: process.env.NEXT_PUBLIC_APP_ENV ?? "unknown",
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
