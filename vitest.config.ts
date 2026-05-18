import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

/**
 * Vitest config.
 *
 * Unit tests run in a jsdom environment so React components and modules
 * that touch `window` / `navigator` work the same as in the browser. We
 * stub out `server-only` so server-scoped modules can be imported in
 * tests, and we provide a `fake-indexeddb` autoload via the test setup
 * file for any test that exercises the offline POS storage layer.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Don't pick up Playwright e2e specs.
    exclude: ["node_modules", ".next", "e2e", "scripts"],
    // Use the threads pool: subprocess `kill` is restricted in some
    // sandboxes, and IDB state is naturally per-thread, so each test
    // file gets a fresh module graph. `maxWorkers: 1` is the Vitest 4
    // replacement for `poolOptions.threads.singleThread`.
    isolate: true,
    pool: "threads",
    maxWorkers: 1,
    coverage: {
      reporter: ["text", "html"],
      include: ["src/lib/**", "src/components/**"],
      exclude: ["**/*.test.*", "**/types.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./src/test/server-only-stub.ts"),
    },
  },
});
