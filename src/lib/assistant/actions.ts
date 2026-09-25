"use server";

import { z } from "zod";
import { actionClient } from "@/lib/safe-action";
import { getCurrentTenant, getCurrentUser, type AppRole } from "@/lib/auth/tenant";
import { isPlatformStaff } from "@/lib/platform/auth";
import {
  getPeriodRange,
  getSalesSummary,
  getLowStockRows,
  getOutstandingPosSummary,
} from "@/lib/reports/queries";
import { getTenantBilling, getTenantSubscriptionAccess } from "@/lib/billing/queries";
import { listOnlineOrdersForTenant } from "@/lib/storefront/admin-queries";
import { createClient } from "@/lib/supabase/server";
import { formatEuro } from "@/lib/utils";
import type { AssistantSession, LookupTopic } from "@/lib/assistant/types";

const topicSchema = z.enum([
  "sales",
  "billing",
  "stock",
  "tills",
  "purchasing",
  "online",
  "team",
  "payments",
]);

function roleOf(role: AppRole | null, allowed: AppRole[]): boolean {
  return Boolean(role && allowed.includes(role));
}

async function openTillCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("pos_sessions")
    .select("id", { count: "exact", head: true })
    .eq("status", "open");
  return count ?? 0;
}

async function activeTeamCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("user_tenants")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);
  return count ?? 0;
}

export const lookupAssistantFactsAction = actionClient
  .metadata({ actionName: "assistant.lookup" })
  .inputSchema(z.object({ topic: topicSchema }))
  .action(async ({ parsedInput }) => {
    const user = await getCurrentUser();
    if (!user) {
      return { ok: false as const, message: "Sign in to see live figures for this shop." };
    }

    const [tenant, platform] = await Promise.all([getCurrentTenant(), isPlatformStaff()]);
    if (!tenant) {
      return {
        ok: true as const,
        facts: ["No shop is selected yet. Finish onboarding to see live figures."],
        href: platform ? "/platform" : "/onboarding",
      };
    }

    const facts = await factsForTopic(parsedInput.topic, tenant.role, tenant.tenantId, platform);
    return { ok: true as const, facts, href: undefined as string | undefined };
  });

async function factsForTopic(
  topic: LookupTopic,
  role: AppRole,
  tenantId: string,
  platform: boolean,
): Promise<string[]> {
  if (topic === "payments") {
    const [till, bill] = await Promise.all([
      factsForTopic("tills", role, tenantId, platform),
      role === "owner" || platform
        ? factsForTopic("billing", role, tenantId, platform)
        : Promise.resolve([] as string[]),
    ]);
    return [...till, ...bill];
  }

  if (topic === "sales" && roleOf(role, ["owner", "manager", "cashier", "accountant"])) {
    const summary = await getSalesSummary(getPeriodRange("today"));
    const methods = summary.paymentsByMethod
      .map((m) => `${m.method}: ${formatEuro(m.amount)}`)
      .join(", ");
    return [
      `Today: ${summary.salesCount} sale(s), ${formatEuro(summary.grossRevenue)} gross, ${formatEuro(summary.vatTotal)} VAT.`,
      methods ? `Payments captured: ${methods}.` : "No payments captured yet today.",
    ];
  }

  if (topic === "billing" && (role === "owner" || platform)) {
    const [access, billing] = await Promise.all([
      getTenantSubscriptionAccess(tenantId),
      getTenantBilling(tenantId),
    ]);
    const lines: string[] = [];
    if (access) {
      lines.push(
        `Plan status: ${access.status}${access.isTrial && access.daysLeftInTrial != null ? ` (${access.daysLeftInTrial} day(s) of trial left)` : ""}.`,
      );
      lines.push(`Monthly amount: ${formatEuro(access.monthlyAmountEur)}.`);
      if (access.needsCard)
        lines.push("A card is still needed on file before POS can stay unlocked.");
      if (access.needsPayment) lines.push("This shop currently needs a payment recorded.");
    }
    if (billing?.cardOnFile) {
      lines.push(
        `Card on file: ${billing.cardBrand ?? "card"} ending ${billing.cardLast4 ?? "—"}.`,
      );
    }
    return lines.length > 0 ? lines : ["No billing record found for this shop yet."];
  }

  if (topic === "stock" && roleOf(role, ["owner", "manager", "warehouse"])) {
    const rows = await getLowStockRows(5);
    if (rows.length === 0) return ["No products are at or below their minimum stock."];
    return [
      `${rows.length} low-stock line(s). ${rows
        .slice(0, 3)
        .map((r) => `${r.name} at ${r.branch_name}: ${r.on_hand} (min ${r.min_stock})`)
        .join("; ")}.`,
    ];
  }

  if (topic === "tills" && roleOf(role, ["owner", "manager", "cashier", "warehouse"])) {
    const open = await openTillCount();
    return [
      open > 0
        ? `${open} till session(s) are open. Open POS to take a customer payment.`
        : "No till is open. Open a till session before taking payments.",
    ];
  }

  if (topic === "purchasing" && roleOf(role, ["owner", "manager", "warehouse"])) {
    const outstanding = await getOutstandingPosSummary();
    return [
      outstanding.count > 0
        ? `${outstanding.count} purchase order(s) still open, worth ${formatEuro(outstanding.totalValue)}.`
        : "No outstanding purchase orders.",
    ];
  }

  if (topic === "online" && roleOf(role, ["owner", "manager"])) {
    const orders = await listOnlineOrdersForTenant(8);
    const open = orders.filter((o) => !["completed", "cancelled", "canceled"].includes(o.status));
    return [
      `${orders.length} recent online order(s), ${open.length} still open.`,
      open[0]
        ? `Latest: ${open[0].order_number} for ${formatEuro(open[0].total)} (${open[0].status}).`
        : "No open online orders.",
    ];
  }

  if (topic === "team" && roleOf(role, ["owner", "manager"])) {
    const count = await activeTeamCount();
    return [`${count} active team member(s) on this shop.`];
  }

  return [];
}

export async function getAssistantSession(): Promise<AssistantSession> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      signedIn: false,
      email: null,
      displayName: null,
      role: null,
      tenantName: null,
      tenantSlug: null,
      isPlatformStaff: false,
    };
  }
  const [tenant, platform] = await Promise.all([getCurrentTenant(), isPlatformStaff()]);
  return {
    signedIn: true,
    email: user.email ?? null,
    displayName: (user.user_metadata?.full_name as string | undefined) ?? user.email ?? null,
    role: tenant?.role ?? null,
    tenantName: tenant?.tenantName ?? null,
    tenantSlug: tenant?.tenantSlug ?? null,
    isPlatformStaff: platform,
  };
}
