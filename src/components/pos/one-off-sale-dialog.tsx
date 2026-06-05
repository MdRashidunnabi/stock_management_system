"use client";

import { useState } from "react";
import { Loader2, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatEuro } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending?: boolean;
  onConfirm: (amount: number) => void;
}

export function OneOffSaleDialog({ open, onOpenChange, pending, onConfirm }: Props) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  function reset() {
    setAmount("");
    setError(null);
  }

  function submit() {
    setError(null);
    const n = Number(amount.replace(",", "."));
    if (amount.trim() === "" || !Number.isFinite(n)) {
      setError("Enter the sale amount in euro.");
      return;
    }
    if (n < 0.01) {
      setError("Amount must be at least €0.01.");
      return;
    }
    if (n > 99999) {
      setError("Amount is too large.");
      return;
    }
    const rounded = Math.round(n * 100) / 100;
    onConfirm(rounded);
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="size-4" />
            One-off sale
          </DialogTitle>
          <DialogDescription>
            For an item that is not in your product list. Enter the total you want to charge
            (VAT-inclusive).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="one-off-amount">Amount (€)</Label>
          <Input
            id="one-off-amount"
            type="number"
            inputMode="decimal"
            min={0.01}
            max={99999}
            step={0.01}
            placeholder="e.g. 25.00"
            value={amount}
            autoFocus
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
          />
          {error ? <p className="text-destructive text-xs">{error}</p> : null}
          {amount.trim() !== "" && Number.isFinite(Number(amount)) ? (
            <p className="text-muted-foreground text-xs">
              Charge: {formatEuro(Math.round(Number(amount.replace(",", ".")) * 100) / 100)}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Add to cart
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
