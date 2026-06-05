/** Build a public URL for a file in the product-images bucket. */
export function publicProductImageUrl(storagePath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!base) return storagePath;
  const path = storagePath.replace(/^\//, "");
  return `${base}/storage/v1/object/public/product-images/${path}`;
}
