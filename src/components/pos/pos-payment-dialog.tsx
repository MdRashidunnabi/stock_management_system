"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Banknote, CreditCard, Delete, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { kickCashDrawer } from "@/lib/pos/cash-drawer";
import { appendCashKey, evaluateCashTender, parseCashBuffer } from "@/lib/pos/cash-tender";
import { cashNoteValues } from "@/lib/pos/denominations";
import type { CustomerDisplayPhase } from "@/lib/pos/customer-display";
import { round2 } from "@/lib/pos/totals";

type Method = "cash" | "card";
type Step = "choose" | "cash" | "card";

export type PosPayUiState = {
  phase: CustomerDisplayPhase;
  given?: number;
  change?: number;
};

interface Props {
  open: boolean;
  total: number;
  pending: boolean;
  cashOnly?: boolean;
  currency?: string;
  formatAmount?: (n: number) => string;
  onClose: () => void;
  onConfirm: (payments: { method: Method; amount: number }[]) => void;
  onUiState?: (state: PosPayUiState) => void;
}

export function PosPaymentDialog({
  open,
  total,
  pending,
  cashOnly,
  currency = "EUR",
  formatAmount = (n) => n.toFixed(2),
  onClose,
  onConfirm,
  onUiState,
}: Props) {
  const [openSnap, setOpenSnap] = useState(open);
  const [step, setStep] = useState<Step>(cashOnly ? "cash" : "choose");
  const [buffer, setBuffer] = useState("");
  const finishing = useRef(false);
  const prevPending = useRef(pending);
  const drawerKicked = useRef(false);
  const onUiStateRef = useRef(onUiState);

  if (open !== openSnap) {
    setOpenSnap(open);
    if (open) {
      setBuffer("");
      setStep(cashOnly ? "cash" : "choose");
    }
  }

  const given = parseCashBuffer(buffer);
  const tender = evaluateCashTender(total, given);
  const notes = useMemo(() => cashNoteValues(currency), [currency]);

  useEffect(() => {
    onUiStateRef.current = onUiState;
  }, [onUiState]);

  useEffect(() => {
    if (open) {
      finishing.current = false;
      drawerKicked.current = false;
    }
  }, [open]);

  useEffect(() => {
    if (prevPending.current && !pending && open) {
      finishing.current = false;
    }
    prevPending.current = pending;
  }, [pending, open]);

  useEffect(() => {
    if (!open) return;
    if (step === "choose") onUiStateRef.current?.({ phase: "choose" });
    else if (step === "card") onUiStateRef.current?.({ phase: "pay-card" });
    else {
      onUiStateRef.current?.({
        phase: tender.enough && given > 0 ? "change" : "pay-cash",
        given,
        change: tender.change,
      });
    }
  }, [open, step, given, tender.enough, tender.change]);

  function openDrawerOnce() {
    if (drawerKicked.current) return;
    drawerKicked.current = true;
    kickCashDrawer();
  }

  function goCash() {
    openDrawerOnce();
    setStep("cash");
  }

  useEffect(() => {
    if (open && step === "cash") openDrawerOnce();
  }, [open, step]);

  function finishCash(nextGiven: number) {
    if (finishing.current || pending) return;
    const result = evaluateCashTender(total, nextGiven);
    if (!result.enough) return;
    finishing.current = true;
    openDrawerOnce();
    onUiState?.({ phase: "change", given: result.given, change: result.change });
    onConfirm([{ method: "cash", amount: result.due }]);
  }

  function finishCard() {
    if (finishing.current || pending) return;
    finishing.current = true;
    onConfirm([{ method: "card", amount: round2(total) }]);
  }

  function applyNote(note: number) {
    const next = round2(given + note);
    const result = evaluateCashTender(total, next);
    setBuffer(formatBuffer(next));
    if (result.enough) finishCash(next);
  }

  function applyExact() {
    setBuffer(formatBuffer(total));
    finishCash(total);
  }

  function onKey(key: string) {
    setBuffer((prev) => appendCashKey(prev, key));
  }

  useEffect(() => {
    if (!open || step !== "cash" || pending) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") return;
      if (e.key === "Enter" && tender.enough) {
        e.preventDefault();
        finishCash(given);
        return;
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        onKey("back");
        return;
      }
      if (e.key === "." || e.key === ",") {
        e.preventDefault();
        onKey(".");
        return;
      }
      if (/^\d$/.test(e.key)) {
        e.preventDefault();
        onKey(e.key);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, step, pending, tender.enough, given]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !pending && onClose()}>
      <DialogContent
        showCloseButton={!pending}
        className="gap-5 sm:max-w-3xl"
        onOpenAutoFocus={(e) => e.preventDefault()}
        data-no-hid-scan=""
      >
        <DialogHeader>
          <DialogTitle className="text-2xl">Take payment</DialogTitle>
          <DialogDescription className="text-base">
            Due{" "}
            <span className="text-foreground text-xl font-semibold tabular-nums">
              {formatAmount(total)}
            </span>
            {cashOnly ? " · Cash only while offline" : null}
          </DialogDescription>
        </DialogHeader>

        {step === "choose" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <PayChoice
              icon={<Banknote className="size-12" />}
              title="Cash"
              className="border-emerald-500/40 hover:border-emerald-600 hover:bg-emerald-500/10"
              onClick={goCash}
            />
            <PayChoice
              icon={<CreditCard className="size-12" />}
              title="Card"
              className="border-sky-500/40 hover:border-sky-600 hover:bg-sky-500/10"
              onClick={() => setStep("card")}
            />
          </div>
        ) : null}

        {step === "cash" ? (
          <CashPad
            total={total}
            buffer={buffer}
            tender={tender}
            notes={notes}
            pending={pending}
            formatAmount={formatAmount}
            showBack={!cashOnly}
            onBack={() => {
              setBuffer("");
              setStep("choose");
            }}
            onNote={applyNote}
            onExact={applyExact}
            onKey={onKey}
            onComplete={() => finishCash(given)}
          />
        ) : null}

        {step === "card" ? (
          <div className="space-y-5">
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground inline-flex h-11 items-center gap-1 text-base"
              onClick={() => setStep("choose")}
              disabled={pending}
            >
              <ArrowLeft className="size-4" />
              Back
            </button>
            <p className="text-muted-foreground text-base">Confirm after the machine accepts.</p>
            <Button
              type="button"
              size="lg"
              className="h-20 w-full text-xl"
              disabled={pending}
              onClick={finishCard}
            >
              {pending ? (
                <Loader2 className="size-6 animate-spin" />
              ) : (
                <CreditCard className="size-6" />
              )}
              Confirm card payment
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function PayChoice({
  icon,
  title,
  hint,
  onClick,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "border-border bg-card focus-visible:ring-ring flex min-h-32 flex-col items-start gap-3 rounded-2xl border-2 p-6 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none",
        className,
      )}
    >
      <span className="text-primary">{icon}</span>
      <span className="text-3xl font-semibold tracking-tight">{title}</span>
      {hint ? <span className="text-muted-foreground text-sm">{hint}</span> : null}
    </button>
  );
}

function CashPad({
  total,
  buffer,
  tender,
  notes,
  pending,
  formatAmount,
  showBack,
  onBack,
  onNote,
  onExact,
  onKey,
  onComplete,
}: {
  total: number;
  buffer: string;
  tender: ReturnType<typeof evaluateCashTender>;
  notes: number[];
  pending: boolean;
  formatAmount: (n: number) => string;
  showBack: boolean;
  onBack: () => void;
  onNote: (note: number) => void;
  onExact: () => void;
  onKey: (key: string) => void;
  onComplete: () => void;
}) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "."] as const;

  return (
    <div className="space-y-4">
      {showBack ? (
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground inline-flex h-11 items-center gap-1 text-base"
          onClick={onBack}
          disabled={pending}
        >
          <ArrowLeft className="size-4" />
          Back
        </button>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="border-border rounded-2xl border p-5">
          <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
            Note given
          </p>
          <p className="mt-1 text-5xl font-semibold tracking-tight tabular-nums">
            {buffer ? formatAmount(tender.given) : formatAmount(0)}
          </p>
        </div>
        <div
          className={cn(
            "rounded-2xl border p-5",
            tender.enough ? "border-emerald-500/50 bg-emerald-500/10" : "border-border bg-muted/40",
          )}
        >
          <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
            {tender.enough ? "Change to give" : "Still due"}
          </p>
          <p
            className={cn(
              "mt-1 text-5xl font-semibold tracking-tight tabular-nums",
              tender.enough ? "text-emerald-700 dark:text-emerald-400" : "text-foreground",
            )}
          >
            {tender.enough ? formatAmount(tender.change) : formatAmount(tender.short || total)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Button
          type="button"
          variant="secondary"
          className="h-16 text-lg font-semibold"
          disabled={pending}
          onClick={onExact}
        >
          Exact
        </Button>
        {notes.map((note) => (
          <Button
            key={note}
            type="button"
            variant="outline"
            className="h-16 text-lg font-semibold tabular-nums"
            disabled={pending}
            onClick={() => onNote(note)}
          >
            {formatAmount(note)}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {keys.map((key) => (
          <Button
            key={key}
            type="button"
            variant="outline"
            className="h-14 text-lg font-semibold"
            disabled={pending}
            onClick={() => onKey(key === "clear" ? "clear" : key)}
          >
            {key === "clear" ? "C" : key}
          </Button>
        ))}
        <Button
          type="button"
          variant="outline"
          className="col-span-3 h-12"
          disabled={pending}
          onClick={() => onKey("back")}
        >
          <Delete className="size-4" />
          Delete
        </Button>
      </div>

      <Button
        type="button"
        size="lg"
        className="h-20 w-full text-xl"
        disabled={pending || !tender.enough}
        onClick={onComplete}
      >
        {pending ? (
          <Loader2 className="size-6 animate-spin" />
        ) : tender.enough ? (
          <>Complete · give {formatAmount(tender.change)}</>
        ) : (
          "Tap the note first"
        )}
      </Button>
    </div>
  );
}

function formatBuffer(n: number): string {
  const v = round2(n);
  if (v === 0) return "";
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}
