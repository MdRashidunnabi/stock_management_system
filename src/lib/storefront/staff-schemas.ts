import { z } from "zod";

export const publicOrderTrackSchema = z.object({
  shopSlug: z.string().min(2).max(64),
  orderNumber: z.string().min(3).max(40),
  phone: z.string().min(6).max(40),
});
