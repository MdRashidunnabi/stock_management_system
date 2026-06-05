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
import { StorefrontLogoField } from "@/components/storefront/storefront-logo-field";
import { updateStorefrontSettingsAction } from "@/lib/storefront/settings-actions";
import type { StorefrontSettingsRow } from "@/lib/storefront/settings-queries";

interface Props {
  settings: StorefrontSettingsRow;
  shopPath: string;
  appOrigin: string;
}

export function StorefrontSettingsForm({ settings, shopPath, appOrigin }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [enableTakeaway, setEnableTakeaway] = useState(settings.enableTakeaway);
  const [enableOnlinePayment, setEnableOnlinePayment] = useState(settings.enableOnlinePayment);
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl ?? "");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await updateStorefrontSettingsAction({
        publicSiteName: String(fd.get("publicSiteName") ?? ""),
        logoUrl,
        customDomain: String(fd.get("customDomain") ?? ""),
        deliveryStandardFee: Number(fd.get("deliveryStandardFee")),
        deliveryFreeOver: Number(fd.get("deliveryFreeOver")),
        deliveryMinOrder: Number(fd.get("deliveryMinOrder")),
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
      router.refresh();
    });
  }

  const defaultShopUrl = `${appOrigin}${shopPath}`;
  const domainHint = settings.customDomain
    ? `When DNS points ${settings.customDomain} to this app, customers can use your domain. Until then: ${defaultShopUrl}`
    : `Default shop link: ${defaultShopUrl}`;

  return (
    <form onSubmit={onSubmit} className="max-w-xl space-y-8">
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Website & domain</h2>
          <p className="text-muted-foreground text-sm">
            Name shown on your public shop and the domain you plan to use (e.g. needscarlow.ie).
          </p>
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
          <p className="text-muted-foreground text-xs">{domainHint}</p>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Contact & footer</h2>
          <p className="text-muted-foreground text-sm">
            Shown in the shop header, footer, and &quot;Call us now&quot; block. Does not change POS
            receipts.
          </p>
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
          <p className="text-muted-foreground text-sm">
            Default markup on in-store prices when a product has no manual online price. Set to 0
            for the same price as the till. Per-product overrides are on each product page.
          </p>
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
          <h2 className="text-lg font-semibold">Delivery charges</h2>
          <p className="text-muted-foreground text-sm">
            Flat fee under a threshold, free delivery above it. Calculated automatically at
            checkout.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="deliveryStandardFee">Standard fee (€)</Label>
            <Input
              id="deliveryStandardFee"
              name="deliveryStandardFee"
              type="number"
              step="0.01"
              min={0}
              required
              defaultValue={settings.delivery.standardFee}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="deliveryFreeOver">Free delivery over (€)</Label>
            <Input
              id="deliveryFreeOver"
              name="deliveryFreeOver"
              type="number"
              step="0.01"
              min={0}
              required
              defaultValue={settings.delivery.freeOver}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="deliveryMinOrder">Min order hint (€)</Label>
            <Input
              id="deliveryMinOrder"
              name="deliveryMinOrder"
              type="number"
              step="0.01"
              min={0}
              required
              defaultValue={settings.delivery.minOrder}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Checkout options</h2>
        <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">Takeaway / collection</p>
            <p className="text-muted-foreground text-xs">Customer picks a collection time</p>
          </div>
          <Switch
            checked={enableTakeaway}
            onCheckedChange={setEnableTakeaway}
            aria-label="Enable takeaway"
          />
        </div>
        <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">Pay online (card)</p>
            <p className="text-muted-foreground text-xs">
              Records card payment as pending until Stripe is connected
            </p>
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
    </form>
  );
}
