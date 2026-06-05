"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
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

interface Props {
  tenantId: string;
  status: string;
}

export function TenantAdminPanel({ tenantId, status }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ data?: { ok: boolean }; serverError?: string }>) {
    startTransition(async () => {
      const res = await fn();
      if (res?.serverError) toast.error(res.serverError);
      else {
        toast.success("Done");
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>What do you want to do?</CardTitle>
        <p className="text-muted-foreground text-sm">
          These buttons change the shop immediately. Use &quot;Pause shop&quot; if they have not
          paid.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Badge variant="outline" className="capitalize">
          Current: {status.replace("_", " ")}
        </Badge>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => platformSimulatePaymentAction({ tenantId }))}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Record payment
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => platformActivateAction({ tenantId }))}
          >
            Turn on shop
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => platformMarkPastDueAction({ tenantId }))}
          >
            Payment failed
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={pending}
            onClick={() => run(() => platformSuspendAction({ tenantId }))}
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
            run(() => platformExtendTrialAction({ tenantId, days }));
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
        <div className="flex flex-wrap gap-2 border-t pt-4">
          {(["trial", "active", "past_due", "suspended", "cancelled"] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant="ghost"
              disabled={pending || status === s}
              className="capitalize"
              onClick={() => run(() => platformSetStatusAction({ tenantId, status: s }))}
            >
              Force {s.replace("_", " ")}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
