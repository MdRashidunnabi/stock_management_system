"use server";

import { getPublicOrderTracking } from "@/lib/storefront/admin-queries";
import { publicOrderTrackSchema } from "@/lib/storefront/staff-schemas";
import { hitRateLimit } from "@/lib/security/rate-limit";

export async function getPublicOrderTrackingAction(input: unknown) {
  const parsed = publicOrderTrackSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Enter your order number and phone." };
  }
  const gate = hitRateLimit(`track:${parsed.data.shopSlug}`, 40, 10 * 60 * 1000);
  if (!gate.ok) {
    return { ok: false as const, error: "Too many tracking lookups. Please wait a minute." };
  }
  const order = await getPublicOrderTracking(
    parsed.data.shopSlug,
    parsed.data.orderNumber,
    parsed.data.phone,
  );
  if (!order) {
    return {
      ok: false as const,
      error: "We could not find that order. Check the number and phone.",
    };
  }
  return { ok: true as const, order };
}
