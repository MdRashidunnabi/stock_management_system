import { z } from "zod";
import {
  BRANCH_TIER_OPTIONS,
  SHOP_TIER_OPTIONS,
  calculateMonthlyCents,
  normalizeBranchTier,
  normalizeShopTier,
  type BranchTier,
  type ShopTier,
} from "@/lib/billing/plans";
import { isCountryCode } from "@/lib/geo/countries";

const trimmed = (max: number, label: string) =>
  z
    .string()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`)
    .transform((v) => v.trim())
    .refine((v) => v.length > 0, `${label} is required`);

const optionalTrim = (max: number) =>
  z
    .string()
    .max(max, `Must be at most ${max} characters`)
    .optional()
    .transform((v) => (v ? v.trim() : v));

export const slugSchema = z
  .string()
  .min(2, "Slug must be at least 2 characters")
  .max(60, "Slug must be at most 60 characters")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and single dashes only");

export const vatNumberSchema = z
  .string()
  .max(32, "Tax ID is too long")
  .optional()
  .transform((v) => (v ? v.trim().toUpperCase() : v))
  .refine((v) => !v || /^[A-Z0-9][A-Z0-9 \-./]{4,31}$/.test(v), "Enter a valid tax / VAT number");

export const postalCodeSchema = z
  .string()
  .max(16, "Postcode is too long")
  .optional()
  .transform((v) => (v ? v.trim().toUpperCase() : v));

/** @deprecated Use postalCodeSchema. Kept for branch/supplier forms. */
export const eircodeSchema = postalCodeSchema;

export const branchCodeSchema = z
  .string()
  .min(2, "Branch code must be at least 2 characters")
  .max(16, "Branch code must be at most 16 characters")
  .transform((v) => v.trim().toUpperCase())
  .refine((v) => /^[A-Z0-9_-]+$/.test(v), "Use letters, numbers, dashes, or underscores");

const tierEnum = (options: readonly number[]) =>
  z.coerce
    .number()
    .refine((n) => options.includes(n as (typeof options)[number]), "Pick a plan option");

export const planStepSchema = z.object({
  planShopTier: tierEnum(SHOP_TIER_OPTIONS),
  planBranchTier: tierEnum(BRANCH_TIER_OPTIONS),
});
export type PlanStepInput = z.infer<typeof planStepSchema>;

export const shopStepSchema = z.object({
  country: z
    .string()
    .min(1, "Pick your country")
    .refine((v) => isCountryCode(v), "Pick your country"),
  legalName: trimmed(160, "Legal name"),
  displayName: trimmed(120, "Shop display name"),
  slug: slugSchema,
  vatNumber: vatNumberSchema,
});
export type ShopStepInput = z.infer<typeof shopStepSchema>;

export const branchStepSchema = z.object({
  branchCode: branchCodeSchema,
  branchName: trimmed(120, "Branch name"),
  branchAddressLine1: optionalTrim(200),
  branchCity: optionalTrim(80),
  branchCounty: optionalTrim(80),
  branchEircode: postalCodeSchema,
});
export type BranchStepInput = z.infer<typeof branchStepSchema>;

export const createTenantSchema = planStepSchema.merge(shopStepSchema).merge(branchStepSchema);
export type CreateTenantInput = z.infer<typeof createTenantSchema>;

const shopInSetupSchema = shopStepSchema.extend({
  key: z.string().min(1),
});

const branchInSetupSchema = branchStepSchema.extend({
  key: z.string().min(1),
  shopKey: z.string().min(1),
});

export const onboardingSetupSchema = z
  .object({
    shops: z.array(shopInSetupSchema).min(1, "Add at least one shop.").max(30),
    branches: z.array(branchInSetupSchema).min(1, "Add at least one branch.").max(900),
  })
  .superRefine((value, ctx) => {
    const slugs = value.shops.map((s) => s.slug);
    if (new Set(slugs).size !== slugs.length) {
      ctx.addIssue({
        code: "custom",
        message: "Each shop needs a different URL handle.",
        path: ["shops"],
      });
    }
    const shopKeys = new Set(value.shops.map((s) => s.key));
    for (const [index, branch] of value.branches.entries()) {
      if (!shopKeys.has(branch.shopKey)) {
        ctx.addIssue({
          code: "custom",
          message: "That branch is not attached to a shop you added.",
          path: ["branches", index, "shopKey"],
        });
      }
    }
    for (const shop of value.shops) {
      const forShop = value.branches.filter((b) => b.shopKey === shop.key);
      if (forShop.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: `Add a branch for ${shop.displayName}.`,
          path: ["branches"],
        });
        continue;
      }
      const codes = forShop.map((b) => b.branchCode);
      if (new Set(codes).size !== codes.length) {
        ctx.addIssue({
          code: "custom",
          message: `Branch codes must be unique inside ${shop.displayName}.`,
          path: ["branches"],
        });
      }
    }
  });

export type OnboardingSetupInput = z.infer<typeof onboardingSetupSchema>;

export function monthlyCentsFromPlanInput(input: PlanStepInput): number {
  return calculateMonthlyCents(
    normalizeShopTier(input.planShopTier),
    normalizeBranchTier(input.planBranchTier),
  );
}

export function planTiersFromInput(input: PlanStepInput): {
  shopTier: ShopTier;
  branchTier: BranchTier;
} {
  return {
    shopTier: normalizeShopTier(input.planShopTier),
    branchTier: normalizeBranchTier(input.planBranchTier),
  };
}
