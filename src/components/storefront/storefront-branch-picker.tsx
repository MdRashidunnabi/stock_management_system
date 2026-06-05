"use client";

import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { StorefrontBranchOption } from "@/lib/storefront/queries";

function cookieName(slug: string) {
  return `shop-branch-${slug}`;
}

export function StorefrontBranchPicker({
  slug,
  branches,
  currentBranchId,
}: {
  slug: string;
  branches: StorefrontBranchOption[];
  currentBranchId: string;
}) {
  const router = useRouter();

  if (branches.length <= 1) return null;

  return (
    <div className="bg-muted/40 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm">
      <MapPin className="text-primary size-4 shrink-0" />
      <Label htmlFor="branch-picker" className="sr-only">
        Choose branch
      </Label>
      <span className="text-muted-foreground hidden sm:inline">Shopping at:</span>
      <Select
        value={currentBranchId}
        onValueChange={(id) => {
          document.cookie = `${cookieName(slug)}=${id};path=/;max-age=31536000;SameSite=Lax`;
          router.refresh();
        }}
      >
        <SelectTrigger id="branch-picker" className="h-9 w-[min(100%,220px)]">
          <SelectValue placeholder="Choose location" />
        </SelectTrigger>
        <SelectContent>
          {branches.map((b) => (
            <SelectItem key={b.id} value={b.id}>
              {b.name} ({b.code})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
