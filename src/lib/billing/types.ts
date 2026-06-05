export type BillingProvider = "demo" | "stripe";

export interface BillingProviderApi {
  readonly name: BillingProvider;
  attachDemoCard(tenantId: string, card: DemoCardInput): Promise<void>;
  activateAfterTrial(tenantId: string): Promise<void>;
  recordSuccessfulPayment(tenantId: string): Promise<void>;
  markPastDue(tenantId: string): Promise<void>;
  suspend(tenantId: string): Promise<void>;
  cancel(tenantId: string): Promise<void>;
  extendTrial(tenantId: string, days: number): Promise<void>;
}

export type TenantBillingRow = {
  tenantId: string;
  provider: BillingProvider;
  planCode: string;
  monthlyAmountCents: number;
  currency: string;
  cardOnFile: boolean;
  cardLast4: string | null;
  cardBrand: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  nextBillingAt: string | null;
  lastPaymentAt: string | null;
  lastPaymentStatus: string | null;
  canceledAt: string | null;
};

export type SubscriptionAccess = {
  canUseApp: boolean;
  canUseStorefront: boolean;
  reason: string | null;
  status: string;
  trialEndsAt: string | null;
  daysLeftInTrial: number | null;
  needsPayment: boolean;
  needsCard: boolean;
  isTrial: boolean;
  monthlyAmountEur: number;
};

export type DemoCardInput = {
  cardholderName: string;
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cvc: string;
};
