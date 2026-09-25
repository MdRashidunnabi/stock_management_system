import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ProductPurchasePanel } from "@/components/storefront/add-to-cart";
import { OnlinePrice } from "@/components/storefront/online-price";
import { getStorefrontProduct, getStorefrontShop } from "@/lib/storefront/queries";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; productId: string }>;
}): Promise<Metadata> {
  const { slug, productId } = await params;
  const shop = await getStorefrontShop(slug);
  const product = shop ? await getStorefrontProduct(shop, productId) : null;
  return { title: product ? `${product.name} — ${shop?.publicSiteName}` : "Product" };
}

export default async function ShopProductPage({
  params,
}: {
  params: Promise<{ slug: string; productId: string }>;
}) {
  const { slug, productId } = await params;
  const shop = await getStorefrontShop(slug);
  if (!shop) notFound();

  const product = await getStorefrontProduct(shop, productId);
  if (!product) notFound();

  return (
    <div className="space-y-6">
      <Link
        href={`/shop/${shop.slug}`}
        className="text-muted-foreground hover:text-primary inline-flex items-center gap-1 text-sm font-medium"
      >
        <ChevronLeft className="size-4" />
        Back to shop
      </Link>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
        <div className="shop-panel bg-card overflow-hidden border shadow-sm">
          <div className="bg-muted/40 aspect-square">
            {product.primaryImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.primaryImageUrl}
                alt={product.name}
                className="size-full object-contain p-6"
              />
            ) : (
              <div className="text-muted-foreground flex size-full items-center justify-center">
                No image
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          {product.categoryName ? (
            <p className="text-primary text-xs font-semibold tracking-wide uppercase">
              {product.categoryName}
            </p>
          ) : null}
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{product.name}</h1>
          {product.sku ? (
            <p className="text-muted-foreground font-mono text-xs">{product.sku}</p>
          ) : null}
          <OnlinePrice
            pricing={{
              price: product.onlinePrice,
              compareAtPrice: product.compareAtPrice,
              discountPct: product.discountPct,
              baseOnlinePrice: product.compareAtPrice ?? product.onlinePrice,
            }}
            size="lg"
          />
          <p className="text-muted-foreground text-xs">
            In-store price may differ. Online price only.
          </p>
          <ProductPurchasePanel shopSlug={shop.slug} product={product} />
        </div>
      </div>
    </div>
  );
}
