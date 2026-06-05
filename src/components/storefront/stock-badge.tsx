import type { StockDisplay } from "@/lib/storefront/stock-display";
import { cn } from "@/lib/utils";

/** Stock label below the product image (never overlaid on the photo). */
export function StockBadge({ stock, className }: { stock: StockDisplay; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-md px-2 py-0.5 text-[11px] font-medium tracking-wide uppercase",
        stock.variant === "out" && "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200",
        stock.variant === "low" &&
          "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100",
        stock.variant === "in_stock" &&
          "bg-success/15 text-primary dark:bg-primary/30 text-success",
        className,
      )}
    >
      {stock.label}
    </span>
  );
}
