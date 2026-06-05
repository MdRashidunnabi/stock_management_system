"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/auth/tenant";
import { publicStorefrontLogoUrl } from "@/lib/storefront/logo-url";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"]);

const SETTINGS_ROLES = new Set(["owner", "manager", "super_admin"]);

export async function uploadStorefrontLogo(
  formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const tenant = await getCurrentTenant();
  if (!tenant) return { ok: false, error: "Not signed in." };
  if (!SETTINGS_ROLES.has(tenant.role)) {
    return { ok: false, error: "You don't have permission to change shop branding." };
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return { ok: false, error: "No image file selected." };
  }
  if (!ALLOWED.has(file.type)) {
    return { ok: false, error: "Use JPEG, PNG, WebP, GIF, or SVG." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "Logo must be 5 MB or smaller." };
  }

  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : file.type === "image/gif"
          ? "gif"
          : file.type === "image/svg+xml"
            ? "svg"
            : "jpg";
  const path = `${tenant.tenantId}/logo-${Date.now()}.${ext}`;

  const supabase = await createClient();
  const { error: uploadErr } = await supabase.storage.from("storefront-logos").upload(path, file, {
    cacheControl: "3600",
    upsert: true,
    contentType: file.type,
  });

  if (uploadErr) {
    return {
      ok: false,
      error: uploadErr.message.includes("Bucket not found")
        ? "Logo storage is not set up. Run: npx supabase migration up --local"
        : uploadErr.message,
    };
  }

  const url = publicStorefrontLogoUrl(path);
  const { error: dbErr } = await supabase
    .from("tenant_storefronts")
    .update({ logo_url: url })
    .eq("tenant_id", tenant.tenantId);

  if (dbErr) return { ok: false, error: dbErr.message };

  revalidatePath("/settings/storefront");
  revalidatePath(`/shop/${tenant.tenantSlug}`);

  return { ok: true, url };
}
