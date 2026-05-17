import "server-only";
import { createClient } from "@/lib/supabase/server";
import { type AuditEntityType, type AuditFilter, type AuditLogRow } from "@/lib/audit/schemas";

/**
 * List audit entries for the current tenant. RLS already restricts to
 * the caller's tenant; the role gate (owner / accountant) is enforced
 * by the page that calls this.
 */
export async function listAuditEntries(filter: AuditFilter): Promise<AuditLogRow[]> {
  const supabase = await createClient();

  let q = supabase
    .from("audit_logs")
    .select("id, created_at, action, entity_type, entity_id, user_id, before, after")
    .order("created_at", { ascending: false })
    .limit(filter.limit);

  if (filter.entity) q = q.eq("entity_type", filter.entity);
  if (filter.action) q = q.like("action", `%.${filter.action}`);

  if (filter.q) {
    const term = filter.q.trim();
    if (term.length > 0) {
      // Best-effort match on entity_id (uuid) or action substring.
      q = q.or(`action.ilike.%${term}%,entity_id.eq.${asUuidOrZero(term)}`);
    }
  }

  const { data, error } = await q;
  if (error) throw new Error(`listAuditEntries: ${error.message}`);

  const rows = data ?? [];
  const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter((v): v is string => !!v)));

  const labels = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds);
    for (const p of profiles ?? []) {
      const name = (p.full_name as string | null)?.trim();
      labels.set(
        p.id,
        name && name.length > 0 ? name : ((p.email as string | null) ?? p.id.slice(0, 8)),
      );
    }
  }

  return rows.map((r) => ({
    id: Number(r.id),
    created_at: r.created_at,
    action: r.action,
    entity_type: (r.entity_type as AuditEntityType | string) ?? "unknown",
    entity_id: r.entity_id,
    user_id: r.user_id,
    user_label: r.user_id ? (labels.get(r.user_id) ?? r.user_id.slice(0, 8)) : "system",
    before: (r.before as Record<string, unknown> | null) ?? null,
    after: (r.after as Record<string, unknown> | null) ?? null,
  }));
}

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";
function asUuidOrZero(value: string): string {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? value
    : ZERO_UUID;
}
