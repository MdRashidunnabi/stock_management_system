"use client";

export function PrintPageButton() {
  return (
    <button
      type="button"
      className="mt-6 rounded-lg bg-stone-900 px-4 py-2 text-sm text-white print:hidden"
      onClick={() => window.print()}
    >
      Print
    </button>
  );
}
