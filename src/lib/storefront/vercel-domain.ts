import "server-only";

import type { DomainRecord, ShopDomainStatus } from "@/lib/storefront/shop-domain";

export type { DomainRecord, ShopDomainStatus };

const PROJECT_ID = process.env.VERCEL_PROJECT_ID?.trim() || "prj_KAylJnDtOcpULHmtgZW0YQkghaYm";
const TEAM_ID = process.env.VERCEL_TEAM_ID?.trim() || "team_2t1rZ1wKWEToZ1KIof8qdyyD";

type VercelError = { error?: { message?: string; code?: string } };
type VercelDomain = {
  name?: string;
  verified?: boolean;
  verification?: Array<{ type?: string; domain?: string; value?: string }>;
};
type VercelConfig = {
  misconfigured?: boolean;
  recommendedIPv4?: Array<{ value?: string[] }>;
  recommendedCNAME?: Array<{ value?: string }>;
};

export function normalizeShopDomain(raw: string | null | undefined): string | null {
  const value = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "")
    .replace(/^www\./, "");
  if (!value || value.length > 253 || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(value)) return null;
  if (value.endsWith(".vercel.app") || value === "localhost") return null;
  return value;
}

function token(): string | null {
  const value = process.env.VERCEL_TOKEN?.trim();
  return value || null;
}

function domainNames(apex: string): string[] {
  return [apex, `www.${apex}`];
}

/** Attach the shop domain on Vercel so the certificate can be issued. */
export async function connectShopDomain(raw: string | null): Promise<ShopDomainStatus | null> {
  const domain = normalizeShopDomain(raw);
  if (!domain) return null;
  if (!token()) {
    return {
      domain,
      attached: false,
      verified: false,
      live: false,
      records: fallbackRecords(domain),
      message:
        "The domain is saved. The server still needs its hosting key before it can attach the certificate.",
    };
  }
  for (const name of domainNames(domain)) {
    await addProjectDomain(name);
  }
  return readShopDomain(domain);
}

export async function readShopDomain(raw: string | null): Promise<ShopDomainStatus | null> {
  const domain = normalizeShopDomain(raw);
  if (!domain) return null;
  if (!token()) return connectShopDomain(domain);
  const [apex, config] = await Promise.all([getProjectDomain(domain), getDomainConfig(domain)]);
  const records = recordsFor(domain, apex, config);
  const verified = Boolean(apex?.verified);
  const live = verified && config?.misconfigured === false;
  return {
    domain,
    attached: Boolean(apex),
    verified,
    live,
    records,
    message: live
      ? `https://${domain} opens this shop. The certificate is active.`
      : verified
        ? "The domain is attached. Finish the DNS records below and the certificate will finish by itself."
        : "The domain is attached to this website. Add the DNS records below at the company that sold the domain. The certificate is issued when those records are in place.",
  };
}

export async function disconnectShopDomain(raw: string | null): Promise<void> {
  const domain = normalizeShopDomain(raw);
  if (!domain || !token()) return;
  await Promise.all(domainNames(domain).map((name) => removeProjectDomain(name)));
}

async function addProjectDomain(name: string): Promise<void> {
  const res = await vercel(`/v10/projects/${PROJECT_ID}/domains`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  if (res.ok || res.status === 409) {
    await vercel(`/v9/projects/${PROJECT_ID}/domains/${encodeURIComponent(name)}/verify`, {
      method: "POST",
    });
    return;
  }
  const body = (await res.json().catch(() => ({}))) as VercelError;
  const code = body.error?.code ?? "";
  if (code === "domain_already_in_use" || code === "forbidden") {
    throw new Error(
      body.error?.message ||
        "This domain is already used by another website. Remove it there first.",
    );
  }
  throw new Error(body.error?.message || "Could not attach this domain.");
}

async function getProjectDomain(name: string): Promise<VercelDomain | null> {
  const res = await vercel(`/v9/projects/${PROJECT_ID}/domains/${encodeURIComponent(name)}`);
  if (res.status === 404) return null;
  if (!res.ok) return null;
  return (await res.json()) as VercelDomain;
}

async function getDomainConfig(name: string): Promise<VercelConfig | null> {
  const res = await vercel(`/v6/domains/${encodeURIComponent(name)}/config`);
  if (!res.ok) return null;
  return (await res.json()) as VercelConfig;
}

async function removeProjectDomain(name: string): Promise<void> {
  await vercel(`/v9/projects/${PROJECT_ID}/domains/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
}

function recordsFor(
  domain: string,
  apex: VercelDomain | null,
  config: VercelConfig | null,
): DomainRecord[] {
  const records: DomainRecord[] = [];
  for (const row of apex?.verification ?? []) {
    if (row.type && row.domain && row.value) {
      records.push({ type: row.type, host: row.domain, value: row.value });
    }
  }
  const ips = config?.recommendedIPv4?.[0]?.value?.length
    ? config.recommendedIPv4[0].value
    : ["216.198.79.1", "64.29.17.1"];
  const cname = (config?.recommendedCNAME?.[0]?.value || "cname.vercel-dns.com").replace(/\.$/, "");
  for (const ip of ips) records.push({ type: "A", host: "@", value: ip });
  records.push({ type: "CNAME", host: "www", value: cname });
  if (records.length === 2 && domain) return records;
  return records;
}

function fallbackRecords(domain: string): DomainRecord[] {
  return recordsFor(domain, null, null);
}

async function vercel(path: string, init?: RequestInit): Promise<Response> {
  const key = token();
  if (!key) throw new Error("Hosting key is missing.");
  const url = new URL(`https://api.vercel.com${path}`);
  url.searchParams.set("teamId", TEAM_ID);
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}
