"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { saveShiftAccountAction } from "@/lib/pos/sessions/actions";
import { getSafeActionError } from "@/lib/parse-safe-action-result";
import type { ShiftCode } from "@/lib/pos/shifts";

export function SaveShiftAccountForm({
  branchId,
  businessDate,
  shiftCode,
  alreadySaved,
}: {
  branchId: string;
  businessDate: string;
  shiftCode: ShiftCode;
  alreadySaved: boolean;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await saveShiftAccountAction({
        branchId,
        businessDate,
        shiftCode,
        notes: notes.trim() || undefined,
      });
      const err = getSafeActionError(res);
      if (err) {
        toast.error(err);
        return;
      }
      toast.success(alreadySaved ? "Shift account updated" : "Shift account saved");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="shift-notes">Note (optional)</Label>
        <Textarea
          id="shift-notes"
          rows={2}
          maxLength={400}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Evening rush, two tills still to close"
        />
      </div>
      <Button type="button" onClick={save} disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        {alreadySaved ? "Update final account" : "Save final account"}
      </Button>
    </div>
  );
}
