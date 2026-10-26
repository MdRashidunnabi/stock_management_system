"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { refundOnlineCardAction } from "@/lib/storefront/staff-actions";
import { formatEuro } from "@/lib/utils";

export function RefundCardButton({ orderId, amount }: { orderId: string; amount: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function refund() {
    start(async () => {
      const res = await refundOnlineCardAction({ orderId });
      if (res?.serverError) {
        toast.error(res.serverError);
        return;
      }
      toast.success(`Refunded ${formatEuro(res?.data?.amount ?? amount)} to the card`);
      setConfirming(false);
      router.refresh();
    });
  }

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() => setConfirming(true)}
      >
        Refund {formatEuro(amount)} to the card
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs">
        Stripe will send {formatEuro(amount)} back to the same card.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="destructive" size="sm" disabled={pending} onClick={refund}>
          Confirm refund
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => setConfirming(false)}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
