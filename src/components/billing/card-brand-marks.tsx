import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { CardBrand } from "@/lib/billing/card";
import { CARD_BRAND_LABELS, DISPLAY_CARD_BRANDS } from "@/lib/billing/card";

function VisaMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 32" className={className} aria-hidden>
      <rect width="48" height="32" rx="4" fill="#1A1F71" />
      <text
        x="24"
        y="21"
        textAnchor="middle"
        fill="#fff"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="700"
        fontStyle="italic"
        fontSize="14"
        letterSpacing="0.5"
      >
        VISA
      </text>
    </svg>
  );
}

function MastercardMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 32" className={className} aria-hidden>
      <rect width="48" height="32" rx="4" fill="#111827" />
      <circle cx="19" cy="16" r="8" fill="#EB001B" />
      <circle cx="29" cy="16" r="8" fill="#F79E1B" />
      <path d="M24 10.2a8 8 0 0 1 0 11.6 8 8 0 0 1 0-11.6Z" fill="#FF5F00" />
    </svg>
  );
}

function AmexMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 32" className={className} aria-hidden>
      <rect width="48" height="32" rx="4" fill="#2E77BB" />
      <text
        x="24"
        y="20"
        textAnchor="middle"
        fill="#fff"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="700"
        fontSize="9"
        letterSpacing="0.4"
      >
        AMEX
      </text>
    </svg>
  );
}

function DiscoverMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 32" className={className} aria-hidden>
      <rect width="48" height="32" rx="4" fill="#fff" stroke="#E5E7EB" />
      <text
        x="6"
        y="20"
        fill="#1F2937"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="700"
        fontSize="7"
      >
        DISCOVER
      </text>
      <circle cx="41" cy="16" r="4.5" fill="#F76F00" />
    </svg>
  );
}

const MARKS: Record<Exclude<CardBrand, "maestro">, (props: { className?: string }) => ReactNode> = {
  visa: VisaMark,
  mastercard: MastercardMark,
  amex: AmexMark,
  discover: DiscoverMark,
};

export function CardBrandMark({ brand, className }: { brand: CardBrand; className?: string }) {
  if (brand === "maestro") return null;
  const Mark = MARKS[brand];
  return <Mark className={cn("h-7 w-[42px]", className)} />;
}

export function AcceptedCardBrands({ active }: { active?: CardBrand | null }) {
  return (
    <ul className="flex items-center gap-1.5" aria-label="Accepted cards">
      {DISPLAY_CARD_BRANDS.map((brand) => {
        const dim = Boolean(active) && active !== brand;
        return (
          <li key={brand}>
            <CardBrandMark
              brand={brand}
              className={cn(
                "rounded-[4px] shadow-sm transition-opacity",
                dim ? "opacity-25" : "opacity-100",
              )}
            />
            <span className="sr-only">{CARD_BRAND_LABELS[brand]}</span>
          </li>
        );
      })}
    </ul>
  );
}
