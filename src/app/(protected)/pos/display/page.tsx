import type { Metadata } from "next";
import { CustomerDisplayChrome } from "@/components/pos/customer-display-chrome";
import { CustomerDisplayScreen } from "@/components/pos/customer-display-screen";

export const metadata: Metadata = { title: "Customer display" };

export default function CustomerDisplayPage() {
  return (
    <>
      <CustomerDisplayChrome />
      <CustomerDisplayScreen />
    </>
  );
}
