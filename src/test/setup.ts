/**
 * Vitest global setup. Anything we want available in EVERY unit test
 * goes here.
 *
 *   - jest-dom matchers (`toBeInTheDocument`, etc.).
 *   - fake-indexeddb so the offline POS storage layer can run under jsdom.
 *   - a tiny shim for `crypto.randomUUID` if jsdom is older than the
 *     polyfilled version (we'll use fallback uuid generator).
 */
import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";

// crypto.randomUUID() exists in modern jsdom; if not, supply a fallback.
if (typeof globalThis.crypto === "undefined") {
  (globalThis as { crypto?: Crypto }).crypto = {} as Crypto;
}
if (typeof globalThis.crypto.randomUUID !== "function") {
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    configurable: true,
    value: () => {
      const bytes = new Uint8Array(16);
      for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
      bytes[6] = (bytes[6]! & 0x0f) | 0x40;
      bytes[8] = (bytes[8]! & 0x3f) | 0x80;
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}` as `${string}-${string}-${string}-${string}-${string}`;
    },
  });
}
