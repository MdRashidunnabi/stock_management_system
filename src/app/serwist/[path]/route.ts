import { spawnSync } from "node:child_process";
import { createSerwistRoute } from "@serwist/turbopack";

/**
 * Serwist's Turbopack route handler. It compiles `app/sw.ts` on demand
 * and serves it (and any helper assets) from `/serwist/<path>`.
 *
 * The `revision` is used to bust precache entries between deploys; using
 * the current git HEAD makes development behave like production - if you
 * commit, the SW invalidates.
 */
const revision =
  spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout?.trim() ||
  crypto.randomUUID();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute(
  {
    additionalPrecacheEntries: [{ url: "/~offline", revision }],
    swSrc: "src/app/sw.ts",
    useNativeEsbuild: true,
  },
);
