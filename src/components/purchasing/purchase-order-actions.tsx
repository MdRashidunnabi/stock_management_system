"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { updatePurchaseOrderStatusAction } from "@/lib/purchasing/orders/actions";
import type { PurchaseOrderStatus } from "@/lib/purchasing/schemas";

interface Props {
  poId: string;
  status: PurchaseOrderStatus;
}

export function PurchaseOrderActions({ poId, status }: Props) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<"submitted" | "cancelled" | null>(null);
  const [isPending, startTransition] = useTransition();

  function transition(next: "submitted" | "cancelled") {
    if (next === "cancelled") {
      const ok = window.confirm(
        "Cancel this purchase order? This cannot be undone, but does not change inventory.",
      );
      if (!ok) return;
    }
    setPendingAction(next);
    startTransition(async () => {
      const res = await updatePurchaseOrderStatusAction({ poId, newStatus: next });
      setPendingAction(null);
      if (res?.serverError) {
        toast.error(res.serverError);
        return;
      }
      if (res?.data?.ok) {
        toast.success(next === "submitted" ? "Purchase order sent." : "Purchase order cancelled.");
        router.refresh();
      }
    });
  }

  if (status === "received" || status === "cancelled" || status === "closed") return null;

  return (
    <section className="border-border bg-card flex flex-wrap items-center gap-2 rounded-lg border p-4">
      <span className="text-sm font-medium">Status actions:</span>
      {status === "draft" ? (
        <Button onClick={() => transition("submitted")} disabled={isPending} size="sm">
          {isPending && pendingAction === "submitted" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              <CheckCheck className="size-4" /> Mark as ordered
            </>
          )}
        </Button>
      ) : null}
      {status === "draft" || status === "submitted" ? (
        <Button
          onClick={() => transition("cancelled")}
          disabled={isPending}
          variant="outline"
          size="sm"
        >
          {isPending && pendingAction === "cancelled" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              <XCircle className="size-4" /> Cancel
            </>
          )}
        </Button>
      ) : null}
      {status === "partially_received" ? (
        <span className="text-muted-foreground text-xs">
          Some items have been received. Receive the remaining quantities to complete the order.
        </span>
      ) : null}
    </section>
  );
}
