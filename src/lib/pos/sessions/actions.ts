"use server";

import { revalidatePath } from "next/cache";
import { ActionError, staffActionClient } from "@/lib/safe-action";
import { createClient } from "@/lib/supabase/server";
import {
  cashMovementSchema,
  closeSessionSchema,
  openSessionSchema,
  type CashMovementRow,
  type SessionListRow,
  type SessionSummary,
} from "@/lib/pos/sessions/schemas";

const POS_ROLES = ["owner", "manager", "cashier", "warehouse"] as const;

/* ------------------------------- Mutations ------------------------------- */

export const openPosSessionAction = staffActionClient([...POS_ROLES])
  .metadata({ actionName: "pos.openSession" })
  .inputSchema(openSessionSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("open_pos_session", {
      p_branch_id: parsedInput.branchId,
      p_opening_cash: parsedInput.openingCash,
      p_terminal_id: parsedInput.terminalId,
      p_note: parsedInput.note,
    });
    if (error) {
      throw new ActionError(friendlyError(error));
    }
    revalidatePath("/sessions");
    revalidatePath("/dashboard");
    revalidatePath("/pos");
    return { ok: true as const, sessionId: data as string };
  });

export const closePosSessionAction = staffActionClient([...POS_ROLES])
  .metadata({ actionName: "pos.closeSession" })
  .inputSchema(closeSessionSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .rpc("close_pos_session", {
        p_session_id: parsedInput.sessionId,
        p_counted_cash: parsedInput.countedCash,
        p_closing_note: parsedInput.closingNote,
      })
      .single();
    if (error) {
      throw new ActionError(friendlyError(error));
    }
    revalidatePath("/sessions");
    revalidatePath(`/sessions/${parsedInput.sessionId}`);
    revalidatePath("/dashboard");
    revalidatePath("/pos");
    return {
      ok: true as const,
      sessionId: data.session_id,
      expectedCash: Number(data.expected_cash),
      countedCash: Number(data.counted_cash),
      cashDifference: Number(data.cash_difference),
      status: data.status,
    };
  });

export const recordCashMovementAction = staffActionClient([...POS_ROLES])
  .metadata({ actionName: "pos.recordCashMovement" })
  .inputSchema(cashMovementSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("record_cash_movement", {
      p_session_id: parsedInput.sessionId,
      p_type: parsedInput.type,
      p_amount: parsedInput.amount,
      p_reason: parsedInput.reason ?? undefined,
    });
    if (error) {
      throw new ActionError(friendlyError(error));
    }
    revalidatePath(`/sessions/${parsedInput.sessionId}`);
    revalidatePath("/sessions");
    return { ok: true as const, movementId: data as string };
  });

/* ------------------------------- Queries ------------------------------- */

/** Returns the user's open session for a branch (if any). */
export async function getOpenSessionForBranch(branchId: string): Promise<{
  id: string;
  opened_at: string;
  opening_cash: number;
} | null> {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return null;

  const { data } = await supabase
    .from("pos_sessions")
    .select("id, opened_at, opening_cash")
    .eq("branch_id", branchId)
    .eq("cashier_id", user.user.id)
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    opened_at: data.opened_at,
    opening_cash: Number(data.opening_cash),
  };
}

export async function listSessions(
  opts: { limit?: number; status?: "open" | "closed" } = {},
): Promise<SessionListRow[]> {
  const supabase = await createClient();
  let q = supabase
    .from("pos_sessions")
    .select(
      `id, status, opened_at, closed_at, opening_cash, expected_cash, counted_cash, cash_difference,
       cashier_id,
       branch:branches!pos_sessions_branch_id_fkey(id, name, code)`,
    )
    .order("opened_at", { ascending: false })
    .limit(opts.limit ?? 50);
  if (opts.status) q = q.eq("status", opts.status);

  const { data, error } = await q;
  if (error) throw new Error(`Failed to load sessions: ${error.message}`);

  const cashierIds = Array.from(new Set((data ?? []).map((r) => r.cashier_id).filter(Boolean)));
  const labels = await loadUserLabels(supabase, cashierIds);

  return (data ?? []).map((row) => ({
    id: row.id,
    status: row.status,
    opened_at: row.opened_at,
    closed_at: row.closed_at,
    opening_cash: Number(row.opening_cash ?? 0),
    expected_cash: row.expected_cash != null ? Number(row.expected_cash) : null,
    counted_cash: row.counted_cash != null ? Number(row.counted_cash) : null,
    cash_difference: row.cash_difference != null ? Number(row.cash_difference) : null,
    branch: pickFirst(row.branch),
    cashier_label: labels.get(row.cashier_id) ?? truncateUuid(row.cashier_id),
  }));
}

/**
 * Build the full Z-report payload for one session: header, sales totals
 * (count, gross/net/vat/discount), payment-method breakdown, VAT breakdown,
 * cash drawer movements, and the running cash position.
 */
export async function getSessionWithSummary(sessionId: string): Promise<SessionSummary | null> {
  const supabase = await createClient();

  const { data: sess, error: sErr } = await supabase
    .from("pos_sessions")
    .select(
      `id, status, opened_at, closed_at, opening_cash, expected_cash, counted_cash,
       cash_difference, closing_note, cashier_id,
       branch:branches!pos_sessions_branch_id_fkey(id, name, code)`,
    )
    .eq("id", sessionId)
    .maybeSingle();
  if (sErr) throw new Error(`Failed to load session: ${sErr.message}`);
  if (!sess) return null;

  const userLabels = await loadUserLabels(supabase, [sess.cashier_id]);

  // 1) sales for this session
  const { data: sales, error: saleErr } = await supabase
    .from("sales")
    .select("id, total, subtotal, vat_total, discount_total")
    .eq("pos_session_id", sessionId)
    .eq("status", "completed");
  if (saleErr) throw new Error(`Failed to load sales: ${saleErr.message}`);

  const saleIds = (sales ?? []).map((s) => s.id);
  const totals = {
    sales_count: sales?.length ?? 0,
    items_count: 0,
    gross: round2((sales ?? []).reduce((s, r) => s + Number(r.total ?? 0), 0)),
    net: round2((sales ?? []).reduce((s, r) => s + Number(r.subtotal ?? 0), 0)),
    vat: round2((sales ?? []).reduce((s, r) => s + Number(r.vat_total ?? 0), 0)),
    discount: round2((sales ?? []).reduce((s, r) => s + Number(r.discount_total ?? 0), 0)),
  };

  // 2) Payments by method, sale items by VAT code (parallel)
  const [paymentsRes, itemsRes, drawerRes] = await Promise.all([
    saleIds.length === 0
      ? Promise.resolve({ data: [] as { method: string; amount: number }[], error: null })
      : supabase
          .from("payments")
          .select("method, amount")
          .in("sale_id", saleIds)
          .eq("status", "captured"),
    saleIds.length === 0
      ? Promise.resolve({
          data: [] as {
            vat_code: string;
            vat_rate: number;
            line_total_net: number;
            line_vat: number;
          }[],
          error: null,
        })
      : supabase
          .from("sale_items")
          .select("vat_code, vat_rate, line_total_net, line_vat")
          .in("sale_id", saleIds),
    supabase
      .from("cash_drawer_movements")
      .select("id, type, amount, reason, reference_type, reference_id, created_at, user_id")
      .eq("pos_session_id", sessionId)
      .order("created_at", { ascending: true }),
  ]);
  if (paymentsRes.error) throw new Error(`Failed to load payments: ${paymentsRes.error.message}`);
  if (itemsRes.error) throw new Error(`Failed to load items: ${itemsRes.error.message}`);
  if (drawerRes.error) throw new Error(`Failed to load drawer: ${drawerRes.error.message}`);

  const paymentMap = new Map<string, { method: string; count: number; total: number }>();
  for (const p of paymentsRes.data ?? []) {
    const cur = paymentMap.get(p.method) ?? { method: p.method, count: 0, total: 0 };
    cur.count += 1;
    cur.total += Number(p.amount ?? 0);
    paymentMap.set(p.method, cur);
  }
  const payments = Array.from(paymentMap.values())
    .map((p) => ({ ...p, total: round2(p.total) }))
    .sort((a, b) => b.total - a.total);

  const vatMap = new Map<string, { vat_code: string; rate: number; net: number; vat: number }>();
  for (const it of itemsRes.data ?? []) {
    const code = it.vat_code;
    const cur = vatMap.get(code) ?? {
      vat_code: code,
      rate: Number(it.vat_rate ?? 0),
      net: 0,
      vat: 0,
    };
    cur.net += Number(it.line_total_net ?? 0);
    cur.vat += Number(it.line_vat ?? 0);
    vatMap.set(code, cur);
  }
  const vat = Array.from(vatMap.values())
    .map((v) => ({ ...v, net: round2(v.net), vat: round2(v.vat) }))
    .sort((a, b) => a.vat_code.localeCompare(b.vat_code));
  totals.items_count = itemsRes.data?.length ?? 0;

  const drawerUserIds = Array.from(
    new Set(
      (drawerRes.data ?? [])
        .map((d) => d.user_id)
        .filter((v): v is string => typeof v === "string" && v.length > 0),
    ),
  );
  const drawerLabels = await loadUserLabels(supabase, drawerUserIds);

  const cash_movements: CashMovementRow[] = (drawerRes.data ?? []).map((m) => ({
    id: m.id,
    type: m.type,
    amount: Number(m.amount ?? 0),
    reason: m.reason,
    reference_type: m.reference_type,
    reference_id: m.reference_id,
    created_at: m.created_at,
    user_label: m.user_id ? (drawerLabels.get(m.user_id) ?? null) : null,
  }));

  let cashIn = 0;
  let cashOut = 0;
  let opening = 0;
  for (const m of cash_movements) {
    if (m.type === "opening") {
      opening += m.amount;
    } else if (m.type === "sale" || m.type === "pay_in") {
      cashIn += m.amount;
    } else if (
      m.type === "refund_out" ||
      m.type === "cash_drop" ||
      m.type === "expense" ||
      m.type === "pay_out" ||
      m.type === "closing"
    ) {
      cashOut += m.amount;
    }
  }

  const cash_running = {
    opening: round2(opening),
    cash_in: round2(cashIn),
    cash_out: round2(cashOut),
    expected: round2(opening + cashIn - cashOut),
  };

  return {
    session: {
      id: sess.id,
      status: sess.status,
      branch: pickFirst(sess.branch),
      cashier_label: userLabels.get(sess.cashier_id) ?? truncateUuid(sess.cashier_id),
      opened_at: sess.opened_at,
      closed_at: sess.closed_at,
      opening_cash: Number(sess.opening_cash ?? 0),
      expected_cash: sess.expected_cash != null ? Number(sess.expected_cash) : null,
      counted_cash: sess.counted_cash != null ? Number(sess.counted_cash) : null,
      cash_difference: sess.cash_difference != null ? Number(sess.cash_difference) : null,
      closing_note: sess.closing_note,
    },
    totals,
    payments,
    vat,
    cash_movements,
    cash_running,
  };
}

/* ------------------------------ Utilities ------------------------------ */

type SupabaseLike = Awaited<ReturnType<typeof createClient>>;

async function loadUserLabels(supabase: SupabaseLike, ids: string[]): Promise<Map<string, string>> {
  const labels = new Map<string, string>();
  const filtered = ids.filter(Boolean);
  if (filtered.length === 0) return labels;

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", filtered);
  for (const row of data ?? []) {
    const name = (row.full_name as string | null)?.trim();
    labels.set(
      row.id,
      name && name.length > 0 ? name : ((row.email as string | null) ?? truncateUuid(row.id)),
    );
  }
  for (const id of filtered) {
    if (!labels.has(id)) labels.set(id, truncateUuid(id));
  }
  return labels;
}

function pickFirst<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function truncateUuid(id: string | null | undefined): string {
  if (!id) return "?";
  return id.slice(0, 8);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function friendlyError(error: { code?: string; message: string }): string {
  if (error.code === "42501") return "You don't have permission to do that on this till.";
  if (error.code === "23505" && /already have an open till/i.test(error.message)) {
    return "You already have an open till on this branch. Close it first.";
  }
  if (error.code === "22023") return error.message;
  return error.message;
}
