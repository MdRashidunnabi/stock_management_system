"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setActiveTenantAction } from "@/lib/auth/actions";
import { acceptTeamInviteAction } from "@/lib/team/actions";

export function InviteAcceptClient({
  token,
  shopName,
  role,
  email,
  userEmail,
}: {
  token: string;
  shopName: string;
  role: string;
  email: string;
  userEmail: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const emailMatch = userEmail.toLowerCase() === email.toLowerCase();

  function accept() {
    startTransition(async () => {
      const res = await acceptTeamInviteAction({ token });
      if (res?.serverError) {
        toast.error(res.serverError);
        return;
      }
      if (res?.data?.tenantId) {
        await setActiveTenantAction({ tenantId: res.data.tenantId });
        toast.success(`Joined ${shopName}`);
        router.replace("/dashboard");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6 text-center">
      <div>
        <h1 className="text-2xl font-bold">Join {shopName}</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          You&apos;ve been invited as <span className="font-medium capitalize">{role}</span>.
        </p>
      </div>
      {!emailMatch ? (
        <p className="text-destructive text-sm">
          This invite was sent to <strong>{email}</strong>. You are signed in as {userEmail}. Sign
          in with the invited email or ask for a new invite.
        </p>
      ) : null}
      <Button className="w-full" disabled={pending || !emailMatch} onClick={accept}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        Accept invite
      </Button>
    </div>
  );
}
