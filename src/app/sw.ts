/// <reference lib="esnext" />
/// <reference lib="webworker" />

/**
 * ShopOS - Step 13 - Service worker entrypoint.
 *
 * Compiled by `@serwist/turbopack` and served from `/serwist/sw.js`.
 *
 * Strategy:
 *   - Static assets (JS / CSS / images / fonts) are precached at install
 *     time using Serwist's `defaultCache` rules.
 *   - Navigations (HTML routes) are NetworkFirst with a short timeout so
 *     the user always sees fresh data when online but never sees a blank
 *     screen when offline.
 *   - When offline, navigations fall back to `/~offline`, which is a
 *     small static page that explains the situation and links to the POS
 *     (the POS terminal itself is a regular cached route, but `/~offline`
 *     guarantees that even uncached deep links land somewhere readable).
 *   - Authenticated API and Server Action requests are NEVER cached by the
 *     service worker. The offline POS reads/writes through IndexedDB
 *     (see `src/lib/pos/offline/*`), so there is no risk of the SW
 *     handing back a stale `commit_pos_sale` response.
 */
import { defaultCache } from "@serwist/turbopack/worker";
import { Serwist, type PrecacheEntry, type SerwistGlobalConfig } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();
