"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  value: number;
  max: number;
  min?: number;
  disabled?: boolean;
  onChange: (qty: number) => void;
  className?: string;
  size?: "sm" | "md";
}

export function QuantityStepper({
  value,
  max,
  min = 0,
  disabled,
  onChange,
  className,
  size = "md",
}: Props) {
  const btn = size === "sm" ? "size-8" : "size-9";
  const text = size === "sm" ? "text-sm" : "text-base";

  return (
    <div
      className={cn(
        "bg-muted/50 flex items-center justify-between gap-1 rounded-xl border p-1",
        disabled && "opacity-50",
        className,
      )}
      role="group"
      aria-label="Quantity"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(btn, "shrink-0 rounded-lg")}
        disabled={disabled || value <= min}
        aria-label="Decrease quantity"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onChange(Math.max(min, value - 1));
        }}
      >
        <Minus className="size-4" />
      </Button>
      <span
        className={cn("min-w-[2ch] text-center font-semibold tabular-nums", text)}
        aria-live="polite"
      >
        {value}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(btn, "shrink-0 rounded-lg")}
        disabled={disabled || value >= max}
        aria-label="Increase quantity"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onChange(Math.min(max, value + 1));
        }}
      >
        <Plus className="size-4" />
      </Button>
    </div>
  );
}
