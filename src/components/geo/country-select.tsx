"use client";

import { COUNTRIES } from "@/lib/geo/countries";
import { useT } from "@/components/i18n/locale-provider";
import { cn } from "@/lib/utils";

interface Props {
  id?: string;
  value: string;
  disabled?: boolean;
  onChange: (code: string) => void;
  invalid?: boolean;
}

export function CountrySelect({ id, value, disabled, onChange, invalid }: Props) {
  const { t } = useT();

  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50",
        invalid && "border-destructive",
      )}
    >
      <option value="" disabled>
        {t("auth.country")}
      </option>
      {COUNTRIES.map((c) => (
        <option key={c.code} value={c.code}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
