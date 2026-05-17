import { z } from "zod";
import { eircodeSchema, vatNumberSchema } from "@/lib/onboarding/schemas";

const trimmedRequired = (max: number, label: string) =>
  z
    .string()
    .min(1, `${label} is required`)
    .max(max, `${label} is too long`)
    .transform((v) => v.trim());

const trimmedOptional = (max: number) =>
  z
    .string()
    .max(max, `Must be at most ${max} characters`)
    .optional()
    .transform((v) => (v ? v.trim() : v));

const phoneSchema = z
  .string()
  .max(40)
  .optional()
  .transform((v) => (v ? v.trim() : v));

const emailSchema = z
  .string()
  .max(254)
  .optional()
  .transform((v) => (v ? v.trim().toLowerCase() : v))
  .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Enter a valid email address");

const codeSchema = z
  .string()
  .max(40, "Code is too long")
  .optional()
  .transform((v) => (v ? v.trim().toUpperCase() : v))
  .refine((v) => !v || /^[A-Z0-9_-]+$/.test(v), "Use letters, numbers, dashes, or underscores");

export const supplierBaseSchema = z.object({
  code: codeSchema,
  name: trimmedRequired(160, "Supplier name"),
  legalName: trimmedOptional(160),
  vatNumber: vatNumberSchema,
  contactName: trimmedOptional(120),
  email: emailSchema,
  phone: phoneSchema,
  addressLine1: trimmedOptional(200),
  addressLine2: trimmedOptional(200),
  city: trimmedOptional(80),
  county: trimmedOptional(80),
  eircode: eircodeSchema,
  country: z.string().min(2).max(2).default("IE"),
  paymentTerms: trimmedOptional(80),
  defaultLeadTimeDays: z.coerce.number().int().min(0).max(365).optional(),
  defaultCurrency: z.string().min(3).max(3).default("EUR"),
  notes: trimmedOptional(2000),
  isActive: z.boolean().default(true),
});

export const createSupplierSchema = supplierBaseSchema;
export const updateSupplierSchema = supplierBaseSchema.extend({
  id: z.string().uuid("Invalid id"),
});

export const supplierIdSchema = z.object({ id: z.string().uuid("Invalid id") });

export type SupplierFormInput = z.input<typeof createSupplierSchema>;
export type SupplierFormOutput = z.output<typeof createSupplierSchema>;

export interface SupplierListRow {
  id: string;
  code: string | null;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  county: string | null;
  country: string;
  payment_terms: string | null;
  default_lead_time_days: number | null;
  is_active: boolean;
  created_at: string;
}

export interface SupplierFullRow {
  id: string;
  code: string | null;
  name: string;
  legal_name: string | null;
  vat_number: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  county: string | null;
  eircode: string | null;
  country: string;
  payment_terms: string | null;
  default_lead_time_days: number | null;
  default_currency: string;
  notes: string | null;
  is_active: boolean;
}
