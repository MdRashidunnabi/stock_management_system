"use client";

import { usePathname } from "next/navigation";
import { CategoryNav } from "@/components/storefront/category-nav";
import type { StorefrontCategory } from "@/lib/storefront/queries";

/** Cart, checkout, and order confirmation — no category sidebar */
function isCheckoutPath(pathname: string): boolean {
  return /\/(cart|checkout|order)(\/|$)/.test(pathname);
}

interface Props {
  shopSlug: string;
  categories: StorefrontCategory[];
  children: React.ReactNode;
}

export function ShopCatalogShell({ shopSlug, categories, children }: Props) {
  const pathname = usePathname() ?? "";
  const activeSlug = pathname.match(/\/category\/([^/]+)/)?.[1] ?? null;
  const showSidebar = !isCheckoutPath(pathname);

  if (!showSidebar) {
    return <div className="min-w-0 flex-1">{children}</div>;
  }

  return (
    <div className="grid min-w-0 flex-1 grid-cols-[minmax(8.75rem,10.5rem)_1fr] gap-4 sm:gap-6 md:grid-cols-[13rem_1fr] md:gap-8 lg:grid-cols-[14rem_1fr]">
      <aside className="min-w-0">
        <div className="sticky top-24 max-h-[calc(100dvh-7rem)] [scrollbar-width:thin] overflow-y-auto pr-1">
          <CategoryNav shopSlug={shopSlug} categories={categories} activeSlug={activeSlug} />
        </div>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
