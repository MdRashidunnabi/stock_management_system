"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { placeOnlineOrderSchema } from "@/lib/storefront/schemas";
import { hitRateLimit } from "@/lib/security/rate-limit";
import { publicStorefrontOrderError } from "@/lib/security/public-error";
import { MIN_ADVANCE_DAYS, minAdvanceDateYmd } from "@/lib/reports/period";
import { parseVoucherNote, withVoucherNote } from "@/lib/vouchers/note";
import { earnedVoucherAmount, eligibleSpend, voucherDiscount } from "@/lib/vouchers/rules";

export type PlaceOrderResult =
  | {
      ok: true;
      orderId: string;
      orderNumber: string;
      total: number;
      deliveryFee: number;
      productsTotal: number;
      voucherDiscount: number;
      earnedVoucher: number;
      voucherWarning?: string;
    }
  | { ok: false; error: string };

async function rememberVoucherOnOrder(
  orderId: string,
  products: number,
  deliveryFee: number,
  code: string | undefined,
) {
  const admin = createAdminClient();
  const clean = code?.trim().toUpperCase() || "";
  let discount = 0;
  let warning: string | undefined;
  if (clean) {
    const { data: order } = await admin
      .from("online_orders")
      .select("tenant_id")
      .eq("id", orderId)
      .maybeSingle();
    const { data: rows } = await admin
      .from("online_orders")
      .select("id, notes")
      .eq("tenant_id", order?.tenant_id ?? "")
      .ilike("notes", `%code=${clean}%`)
      .limit(10);
    const today = new Date().toISOString().slice(0, 10);
    const match = (rows ?? [])
      .map((row) => ({ row, voucher: parseVoucherNote(row.notes) }))
      .find(
        (item) =>
          item.voucher?.code === clean &&
          item.voucher.status === "active" &&
          (!item.voucher.expires || item.voucher.expires >= today),
      );
    if (!match?.voucher) {
      warning = "That voucher code was not accepted, so it was not taken off this order.";
    } else {
      discount = voucherDiscount(match.voucher.amount, products);
      await admin
        .from("online_orders")
        .update({
          notes: withVoucherNote(match.row.notes, { ...match.voucher, status: "redeemed" }),
        })
        .eq("id", match.row.id);
    }
  }
  const earned = earnedVoucherAmount(eligibleSpend(products, discount));
  const total = Math.round((Math.max(0, products - discount) + deliveryFee) * 100) / 100;
  const { data: current } = await admin
    .from("online_orders")
    .select("notes")
    .eq("id", orderId)
    .maybeSingle();
  await admin
    .from("online_orders")
    .update({
      notes:
        earned > 0
          ? withVoucherNote(current?.notes, {
              status: "pending",
              amount: earned,
              eligible: eligibleSpend(products, discount),
              code: null,
              expires: null,
            })
          : current?.notes,
      total,
      subtotal: total,
    })
    .eq("id", orderId);
  if (discount > 0) {
    await admin
      .from("payments")
      .update({ amount: total })
      .eq("online_order_id", orderId)
      .eq("status", "pending");
  }
  return { discount, earned, total, warning };
}

export async function quoteStorefrontVoucher(shopSlug: string, code: string, products: number) {
  const admin = createAdminClient();
  const clean = code.trim().toUpperCase();
  const { data: tenant } = await admin
    .from("tenants")
    .select("id")
    .eq("slug", shopSlug)
    .maybeSingle();
  if (!tenant) return { ok: false as const, error: "That voucher code is not valid." };
  const { data: rows } = await admin
    .from("online_orders")
    .select("notes")
    .eq("tenant_id", tenant.id)
    .ilike("notes", `%code=${clean}%`)
    .limit(10);
  const today = new Date().toISOString().slice(0, 10);
  const match = (rows ?? [])
    .map((row) => parseVoucherNote(row.notes))
    .find(
      (voucher) =>
        voucher?.code === clean &&
        voucher.status === "active" &&
        (!voucher.expires || voucher.expires >= today),
    );
  if (!match) return { ok: false as const, error: "That voucher code is not valid." };
  return {
    ok: true as const,
    amount: match.amount,
    discount: voucherDiscount(match.amount, products),
  };
}

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
    voucherCode,
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

  let voucherDiscount = 0;
  let earnedVoucher = 0;
  let voucherWarning: string | undefined;
  const voucher = await admin.rpc("apply_online_order_voucher", {
    p_order_id: row.online_order_id,
    p_code: voucherCode?.trim() || "",
  });
  if (
    voucher.error?.message.includes("Could not find the function") ||
    voucher.error?.code === "PGRST202"
  ) {
    const applied = await rememberVoucherOnOrder(
      row.online_order_id,
      Number(row.products_total ?? 0),
      Number(row.delivery_fee ?? 0),
      voucherCode,
    );
    voucherDiscount = applied.discount;
    earnedVoucher = applied.earned;
    if (applied.total != null) row.total = applied.total;
    voucherWarning = applied.warning;
  } else if (voucher.error) {
    const msg = voucher.error.message;
    if (msg.includes("voucher:")) {
      voucherWarning = msg.includes("deadline")
        ? "That voucher has passed its deadline, so it was not taken off this order."
        : "That voucher code was not accepted, so it was not taken off this order.";
    }
  } else if (voucher.data && typeof voucher.data === "object") {
    const body = voucher.data as { discount?: number; earned?: number; total?: number };
    voucherDiscount = Number(body.discount ?? 0);
    earnedVoucher = Number(body.earned ?? 0);
    if (body.total != null) row.total = Number(body.total);
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
    voucherDiscount,
    earnedVoucher,
    voucherWarning,
  };
}
