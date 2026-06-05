"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/auth/tenant";
import { publicProductImageUrl } from "@/lib/catalog/products/image-url";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function uploadProductImage(
  formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const tenant = await getCurrentTenant();
  if (!tenant) return { ok: false, error: "Not signed in." };
  if (!["owner", "manager", "warehouse"].includes(tenant.role)) {
    return { ok: false, error: "You don't have permission to upload images." };
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return { ok: false, error: "No image file selected." };
  }
  if (!ALLOWED.has(file.type)) {
    return { ok: false, error: "Use JPEG, PNG, WebP, or GIF." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "Image must be 5 MB or smaller." };
  }

  const productId = String(formData.get("productId") ?? "new");
  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : file.type === "image/gif"
          ? "gif"
          : "jpg";
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  const path = `${tenant.tenantId}/${productId}/${Date.now()}-${safeName || `image.${ext}`}`;

  const supabase = await createClient();
  const { error } = await supabase.storage.from("product-images").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });

  if (error) {
    return {
      ok: false,
      error: error.message.includes("Bucket not found")
        ? "Image storage is not set up. Run: npx supabase migration up --local"
        : error.message,
    };
  }

  return { ok: true, url: publicProductImageUrl(path) };
}
