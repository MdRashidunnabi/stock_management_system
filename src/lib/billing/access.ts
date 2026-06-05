import "server-only";

import type { SubscriptionAccess } from "@/lib/billing/types";

export interface TenantAccessInput {
  status: string;
  trialEndsAt: string | null;
  cardOnFile: boolean;
  monthlyAmountCents: number;
  isPlatformOverride?: boolean;
}

const APP_ALLOWED_STATUSES = new Set(["trial", "active", "past_due"]);
const STOREFRONT_ALLOWED_STATUSES = new Set(["trial", "active", "past_due"]);

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const end = new Date(iso).getTime();
  const now = Date.now();
  return Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
}

function trialExpired(trialEndsAt: string | null): boolean {
  if (!trialEndsAt) return false;
  return new Date(trialEndsAt).getTime() <= Date.now();
}

/**
 * Central subscription gate for the web app and POS.
 * Stripe will update tenant.status via webhooks; demo mode uses the same statuses.
 */
export function resolveSubscriptionAccess(input: TenantAccessInput): SubscriptionAccess {
  const monthlyAmountEur = input.monthlyAmountCents / 100;
  const daysLeftInTrial = input.status === "trial" ? daysUntil(input.trialEndsAt) : null;
  const expiredTrial = input.status === "trial" && trialExpired(input.trialEndsAt);

  if (input.isPlatformOverride) {
    return {
      canUseApp: true,
      canUseStorefront: true,
      reason: null,
      status: input.status,
      trialEndsAt: input.trialEndsAt,
      daysLeftInTrial,
      needsPayment: false,
      needsCard: false,
      isTrial: input.status === "trial",
      monthlyAmountEur,
    };
  }

  if (input.status === "suspended" || input.status === "cancelled") {
    return {
      canUseApp: false,
      canUseStorefront: false,
      reason:
        input.status === "suspended"
          ? "Your subscription is suspended. Pay your invoice to restore access."
          : "This shop subscription has been cancelled.",
      status: input.status,
      trialEndsAt: input.trialEndsAt,
      daysLeftInTrial,
      needsPayment: true,
      needsCard: !input.cardOnFile,
      isTrial: false,
      monthlyAmountEur,
    };
  }

  if (expiredTrial && !input.cardOnFile) {
    return {
      canUseApp: false,
      canUseStorefront: false,
      reason: "Your free trial has ended. Add a payment method to continue.",
      status: input.status,
      trialEndsAt: input.trialEndsAt,
      daysLeftInTrial: 0,
      needsPayment: true,
      needsCard: true,
      isTrial: true,
      monthlyAmountEur,
    };
  }

  if (expiredTrial && input.cardOnFile) {
    return {
      canUseApp: false,
      canUseStorefront: false,
      reason: "Your trial has ended. Complete subscription to continue using ShopOS.",
      status: input.status,
      trialEndsAt: input.trialEndsAt,
      daysLeftInTrial: 0,
      needsPayment: true,
      needsCard: false,
      isTrial: true,
      monthlyAmountEur,
    };
  }

  if (input.status === "past_due") {
    return {
      canUseApp: true,
      canUseStorefront: true,
      reason: "Payment failed. Update your card to avoid suspension.",
      status: input.status,
      trialEndsAt: input.trialEndsAt,
      daysLeftInTrial,
      needsPayment: true,
      needsCard: false,
      isTrial: false,
      monthlyAmountEur,
    };
  }

  const canUseApp = APP_ALLOWED_STATUSES.has(input.status);
  const canUseStorefront = STOREFRONT_ALLOWED_STATUSES.has(input.status);

  return {
    canUseApp,
    canUseStorefront,
    reason:
      input.status === "trial" && daysLeftInTrial != null && daysLeftInTrial <= 7
        ? `Trial ends in ${daysLeftInTrial} day${daysLeftInTrial === 1 ? "" : "s"}.`
        : null,
    status: input.status,
    trialEndsAt: input.trialEndsAt,
    daysLeftInTrial,
    needsPayment: false,
    needsCard: input.status === "trial" && !input.cardOnFile,
    isTrial: input.status === "trial",
    monthlyAmountEur,
  };
}
