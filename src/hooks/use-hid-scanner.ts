"use client";

import { useEffect, useRef } from "react";
import { emptyHidScanState, feedHidScan } from "@/lib/pos/hid-scanner";

/**
 * Captures USB / Bluetooth HID wedge scanners (they type a barcode, then Enter).
 * Disable while a dialog is capturing keys (payment pad, one-off amount).
 */
export function useHidScanner(onScan: (code: string) => void, enabled = true) {
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return;
    let state = emptyHidScanState();

    function onKeyDown(event: KeyboardEvent) {
      if (event.isComposing) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-no-hid-scan]")) return;
      if (target?.closest("textarea, [contenteditable='true']")) return;

      const result = feedHidScan(state, event.key, Date.now());
      state = result.state;
      if (!result.complete) return;

      event.preventDefault();
      event.stopPropagation();
      onScanRef.current(result.complete);
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [enabled]);
}
