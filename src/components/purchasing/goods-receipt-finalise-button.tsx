"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { finaliseGoodsReceiptAction } from "@/lib/purchasing/receipts/actions";

export function GoodsReceiptFinaliseButton({ grId }: { grId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function finalise() {
    if (!open) {
      setOpen(true);
      return;
    }
    startTransition(async () => {
      const res = await finaliseGoodsReceiptAction({ grId });
      if (res?.serverError) {
        toast.error(res.serverError);
        setOpen(false);
        return;
      }
      if (res?.data?.ok) {
        toast.success(
          `Receipt ${res.data.grNumber} finalised — ${res.data.itemsCount} line(s) committed.`,
        );
        router.refresh();
      }
    });
  }

  if (!open) {
    return (
      <Button onClick={finalise} size="sm">
        <CheckCheck className="size-4" /> Finalise & update stock
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button onClick={finalise} size="sm" disabled={pending}>
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <>
            <CheckCheck className="size-4" /> Confirm finalise
          </>
        )}
      </Button>
      <Button onClick={() => setOpen(false)} size="sm" variant="outline" disabled={pending}>
        Cancel
      </Button>
    </div>
  );
}
