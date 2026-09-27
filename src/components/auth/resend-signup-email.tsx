"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { resendSignupEmailAction } from "@/lib/auth/actions";
import { useT } from "@/components/i18n/locale-provider";
import { displayMessage } from "@/lib/i18n/display";

export function ResendSignupEmail({
  email,
  className,
}: {
  email: string;
  className?: string;
}) {
  const { t } = useT();
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);

  if (!email) return null;

  function onClick() {
    startTransition(async () => {
      const res = await resendSignupEmailAction({ email });
      if (res?.serverError) {
        toast.error(t("errors.generic"));
        return;
      }
      if (res?.data && res.data.ok === false) {
        const wait = "seconds" in res.data ? res.data.seconds : undefined;
        toast.error(displayMessage(t, res.data.message, wait ? { seconds: wait } : undefined));
        return;
      }
      setSent(true);
      toast.success(t("auth.resendSent"));
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      className={className ?? "w-full"}
      disabled={pending || sent}
      onClick={onClick}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : t("auth.resendLink")}
    </Button>
  );
}
