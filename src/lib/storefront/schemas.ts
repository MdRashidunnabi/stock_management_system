import { z } from "zod";

export const storefrontCartItemSchema = z.object({
  productId: z.string().uuid(),
  qty: z.coerce.number().positive().max(999),
});

export const placeOnlineOrderSchema = z
  .object({
    shopSlug: z.string().min(2).max(64),
    items: z.array(storefrontCartItemSchema).min(1).max(50),
    customerName: z.string().min(2).max(120),
    customerPhone: z.string().min(6).max(40),
    customerEmail: z.string().email().optional().or(z.literal("")),
    fulfillment: z.enum(["delivery", "takeaway"]),
    paymentMethod: z.enum(["cod", "online_card"]),
    deliveryAddress: z.string().max(500).optional(),
    pickupAt: z.string().max(64).optional(),
    notes: z.string().max(1000).optional(),
    clientUuid: z.string().uuid().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.fulfillment === "delivery") {
      if (!data.deliveryAddress?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Delivery address is required",
          path: ["deliveryAddress"],
        });
      }
    } else if (!data.pickupAt?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please choose when you will collect your order",
        path: ["pickupAt"],
      });
    }
  });

const optionalUrl = z
  .string()
  .max(500)
  .optional()
  .or(z.literal(""))
  .transform((v) => {
    const t = (v ?? "").trim();
    return t.length > 0 ? t : null;
  });

export const updateStorefrontSettingsSchema = z.object({
  publicSiteName: z.string().min(2).max(120),
  logoUrl: z.string().max(2000).optional().or(z.literal("")),
  customDomain: z
    .string()
    .max(253)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v?.trim() ? v.trim().toLowerCase() : null)),
  deliveryStandardFee: z.coerce.number().min(0).max(99.99),
  deliveryFreeOver: z.coerce.number().min(0).max(9999),
  deliveryMinOrder: z.coerce.number().min(0).max(9999),
  enableTakeaway: z.boolean(),
  enableOnlinePayment: z.boolean(),
  orderNotice: z.string().max(500).optional().or(z.literal("")),
  footerAbout: z.string().max(4000).optional().or(z.literal("")),
  phone: z.string().max(40).optional().or(z.literal("")),
  whatsapp: z.string().max(40).optional().or(z.literal("")),
  callUsLabel: z.string().max(80).optional().or(z.literal("")),
  facebookUrl: optionalUrl,
  twitterUrl: optionalUrl,
  youtubeUrl: optionalUrl,
  instagramUrl: optionalUrl,
  onlinePriceMarkupPct: z.coerce.number().min(0).max(50),
});

export type PlaceOnlineOrderInput = z.infer<typeof placeOnlineOrderSchema>;
export type UpdateStorefrontSettingsInput = z.infer<typeof updateStorefrontSettingsSchema>;
