"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { DeliveryAreasEditor } from "@/components/storefront/delivery-areas-editor";
import { StorefrontLogoField } from "@/components/storefront/storefront-logo-field";
import { VoucherTiersEditor } from "@/components/storefront/voucher-tiers-editor";
import { ShopThemePicker } from "@/components/storefront/shop-theme-picker";
import type { DeliveryArea } from "@/lib/storefront/delivery";
import type { VoucherTier } from "@/lib/vouchers/rules";
import {
  checkShopDomainAction,
  updateStorefrontSettingsAction,
} from "@/lib/storefront/settings-actions";
import type { ShopDomainStatus } from "@/lib/storefront/shop-domain";
import type { StorefrontSettingsRow } from "@/lib/storefront/settings-queries";
import type { ShopTemplateId } from "@/lib/storefront/templates";

interface Props {
  settings: StorefrontSettingsRow;
  shopPath: string;
  appOrigin: string;
  domainStatus: ShopDomainStatus | null;
  webhookUrl: string;
}

export function StorefrontSettingsForm({
  settings,
  shopPath,
  appOrigin,
  domainStatus,
  webhookUrl,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [enableTakeaway, setEnableTakeaway] = useState(settings.enableTakeaway);
  const [enableOnlinePayment, setEnableOnlinePayment] = useState(settings.enableOnlinePayment);
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl ?? "");
  const [themeId, setThemeId] = useState<ShopTemplateId>(settings.themeId);
  const [posVoucherEnabled, setPosVoucherEnabled] = useState(settings.posVoucherEnabled);
  const [areas, setAreas] = useState<DeliveryArea[]>(settings.deliveryAreas);
  const [onlineTiers, setOnlineTiers] = useState<VoucherTier[]>(settings.onlineVoucherTiers);
  const [posTiers, setPosTiers] = useState<VoucherTier[]>(settings.posVoucherTiers);
  const [domain, setDomain] = useState<ShopDomainStatus | null>(domainStatus);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await updateStorefrontSettingsAction({
        publicSiteName: String(fd.get("publicSiteName") ?? ""),
        logoUrl,
        customDomain: String(fd.get("customDomain") ?? ""),
        deliveryStandardFee: Math.max(0, ...areas.map((area) => Number(area.fee) || 0)),
        deliveryFreeOver: 9999,
        deliveryMinOrder: areas.length
          ? Math.min(...areas.map((area) => Number(area.minOrder) || 0))
          : 0,
        deliveryAreasJson: JSON.stringify(areas),
        enableTakeaway,
        enableOnlinePayment,
        orderNotice: String(fd.get("orderNotice") ?? ""),
        footerAbout: String(fd.get("footerAbout") ?? ""),
        phone: String(fd.get("phone") ?? ""),
        whatsapp: String(fd.get("whatsapp") ?? ""),
        callUsLabel: String(fd.get("callUsLabel") ?? ""),
        facebookUrl: String(fd.get("facebookUrl") ?? ""),
        twitterUrl: String(fd.get("twitterUrl") ?? ""),
        youtubeUrl: String(fd.get("youtubeUrl") ?? ""),
        instagramUrl: String(fd.get("instagramUrl") ?? ""),
        onlinePriceMarkupPct: Number(fd.get("onlinePriceMarkupPct")),
        voucherEarnPct: 0,
        voucherMinimum: 0,
        posVoucherEnabled,
        posVoucherPct: 0,
        posVoucherDays: Number(fd.get("posVoucherDays")),
        posVoucherMinimum: 0,
        onlineTiersJson: JSON.stringify(onlineTiers),
        posTiersJson: JSON.stringify(posTiers),
        stripePublishableKey: String(fd.get("stripePublishableKey") ?? ""),
        stripeSecretKey: String(fd.get("stripeSecretKey") ?? ""),
        stripeWebhookSecret: String(fd.get("stripeWebhookSecret") ?? ""),
        themeId,
      });

      if (result?.serverError) {
        setError(result.serverError);
        toast.error(result.serverError);
        return;
      }
      if (result?.validationErrors) {
        const msg = "Please check the form fields";
        setError(msg);
        toast.error(msg);
        return;
      }
      if (!result?.data?.ok) {
        setError("Could not save settings");
        return;
      }

      toast.success("Online shop settings saved");
      setDomain(result.data.domain ?? null);
      router.refresh();
    });
  }

  const defaultShopUrl = `${appOrigin}${shopPath}`;

  function checkDomain() {
    startTransition(async () => {
      const result = await checkShopDomainAction();
      if (result?.serverError) {
        toast.error(result.serverError);
        return;
      }
      setDomain(result?.data?.domain ?? null);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <ShopThemePicker value={themeId} onChange={setThemeId} shopPath={shopPath} />

      <div className="max-w-xl space-y-8">
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Website & domain</h2>
          </div>
          <StorefrontLogoField value={logoUrl} onChange={setLogoUrl} />

          <div className="space-y-2">
            <Label htmlFor="publicSiteName">Website name</Label>
            <Input
              id="publicSiteName"
              name="publicSiteName"
              required
              defaultValue={settings.publicSiteName ?? settings.tenantDisplayName}
              placeholder="Needscarlow"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customDomain">Custom domain</Label>
            <Input
              id="customDomain"
              name="customDomain"
              defaultValue={settings.customDomain ?? ""}
              placeholder="yourshop.ie"
            />
            <p className="text-muted-foreground text-xs">
              Shop link until the domain is live: {defaultShopUrl}
            </p>
            {domain ? (
              <div className="space-y-3 rounded-lg border p-3">
                <p className="text-sm">{domain.message}</p>
                {domain.records.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-muted-foreground">
                          <th className="py-1 pr-3 font-medium">Type</th>
                          <th className="py-1 pr-3 font-medium">Host</th>
                          <th className="py-1 font-medium">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {domain.records.map((row) => (
                          <tr key={`${row.type}-${row.host}-${row.value}`}>
                            <td className="py-1 pr-3">{row.type}</td>
                            <td className="py-1 pr-3">{row.host}</td>
                            <td className="py-1 font-mono">{row.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={checkDomain}
                >
                  {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                  Attach and check certificate
                </Button>
              </div>
            ) : null}
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Contact & footer</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                name="phone"
                defaultValue={settings.phone ?? ""}
                placeholder="+353 59 123 4567"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input
                id="whatsapp"
                name="whatsapp"
                defaultValue={settings.whatsapp ?? ""}
                placeholder="+353851234567"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="callUsLabel">Call-us label (header)</Label>
            <Input
              id="callUsLabel"
              name="callUsLabel"
              defaultValue={settings.callUsLabel ?? "Call us now"}
              placeholder="Call us now"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="footerAbout">About text (footer)</Label>
            <Textarea
              id="footerAbout"
              name="footerAbout"
              rows={4}
              defaultValue={settings.footerAbout ?? ""}
              placeholder="Tell customers about your shop…"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="facebookUrl">Facebook URL</Label>
              <Input
                id="facebookUrl"
                name="facebookUrl"
                type="url"
                defaultValue={settings.facebookUrl ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="twitterUrl">Twitter / X URL</Label>
              <Input
                id="twitterUrl"
                name="twitterUrl"
                type="url"
                defaultValue={settings.twitterUrl ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="youtubeUrl">YouTube URL</Label>
              <Input
                id="youtubeUrl"
                name="youtubeUrl"
                type="url"
                defaultValue={settings.youtubeUrl ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="instagramUrl">Instagram URL</Label>
              <Input
                id="instagramUrl"
                name="instagramUrl"
                type="url"
                defaultValue={settings.instagramUrl ?? ""}
              />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Online shop pricing</h2>
          </div>
          <div className="max-w-xs space-y-2">
            <Label htmlFor="onlinePriceMarkupPct">Default online markup (%)</Label>
            <Input
              id="onlinePriceMarkupPct"
              name="onlinePriceMarkupPct"
              type="number"
              step="0.1"
              min={0}
              max={50}
              required
              defaultValue={settings.onlinePriceMarkupPct}
            />
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Voucher</h2>
            <p className="text-muted-foreground text-sm">
              The next voucher depends on how much the customer spends. Delivery is not included.
            </p>
            <VoucherTiersEditor
              title="Online sales"
              tiers={onlineTiers}
              onChange={setOnlineTiers}
            />
            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Till vouchers</p>
                <p className="text-muted-foreground text-xs">
                  Print a voucher with the till receipt after payment.
                </p>
              </div>
              <Switch
                checked={posVoucherEnabled}
                onCheckedChange={setPosVoucherEnabled}
                aria-label="Till vouchers"
              />
            </div>
            {posVoucherEnabled ? (
              <VoucherTiersEditor title="Till sales" tiers={posTiers} onChange={setPosTiers} />
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="posVoucherDays">Valid for (days)</Label>
                <Input
                  id="posVoucherDays"
                  name="posVoucherDays"
                  type="number"
                  min={1}
                  max={365}
                  step={1}
                  defaultValue={settings.posVoucherDays}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Delivery areas</h2>
            <p className="text-muted-foreground text-sm">
              Each area has its own minimum order, delivery charge, lead time, and delivery times.
              Customers see this when they order.
            </p>
          </div>
          <DeliveryAreasEditor areas={areas} onChange={setAreas} />
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Checkout options</h2>
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Takeaway / collection</p>
            </div>
            <Switch
              checked={enableTakeaway}
              onCheckedChange={setEnableTakeaway}
              aria-label="Enable takeaway"
            />
          </div>
          <div className="space-y-3 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Stripe card payments</p>
              <p className="text-muted-foreground text-xs">
                {settings.stripeConnected
                  ? `Connected ${settings.stripePublishableHint ?? ""}. Leave a box empty to keep the saved key.`
                  : "Paste the three values from Stripe. A paid card is then added to the online order automatically."}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stripePublishableKey">Publishable key</Label>
              <Input
                id="stripePublishableKey"
                name="stripePublishableKey"
                autoComplete="off"
                placeholder="pk_live_..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stripeSecretKey">Secret key</Label>
              <Input
                id="stripeSecretKey"
                name="stripeSecretKey"
                type="password"
                autoComplete="off"
                placeholder="sk_live_..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stripeWebhookSecret">Webhook signing secret</Label>
              <Input
                id="stripeWebhookSecret"
                name="stripeWebhookSecret"
                type="password"
                autoComplete="off"
                placeholder="whsec_..."
              />
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs">Webhook URL to paste in Stripe</p>
              <p className="font-mono text-xs break-all">{webhookUrl}</p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Pay online (card)</p>
            </div>
            <Switch
              checked={enableOnlinePayment}
              onCheckedChange={setEnableOnlinePayment}
              aria-label="Enable online payment"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="orderNotice">Banner message on shop</Label>
            <Textarea
              id="orderNotice"
              name="orderNotice"
              rows={2}
              defaultValue={settings.orderNotice ?? ""}
              placeholder="Pay on delivery — we will confirm your order by phone."
            />
          </div>
        </section>

        {error ? <p className="text-destructive text-sm">{error}</p> : null}

        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          Save settings
        </Button>
      </div>
    </form>
  );
}
