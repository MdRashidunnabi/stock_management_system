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
 *   - HTML / RSC navigations always hit the network (never cache 404s).
 *     A first-load miss while the app is compiling must not stick as
 *     "Page not found" after the route exists.
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
import {
  NetworkOnly,
  Serwist,
  type PrecacheEntry,
  type RuntimeCaching,
  type SerwistGlobalConfig,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const livePages: RuntimeCaching[] = [
  {
    matcher: ({ request }) =>
      request.mode === "navigate" ||
      request.destination === "document" ||
      request.headers.get("RSC") === "1",
    handler: new NetworkOnly(),
  },
  ...defaultCache,
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: livePages,
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
