"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { placeOnlineOrderSchema } from "@/lib/storefront/schemas";

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
  } = parsed.data;

  const admin = createAdminClient();

  const { data, error } = await admin.rpc("commit_online_order", {
    p_tenant_slug: shopSlug.trim().toLowerCase(),
    p_items: items.map((i) => ({ product_id: i.productId, qty: i.qty })),
    p_customer: {
      name: customerName.trim(),
      phone: customerPhone.trim(),
      email: customerEmail?.trim() || undefined,
      fulfillment,
      payment_method: paymentMethod,
      address: fulfillment === "delivery" ? deliveryAddress?.trim() : undefined,
      pickup_at: fulfillment === "takeaway" ? pickupAt?.trim() : undefined,
      notes: notes?.trim() || undefined,
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
    return { ok: false, error: msg };
  }

  const row = data?.[0];
  if (!row) {
    return { ok: false, error: "Order could not be placed. Please try again." };
  }

  revalidatePath(`/shop/${shopSlug.trim().toLowerCase()}`);
  revalidatePath("/online-orders");
  revalidatePath("/sales");
  revalidatePath("/products");

  return {
    ok: true,
    orderId: row.online_order_id,
    orderNumber: row.order_number,
    total: Number(row.total),
    deliveryFee: Number(row.delivery_fee ?? 0),
    productsTotal: Number(row.products_total ?? row.total),
  };
}
