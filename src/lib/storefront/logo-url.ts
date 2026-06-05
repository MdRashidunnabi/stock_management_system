/** Public URL for a path in the storefront-logos bucket. */
export function publicStorefrontLogoUrl(storagePath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!base) return storagePath;
  const path = storagePath.replace(/^\//, "");
  return `${base}/storage/v1/object/public/storefront-logos/${path}`;
}

/** Resolve logo for display (absolute storage URL or same-origin path). */
export function resolveStorefrontLogoUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const trimmed = url.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("/")) {
    return trimmed;
  }
  return publicStorefrontLogoUrl(trimmed);
}
