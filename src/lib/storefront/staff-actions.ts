"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { entityIdSchema } from "@/lib/entity-id";
import { createClient } from "@/lib/supabase/server";
import { ActionError, staffActionClient } from "@/lib/safe-action";

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
