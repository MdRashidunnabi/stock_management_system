import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { requireRole } from "@/lib/auth/tenant";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AuditRow } from "@/components/audit/audit-row";
import { listAuditEntries } from "@/lib/audit/queries";
import { AUDIT_ACTION_VERBS, AUDIT_ENTITY_TYPES, auditFilterSchema } from "@/lib/audit/schemas";

export const metadata = { title: "Audit log · ShopOS" };
export const dynamic = "force-dynamic";

interface SearchParams {
  entity?: string;
  action?: string;
  q?: string;
  limit?: string;
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  // Owners and accountants are the legal owners of the audit trail.
  const tenant = await requireRole(["owner", "accountant", "support_admin", "super_admin"]);
  if (!tenant) redirect("/dashboard");

  const params = await searchParams;
  const parsed = auditFilterSchema.safeParse({
    entity: params.entity || null,
    action: params.action || null,
    q: params.q || null,
    limit: params.limit ?? 100,
  });
  const filter = parsed.success ? parsed.data : { entity: null, action: null, q: null, limit: 100 };

  const rows = await listAuditEntries(filter);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5" />
          <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Every create, update, and delete on the rows that affect inventory, cash, customers, and
          suppliers is recorded by a database trigger. Because the trigger lives in Postgres, even
          direct SQL or service-role tools end up here.
        </p>
      </header>

      <form
        method="GET"
        className="border-border bg-card flex flex-wrap items-end gap-3 rounded-lg border p-3"
      >
        <FormSelect
          name="entity"
          label="Entity"
          value={filter.entity ?? ""}
          options={[
            { value: "", label: "All entities" },
            ...AUDIT_ENTITY_TYPES.map((e) => ({ value: e, label: e })),
          ]}
        />
        <FormSelect
          name="action"
          label="Action"
          value={filter.action ?? ""}
          options={[
            { value: "", label: "Any" },
            ...AUDIT_ACTION_VERBS.map((v) => ({ value: v, label: v })),
          ]}
        />
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs">Search</label>
          <input
            type="text"
            name="q"
            defaultValue={filter.q ?? ""}
            placeholder="action keyword or entity uuid"
            className="border-border bg-background h-9 w-64 rounded-md border px-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs">Limit</label>
          <input
            type="number"
            name="limit"
            min={10}
            max={500}
            defaultValue={filter.limit}
            className="border-border bg-background h-9 w-20 rounded-md border px-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="bg-primary text-primary-foreground h-9 rounded-md px-3 text-sm font-medium"
        >
          Apply
        </button>
        {(filter.entity || filter.action || filter.q) && (
          <Link
            href="/audit"
            className="text-muted-foreground hover:text-foreground h-9 px-3 text-sm leading-9"
          >
            Reset
          </Link>
        )}
      </form>

      <section className="border-border bg-card overflow-x-auto rounded-lg border">
        {rows.length === 0 ? (
          <p className="text-muted-foreground p-6 text-center text-sm">
            No audit entries match your filter yet.
          </p>
        ) : (
          <Suspense>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Time</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <AuditRow key={r.id} row={r} />
                ))}
              </TableBody>
            </Table>
          </Suspense>
        )}
      </section>

      <p className="text-muted-foreground text-xs">
        Showing the most recent {rows.length} entries{" "}
        {filter.limit < 500 ? `(limit ${filter.limit})` : ""}. Click any row to expand and view a
        field-level before / after diff.
      </p>
    </div>
  );
}

function FormSelect({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-muted-foreground text-xs">{label}</label>
      <select
        name={name}
        defaultValue={value}
        className="border-border bg-background h-9 rounded-md border px-2 text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
