"use client";

import { useLayoutEffect } from "react";

/** Hides till chrome so the second screen is only the customer view. */
export function CustomerDisplayChrome() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.shoposCustomerDisplay = "true";
    root.dataset.shoposKiosk = "true";
    return () => {
      delete root.dataset.shoposCustomerDisplay;
      delete root.dataset.shoposKiosk;
    };
  }, []);
  return null;
}
