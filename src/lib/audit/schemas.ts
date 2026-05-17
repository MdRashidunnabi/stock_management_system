import { z } from "zod";

/**
 * The set of `entity_type` values our trigger emits today. Used to
 * type the audit-log filter UI and validate query-params.
 */
export const AUDIT_ENTITY_TYPES = [
  "tenant",
  "branch",
  "product",
  "supplier",
  "category",
  "brand",
  "customer",
  "purchase_order",
  "goods_receipt",
  "pos_session",
  "sale",
  "cash_movement",
  "product_branch_settings",
] as const;
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

export const AUDIT_ACTION_VERBS = ["created", "updated", "deleted"] as const;
export type AuditActionVerb = (typeof AUDIT_ACTION_VERBS)[number];

export const auditFilterSchema = z.object({
  entity: z.enum(AUDIT_ENTITY_TYPES).nullish(),
  action: z.enum(AUDIT_ACTION_VERBS).nullish(),
  q: z.string().max(120).nullish(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});
export type AuditFilter = z.infer<typeof auditFilterSchema>;

export interface AuditLogRow {
  id: number;
  created_at: string;
  action: string;
  entity_type: AuditEntityType | string;
  entity_id: string | null;
  user_id: string | null;
  user_label: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

export interface AuditFieldDiff {
  field: string;
  before: unknown;
  after: unknown;
}

/**
 * Compare a `before` and `after` JSON snapshot and return only the keys
 * that changed. Used by the audit detail row to render a compact diff
 * instead of dumping the whole row.
 */
export function diffSnapshots(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): AuditFieldDiff[] {
  const diffs: AuditFieldDiff[] = [];
  const keys = new Set<string>([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  for (const k of keys) {
    if (k === "updated_at" || k === "created_at") continue;
    const a = (before ?? {})[k];
    const b = (after ?? {})[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      diffs.push({ field: k, before: a, after: b });
    }
  }
  return diffs.sort((a, b) => a.field.localeCompare(b.field));
}
