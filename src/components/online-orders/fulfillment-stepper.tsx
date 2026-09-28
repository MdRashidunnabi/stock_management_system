"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setOnlineFulfillmentStageAction } from "@/lib/storefront/staff-actions";
import { stagesForFulfillment, type FulfillmentStage } from "@/lib/storefront/fulfillment";
import { cn } from "@/lib/utils";

export function FulfillmentStepper({
  orderId,
  fulfillmentType,
  stage,
  disabled,
}: {
  orderId: string;
  fulfillmentType: string;
  stage: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const steps = stagesForFulfillment(fulfillmentType);
  const currentIdx = Math.max(
    0,
    steps.findIndex((s) => s.value === stage),
  );

  return (
    <ol className="flex flex-col gap-2">
      {steps.map((s, i) => {
        const active = s.value === stage;
        const done = i < currentIdx;
        return (
          <li key={s.value} className="flex items-center gap-3">
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                active
                  ? "bg-primary text-primary-foreground"
                  : done
                    ? "bg-emerald-600 text-white"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {i + 1}
            </span>
            <span className={cn("flex-1 text-sm", active && "font-semibold")}>{s.label}</span>
            {!disabled && !active ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => {
                  start(async () => {
                    const res = await setOnlineFulfillmentStageAction({
                      orderId,
                      stage: s.value as FulfillmentStage,
                    });
                    if (res?.serverError) {
                      toast.error(res.serverError);
                      return;
                    }
                    toast.success(`Updated to ${s.label}`);
                    router.refresh();
                  });
                }}
              >
                Set
              </Button>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
