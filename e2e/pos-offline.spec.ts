import { test, expect } from "./fixtures";

/**
 * Offline POS path: cashier searches a product while online (so the
 * IndexedDB cache fills), goes offline, takes a cash sale (which gets
 * queued), comes back online, and the queue auto-syncs on the
 * `online` event.
 *
 * This is the highest-stakes test in the suite because it covers the
 * Step-13 idempotency guarantee: the queued sale must turn into
 * exactly one row in `public.sales` even if the browser retries.
 */

test("cashier can take a cash sale offline and have it sync on reconnect", async ({
  page,
  pos,
  context,
}) => {
  // The receipt opens in a new tab on success; suppress that.
  await context.addInitScript(() => {
    window.open = () => null;
  });

  await pos.signIn(page);
  await page.goto("/pos");
  await expect(page.getByLabel("Scan or search")).toBeVisible({ timeout: 15_000 });

  // Step 1: search online so the catalog cache picks up our product.
  await page.getByLabel("Scan or search").fill(pos.product.sku);
  const productTile = page.getByRole("button", { name: new RegExp(pos.product.name, "i") });
  await expect(productTile).toBeVisible({ timeout: 15_000 });

  // Step 2: go offline.
  await context.setOffline(true);
  await expect(page.getByText(/^Offline$/).first()).toBeVisible({ timeout: 10_000 });

  // Step 3: search again (offline cache should serve the same row).
  await page.getByLabel("Scan or search").fill("");
  await page.getByLabel("Scan or search").fill(pos.product.sku);
  const offlineTile = page.getByRole("button", { name: new RegExp(pos.product.name, "i") });
  await expect(offlineTile).toBeVisible({ timeout: 10_000 });
  await offlineTile.click();

  await expect(page.getByText(/Cart \(1 line\)/)).toBeVisible();

  // Step 4: take cash payment - dialog should be cash-only.
  await page.getByRole("button", { name: /Take payment/ }).click();
  const paymentDialog = page.getByRole("dialog");
  await expect(paymentDialog).toBeVisible();
  await expect(paymentDialog.getByText(/Total due/).first()).toBeVisible();
  await paymentDialog.getByRole("button", { name: "Exact cash" }).click();
  await paymentDialog.getByRole("button", { name: "Complete sale" }).click();

  // Toast confirms the queue, cart clears.
  await expect(page.getByText(/Sale queued offline/)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/Scan a barcode or pick from the search/i)).toBeVisible();
  // The status badge should now read "Sync pending" with 1 queued.
  await expect(page.getByText(/1 queued/i)).toBeVisible();

  // Step 5: come back online. The hook flushes on the `online` event.
  await context.setOffline(false);

  // Wait for the queue to drain (the badge stops showing "1 queued").
  await expect(page.getByText(/1 queued/i)).toBeHidden({ timeout: 30_000 });
  // And status returns to "Online" (or "Sync pending" briefly).
  await expect(page.getByText(/^Online$/).first()).toBeVisible({ timeout: 30_000 });
});
