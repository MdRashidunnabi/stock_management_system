import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatEuro } from "@/lib/utils";
import { getStorefrontShop } from "@/lib/storefront/queries";

export default async function OrderSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    order?: string;
    total?: string;
    fulfillment?: string;
    payment?: string;
    delivery?: string;
    wanted?: string;
    earned?: string;
    saved?: string;
    voucherNote?: string;
  }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const shop = await getStorefrontShop(slug);
  const orderNo = sp.order ?? "";
  const total = sp.total ? Number(sp.total) : null;
  const deliveryFee = sp.delivery ? Number(sp.delivery) : 0;
  const fulfillment = sp.fulfillment === "takeaway" ? "collection" : "delivery";
  const earned = sp.earned ? Number(sp.earned) : 0;
  const saved = sp.saved ? Number(sp.saved) : 0;
  const cardPay = sp.payment === "online_card";
  const payment = cardPay
    ? "online card — we will send a secure payment link after we confirm stock"
    : "cash on delivery";

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <CheckCircle2 className="text-success mx-auto size-12" />
      <h1 className="mt-4 text-2xl font-bold">Thank you!</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Your order{orderNo ? ` ${orderNo}` : ""} has been received
        {shop ? ` by ${shop.publicSiteName}` : ""}.
        {total != null && Number.isFinite(total) ? ` Total: ${formatEuro(total)}.` : ""}
        {sp.wanted ? ` Wanted for ${sp.wanted}.` : ""}
      </p>
      <ul className="text-muted-foreground mt-4 space-y-1 text-xs">
        <li>
          <span className="font-medium text-stone-700 dark:text-stone-300">Fulfilment:</span>{" "}
          {fulfillment === "collection"
            ? "Takeaway — please arrive at your chosen time"
            : "Home delivery"}
        </li>
        <li>
          <span className="font-medium text-stone-700 dark:text-stone-300">Payment:</span> {payment}
        </li>
        {deliveryFee > 0 ? (
          <li>
            <span className="font-medium text-stone-700 dark:text-stone-300">Delivery fee:</span>{" "}
            {formatEuro(deliveryFee)}
          </li>
        ) : null}
      </ul>
      {saved > 0 ? (
        <p className="mt-4 text-sm font-medium">
          Voucher used: {formatEuro(saved)} off the products.
        </p>
      ) : null}
      {sp.voucherNote ? <p className="mt-3 text-sm text-amber-800">{sp.voucherNote}</p> : null}
      {earned > 0 ? (
        <div className="mx-auto mt-6 max-w-sm rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-left text-sm">
          <p className="font-semibold text-emerald-900">Your next voucher</p>
          <p className="mt-1 text-2xl font-bold text-emerald-800">{formatEuro(earned)}</p>
          <p className="mt-2 text-emerald-900">
            Valid for 30 days after you receive it. This screen has no code and no barcode.
          </p>
          <p className="mt-2 text-emerald-900">
            You will receive the original paper voucher, with its code, when you receive your
            products. After that code is used on a later order, it stops working.
          </p>
        </div>
      ) : null}
      <p className="text-muted-foreground mt-4 text-xs">
        Stock has been reserved from our shop. We will call you to confirm your order.
        {cardPay
          ? " After confirmation we send a payment link — you do not enter card details on this site."
          : ""}
      </p>
      <div className="mt-8 flex flex-col gap-2">
        <Button asChild className="bg-primary hover:bg-primary/90">
          <Link href={`/shop/${slug}`}>Continue shopping</Link>
        </Button>
        {orderNo ? (
          <Button asChild variant="outline">
            <Link href={`/shop/${slug}/order/track?order=${encodeURIComponent(orderNo)}`}>
              Track this order
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
