"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { entityIdSchema } from "@/lib/entity-id";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ActionError, staffActionClient } from "@/lib/safe-action";
import { refundStripeOrder } from "@/lib/storefront/stripe-shop";
import { makeVoucherCode, parseVoucherNote, withVoucherNote } from "@/lib/vouchers/note";

const OPS_ROLES = ["owner", "manager", "cashier", "warehouse", "delivery"] as const;

const STAGE_VALUES = [
  "preparing",
  "prepared_for_delivery",
  "on_the_way",
  "delivered",
  "ready_for_collection",
  "collected",
] as const;

export const setOnlineFulfillmentStageAction = staffActionClient([...OPS_ROLES])
  .metadata({ actionName: "online.setStage" })
  .inputSchema(
    z.object({
      orderId: entityIdSchema,
      stage: z.enum(STAGE_VALUES),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const admin = createAdminClient();
    const { data: order } = await admin
      .from("online_orders")
      .select("id, status, fulfillment_type")
      .eq("id", parsedInput.orderId)
      .eq("tenant_id", ctx.tenant.tenantId)
      .maybeSingle();
    if (!order) throw new ActionError("Order not found.");
    if (order.status === "cancelled") throw new ActionError("This order is cancelled.");
    const deliveryStages = ["preparing", "prepared_for_delivery", "on_the_way", "delivered"];
    const collectionStages = ["preparing", "ready_for_collection", "collected"];
    const allowed = order.fulfillment_type === "delivery" ? deliveryStages : collectionStages;
    if (!allowed.includes(parsedInput.stage)) {
      throw new ActionError(
        order.fulfillment_type === "delivery"
          ? "That stage is for collection orders."
          : "That stage is for delivery orders.",
      );
    }
    const status =
      parsedInput.stage === "delivered" || parsedInput.stage === "collected"
        ? "fulfilled"
        : order.status === "pending"
          ? "confirmed"
          : order.status;
    const { error } = await admin
      .from("online_orders")
      .update({ fulfillment_stage: parsedInput.stage, status })
      .eq("id", order.id);
    if (error) throw new ActionError(friendlyOpsError(error.message));
    revalidatePath("/online-orders");
    revalidatePath(`/online-orders/${parsedInput.orderId}`);
    revalidatePath("/sales");
    return { ok: true as const };
  });

export const confirmOnlinePaymentAction = staffActionClient([...OPS_ROLES])
  .metadata({ actionName: "online.confirmPayment" })
  .inputSchema(z.object({ orderId: entityIdSchema }))
  .action(async ({ parsedInput }) => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("confirm_online_order_payment", {
      p_order_id: parsedInput.orderId,
    });
    if (error?.message.includes("Could not find the function") || error?.code === "PGRST202") {
      const issued = await issueVoucherFromNotes(parsedInput.orderId);
      revalidatePath("/online-orders");
      revalidatePath(`/online-orders/${parsedInput.orderId}`);
      revalidatePath(`/online-orders/${parsedInput.orderId}/voucher`);
      return issued;
    }
    if (error) throw new ActionError(friendlyOpsError(error.message));
    revalidatePath("/online-orders");
    revalidatePath(`/online-orders/${parsedInput.orderId}`);
    revalidatePath(`/online-orders/${parsedInput.orderId}/voucher`);
    const body = (data ?? {}) as { issued?: boolean; code?: string; amount?: number };
    return {
      ok: true as const,
      issued: Boolean(body.issued),
      code: body.code ? String(body.code) : null,
      amount: Number(body.amount ?? 0),
    };
  });

export const resolveOnlineOrderLineAction = staffActionClient([...OPS_ROLES])
  .metadata({ actionName: "online.resolveLine" })
  .inputSchema(
    z.object({
      orderId: entityIdSchema,
      itemId: entityIdSchema,
      action: z.enum(["omit", "substitute"]),
      substituteProductId: entityIdSchema.optional(),
    }),
  )
  .action(async ({ parsedInput }) => {
    if (parsedInput.action === "substitute" && !parsedInput.substituteProductId) {
      throw new ActionError("Pick a similar product to send instead.");
    }
    const refundedToCard =
      parsedInput.action === "omit"
        ? await refundOmittedLine(parsedInput.orderId, parsedInput.itemId)
        : false;
    const supabase = await createClient();
    const { error } = await supabase.rpc("resolve_online_order_line", {
      p_item_id: parsedInput.itemId,
      p_action: parsedInput.action,
      p_substitute_product_id: parsedInput.substituteProductId ?? null,
    });
    if (error) throw new ActionError(friendlyOpsError(error.message));
    revalidatePath("/online-orders");
    revalidatePath(`/online-orders/${parsedInput.orderId}`);
    revalidatePath("/sales");
    revalidatePath("/products");
    revalidatePath("/reports");
    return { ok: true as const, refundedToCard };
  });

export const refundOnlineCardAction = staffActionClient([...OPS_ROLES])
  .metadata({ actionName: "online.refundCard" })
  .inputSchema(z.object({ orderId: entityIdSchema }))
  .action(async ({ parsedInput }) => {
    const supabase = createAdminClient();
    const { data: pay } = await supabase
      .from("payments")
      .select("amount, refunded_amount, status, method")
      .eq("online_order_id", parsedInput.orderId)
      .eq("method", "card")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const remaining = round2(Number(pay?.amount ?? 0) - Number(pay?.refunded_amount ?? 0));
    if (!pay || pay.status === "refunded" || remaining <= 0) {
      throw new ActionError("This order has no Stripe card payment left to refund.");
    }
    const refunded = await refundStripeOrder({
      orderId: parsedInput.orderId,
      amount: remaining,
      idempotencyKey: `refund-order-${parsedInput.orderId}-${Math.round(remaining * 100)}`,
    }).catch((err: unknown) => {
      throw new ActionError(err instanceof Error ? err.message : "Stripe did not refund the card.");
    });
    await supabase
      .from("payments")
      .update({
        refunded_amount: round2(Number(pay.refunded_amount ?? 0) + refunded),
        refunded_at: new Date().toISOString(),
        status: "refunded",
      })
      .eq("online_order_id", parsedInput.orderId)
      .eq("method", "card");
    revalidatePath("/online-orders");
    revalidatePath(`/online-orders/${parsedInput.orderId}`);
    return { ok: true as const, amount: refunded };
  });

async function refundOmittedLine(orderId: string, itemId: string) {
  const supabase = await createClient();
  const [{ data: item }, { data: order }, { data: pay }] = await Promise.all([
    supabase
      .from("online_order_items")
      .select("line_total_gross, line_status")
      .eq("id", itemId)
      .maybeSingle(),
    supabase.from("online_orders").select("payment_method").eq("id", orderId).maybeSingle(),
    supabase
      .from("payments")
      .select("status, method")
      .eq("online_order_id", orderId)
      .eq("method", "card")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!item || item.line_status !== "ok") return false;
  if (order?.payment_method !== "online_card" || pay?.status !== "captured") return false;
  await refundStripeOrder({
    orderId,
    amount: Number(item.line_total_gross ?? 0),
    idempotencyKey: `refund-line-${itemId}`,
  }).catch((err: unknown) => {
    throw new ActionError(err instanceof Error ? err.message : "Stripe did not refund the card.");
  });
  return true;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function issueVoucherFromNotes(orderId: string) {
  const supabase = await createClient();
  const { data: order, error } = await supabase
    .from("online_orders")
    .select("notes")
    .eq("id", orderId)
    .maybeSingle();
  if (error || !order) throw new ActionError("Order not found.");
  const voucher = parseVoucherNote(order.notes);
  if (!voucher || voucher.amount <= 0) {
    await supabase
      .from("payments")
      .update({ status: "captured", captured_at: new Date().toISOString() })
      .eq("online_order_id", orderId)
      .eq("status", "pending");
    return { ok: true as const, issued: false, code: null, amount: 0 };
  }
  if (voucher.status === "active" && voucher.code) {
    return { ok: true as const, issued: true, code: voucher.code, amount: voucher.amount };
  }
  const code = makeVoucherCode();
  const expires = new Date();
  expires.setDate(expires.getDate() + 30);
  const { error: updateError } = await supabase
    .from("online_orders")
    .update({
      notes: withVoucherNote(order.notes, {
        ...voucher,
        status: "active",
        code,
        expires: expires.toISOString().slice(0, 10),
      }),
      status: "confirmed",
    })
    .eq("id", orderId);
  if (updateError) throw new ActionError("Could not issue the voucher.");
  await supabase
    .from("payments")
    .update({ status: "captured", captured_at: new Date().toISOString() })
    .eq("online_order_id", orderId)
    .eq("status", "pending");
  return { ok: true as const, issued: true, code, amount: voucher.amount };
}

function friendlyOpsError(msg: string): string {
  if (msg.includes("already settled")) return "This line is already settled.";
  if (msg.includes("cancelled")) return "This order is cancelled.";
  if (msg.includes("collection orders")) return "That stage is for collection orders.";
  if (msg.includes("delivery orders")) return "That stage is for delivery orders.";
  if (msg.includes("Pick a similar")) return "Pick a similar product to send instead.";
  if (msg.includes("not found")) return "Order line not found.";
  if (msg.includes("not allowed")) return "Your role cannot update this order.";
  if (msg.includes("insufficient") || msg.includes("below zero") || msg.includes("cannot reduce")) {
    return "Not enough stock of the similar product.";
  }
  return "Could not update this order. Try again.";
}
