import type { Metadata } from "next";
import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata: Metadata = {
  title: "Create your account",
  description: "Create a ShopOS account and start your 30-day pilot.",
};

export default function SignUpPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Start your 30-day pilot</h1>
        <p className="text-muted-foreground text-sm">
          No card required. We&apos;ll set you up with a demo shop you can play with.
        </p>
      </div>
      <SignUpForm />
    </div>
  );
}
