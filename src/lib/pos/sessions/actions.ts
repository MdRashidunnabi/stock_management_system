"use server";

import { revalidatePath } from "next/cache";
import { ActionError, staffActionClient } from "@/lib/safe-action";
import { assertTillMaySell } from "@/lib/license/assert";
import { createClient } from "@/lib/supabase/server";
import {
  cashMovementSchema,
  closeSessionSchema,
  openSessionSchema,
  saveShiftAccountSchema,
  type CashMovementRow,
  type SessionListRow,
  type SessionSummary,
  type ShiftAccountView,
  type TillSlot,
} from "@/lib/pos/sessions/schemas";
import { MAX_TILLS_PER_BRANCH, parseShiftCode, type ShiftCode } from "@/lib/pos/shifts";

const POS_ROLES = ["owner", "manager", "cashier", "warehouse"] as const;

/* ------------------------------- Mutations ------------------------------- */

export const openPosSessionAction = staffActionClient([...POS_ROLES])
  .metadata({ actionName: "pos.openSession" })
  .inputSchema(openSessionSchema)
  .action(async ({ parsedInput, ctx }) => {
    await assertTillMaySell(ctx.tenant.tenantId, parsedInput.deviceId);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("open_pos_session", {
      p_branch_id: parsedInput.branchId,
      p_opening_cash: parsedInput.openingCash,
      p_terminal_id: parsedInput.terminalId,
      p_note: parsedInput.note,
      p_shift_code: parsedInput.shiftCode,
      p_business_date: parsedInput.businessDate,
      p_device_id: parsedInput.deviceId,
      p_till_number: parsedInput.tillNumber,
    });
    if (error) {
      throw new ActionError(friendlyError(error));
    }
    const sessionId = typeof data === "string" ? data : null;
    if (!sessionId) {
      throw new ActionError("Till could not be opened. Please try again.");
    }
    revalidatePath("/sessions");
    revalidatePath("/sessions/shift");
    revalidatePath("/dashboard");
    revalidatePath("/pos");
    return { ok: true as const, sessionId };
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
    revalidatePath("/sessions/shift");
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

export const saveShiftAccountAction = staffActionClient(["owner", "manager", "accountant"])
  .metadata({ actionName: "pos.saveShiftAccount" })
  .inputSchema(saveShiftAccountSchema)
  .action(async ({ parsedInput, ctx }) => {
    const view = await getShiftAccount(
      parsedInput.branchId,
      parsedInput.businessDate,
      parsedInput.shiftCode,
    );
    if (!view || view.tills.length === 0) {
      throw new ActionError("No tills found for that branch, date, and shift.");
    }
    const supabase = await createClient();
    const snapshot = {
      sales_count: view.combined.sales_count,
      items_count: view.combined.items_count,
      gross: view.combined.gross,
      net: view.combined.net,
      vat: view.combined.vat,
      discount: view.combined.discount,
      cash_expected: view.combined.cash_expected,
      cash_counted: view.combined.cash_counted,
      cash_difference: view.combined.cash_difference,
      payments: view.combined.payments,
      till_count: view.tills.length,
      open_till_count: view.open_till_count,
    };
    const { data, error } = await supabase
      .from("shift_accounts")
      .upsert(
        {
          tenant_id: ctx.tenant.tenantId,
          branch_id: parsedInput.branchId,
          business_date: parsedInput.businessDate,
          shift_code: parsedInput.shiftCode,
          status: "finalised",
          notes: parsedInput.notes ?? null,
          totals: snapshot,
          finalised_at: new Date().toISOString(),
          finalised_by: ctx.user.id,
        },
        { onConflict: "tenant_id,branch_id,business_date,shift_code" },
      )
      .select("id")
      .single();
    if (error) throw new ActionError(friendlyError(error));
    revalidatePath("/sessions");
    revalidatePath("/sessions/shift");
    revalidatePath("/dashboard");
    return { ok: true as const, id: data.id as string };
  });

/* ------------------------------- Queries ------------------------------- */

/** Returns the user's open session for a branch (if any). */
export async function getOpenSessionForBranch(branchId: string): Promise<{
  id: string;
  opened_at: string;
  opening_cash: number;
  shift_code: ShiftCode;
  business_date: string;
  till_number: number | null;
} | null> {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return null;

  const { data } = await supabase
    .from("pos_sessions")
    .select("id, opened_at, opening_cash, shift_code, business_date, till_number")
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
    shift_code: parseShiftCode(data.shift_code),
    business_date: data.business_date,
    till_number: data.till_number != null ? Number(data.till_number) : null,
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
       cashier_id, shift_code, business_date, device_id, till_number,
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
    shift_code: parseShiftCode(row.shift_code),
    business_date: row.business_date,
    device_id: row.device_id,
    till_number: row.till_number != null ? Number(row.till_number) : null,
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
       cash_difference, closing_note, cashier_id, shift_code, business_date, device_id, till_number,
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
      shift_code: parseShiftCode(sess.shift_code),
      business_date: sess.business_date,
      device_id: sess.device_id,
      till_number: sess.till_number != null ? Number(sess.till_number) : null,
    },
    totals,
    payments,
    vat,
    cash_movements,
    cash_running,
  };
}

export async function getShiftAccount(
  branchId: string,
  businessDate: string,
  shiftCode: ShiftCode,
): Promise<ShiftAccountView | null> {
  const supabase = await createClient();
  const { data: sessions, error } = await supabase
    .from("pos_sessions")
    .select("id")
    .eq("branch_id", branchId)
    .eq("business_date", businessDate)
    .eq("shift_code", shiftCode)
    .order("opened_at", { ascending: true });
  if (error) throw new Error(`Failed to load shift tills: ${error.message}`);

  const tills = (
    await Promise.all((sessions ?? []).map((row) => getSessionWithSummary(row.id)))
  ).filter((s): s is SessionSummary => s != null);

  const { data: branchRow } = await supabase
    .from("branches")
    .select("id, name, code")
    .eq("id", branchId)
    .maybeSingle();

  const { data: savedRow } = await supabase
    .from("shift_accounts")
    .select("id, status, notes, finalised_at")
    .eq("branch_id", branchId)
    .eq("business_date", businessDate)
    .eq("shift_code", shiftCode)
    .maybeSingle();

  const paymentMap = new Map<string, { method: string; count: number; total: number }>();
  let sales_count = 0;
  let items_count = 0;
  let gross = 0;
  let net = 0;
  let vat = 0;
  let discount = 0;
  let cash_expected = 0;
  let cash_counted = 0;
  let countedAny = false;
  let cash_difference = 0;

  for (const till of tills) {
    sales_count += till.totals.sales_count;
    items_count += till.totals.items_count;
    gross += till.totals.gross;
    net += till.totals.net;
    vat += till.totals.vat;
    discount += till.totals.discount;
    cash_expected += till.cash_running.expected;
    if (till.session.counted_cash != null) {
      countedAny = true;
      cash_counted += till.session.counted_cash;
    }
    if (till.session.cash_difference != null) {
      cash_difference += till.session.cash_difference;
    }
    for (const p of till.payments) {
      const cur = paymentMap.get(p.method) ?? { method: p.method, count: 0, total: 0 };
      cur.count += p.count;
      cur.total += p.total;
      paymentMap.set(p.method, cur);
    }
  }

  return {
    branch: branchRow,
    business_date: businessDate,
    shift_code: shiftCode,
    tills,
    combined: {
      sales_count,
      items_count,
      gross: round2(gross),
      net: round2(net),
      vat: round2(vat),
      discount: round2(discount),
      cash_expected: round2(cash_expected),
      cash_counted: countedAny ? round2(cash_counted) : null,
      cash_difference: countedAny ? round2(cash_difference) : null,
      payments: Array.from(paymentMap.values())
        .map((p) => ({ ...p, total: round2(p.total) }))
        .sort((a, b) => b.total - a.total),
    },
    open_till_count: tills.filter((t) => t.session.status === "open").length,
    closed_till_count: tills.filter((t) => t.session.status !== "open").length,
    saved: savedRow
      ? {
          id: savedRow.id,
          status: savedRow.status,
          notes: savedRow.notes,
          finalised_at: savedRow.finalised_at,
        }
      : null,
  };
}

export async function listTillSlots(branchId: string): Promise<TillSlot[]> {
  const supabase = await createClient();
  const [{ data: devices, error: dErr }, { data: openRows, error: oErr }] = await Promise.all([
    supabase
      .from("pos_devices")
      .select("device_id, till_number")
      .eq("branch_id", branchId)
      .is("revoked_at", null),
    supabase
      .from("pos_sessions")
      .select("till_number, cashier_id, device_id")
      .eq("branch_id", branchId)
      .eq("status", "open"),
  ]);
  if (dErr) throw new Error(`Failed to load tills: ${dErr.message}`);
  if (oErr) throw new Error(`Failed to load open tills: ${oErr.message}`);

  const cashierIds = Array.from(new Set((openRows ?? []).map((r) => r.cashier_id).filter(Boolean)));
  const labels = await loadUserLabels(supabase, cashierIds);

  const slots: TillSlot[] = [];
  for (let n = 1; n <= MAX_TILLS_PER_BRANCH; n++) {
    const device = (devices ?? []).find((d) => d.till_number === n);
    const open = (openRows ?? []).find((r) => r.till_number === n);
    slots.push({
      number: n,
      device_id: device?.device_id ?? null,
      open: Boolean(open),
      cashier_label: open ? (labels.get(open.cashier_id) ?? null) : null,
    });
  }
  return slots;
}

export async function listTillSlotsByBranch(
  branchIds: string[],
): Promise<Record<string, TillSlot[]>> {
  const entries = await Promise.all(
    branchIds.map(async (id) => [id, await listTillSlots(id)] as const),
  );
  return Object.fromEntries(entries);
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
  if (error.code === "23505" && /already has an open session/i.test(error.message)) {
    return "This till computer already has an open session. Close it first.";
  }
  if (error.code === "23505" && /Till \d+ is already/i.test(error.message)) {
    return error.message.replace(/^.*Till/, "Till");
  }
  if (error.code === "P0001" || /already has 10 tills/i.test(error.message)) {
    return error.message;
  }
  if (error.code === "22023") return error.message;
  return error.message;
}
