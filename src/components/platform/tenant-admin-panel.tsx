"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  platformActivateAction,
  platformExtendTrialAction,
  platformMarkPastDueAction,
  platformSetStatusAction,
  platformSimulatePaymentAction,
  platformSuspendAction,
} from "@/lib/billing/actions";
import { getSafeActionData, getSafeActionError } from "@/lib/parse-safe-action-result";

const FORCE_STATUSES = ["trial", "active", "past_due", "suspended", "cancelled"] as const;

type StatusResult = { ok: true; status: string; message: string };

interface Props {
  tenantId: string;
  status: string;
  embedded?: boolean;
  onUpdated?: (status: string) => void;
}

export function TenantAdminPanel({ tenantId, status, embedded = false, onUpdated }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useState(status);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    setCurrent(status);
  }, [status]);

  function run(label: string, fn: () => Promise<unknown>) {
    setNotice(null);
    startTransition(async () => {
      const res = await fn();
      const err = getSafeActionError(res);
      if (err) {
        setNotice({ ok: false, text: err });
        toast.error(err);
        return;
      }
      const data = getSafeActionData<StatusResult>(res);
      const nextStatus = data?.status ?? current;
      const text = data?.message ?? `${label} done.`;
      setCurrent(nextStatus);
      setNotice({ ok: true, text });
      toast.success(text);
      onUpdated?.(nextStatus);
      router.refresh();
    });
  }

  const body = (
    <div className="space-y-4">
      {notice ? (
        <Alert variant={notice.ok ? "default" : "destructive"}>
          <AlertDescription>{notice.text}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground text-sm">Current status</span>
        <Badge variant="outline" className="capitalize">
          {current.replace("_", " ")}
        </Badge>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => run("Record payment", () => platformSimulatePaymentAction({ tenantId }))}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          Record payment
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => run("Turn on shop", () => platformActivateAction({ tenantId }))}
        >
          Turn on shop
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => run("Payment failed", () => platformMarkPastDueAction({ tenantId }))}
        >
          Payment failed
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={pending}
          onClick={() => run("Pause shop", () => platformSuspendAction({ tenantId }))}
        >
          Pause shop
        </Button>
      </div>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const days = Number(fd.get("days"));
          run("Extend trial", () => platformExtendTrialAction({ tenantId, days }));
        }}
      >
        <div className="space-y-1">
          <Label htmlFor="days">Extend trial (days)</Label>
          <Input
            id="days"
            name="days"
            type="number"
            min={1}
            max={90}
            defaultValue={14}
            className="w-24"
          />
        </div>
        <Button type="submit" size="sm" disabled={pending}>
          Extend
        </Button>
      </form>
      <div className="space-y-2 border-t pt-4">
        <p className="text-sm font-medium">Set status</p>
        <p className="text-muted-foreground text-xs">
          These change the shop immediately. The badge above updates when it works.
        </p>
        <div className="flex flex-wrap gap-2">
          {FORCE_STATUSES.map((s) => (
            <Button
              key={s}
              type="button"
              size="sm"
              variant={current === s ? "default" : "outline"}
              disabled={pending}
              className="capitalize"
              onClick={() =>
                run(`Force ${s.replace("_", " ")}`, () =>
                  platformSetStatusAction({ tenantId, status: s }),
                )
              }
            >
              Force {s.replace("_", " ")}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );

  if (embedded) return body;

  return (
    <Card>
      <CardHeader>
        <CardTitle>What do you want to do?</CardTitle>
        <p className="text-muted-foreground text-sm">
          These buttons change the shop immediately. Use &quot;Pause shop&quot; if they have not
          paid.
        </p>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
