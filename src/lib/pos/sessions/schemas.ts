import { z } from "zod";

/**
 * Cash movement types the cashier can record by hand. The other types
 * (`opening`, `closing`, `sale`, `refund_out`) are written automatically by
 * the open/close session and sale flows; the RPC `record_cash_movement`
 * rejects them when called from the UI.
 */
export const MANUAL_CASH_MOVEMENT_TYPES = ["pay_in", "pay_out", "cash_drop", "expense"] as const;
export type ManualCashMovementType = (typeof MANUAL_CASH_MOVEMENT_TYPES)[number];

export const CASH_MOVEMENT_LABEL: Record<string, { label: string; sign: "in" | "out" }> = {
  opening: { label: "Opening float", sign: "in" },
  sale: { label: "Cash sale", sign: "in" },
  pay_in: { label: "Pay-in", sign: "in" },
  refund_out: { label: "Refund", sign: "out" },
  cash_drop: { label: "Cash drop", sign: "out" },
  expense: { label: "Petty expense", sign: "out" },
  pay_out: { label: "Pay-out", sign: "out" },
  closing: { label: "Closing", sign: "out" },
};

export const openSessionSchema = z.object({
  branchId: z.string().uuid("Pick a branch"),
  terminalId: z.string().uuid().optional(),
  openingCash: z.coerce
    .number()
    .min(0, "Opening cash must be 0 or more")
    .max(100000, "That's a lot of cash - check the amount"),
  note: z
    .string()
    .max(200, "Note is too long")
    .optional()
    .transform((v) => (v ? v.trim() : v)),
});
export type OpenSessionInput = z.input<typeof openSessionSchema>;

export const closeSessionSchema = z.object({
  sessionId: z.string().uuid(),
  countedCash: z.coerce
    .number()
    .min(0, "Counted cash must be 0 or more")
    .max(100000, "Did you mean a smaller amount?"),
  closingNote: z
    .string()
    .max(200)
    .optional()
    .transform((v) => (v ? v.trim() : v)),
});
export type CloseSessionInput = z.input<typeof closeSessionSchema>;

export const cashMovementSchema = z.object({
  sessionId: z.string().uuid(),
  type: z.enum(MANUAL_CASH_MOVEMENT_TYPES),
  amount: z.coerce
    .number()
    .min(0.01, "Amount must be > 0")
    .max(99999, "That's too big - check the amount"),
  reason: z
    .string()
    .max(200)
    .optional()
    .transform((v) => (v ? v.trim() : v)),
});
export type CashMovementInput = z.input<typeof cashMovementSchema>;

/* ---------------------------------- View shapes ---------------------------------- */

export interface SessionListRow {
  id: string;
  status: string;
  opened_at: string;
  closed_at: string | null;
  opening_cash: number;
  expected_cash: number | null;
  counted_cash: number | null;
  cash_difference: number | null;
  branch: { id: string; name: string; code: string } | null;
  cashier_label: string;
}

export interface CashMovementRow {
  id: string;
  type: string;
  amount: number;
  reason: string | null;
  reference_type: string | null;
  reference_id: string | null;
  created_at: string;
  user_label: string | null;
}

/** Z-report payload built by getSessionWithSummary on the server. */
export interface SessionSummary {
  session: {
    id: string;
    status: string;
    branch: { id: string; name: string; code: string } | null;
    cashier_label: string;
    opened_at: string;
    closed_at: string | null;
    opening_cash: number;
    expected_cash: number | null;
    counted_cash: number | null;
    cash_difference: number | null;
    closing_note: string | null;
  };
  totals: {
    sales_count: number;
    items_count: number;
    gross: number;
    net: number;
    vat: number;
    discount: number;
  };
  payments: Array<{ method: string; count: number; total: number }>;
  vat: Array<{ vat_code: string; rate: number; net: number; vat: number }>;
  cash_movements: CashMovementRow[];
  /**
   * Same numbers as the column on pos_sessions but recomputed live so an
   * open session shows up-to-the-second values.
   */
  cash_running: {
    opening: number;
    cash_in: number;
    cash_out: number;
    expected: number;
  };
}
