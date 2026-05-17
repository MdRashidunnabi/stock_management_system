"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { recordCashMovementAction } from "@/lib/pos/sessions/actions";
import {
  MANUAL_CASH_MOVEMENT_TYPES,
  type ManualCashMovementType,
} from "@/lib/pos/sessions/schemas";

const TYPE_LABEL: Record<
  ManualCashMovementType,
  { label: string; hint: string; sign: "in" | "out" }
> = {
  pay_in: {
    label: "Pay-in",
    sign: "in",
    hint: "Owner / manager adds cash to the drawer.",
  },
  pay_out: {
    label: "Pay-out",
    sign: "out",
    hint: "Cash taken out of the drawer for any reason.",
  },
  cash_drop: {
    label: "Cash drop",
    sign: "out",
    hint: "Cash moved to the safe or bank deposit.",
  },
  expense: {
    label: "Petty expense",
    sign: "out",
    hint: "Cash paid out for a small expense (kept the receipt!).",
  },
};

export function CashMovementForm({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<ManualCashMovementType>("cash_drop");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);

  const meta = TYPE_LABEL[type];

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);
    startTransition(async () => {
      const res = await recordCashMovementAction({
        sessionId,
        type,
        amount: Number(amount) || 0,
        reason: reason.trim() || undefined,
      });
      if (res?.serverError) {
        setServerError(res.serverError);
        return;
      }
      if (res?.validationErrors) {
        setServerError("Please check the form fields.");
        return;
      }
      if (res?.data?.ok) {
        toast.success(`${meta.label} recorded`);
        setAmount("");
        setReason("");
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="cm-type">Type</Label>
          <select
            id="cm-type"
            value={type}
            onChange={(e) => setType(e.target.value as ManualCashMovementType)}
            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
          >
            {MANUAL_CASH_MOVEMENT_TYPES.map((v) => (
              <option key={v} value={v}>
                {TYPE_LABEL[v].label} ({TYPE_LABEL[v].sign === "in" ? "+ cash in" : "- cash out"})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="cm-amount">Amount (EUR)</Label>
          <Input
            id="cm-amount"
            type="number"
            min={0.01}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            required
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="cm-reason">Reason</Label>
        <Input
          id="cm-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={meta.hint}
          maxLength={200}
        />
      </div>

      {serverError ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" size="sm" disabled={pending}>
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <>
            <PlusCircle className="size-4" /> Record
          </>
        )}
      </Button>
    </form>
  );
}
