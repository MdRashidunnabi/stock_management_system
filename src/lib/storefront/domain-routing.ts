import { NextResponse, type NextRequest } from "next/server";

const cache = new Map<string, { slug: string | null; at: number }>();
const CACHE_MS = 60_000;

/** Serve the public shop when a customer opens the shop's own domain. */
export async function rewriteShopHost(request: NextRequest): Promise<NextResponse | null> {
  const host = shopHost(request);
  if (!host || isPlatformHost(host)) return null;
  const path = request.nextUrl.pathname;
  if (path.startsWith("/shop/") || path.startsWith("/api/") || path.startsWith("/_next")) {
    return null;
  }
  if (path !== "/") return null;
  const slug = await slugForHost(host);
  if (!slug) return null;
  const url = request.nextUrl.clone();
  url.pathname = `/shop/${slug}`;
  return NextResponse.rewrite(url);
}

function shopHost(request: NextRequest): string {
  const raw = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  return raw.split(",")[0]?.trim().split(":")[0]?.toLowerCase().replace(/\.$/, "") ?? "";
}

function isPlatformHost(host: string): boolean {
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".vercel.app") ||
    host.endsWith(".vercel.sh")
  );
}

async function slugForHost(host: string): Promise<string | null> {
  const apex = host.replace(/^www\./, "");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(apex)) return null;
  const hit = cache.get(apex);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.slug;
  const slug = await lookupSlug(apex);
  cache.set(apex, { slug, at: Date.now() });
  return slug;
}

async function lookupSlug(domain: string): Promise<string | null> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return null;
  const url = new URL("/rest/v1/tenant_storefronts", base);
  url.searchParams.set("select", "tenants!inner(slug)");
  url.searchParams.set("custom_domain", `eq.${domain}`);
  url.searchParams.set("enabled", "eq.true");
  url.searchParams.set("limit", "1");
  try {
    const res = await fetch(url, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ tenants?: { slug?: string } | { slug?: string }[] }>;
    const tenant = rows[0]?.tenants;
    const row = Array.isArray(tenant) ? tenant[0] : tenant;
    return row?.slug ?? null;
  } catch {
    return null;
  }
}
