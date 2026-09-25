"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getSafeActionData, getSafeActionError } from "@/lib/parse-safe-action-result";
import { openPosSessionAction } from "@/lib/pos/sessions/actions";
import { useTillLicense } from "@/components/license/license-heartbeat";
import { TillLockedNotice } from "@/components/license/till-locked-notice";
import {
  defaultBusinessDateISO,
  formatTillLabel,
  suggestShiftCode,
  type ShiftCode,
} from "@/lib/pos/shifts";
import { ShiftSelect } from "@/components/pos/sessions/shift-select";
import { TillNumberPicker } from "@/components/pos/sessions/till-number-picker";
import type { TillSlot } from "@/lib/pos/sessions/schemas";

interface BranchOption {
  id: string;
  name: string;
  code: string;
}

interface Props {
  branches: BranchOption[];
  defaultBranchId: string | null;
  defaultShift?: ShiftCode;
  defaultBusinessDate?: string;
  tillSlotsByBranch: Record<string, TillSlot[]>;
}

export function OpenSessionForm({
  branches,
  defaultBranchId,
  defaultShift,
  defaultBusinessDate,
  tillSlotsByBranch,
}: Props) {
  const router = useRouter();
  const { canSell, reason: licenseReason, deviceId } = useTillLicense();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const initialBranchId = defaultBranchId ?? branches[0]?.id ?? "";
  const [branchId, setBranchId] = useState<string>(initialBranchId);
  const activeBranchId = branchId || defaultBranchId || branches[0]?.id || "";
  const [openingCash, setOpeningCash] = useState<string>("0");
  const [note, setNote] = useState<string>("");
  const [shiftCode, setShiftCode] = useState<ShiftCode>(defaultShift ?? suggestShiftCode());
  const [businessDate, setBusinessDate] = useState<string>(
    defaultBusinessDate ?? defaultBusinessDateISO(defaultShift ?? suggestShiftCode()),
  );
  const [tillNumber, setTillNumber] = useState<number | null>(null);
  const branchSelectRef = useRef<HTMLSelectElement>(null);
  const slots = tillSlotsByBranch[activeBranchId] ?? [];
  const mySlot = slots.find((s) => s.device_id && s.device_id === deviceId);
  const resolvedTill = mySlot?.number ?? tillNumber;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);
    startTransition(async () => {
      if (!resolvedTill) {
        setServerError("Pick Till 1 to Till 10 for this computer.");
        return;
      }
      if (!canSell) {
        setServerError(licenseReason);
        return;
      }
      const res = await openPosSessionAction({
        branchId: branchSelectRef.current?.value || activeBranchId,
        openingCash: Number(openingCash) || 0,
        note: note.trim() || undefined,
        deviceId: deviceId || undefined,
        tillNumber: resolvedTill ?? undefined,
        shiftCode,
        businessDate,
      });
      const err = getSafeActionError(res);
      if (err) {
        setServerError(err);
        return;
      }
      const data = getSafeActionData<{ ok: true; sessionId: string }>(res);
      if (data) {
        toast.success(`${formatTillLabel(resolvedTill)} opened`);
        router.push(`/sessions/${data.sessionId}`);
        router.refresh();
        return;
      }
      setServerError("Till could not be opened. Please try again.");
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <TillLockedNotice />
      <div className="space-y-2">
        <Label htmlFor="branch">Branch</Label>
        <select
          id="branch"
          ref={branchSelectRef}
          defaultValue={initialBranchId}
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
      </div>

      <div className="space-y-2">
        <Label>Till number</Label>
        <TillNumberPicker
          slots={slots}
          deviceId={deviceId}
          value={resolvedTill}
          onChange={setTillNumber}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="shift">Shift</Label>
          <ShiftSelect id="shift" value={shiftCode} onChange={setShiftCode} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="businessDate">Business date</Label>
          <Input
            id="businessDate"
            type="date"
            value={businessDate}
            onChange={(e) => setBusinessDate(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="openingCash">Opening cash</Label>
        <Input
          id="openingCash"
          type="number"
          min={0}
          step="0.01"
          value={openingCash}
          onChange={(e) => setOpeningCash(e.target.value)}
          placeholder="0.00"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="note">Note (optional)</Label>
        <Textarea
          id="note"
          rows={2}
          maxLength={200}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional"
        />
      </div>

      {serverError ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      ) : null}

      <Button
        type="submit"
        size="lg"
        disabled={pending || !canSell || !resolvedTill}
        className="w-full sm:w-auto"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <>
            <KeyRound className="size-4" /> Open {formatTillLabel(resolvedTill)}
          </>
        )}
      </Button>
    </form>
  );
}
