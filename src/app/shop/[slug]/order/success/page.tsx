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
  }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const shop = await getStorefrontShop(slug);
  const orderNo = sp.order ?? "";
  const total = sp.total ? Number(sp.total) : null;
  const deliveryFee = sp.delivery ? Number(sp.delivery) : 0;
  const fulfillment = sp.fulfillment === "takeaway" ? "collection" : "delivery";
  const payment =
    sp.payment === "online_card"
      ? "online card payment (we will send a payment link)"
      : "cash on delivery";

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <CheckCircle2 className="text-success mx-auto size-12" />
      <h1 className="mt-4 text-2xl font-bold">Thank you!</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Your order{orderNo ? ` ${orderNo}` : ""} has been received
        {shop ? ` by ${shop.publicSiteName}` : ""}.
        {total != null && Number.isFinite(total) ? ` Total: ${formatEuro(total)}.` : ""}
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
      <p className="text-muted-foreground mt-4 text-xs">
        Stock has been reserved from our shop. We will call you to confirm your order.
      </p>
      <Button asChild className="bg-primary hover:bg-primary/90 mt-8">
        <Link href={`/shop/${slug}`}>Continue shopping</Link>
      </Button>
    </div>
  );
}
