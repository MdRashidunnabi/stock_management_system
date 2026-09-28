"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { resolveOnlineOrderLineAction } from "@/lib/storefront/staff-actions";
import type { SubstituteCandidate } from "@/lib/storefront/admin-queries";

export function LineResolveControls({
  orderId,
  itemId,
  policy,
  candidates,
}: {
  orderId: string;
  itemId: string;
  policy: string;
  candidates: SubstituteCandidate[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [subId, setSubId] = useState(candidates[0]?.id ?? "");
  const prefersSub = policy === "substitute";

  function run(action: "omit" | "substitute") {
    start(async () => {
      const res = await resolveOnlineOrderLineAction({
        orderId,
        itemId,
        action,
        substituteProductId: action === "substitute" ? subId : undefined,
      });
      if (res?.serverError) {
        toast.error(res.serverError);
        return;
      }
      toast.success(
        action === "omit" ? "Line refunded and stock returned" : "Similar product sent",
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-2 print:hidden">
      <p className="text-muted-foreground text-xs">
        Customer chose: {prefersSub ? "send a similar product" : "skip and refund if unavailable"}
      </p>
      {prefersSub && candidates.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="border-input bg-background h-9 max-w-xs rounded-md border px-2 text-sm"
            value={subId}
            onChange={(e) => setSubId(e.target.value)}
          >
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.sku ? ` · ${c.sku}` : ""} · {c.available} in stock
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            disabled={pending || !subId}
            onClick={() => run("substitute")}
          >
            Send similar
          </Button>
        </div>
      ) : prefersSub ? (
        <p className="text-xs text-amber-800 dark:text-amber-200">
          No in-stock similar products. Refund this line or pick from the catalogue later.
        </p>
      ) : null}
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => run("omit")}
      >
        Mark unavailable · refund
      </Button>
    </div>
  );
}
