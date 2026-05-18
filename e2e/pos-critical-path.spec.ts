import { test, expect } from "./fixtures";

/**
 * POS critical path: sign in -> open POS -> search a seeded product ->
 * add to cart -> take cash payment -> verify success toast + cart clear.
 *
 * The test deliberately uses real UI clicks (not API short-cuts) for
 * everything that the cashier touches. Bootstrap (tenant + product +
 * opening stock) goes through the service role for speed; the rest is
 * a verbatim simulation of a cashier doing one sale.
 */

test("cashier can sign in and complete a cash sale", async ({ page, pos, context }) => {
  // Stop the receipt window from popping a new tab during the test.
  await context.addInitScript(() => {
    window.open = () => null;
  });

  await pos.signIn(page);
  await expect(page.getByRole("heading", { name: /Owner dashboard|Welcome/i })).toBeVisible({
    timeout: 15_000,
  });

  // Visit the POS terminal.
  await page.goto("/pos");
  await expect(page.getByLabel("Scan or search")).toBeVisible({ timeout: 15_000 });

  // Make sure the terminal mounted (offline status badge is rendered).
  await expect(page.getByText(/Online|Offline|Sync pending/i).first()).toBeVisible();

  // Search by SKU.
  await page.getByLabel("Scan or search").fill(pos.product.sku);
  // Server action debounces 200ms; wait for the result tile to render.
  const productTile = page.getByRole("button", { name: new RegExp(pos.product.name, "i") });
  await expect(productTile).toBeVisible({ timeout: 15_000 });
  await productTile.click();

  // Cart should have one line; total = €1.50 (STD inclusive).
  await expect(page.getByText(/Cart \(1 line\)/)).toBeVisible();

  // Take payment.
  await page.getByRole("button", { name: /Take payment/ }).click();
  const paymentDialog = page.getByRole("dialog");
  await expect(paymentDialog).toBeVisible();
  await expect(paymentDialog.getByText(/Total due/).first()).toBeVisible();

  // "Exact cash" pre-fills the cash tender for the full amount.
  await paymentDialog.getByRole("button", { name: "Exact cash" }).click();
  await paymentDialog.getByRole("button", { name: "Complete sale" }).click();

  // Success path: toast + cart resets to the empty placeholder.
  await expect(page.getByText(/Receipt /)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Scan a barcode or pick from the search/i)).toBeVisible();
});
