"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReceiptPrintButton() {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={() => {
        if (typeof window !== "undefined") window.print();
      }}
    >
      <Printer className="size-4" />
      Print
    </Button>
  );
}
