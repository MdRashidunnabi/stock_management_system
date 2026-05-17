"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { openPosSessionAction } from "@/lib/pos/sessions/actions";

interface BranchOption {
  id: string;
  name: string;
  code: string;
}

interface Props {
  branches: BranchOption[];
  defaultBranchId: string | null;
}

export function OpenSessionForm({ branches, defaultBranchId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string>(defaultBranchId ?? branches[0]?.id ?? "");
  const [openingCash, setOpeningCash] = useState<string>("0");
  const [note, setNote] = useState<string>("");

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);
    startTransition(async () => {
      const res = await openPosSessionAction({
        branchId,
        openingCash: Number(openingCash) || 0,
        note: note.trim() || undefined,
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
        toast.success("Till opened");
        router.push(`/sessions/${res.data.sessionId}`);
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="branch">Branch</Label>
        <select
          id="branch"
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
          required
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.code} - {b.name}
            </option>
          ))}
        </select>
        <p className="text-muted-foreground text-xs">
          Each cashier can have one open till per branch at a time.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="openingCash">Opening cash float (EUR)</Label>
        <Input
          id="openingCash"
          type="number"
          min={0}
          step="0.01"
          value={openingCash}
          onChange={(e) => setOpeningCash(e.target.value)}
          placeholder="0.00"
        />
        <p className="text-muted-foreground text-xs">
          The cash you have in the drawer right now, before any sales. Used to compute the variance
          when you close the till.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="note">Note (optional)</Label>
        <Textarea
          id="note"
          rows={2}
          maxLength={200}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Morning shift, two €50 notes + coin float"
        />
      </div>

      {serverError ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <>
            <KeyRound className="size-4" /> Open till
          </>
        )}
      </Button>
    </form>
  );
}
