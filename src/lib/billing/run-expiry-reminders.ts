import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { sendAppEmail } from "@/lib/mail/send";
import { dueOnKey, paymentDueAt, shouldSendExpiryReminder } from "@/lib/billing/reminders";

const REMINDER_TYPE = "billing_expiry_reminder";

export async function runExpiryReminders(now = new Date()) {
  const admin = createAdminClient();
  const { data: tenants, error } = await admin
    .from("tenants")
    .select("id, display_name, slug, status, trial_ends_at")
    .in("status", ["trial", "active", "past_due"]);
  if (error) throw new Error(error.message);

  const rows = tenants ?? [];
  if (rows.length === 0) return { considered: 0, notified: 0, emailed: 0, skipped: 0 };

  const ids = rows.map((t) => t.id);
  const { data: billings } = await admin
    .from("tenant_billing")
    .select("tenant_id, next_billing_at")
    .in("tenant_id", ids);
  const nextByTenant = new Map((billings ?? []).map((b) => [b.tenant_id, b.next_billing_at]));

  const dueShops = rows
    .map((t) => {
      const due = paymentDueAt({
        status: t.status,
        trialEndsAt: t.trial_ends_at,
        nextBillingAt: nextByTenant.get(t.id) ?? null,
      });
      if (!due || !shouldSendExpiryReminder(due, now)) return null;
      return { tenant: t, due, dueOn: dueOnKey(due) };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  if (dueShops.length === 0) {
    return { considered: rows.length, notified: 0, emailed: 0, skipped: 0 };
  }

  const { data: prior } = await admin
    .from("notifications")
    .select("tenant_id, data")
    .eq("type", REMINDER_TYPE)
    .in(
      "tenant_id",
      dueShops.map((s) => s.tenant.id),
    );

  const already = new Set(
    (prior ?? [])
      .filter((n) => (n.data as { dueOn?: string } | null)?.dueOn)
      .map((n) => `${n.tenant_id}:${(n.data as { dueOn: string }).dueOn}`),
  );

  const { data: members } = await admin
    .from("user_tenants")
    .select("tenant_id, user_id")
    .eq("role", "owner")
    .eq("is_active", true)
    .in(
      "tenant_id",
      dueShops.map((s) => s.tenant.id),
    );
  const ownerIds = [...new Set((members ?? []).map((m) => m.user_id))];
  const { data: profiles } = ownerIds.length
    ? await admin.from("profiles").select("id, email").in("id", ownerIds)
    : { data: [] };
  const emailById = new Map((profiles ?? []).map((p) => [p.id, p.email]));
  const ownersByTenant = new Map<string, { userId: string; email: string | null }[]>();
  for (const m of members ?? []) {
    const list = ownersByTenant.get(m.tenant_id) ?? [];
    list.push({ userId: m.user_id, email: emailById.get(m.user_id) ?? null });
    ownersByTenant.set(m.tenant_id, list);
  }

  const loginUrl = `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/settings/billing`;
  let notified = 0;
  let emailed = 0;
  let skipped = 0;

  for (const shop of dueShops) {
    const key = `${shop.tenant.id}:${shop.dueOn}`;
    if (already.has(key)) {
      skipped += 1;
      continue;
    }

    const owners = ownersByTenant.get(shop.tenant.id) ?? [];
    const title =
      shop.tenant.status === "trial"
        ? `${shop.tenant.display_name}: trial ends in 2 days`
        : `${shop.tenant.display_name}: payment is due in 2 days`;
    const body =
      shop.tenant.status === "trial"
        ? `Your ShopOS trial for ${shop.tenant.display_name} ends on ${shop.dueOn}. Add a card in Billing if you want the shop to stay on.`
        : `The next ShopOS payment for ${shop.tenant.display_name} is due on ${shop.dueOn}. Open Billing to keep the shop on.`;

    if (owners.length === 0) {
      const { error: nErr } = await admin.from("notifications").insert({
        tenant_id: shop.tenant.id,
        user_id: null,
        type: REMINDER_TYPE,
        title,
        body,
        data: { dueOn: shop.dueOn, slug: shop.tenant.slug },
      });
      if (nErr) throw new Error(nErr.message);
      notified += 1;
      continue;
    }

    for (const owner of owners) {
      const { error: nErr } = await admin.from("notifications").insert({
        tenant_id: shop.tenant.id,
        user_id: owner.userId,
        type: REMINDER_TYPE,
        title,
        body,
        data: { dueOn: shop.dueOn, slug: shop.tenant.slug },
      });
      if (nErr) throw new Error(nErr.message);
      notified += 1;

      if (owner.email) {
        const mail = await sendAppEmail({
          to: owner.email,
          subject: title,
          text: `${body}\n\n${loginUrl}\n`,
        });
        if (mail.ok) emailed += 1;
      }
    }
  }

  return { considered: rows.length, notified, emailed, skipped };
}
