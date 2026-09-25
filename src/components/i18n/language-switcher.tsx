"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { LOCALES, LOCALE_META, type Locale } from "@/lib/i18n/config";
import { useT } from "@/components/i18n/locale-provider";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ compact, light }: { compact?: boolean; light?: boolean }) {
  const { locale, t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    return LOCALES.filter((code) => {
      if (!q) return true;
      const meta = LOCALE_META[code];
      return (
        meta.nativeLabel.toLowerCase().includes(q) ||
        meta.englishLabel.toLowerCase().includes(q) ||
        code.includes(q)
      );
    });
  }, [query]);

  function choose(next: Locale) {
    if (next === locale) return;
    startTransition(async () => {
      await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: next }),
      });
      router.refresh();
    });
  }

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (!open) setQuery("");
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size={compact ? "sm" : "default"}
          disabled={pending}
          className={cn(light && "text-white hover:bg-white/15 hover:text-white")}
          aria-label={t("common.language")}
        >
          <Languages className="size-4" />
          <span className="hidden max-w-[7.5rem] truncate text-sm sm:inline">
            {LOCALE_META[locale].nativeLabel}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 p-0">
        <div className="p-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder={t("common.searchLanguage")}
            autoComplete="off"
          />
        </div>
        <div className="max-h-72 overflow-y-auto py-1">
          {options.map((code) => (
            <DropdownMenuItem
              key={code}
              onClick={() => choose(code)}
              className={cn("flex justify-between gap-2", code === locale && "bg-accent")}
            >
              <span>{LOCALE_META[code].nativeLabel}</span>
              <span className="text-muted-foreground text-xs">
                {LOCALE_META[code].englishLabel}
              </span>
            </DropdownMenuItem>
          ))}
          {options.length === 0 ? (
            <p className="text-muted-foreground px-3 py-2 text-xs">{t("errors.notFoundTitle")}</p>
          ) : null}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
