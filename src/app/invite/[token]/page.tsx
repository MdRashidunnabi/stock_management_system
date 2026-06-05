import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { InviteAcceptClient } from "@/components/team/invite-accept-client";
import { getCurrentUser } from "@/lib/auth/tenant";
import { getInviteByToken } from "@/lib/team/queries";

export const metadata: Metadata = { title: "Join shop" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await getInviteByToken(token);
  const user = await getCurrentUser();

  if (!invite) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-bold">Invite not found</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          This link may have expired or been revoked.
        </p>
        <Link href="/" className="text-info mt-4 inline-block text-sm hover:underline">
          Go home
        </Link>
      </div>
    );
  }

  const now = new Date();
  if (new Date(invite.expiresAt) < now) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-bold">Invite expired</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Ask {invite.shopName} to send a new invite.
        </p>
      </div>
    );
  }

  if (!user) {
    redirect(`/signup?next=${encodeURIComponent(`/invite/${token}`)}`);
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <InviteAcceptClient
        token={token}
        shopName={invite.shopName}
        role={invite.role}
        email={invite.email}
        userEmail={user.email ?? ""}
      />
    </div>
  );
}
