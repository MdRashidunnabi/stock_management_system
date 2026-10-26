"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ActionError, staffActionClient } from "@/lib/safe-action";
import { updateStorefrontSettingsSchema } from "@/lib/storefront/schemas";
import type { ShopDomainStatus } from "@/lib/storefront/shop-domain";
import { assertStripeKey, withShopStripe } from "@/lib/storefront/stripe-shop";
import { connectShopDomain, disconnectShopDomain } from "@/lib/storefront/vercel-domain";
import { normalizeDeliveryAreas, withDeliveryAreas } from "@/lib/storefront/delivery";
import { withVoucherSettings, type VoucherTier } from "@/lib/vouchers/rules";

const SETTINGS_ROLES = ["owner", "manager", "super_admin"] as const;

export const updateStorefrontSettingsAction = staffActionClient([...SETTINGS_ROLES])
  .metadata({ actionName: "storefront.updateSettings" })
  .inputSchema(updateStorefrontSettingsSchema)
  .action(async ({ parsedInput, ctx }) => {
    const supabase = await createClient();
    const { data: previous } = await supabase
      .from("tenant_storefronts")
      .select("custom_domain")
      .eq("tenant_id", ctx.tenant.tenantId)
      .maybeSingle();

    let areas: ReturnType<typeof normalizeDeliveryAreas> = [];
    if (parsedInput.deliveryAreasJson) {
      try {
        areas = normalizeDeliveryAreas(JSON.parse(parsedInput.deliveryAreasJson));
        if (areas.length === 0) {
          throw new ActionError("Add at least one delivery area with a name.");
        }
      } catch {
        throw new ActionError("Check the delivery areas.");
      }
    }
    const highestFee = areas.reduce((max, area) => Math.max(max, area.fee), 0);
    const lowestMin = areas.reduce((min, area) => Math.min(min, area.minOrder), 9999);
    const { error } = await supabase
      .from("tenant_storefronts")
      .update({
        public_site_name: parsedInput.publicSiteName.trim(),
        custom_domain: parsedInput.customDomain,
        delivery_standard_fee: areas.length ? highestFee : parsedInput.deliveryStandardFee,
        delivery_free_over: areas.length ? 9999 : parsedInput.deliveryFreeOver,
        delivery_min_order: areas.length ? lowestMin : parsedInput.deliveryMinOrder,
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
        theme_id: parsedInput.themeId,
      })
      .eq("tenant_id", ctx.tenant.tenantId);

    if (error) throw new ActionError(error.message);

    const { data: tenant } = await supabase
      .from("tenants")
      .select("notes")
      .eq("id", ctx.tenant.tenantId)
      .maybeSingle();
    const onlineTiers = parseTiers(parsedInput.onlineTiersJson);
    const posTiers = parseTiers(parsedInput.posTiersJson);
    let notes = withVoucherSettings(tenant?.notes, {
      onlinePct: parsedInput.voucherEarnPct,
      onlineMinimum: parsedInput.voucherMinimum,
      pos: {
        enabled: parsedInput.posVoucherEnabled,
        pct: parsedInput.posVoucherPct,
        days: parsedInput.posVoucherDays,
        minimum: parsedInput.posVoucherMinimum,
      },
      ...(onlineTiers ? { onlineTiers } : {}),
      ...(posTiers ? { posTiers } : {}),
    });
    if (areas.length) notes = withDeliveryAreas(notes, areas);
    const { error: noteError } = await supabase
      .from("tenants")
      .update({ notes })
      .eq("id", ctx.tenant.tenantId);
    if (noteError) throw new ActionError(noteError.message);

    try {
      const publishableKey = assertStripeKey("pk", parsedInput.stripePublishableKey || "");
      const secretKey = assertStripeKey("sk", parsedInput.stripeSecretKey || "");
      const webhookSecret = assertStripeKey("wh", parsedInput.stripeWebhookSecret || "");
      if (publishableKey || secretKey || webhookSecret) {
        const { data: fresh } = await supabase
          .from("tenants")
          .select("notes")
          .eq("id", ctx.tenant.tenantId)
          .maybeSingle();
        const { error: stripeError } = await supabase
          .from("tenants")
          .update({
            notes: withShopStripe(fresh?.notes, {
              publishableKey: publishableKey ?? undefined,
              secretKey: secretKey ?? undefined,
              webhookSecret: webhookSecret ?? undefined,
            }),
          })
          .eq("id", ctx.tenant.tenantId);
        if (stripeError) throw new ActionError(stripeError.message);
      }
    } catch (err) {
      if (err instanceof ActionError) throw err;
      throw new ActionError(err instanceof Error ? err.message : "Check the Stripe keys.");
    }

    const domain = await syncShopDomain(previous?.custom_domain, parsedInput.customDomain);

    revalidatePath("/settings/storefront");
    revalidatePath("/online-orders");
    revalidatePath(`/shop/${ctx.tenant.tenantSlug}`, "layout");

    return { ok: true as const, domain };
  });

export const checkShopDomainAction = staffActionClient([...SETTINGS_ROLES])
  .metadata({ actionName: "storefront.checkDomain" })
  .action(async ({ ctx }) => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("tenant_storefronts")
      .select("custom_domain")
      .eq("tenant_id", ctx.tenant.tenantId)
      .maybeSingle();
    if (!data?.custom_domain) {
      throw new ActionError("Save a domain first.");
    }
    const domain = await connectShopDomain(data.custom_domain);
    return { ok: true as const, domain };
  });

function parseTiers(raw: string | null | undefined): VoucherTier[] | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed
      .map((row) => {
        if (!row || typeof row !== "object") return null;
        const from = Number((row as { from?: unknown }).from);
        const amount = Number((row as { amount?: unknown }).amount);
        if (!Number.isFinite(from) || !Number.isFinite(amount)) return null;
        return { from, amount };
      })
      .filter((row): row is VoucherTier => row != null);
  } catch {
    throw new ActionError("Check the voucher amounts.");
  }
}

async function syncShopDomain(
  previous: string | null | undefined,
  next: string | null,
): Promise<ShopDomainStatus | null> {
  try {
    if (previous && previous !== next) await disconnectShopDomain(previous);
    if (!next) return null;
    return await connectShopDomain(next);
  } catch (error) {
    const domain = next ?? previous ?? "";
    return {
      domain,
      attached: false,
      verified: false,
      live: false,
      records: [],
      message: error instanceof Error ? error.message : "Could not attach this domain.",
    };
  }
}
