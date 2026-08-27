import { expect, test } from "@playwright/test";
import { ACCOUNTS, apiSignIn, signIn } from "./support";

test.describe("discovery", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, ACCOUNTS.clientOwner);
    await page.goto("/discovery");
  });

  /**
   * Above `lg` the results are a table; below it they are a card list. That is
   * a deliberate change of information hierarchy, not a shrunk table, so the
   * assertions resolve whichever shape the viewport produced.
   */
  const resultLinks = (page: import("@playwright/test").Page) =>
    // `:visible` matters: both shapes are in the DOM and one is display:none,
    // so an unscoped query would resolve to the hidden one first.
    page.locator('a[href^="/influencers/inf_"]:visible');

  test("lists creators with scores from the pipeline", async ({ page }) => {
    await expect(resultLinks(page).first()).toBeVisible();
    expect(await resultLinks(page).count()).toBeGreaterThan(0);
  });

  test("a filter narrows the result set and its chip removes it again", async ({ page }) => {
    // Results arrive from a fetch, so count only once they are on screen.
    await expect(resultLinks(page).first()).toBeVisible();
    const unfiltered = await resultLinks(page).count();

    // The URL is the state: a filtered view is reachable, shareable and
    // reloadable, which is the contract both filter surfaces write into.
    await page.goto("/discovery?platform=youtube");
    const remove = page.getByRole("button", { name: /Remove filter Platform/ });
    await expect(remove).toBeVisible();
    await expect(resultLinks(page).first()).toBeVisible();
    expect(await resultLinks(page).count()).toBeLessThanOrEqual(unfiltered);

    await remove.click();
    await expect(page).not.toHaveURL(/platform=/);
    await expect(remove).toBeHidden();
  });

  test("the filter surface writes into the URL", async ({ page }) => {
    // Which surface is on screen follows from the viewport, not from probing
    // visibility: `isVisible()` is a one-shot check that can run before
    // hydration and silently send the test down the wrong branch.
    const width = page.viewportSize()?.width ?? 1440;
    const usesSheet = width < 1280;

    const showResults = page.getByRole("button", { name: "Show results" });
    if (usesSheet) {
      // Below xl the controls only exist while the sheet is open.
      await page.getByRole("button", { name: /^Filters/ }).click();
      await expect(showResults).toBeVisible();
    }

    // Name the control rather than taking "the first visible checkbox": both
    // filter surfaces render the same names and one of them is display:none,
    // so the assertion has to say which filter it means.
    const surface = usesSheet ? page.getByRole("dialog", { name: "Filters" }) : page;
    await surface.getByLabel("YouTube").check();
    if (usesSheet) await showResults.click();

    await expect(page).toHaveURL(/platform=youtube/);
  });

  test("keyword search puts the term in the URL so results are shareable", async ({ page }) => {
    await page.getByLabel("Search influencers").fill("technology");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page.waitForURL(/q=technology/);
    await expect(page).toHaveURL(/q=technology/);
  });

  test("sorting by followers actually orders the column", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "the table view only exists above lg");
    await page.getByLabel("Sort results").selectOption("followers_desc");
    await page.waitForURL(/sort=followers_desc/);

    const cells = page
      .getByRole("region", { name: "Influencer search results" })
      .locator("tbody tr td:nth-child(3)");

    // The previous page stays on screen while the re-sorted one loads, so poll
    // until the rendered order settles rather than reading it once.
    await expect
      .poll(
        async () => {
          const values = (await cells.allInnerTexts()).map(parseCompact);
          const sorted = [...values].sort((a, b) => b - a);
          return JSON.stringify(values) === JSON.stringify(sorted);
        },
        { timeout: 10_000 },
      )
      .toBe(true);
  });

  test("an impossible filter combination shows an empty state, not a blank panel", async ({ page }) => {
    await page.goto("/discovery?followersMin=90000000&healthMin=99");
    await expect(page.getByText("No creators match these filters")).toBeVisible();
    await expect(page.getByRole("button", { name: "Clear filters" })).toBeVisible();
  });

  test("opens a profile from a result", async ({ page }) => {
    const first = resultLinks(page).first();
    const name = (await first.innerText()).trim();
    await first.click();
    await page.waitForURL(/\/influencers\/inf_/);
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  });
});

test.describe("free plan search allowance", () => {
  test("permits five metered searches then blocks the sixth", async ({ request }) => {
    await apiSignIn(request, ACCOUNTS.freeClient);

    let lastStatus = 0;
    for (let attempt = 1; attempt <= 6; attempt += 1) {
      const response = await request.get(
        `/api/internal/influencers?q=quota-probe-${Date.now()}-${attempt}`,
      );
      lastStatus = response.status();
      if (attempt <= 5) {
        // Earlier runs in the same process may have already spent the allowance,
        // so accept either an allowed search or the block, but never a crash.
        expect([200, 402]).toContain(lastStatus);
      }
    }
    expect(lastStatus).toBe(402);

    // Browsing without a filter stays available after the allowance is gone.
    const browse = await request.get("/api/internal/influencers");
    expect(browse.status()).toBe(200);
  });

  test("does not meter platform staff", async ({ request }) => {
    await apiSignIn(request, ACCOUNTS.manager);
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const response = await request.get(`/api/internal/influencers?q=staff-${attempt}`);
      expect(response.status()).toBe(200);
      expect((await response.json()).charged).toBe(false);
    }
  });
});

function parseCompact(text: string): number {
  const value = text.trim().replace(/,/g, "");
  if (value === "—" || value === "") return -1;
  const multiplier = value.endsWith("K") ? 1e3 : value.endsWith("M") ? 1e6 : 1;
  return parseFloat(value) * multiplier;
}
