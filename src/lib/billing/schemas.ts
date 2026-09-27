import { z } from "zod";
import { entityIdSchema } from "@/lib/entity-id";
import {
  detectCardBrand,
  isExpiryInFuture,
  isValidCardNumber,
  isValidCardholderName,
  isValidCvc,
} from "@/lib/billing/card";

export const paymentCardSchema = z
  .object({
    cardholderName: z.string().min(1, "Enter the name on the card."),
    cardNumber: z.string().min(1, "Enter a card number."),
    expiryMonth: z.string(),
    expiryYear: z.string(),
    cvc: z.string().min(1, "Enter the security code."),
  })
  .superRefine((value, ctx) => {
    if (!isValidCardholderName(value.cardholderName)) {
      ctx.addIssue({
        code: "custom",
        path: ["cardholderName"],
        message: "Enter the name as it appears on the card.",
      });
    }
    if (!isValidCardNumber(value.cardNumber)) {
      ctx.addIssue({
        code: "custom",
        path: ["cardNumber"],
        message: "That card number is not valid.",
      });
    }
    if (!isExpiryInFuture(value.expiryMonth, value.expiryYear)) {
      ctx.addIssue({
        code: "custom",
        path: ["expiryMonth"],
        message: "Enter a valid expiry date.",
      });
    }
    const brand = detectCardBrand(value.cardNumber);
    if (!isValidCvc(value.cvc, brand)) {
      ctx.addIssue({
        code: "custom",
        path: ["cvc"],
        message: brand === "amex" ? "Enter the 4-digit CID." : "Enter the 3-digit CVC.",
      });
    }
  });

/** @deprecated Use paymentCardSchema */
export const demoCardSchema = paymentCardSchema;

export const platformTenantActionSchema = z.object({
  tenantId: z
    .string()
    .regex(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      "Invalid shop id.",
    ),
});

export const extendTrialSchema = platformTenantActionSchema.extend({
  days: z.coerce.number().int().min(1).max(90),
});

export const SHOP_MEMBER_ROLES = ["owner", "manager", "accountant", "cashier"] as const;

export const platformCreateShopMemberSchema = z.object({
  tenantId: z
    .string()
    .regex(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      "Invalid shop id.",
    ),
  fullName: z.string().min(1).max(120),
  email: z.string().min(1).max(254),
  role: z.enum(SHOP_MEMBER_ROLES),
  password: z.string().min(1).max(72),
  resetPasswordIfExists: z.boolean().optional(),
});

export const platformShopMemberIdSchema = platformTenantActionSchema.extend({
  userId: entityIdSchema,
});

export const platformUpdateShopMemberRoleSchema = platformShopMemberIdSchema.extend({
  role: z.enum(SHOP_MEMBER_ROLES),
});

export const platformSetShopMemberPasswordSchema = platformShopMemberIdSchema.extend({
  password: z.string().min(1).max(72),
});
