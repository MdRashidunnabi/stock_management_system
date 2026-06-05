"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ActionError, staffActionClient } from "@/lib/safe-action";
import { updateStorefrontSettingsSchema } from "@/lib/storefront/schemas";

const SETTINGS_ROLES = ["owner", "manager", "super_admin"] as const;

export const updateStorefrontSettingsAction = staffActionClient([...SETTINGS_ROLES])
  .metadata({ actionName: "storefront.updateSettings" })
  .inputSchema(updateStorefrontSettingsSchema)
  .action(async ({ parsedInput, ctx }) => {
    const supabase = await createClient();

    const { error } = await supabase
      .from("tenant_storefronts")
      .update({
        public_site_name: parsedInput.publicSiteName.trim(),
        custom_domain: parsedInput.customDomain,
        delivery_standard_fee: parsedInput.deliveryStandardFee,
        delivery_free_over: parsedInput.deliveryFreeOver,
        delivery_min_order: parsedInput.deliveryMinOrder,
        enable_takeaway: parsedInput.enableTakeaway,
        enable_online_payment: parsedInput.enableOnlinePayment,
        order_notice: parsedInput.orderNotice?.trim() || null,
        logo_url: parsedInput.logoUrl?.trim() || null,
        footer_about: parsedInput.footerAbout?.trim() || null,
        phone: parsedInput.phone?.trim() || null,
        whatsapp: parsedInput.whatsapp?.trim() || null,
        call_us_label: parsedInput.callUsLabel?.trim() || "Call us now",
        facebook_url: parsedInput.facebookUrl,
        twitter_url: parsedInput.twitterUrl,
        youtube_url: parsedInput.youtubeUrl,
        instagram_url: parsedInput.instagramUrl,
        online_price_markup_pct: parsedInput.onlinePriceMarkupPct,
      })
      .eq("tenant_id", ctx.tenant.tenantId);

    if (error) throw new ActionError(error.message);

    revalidatePath("/settings/storefront");
    revalidatePath("/online-orders");
    revalidatePath(`/shop/${ctx.tenant.tenantSlug}`);

    return { ok: true as const };
  });
