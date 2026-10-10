import "server-only";

import { createClient } from "@/lib/supabase/server";
import { parseVoucherNote } from "@/lib/vouchers/note";

export type OrderVoucherView = {
  discount: number;
  codeUsed: string | null;
  paymentStatus: string | null;
  earnedAmount: number;
  earnedStatus: string | null;
  earnedCode: string | null;
  expiresAt: string | null;
  eligibleSpend: number;
  externalItems: Array<{ name?: string; qty?: number; unitPrice?: number }>;
};

export async function getOnlineOrderVoucher(orderId: string): Promise<OrderVoucherView | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_online_order_voucher", {
    p_order_id: orderId,
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    const { data: order } = await supabase
      .from("online_orders")
      .select("notes")
      .eq("id", orderId)
      .maybeSingle();
    const voucher = parseVoucherNote(order?.notes);
    if (!voucher) return null;
    const { data: payment } = await supabase
      .from("payments")
      .select("status")
      .eq("online_order_id", orderId)
      .limit(1)
      .maybeSingle();
    return {
      discount: 0,
      codeUsed: null,
      paymentStatus: payment?.status ?? null,
      earnedAmount: voucher.amount,
      earnedStatus: voucher.status,
      earnedCode: voucher.code,
      expiresAt: voucher.expires,
      eligibleSpend: voucher.eligible,
      externalItems: [],
    };
  }
  const row = data as Record<string, unknown>;
  const items = Array.isArray(row.external_items) ? row.external_items : [];
  return {
    discount: Number(row.discount ?? 0),
    codeUsed: row.code_used ? String(row.code_used) : null,
    paymentStatus: row.payment_status ? String(row.payment_status) : null,
    earnedAmount: Number(row.earned_amount ?? 0),
    earnedStatus: row.earned_status ? String(row.earned_status) : null,
    earnedCode: row.earned_code ? String(row.earned_code) : null,
    expiresAt: row.expires_at ? String(row.expires_at) : null,
    eligibleSpend: Number(row.eligible_spend ?? 0),
    externalItems: items.filter(
      (item) => item && typeof item === "object",
    ) as OrderVoucherView["externalItems"],
  };
}
