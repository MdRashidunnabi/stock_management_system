import { PlatformStaffForm } from "@/components/platform/platform-staff-form";

export const metadata = { title: "Platform staff" };

export default function PlatformStaffPage() {
  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Platform staff</h1>
        <p className="text-muted-foreground text-sm">
          Grant super-admin access to another email. They must already have a ShopOS account.
        </p>
      </div>
      <PlatformStaffForm />
    </div>
  );
}
