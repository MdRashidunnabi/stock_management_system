import { z } from "zod";
import { isCountryCode } from "@/lib/geo/countries";

/**
 * Shared auth-related Zod schemas. Used by both server actions (validation)
 * and client forms (react-hook-form resolvers) so the contract is identical.
 * Messages are i18n keys resolved in the UI via `displayMessage`.
 */

export const emailSchema = z
  .string()
  .min(1, "errors.emailRequired")
  .email("errors.emailInvalid")
  .max(254, "errors.emailLong")
  .transform((v) => v.trim().toLowerCase());

export const passwordSchema = z
  .string()
  .min(8, "errors.passwordMin")
  .max(72, "errors.passwordMax")
  .regex(/[A-Za-z]/, "errors.passwordLetter")
  .regex(/\d/, "errors.passwordNumber");

export const fullNameSchema = z
  .string()
  .min(1, "errors.nameRequired")
  .max(120, "errors.nameLong")
  .transform((v) => v.trim());

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "errors.passwordRequired"),
  next: z.string().optional(),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const signUpSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
  password: passwordSchema,
  country: z
    .string()
    .min(1, "errors.countryRequired")
    .refine((v) => isCountryCode(v), "errors.countryRequired"),
  marketingOptIn: z.boolean().optional(),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "errors.confirmPassword"),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "errors.passwordMismatch",
    path: ["confirmPassword"],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const setActiveTenantSchema = z.object({
  tenantId: z.string().uuid("errors.generic"),
});
