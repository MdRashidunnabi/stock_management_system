"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { entityIdSchema } from "@/lib/entity-id";
import { createClient } from "@/lib/supabase/server";
import { ActionError, staffActionClient } from "@/lib/safe-action";
import { makeVoucherCode, parseVoucherNote, withVoucherNote } from "@/lib/vouchers/note";

const OPS_ROLES = ["owner", "manager", "warehouse", "delivery"] as const;

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
  .action(async ({ parsedInput }) => {
    const supabase = await createClient();
    const { error } = await supabase.rpc("set_online_fulfillment_stage", {
      p_order_id: parsedInput.orderId,
      p_stage: parsedInput.stage,
    });
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
    return { ok: true as const };
  });

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
