import { formatTillLabel } from "@/lib/pos/shifts";
import type { TillSlot } from "@/lib/pos/sessions/schemas";
import { cn } from "@/lib/utils";

export function TillNumberPicker({
  slots,
  deviceId,
  value,
  onChange,
}: {
  slots: TillSlot[];
  deviceId: string;
  value: number | null;
  onChange: (n: number) => void;
}) {
  const mine = slots.find((s) => s.device_id && s.device_id === deviceId);

  if (mine) {
    return <p className="text-lg font-semibold">{formatTillLabel(mine.number)}</p>;
  }

  return (
    <div className="grid grid-cols-5 gap-2">
      {slots.map((slot) => {
        const taken = Boolean(slot.device_id && slot.device_id !== deviceId);
        const selected = value === slot.number;
        return (
          <button
            key={slot.number}
            type="button"
            disabled={taken}
            onClick={() => onChange(slot.number)}
            className={cn(
              "h-12 rounded-md border text-sm font-semibold",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : taken
                  ? "border-border bg-muted text-muted-foreground cursor-not-allowed"
                  : "border-input bg-background hover:bg-accent",
            )}
          >
            {slot.number}
          </button>
        );
      })}
    </div>
  );
}
