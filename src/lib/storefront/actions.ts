"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { placeOnlineOrderSchema } from "@/lib/storefront/schemas";
import { hitRateLimit } from "@/lib/security/rate-limit";
import { publicStorefrontOrderError } from "@/lib/security/public-error";
import { MIN_ADVANCE_DAYS, minAdvanceDateYmd } from "@/lib/reports/period";

export type PlaceOrderResult =
  | {
      ok: true;
      orderId: string;
      orderNumber: string;
      total: number;
      deliveryFee: number;
      productsTotal: number;
    }
  | { ok: false; error: string };

/**
 * Public checkout — uses service role to call commit_online_order.
 * Stock is deducted immediately (same pool as POS).
 */
export async function placeOnlineOrderAction(input: unknown): Promise<PlaceOrderResult> {
  const parsed = placeOnlineOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid order" };
  }

  const {
    shopSlug,
    items,
    customerName,
    customerPhone,
    customerEmail,
    fulfillment,
    paymentMethod,
    deliveryAddress,
    pickupAt,
    notes,
    clientUuid,
    wantedForDate,
    isAdvance,
  } = parsed.data;

  const wanted = wantedForDate?.trim() || "";
  const advance = Boolean(isAdvance && wanted);
  if (advance) {
    const min = minAdvanceDateYmd();
    if (wanted < min) {
      return {
        ok: false,
        error: `Advance orders need at least ${MIN_ADVANCE_DAYS} days' notice. Earliest date is ${min}.`,
      };
    }
  }

  const shopKey = shopSlug.trim().toLowerCase();
  const orderGate = hitRateLimit(`checkout:${shopKey}`, 30, 10 * 60 * 1000);
  if (!orderGate.ok) {
    return { ok: false, error: "Too many orders from this shop just now. Please wait a minute." };
  }

  const admin = createAdminClient();

  const { data, error } = await admin.rpc("commit_online_order", {
    p_tenant_slug: shopKey,
    p_items: items.map((i) => ({
      product_id: i.productId,
      qty: i.qty,
      unavailable_policy: i.ifUnavailable ?? "omit",
    })),
    p_customer: {
      name: customerName.trim(),
      phone: customerPhone.trim(),
      email: customerEmail?.trim() || undefined,
      fulfillment,
      payment_method: paymentMethod,
      address: fulfillment === "delivery" ? deliveryAddress?.trim() : undefined,
      pickup_at: fulfillment === "takeaway" ? pickupAt?.trim() : undefined,
      notes: notes?.trim() || undefined,
      wanted_for_date: advance ? wanted : undefined,
      is_advance: advance,
    },
    p_client_uuid: clientUuid ?? undefined,
  });

  if (error) {
    const msg = error.message;
    if (msg.includes("insufficient stock")) {
      return { ok: false, error: "Some items are no longer in stock. Please update your cart." };
    }
    if (msg.includes("shop not found") || msg.includes("not enabled")) {
      return { ok: false, error: "This online shop is not available." };
    }
    if (msg.includes("pickup")) {
      return { ok: false, error: "Please choose a collection date and time in the future." };
    }
    if (msg.includes("delivery address")) {
      return { ok: false, error: "Please enter your delivery address." };
    }
    return { ok: false, error: publicStorefrontOrderError(msg) };
  }

  const row = data?.[0];
  if (!row) {
    return { ok: false, error: "Order could not be placed. Please try again." };
  }

  if (advance || items.some((i) => i.ifUnavailable)) {
    await admin
      .from("online_orders")
      .update({
        wanted_for_date: advance ? wanted : null,
        is_advance: advance,
      })
      .eq("id", row.online_order_id);

    const { data: lines } = await admin
      .from("online_order_items")
      .select("id, product_id")
      .eq("online_order_id", row.online_order_id);
    const used = new Set<string>();
    for (const item of items) {
      const line = (lines ?? []).find((l) => l.product_id === item.productId && !used.has(l.id));
      if (!line) continue;
      used.add(line.id);
      await admin
        .from("online_order_items")
        .update({ unavailable_policy: item.ifUnavailable ?? "omit" })
        .eq("id", line.id);
    }
  }

  revalidatePath(`/shop/${shopKey}`);
  revalidatePath("/online-orders");
  revalidatePath("/sales");
  revalidatePath("/products");
  revalidatePath("/reports");

  return {
    ok: true,
    orderId: row.online_order_id,
    orderNumber: row.order_number,
    total: Number(row.total),
    deliveryFee: Number(row.delivery_fee ?? 0),
    productsTotal: Number(row.products_total ?? row.total),
  };
}
