"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Phone, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { StorefrontCategory } from "@/lib/storefront/queries";

interface Props {
  shopSlug: string;
  categories: StorefrontCategory[];
  phone?: string | null;
  callUsLabel?: string | null;
  filterParam?: "brand" | "category";
  filterLabel?: string;
}

export function ShopSearchBar({
  shopSlug,
  categories,
  phone,
  callUsLabel,
  filterParam = "brand",
  filterLabel = "Brands",
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const selected =
    searchParams.get(filterParam) ??
    searchParams.get(filterParam === "brand" ? "category" : "brand") ??
    "all";

  function pushSearch(nextQ: string, nextFilter: string) {
    const params = new URLSearchParams();
    const trimmed = nextQ.trim();
    if (trimmed) params.set("q", trimmed);
    if (nextFilter && nextFilter !== "all") params.set(filterParam, nextFilter);
    const qs = params.toString();
    router.push(`/shop/${shopSlug}/search${qs ? `?${qs}` : ""}`);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(() => pushSearch(q, selected));
  }

  const phoneDisplay = phone?.trim();
  const telHref = phoneDisplay ? `tel:${phoneDisplay.replace(/\s/g, "")}` : null;

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
      <form
        onSubmit={submit}
        className="shop-search-pill bg-muted/60 border-border/60 flex min-w-0 flex-1 items-stretch overflow-hidden border shadow-inner"
      >
        <Input
          type="search"
          placeholder="Search..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-11 flex-1 rounded-none border-0 bg-transparent px-4 shadow-none focus-visible:ring-0"
          aria-label="Search products"
        />
        <div className="bg-border/60 hidden w-px sm:block" />
        <Select
          value={selected}
          onValueChange={(val) => {
            startTransition(() => pushSearch(q, val));
          }}
        >
          <SelectTrigger className="h-11 w-[9.5rem] shrink-0 rounded-none border-0 bg-transparent shadow-none sm:w-[11rem]">
            <SelectValue placeholder={`All ${filterLabel.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All {filterLabel.toLowerCase()}</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.slug}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          type="submit"
          disabled={pending}
          className="hover:bg-primary/10 flex h-11 w-12 shrink-0 items-center justify-center transition-colors"
          aria-label="Search"
        >
          <Search className="text-foreground size-5" />
        </button>
      </form>

      {phoneDisplay && telHref ? (
        <a
          href={telHref}
          className="hover:bg-accent/50 hidden shrink-0 items-center gap-2 rounded-lg px-2 py-1 transition-colors lg:flex"
        >
          <Phone className="text-foreground size-5" />
          <div className="text-left leading-tight">
            <p className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
              {callUsLabel ?? "Call us now"}
            </p>
            <p className="text-sm font-bold">{phoneDisplay}</p>
          </div>
        </a>
      ) : null}
    </div>
  );
}
