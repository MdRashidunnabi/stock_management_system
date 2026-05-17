"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, KeyRound, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import { closePosSessionAction } from "@/lib/pos/sessions/actions";
import { formatEuro } from "@/lib/utils";

interface Props {
  sessionId: string;
  expectedCash: number;
  trigger?: React.ReactNode;
}

export function CloseSessionDialog({ sessionId, expectedCash, trigger }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [counted, setCounted] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [serverError, setServerError] = useState<string | null>(null);

  const countedNum = Number(counted);
  const variance = Number.isFinite(countedNum) ? round2(countedNum - expectedCash) : 0;
  const varianceColor =
    !Number.isFinite(countedNum) || counted === ""
      ? "text-muted-foreground"
      : Math.abs(variance) < 0.005
        ? "text-emerald-700 dark:text-emerald-400"
        : variance > 0
          ? "text-amber-700 dark:text-amber-400"
          : "text-destructive";

  function submit() {
    setServerError(null);
    if (counted === "" || !Number.isFinite(countedNum) || countedNum < 0) {
      setServerError("Enter the cash you counted in the drawer.");
      return;
    }
    startTransition(async () => {
      const res = await closePosSessionAction({
        sessionId,
        countedCash: countedNum,
        closingNote: note.trim() || undefined,
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
        toast.success("Till closed");
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="contents">
        {trigger ?? (
          <Button size="lg" variant="destructive">
            <Lock className="size-4" /> Close till
          </Button>
        )}
      </button>

      <Dialog open={open} onOpenChange={(v) => !pending && setOpen(v)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="size-5" /> Close till
            </DialogTitle>
            <DialogDescription>
              Count the cash currently in the drawer and enter the total. We&apos;ll compute the
              variance vs. the expected amount.
            </DialogDescription>
          </DialogHeader>

          <div className="border-border bg-muted/40 space-y-1 rounded-md border p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Expected cash in drawer</span>
              <span className="font-mono font-semibold">{formatEuro(expectedCash)}</span>
            </div>
            <p className="text-muted-foreground text-xs">
              Opening float + cash sales + pay-ins - refunds, drops, expenses, pay-outs.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="counted">Counted cash (EUR)</Label>
            <Input
              id="counted"
              type="number"
              step="0.01"
              min={0}
              value={counted}
              onChange={(e) => setCounted(e.target.value)}
              placeholder="0.00"
              autoFocus
            />
          </div>

          <div className="border-border flex items-center justify-between rounded-md border px-3 py-2">
            <span className="text-sm">Variance</span>
            <span className={`font-mono text-base font-semibold ${varianceColor}`}>
              {counted === "" || !Number.isFinite(countedNum) ? "-" : formatEuro(variance)}
              {Math.abs(variance) > 0.005 && counted !== "" ? (
                <Badge variant="outline" className="ml-2 text-[10px]">
                  {variance > 0 ? "surplus" : "shortage"}
                </Badge>
              ) : null}
            </span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="closing-note">Closing note (optional)</Label>
            <Textarea
              id="closing-note"
              rows={2}
              maxLength={200}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Coin shortage from refunding the wrong change"
            />
          </div>

          {serverError ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="button" onClick={submit} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : "Close till"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
