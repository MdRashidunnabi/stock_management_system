"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { confirmOnlinePaymentAction } from "@/lib/storefront/staff-actions";
import { formatEuro } from "@/lib/utils";
import type { OrderVoucherView } from "@/lib/vouchers/admin";

export function VoucherIssuePanel({
  orderId,
  voucher,
  cancelled,
}: {
  orderId: string;
  voucher: OrderVoucherView | null;
  cancelled: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [code, setCode] = useState(voucher?.earnedCode ?? null);
  const [status, setStatus] = useState(voucher?.earnedStatus ?? null);
  const amount = voucher?.earnedAmount ?? 0;

  function confirm() {
    start(async () => {
      const res = await confirmOnlinePaymentAction({ orderId });
      if (res?.serverError) {
        toast.error(res.serverError);
        return;
      }
      const issued = res?.data;
      if (issued?.code) setCode(issued.code);
      if (issued?.issued) setStatus("active");
      toast.success(
        issued?.issued ? "Payment confirmed. Voucher is ready to print." : "Payment confirmed.",
      );
      router.refresh();
    });
  }

  return (
    <section className="border-border bg-card space-y-3 rounded-xl border p-5">
      <h2 className="text-sm font-semibold tracking-wide uppercase">Voucher</h2>
      {voucher?.discount ? (
        <p className="text-sm">
          Customer used {voucher.codeUsed} · {formatEuro(voucher.discount)} off products.
        </p>
      ) : (
        <p className="text-muted-foreground text-sm">No voucher was used on this order.</p>
      )}
      {amount > 0 ? (
        <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-950">
          <p>
            Next voucher {formatEuro(amount)} from {formatEuro(voucher?.eligibleSpend ?? 0)} paid
            for products.
          </p>
          <p className="mt-1">
            Status: {status ?? "pending"}
            {code ? ` · code ${code}` : " · no code yet"}
          </p>
          <p className="mt-1">The customer does not see this code online.</p>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">This order does not earn a voucher.</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={pending || cancelled} onClick={confirm}>
          {status === "active" ? "Payment already confirmed" : "Confirm payment and issue voucher"}
        </Button>
        {status === "active" && code ? (
          <Button variant="outline" asChild>
            <Link href={`/online-orders/${orderId}/voucher`} target="_blank">
              Print paper voucher
            </Link>
          </Button>
        ) : null}
      </div>
    </section>
  );
}
