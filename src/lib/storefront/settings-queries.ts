import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { DeliverySettings } from "@/lib/storefront/delivery";

export interface StorefrontSettingsRow {
  tenantId: string;
  tenantSlug: string;
  tenantDisplayName: string;
  enabled: boolean;
  publicSiteName: string | null;
  customDomain: string | null;
  delivery: DeliverySettings;
  enableTakeaway: boolean;
  enableOnlinePayment: boolean;
  orderNotice: string | null;
  logoUrl: string | null;
  footerAbout: string | null;
  phone: string | null;
  whatsapp: string | null;
  callUsLabel: string | null;
  facebookUrl: string | null;
  twitterUrl: string | null;
  youtubeUrl: string | null;
  instagramUrl: string | null;
  onlinePriceMarkupPct: number;
}

export async function getStorefrontSettingsForTenant(
  tenantId: string,
): Promise<StorefrontSettingsRow | null> {
  const supabase = await createClient();

  const { data: tenant, error: tErr } = await supabase
    .from("tenants")
    .select("id, slug, display_name")
    .eq("id", tenantId)
    .maybeSingle();

  if (tErr || !tenant) return null;

  const { data: sf, error } = await supabase
    .from("tenant_storefronts")
    .select(
      "enabled, public_site_name, custom_domain, logo_url, delivery_standard_fee, delivery_free_over, delivery_min_order, enable_takeaway, enable_online_payment, order_notice, footer_about, phone, whatsapp, call_us_label, facebook_url, twitter_url, youtube_url, instagram_url, online_price_markup_pct",
    )
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!sf) return null;

  return {
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    tenantDisplayName: tenant.display_name,
    enabled: sf.enabled,
    publicSiteName: sf.public_site_name,
    customDomain: sf.custom_domain,
    delivery: {
      standardFee: Number(sf.delivery_standard_fee ?? 4.99),
      freeOver: Number(sf.delivery_free_over ?? 50),
      minOrder: Number(sf.delivery_min_order ?? 15),
    },
    enableTakeaway: sf.enable_takeaway ?? true,
    enableOnlinePayment: sf.enable_online_payment ?? true,
    orderNotice: sf.order_notice,
    logoUrl: sf.logo_url,
    footerAbout: sf.footer_about,
    phone: sf.phone,
    whatsapp: sf.whatsapp,
    callUsLabel: sf.call_us_label,
    facebookUrl: sf.facebook_url,
    twitterUrl: sf.twitter_url,
    youtubeUrl: sf.youtube_url,
    instagramUrl: sf.instagram_url,
    onlinePriceMarkupPct: Number(sf.online_price_markup_pct ?? 0.5),
  };
}
