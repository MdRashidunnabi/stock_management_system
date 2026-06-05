import { z } from "zod";

export const STAFF_INVITE_ROLES = ["manager", "cashier", "accountant", "warehouse"] as const;

export const createInviteSchema = z.object({
  email: z.string().email().max(200),
  role: z.enum(STAFF_INVITE_ROLES),
  branchId: z.string().uuid().optional().or(z.literal("")),
});

export const revokeInviteSchema = z.object({
  inviteId: z.string().uuid(),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(16).max(128),
});
