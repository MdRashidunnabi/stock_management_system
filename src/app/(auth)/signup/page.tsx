import type { Metadata } from "next";
import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata: Metadata = {
  title: "Create your account",
  description: "Create a ShopOS account and start your 30-day pilot.",
};

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  const isInvite = sp.next?.startsWith("/invite/");

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {isInvite ? "Create your account" : "Start your 30-day pilot"}
        </h1>
        <p className="text-muted-foreground text-sm">
          {isInvite
            ? "Sign up with the email on your invite, then accept the invitation."
            : "Create your shop and start a 30-day trial. Add a card to unlock POS and team features."}
        </p>
      </div>
      <SignUpForm next={sp.next} />
    </div>
  );
}
