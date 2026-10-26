"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DeliveryArea } from "@/lib/storefront/delivery";

export function DeliveryAreasEditor({
  areas,
  onChange,
}: {
  areas: DeliveryArea[];
  onChange: (areas: DeliveryArea[]) => void;
}) {
  function patch(index: number, next: Partial<DeliveryArea>) {
    onChange(areas.map((area, i) => (i === index ? { ...area, ...next } : area)));
  }

  return (
    <div className="space-y-3">
      {areas.map((area, index) => (
        <div key={`${area.id}-${index}`} className="space-y-3 rounded-lg border p-3">
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1 space-y-1">
              <Label>Area</Label>
              <Input
                value={area.name}
                onChange={(e) => patch(index, { name: e.target.value })}
                placeholder="Carlow town, within 5 km"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={areas.length === 1}
              onClick={() => onChange(areas.filter((_, i) => i !== index))}
              aria-label="Remove area"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1">
              <Label>Minimum order (€)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={area.minOrder}
                onChange={(e) => patch(index, { minOrder: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <Label>Delivery charge (€)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={area.fee}
                onChange={(e) => patch(index, { fee: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <Label>Lead time (days)</Label>
              <Input
                type="number"
                min={0}
                max={30}
                step={1}
                value={area.leadDays}
                onChange={(e) => patch(index, { leadDays: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <Label>Delivery times</Label>
              <Input
                value={area.times}
                onChange={(e) => patch(index, { times: e.target.value })}
                placeholder="Same day, 2pm to 6pm"
              />
            </div>
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={areas.length >= 12}
        onClick={() =>
          onChange([
            ...areas,
            {
              id: `area-${areas.length + 1}`,
              name: "",
              minOrder: 0,
              fee: 0,
              leadDays: 0,
              times: "",
            },
          ])
        }
      >
        <Plus className="size-4" />
        Add area
      </Button>
    </div>
  );
}
