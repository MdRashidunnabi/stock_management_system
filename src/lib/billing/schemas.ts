import { z } from "zod";

export const demoCardSchema = z.object({
  cardholderName: z.string().min(2).max(120),
  cardNumber: z.string().min(13).max(24),
  expiryMonth: z.string().regex(/^(0[1-9]|1[0-2])$/, "Use MM"),
  expiryYear: z.string().regex(/^\d{2}$/, "Use YY"),
  cvc: z.string().regex(/^\d{3,4}$/, "Use 3–4 digits"),
});

export const platformTenantActionSchema = z.object({
  tenantId: z.string().uuid(),
});

export const extendTrialSchema = platformTenantActionSchema.extend({
  days: z.coerce.number().int().min(1).max(90),
});
