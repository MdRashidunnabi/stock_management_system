const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isCanonicalUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

/** Only "new" or a UUID may appear as a storage folder under the tenant. */
export function storageObjectSegment(value: string, fallback = "new"): string {
  const v = value.trim();
  if (v === "new") return "new";
  if (UUID_RE.test(v)) return v.toLowerCase();
  return fallback;
}

export function fileNameSegment(name: string, max = 80): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, max);
}

export function tenantObjectPath(tenantId: string, ...parts: string[]): string {
  if (!UUID_RE.test(tenantId)) {
    throw new Error("Invalid tenant storage prefix.");
  }
  const segs = parts.map((p) => fileNameSegment(p)).filter((p) => p.length > 0);
  return [tenantId.toLowerCase(), ...segs].join("/");
}
