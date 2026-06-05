import "server-only";

import { env } from "@/lib/env";
import {
  demoActivate,
  demoAttachCard,
  demoCancel,
  demoExtendTrial,
  demoPastDue,
  demoPay,
  demoSuspend,
} from "@/lib/billing/demo-provider";
import type { BillingProviderApi } from "@/lib/billing/types";

export type { BillingProviderApi } from "@/lib/billing/types";

/**
 * Returns Stripe when keys exist; otherwise demo billing for local/product demos.
 */
export function getBillingProvider(): BillingProviderApi {
  if (env.STRIPE_SECRET_KEY?.trim()) {
    return createStripeProviderStub();
  }
  return createDemoBillingProvider();
}

function createDemoBillingProvider(): BillingProviderApi {
  return {
    name: "demo",
    attachDemoCard: demoAttachCard,
    activateAfterTrial: demoActivate,
    recordSuccessfulPayment: demoPay,
    markPastDue: demoPastDue,
    suspend: demoSuspend,
    cancel: demoCancel,
    extendTrial: demoExtendTrial,
  };
}

function createStripeProviderStub(): BillingProviderApi {
  return {
    name: "stripe",
    async attachDemoCard() {
      throw new Error("Use Stripe Checkout — configure webhooks in settings.");
    },
    async activateAfterTrial() {
      throw new Error("Stripe subscription activation not wired yet.");
    },
    async recordSuccessfulPayment() {
      throw new Error("Use Stripe webhooks.");
    },
    async markPastDue() {
      throw new Error("Use Stripe webhooks.");
    },
    async suspend() {
      throw new Error("Use Stripe webhooks.");
    },
    async cancel() {
      throw new Error("Use Stripe webhooks.");
    },
    async extendTrial() {
      throw new Error("Use Stripe dashboard or API.");
    },
  };
}
