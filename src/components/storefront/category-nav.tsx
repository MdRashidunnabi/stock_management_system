import Link from "next/link";
import { cn } from "@/lib/utils";
import type { StorefrontCategory } from "@/lib/storefront/queries";

interface Props {
  shopSlug: string;
  categories: StorefrontCategory[];
  activeSlug?: string | null;
}

export function CategoryNav({ shopSlug, categories, activeSlug }: Props) {
  const base = `/shop/${shopSlug}`;

  const linkClass = (active: boolean) =>
    cn(
      "flex w-full items-center justify-between gap-1 rounded-lg px-2 py-2 text-left text-xs font-medium transition-colors sm:gap-2 sm:px-3 sm:py-2.5 sm:text-sm",
      active
        ? "bg-primary text-white shadow-sm"
        : "text-foreground/80 hover:bg-primary/10 hover:text-primary dark:hover:bg-primary/20",
    );

  const countClass = (active: boolean) =>
    cn(
      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums",
      active ? "bg-white/20 text-white" : "bg-muted text-muted-foreground",
    );

  return (
    <nav className="flex flex-col gap-0.5" aria-label="Categories">
      <p className="text-muted-foreground mb-1.5 px-1 text-[10px] font-semibold tracking-wide uppercase sm:mb-2 sm:px-3 sm:text-xs">
        Categories
      </p>
      <Link href={base} className={linkClass(!activeSlug)}>
        <span className="truncate">All products</span>
      </Link>
      {categories.map((c) => (
        <Link
          key={c.id}
          href={`${base}/category/${c.slug}`}
          className={linkClass(activeSlug === c.slug)}
        >
          <span className="truncate">{c.name}</span>
          <span className={countClass(activeSlug === c.slug)}>{c.productCount}</span>
        </Link>
      ))}
    </nav>
  );
}
