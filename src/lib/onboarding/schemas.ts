import { z } from "zod";

/**
 * Validation rules for the onboarding wizard.
 *
 * Field-level rules are written so the same schemas can be used for both
 * the client-side form (react-hook-form resolver) and the server action.
 */

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

/**
 * Slug for the tenant. Lower-case ASCII, dashes between words.
 * Examples: "greenway", "greenway-mini-market", "tom-and-co".
 * The server side will auto-suffix if the slug is already taken.
 */
export const slugSchema = z
  .string()
  .min(2, "Slug must be at least 2 characters")
  .max(60, "Slug must be at most 60 characters")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and single dashes only");

/**
 * Irish VAT registration number. Two recognised forms:
 *   - 7 digits + 1 or 2 letters (modern):  IE1234567T, IE1234567TX
 *   - 1 digit + letter + 5 digits + letter (legacy): IE1A23456B
 * We accept either, case-insensitive, and uppercase the value.
 * Empty string is allowed (VAT is optional for businesses below threshold).
 */
export const vatNumberSchema = z
  .string()
  .max(12, "VAT number is too long")
  .optional()
  .transform((v) => (v ? v.trim().toUpperCase() : v))
  .refine(
    (v) => !v || /^IE\d{7}[A-Z]{1,2}$/.test(v) || /^IE\d[A-Z]\d{5}[A-Z]$/.test(v),
    "Enter a valid Irish VAT number (e.g. IE1234567T)",
  );

/**
 * Irish Eircode. Routing key (3 chars) + space + unique identifier (4 chars).
 * E.g. "D07 XY12", "A65 F4E2", "D6W FNT4".
 */
export const eircodeSchema = z
  .string()
  .max(8, "Eircode is too long")
  .optional()
  .transform((v) => (v ? v.trim().toUpperCase().replace(/\s+/g, " ") : v))
  .refine(
    (v) => !v || /^(?:[AC-FHKNPRTV-Y]\d{2}|D6W)\s?[0-9AC-FHKNPRTV-Y]{4}$/.test(v),
    "Enter a valid Eircode (e.g. D07 XY12)",
  );

/**
 * Branch code. Short uppercase identifier per branch (UNIQUE per tenant).
 *   - 2 to 16 chars
 *   - letters, digits, dashes, underscores
 *   - we uppercase before storing
 */
export const branchCodeSchema = z
  .string()
  .min(2, "Branch code must be at least 2 characters")
  .max(16, "Branch code must be at most 16 characters")
  .transform((v) => v.trim().toUpperCase())
  .refine((v) => /^[A-Z0-9_-]+$/.test(v), "Use letters, numbers, dashes, or underscores");

/**
 * Step 1 - Shop details.
 */
export const shopStepSchema = z.object({
  legalName: trimmed(160, "Legal name"),
  displayName: trimmed(120, "Shop display name"),
  slug: slugSchema,
  vatNumber: vatNumberSchema,
});
export type ShopStepInput = z.infer<typeof shopStepSchema>;

/**
 * Step 2 - First branch.
 */
export const branchStepSchema = z.object({
  branchCode: branchCodeSchema,
  branchName: trimmed(120, "Branch name"),
  branchAddressLine1: optionalTrim(200),
  branchCity: optionalTrim(80),
  branchCounty: optionalTrim(80),
  branchEircode: eircodeSchema,
});
export type BranchStepInput = z.infer<typeof branchStepSchema>;

/**
 * Whole-form schema (sum of step 1 + step 2). This is what the server
 * action validates. Country / currency / timezone are locked to Ireland for
 * the MVP - we'll open them up when we expand beyond IE.
 */
export const createTenantSchema = shopStepSchema.merge(branchStepSchema);
export type CreateTenantInput = z.infer<typeof createTenantSchema>;
