import { expect, test, type Page } from "@playwright/test";
import { creatorIds, ACCOUNTS, signIn } from "./test-helpers";

/* ---------------------------------------------------------------------------
 * The search view is mounted twice: at /discovery for clients and at
 * /admin/influencers for operators. It previously hardcoded /discovery when
 * writing filters to the URL, so an operator's every filter click was pushed
 * through a layout that rejects platform users and bounced to /admin — the
 * filters looked dead.
 *
 * These run the same interactions against both mount points, because testing
 * only the client surface is exactly what let that through.
 * ------------------------------------------------------------------------ */

const SURFACES = [
  { path: "/discovery", as: "clientOwner" as const, shortlists: true },
  { path: "/admin/influencers", as: "superAdmin" as const, shortlists: false },
];

async function totalResults(page: Page): Promise<number> {
  const text = await page
    .locator("p")
    .filter({ hasText: /^\s*[\d.,KM]+\s+creators?/ })
    .first()
    .innerText();
  const [value] = text.trim().split(/\s+/);
  const numeric = parseFloat(value.replace(/,/g, ""));
  return value.endsWith("K") ? numeric * 1000 : numeric;
}

for (const surface of SURFACES) {
  test.describe(`search at ${surface.path}`, () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page, ACCOUNTS[surface.as]);
      await page.goto(surface.path, { waitUntil: "networkidle" });
    });

    test("a filter stays on this page and narrows the results", async ({ page }) => {
      const before = await totalResults(page);

      const width = page.viewportSize()?.width ?? 1440;
      const usesSheet = width < 1024;
      const showResults = page.getByRole("button", { name: "Show results" });

      // A dropdown on a wide screen, a sheet on a narrow one — either way the
      // surface has to be opened before a filter can be reached.
      await page.getByRole("button", { name: /^Filters/ }).click();
      const scope = page.getByRole("dialog", { name: "Filters" });
      // An audience-size band, not a platform: the database is harvested from
      // YouTube, so every creator matches a YouTube filter and it narrows
      // nothing. A filter that cannot exclude anything cannot test narrowing.
      await scope.getByLabel("Mega · 1M+").check();
      if (usesSheet) await showResults.click();

      // The critical assertion: it stayed here rather than bouncing.
      await expect(page).toHaveURL(new RegExp(`${surface.path}\\?.*followerBand=mega`));

      await expect
        .poll(async () => totalResults(page), { timeout: 10_000 })
        .toBeLessThan(before);
    });

    test("the filter chip removes the filter and restores the full set", async ({ page }) => {
      const unfiltered = await totalResults(page);

      await page.goto(`${surface.path}?platform=youtube`, { waitUntil: "networkidle" });
      const remove = page.getByRole("button", { name: /Remove filter Platform/ });
      await expect(remove).toBeVisible();
      await remove.click();

      await expect(page).toHaveURL(new RegExp(`${surface.path}$`));
      await expect.poll(async () => totalResults(page), { timeout: 10_000 }).toBe(unfiltered);
    });

    test("sorting stays on this page", async ({ page }, testInfo) => {
      test.skip(testInfo.project.name === "mobile", "the sort control sits with the table view");
      await page.getByLabel("Sort results").selectOption("followers_desc");
      await expect(page).toHaveURL(new RegExp(`${surface.path}\\?.*sort=followers_desc`));
    });

    test(`shortlist action is ${surface.shortlists ? "offered" : "hidden"}`, async ({ page }) => {
      const shortlist = page.getByRole("button", { name: /to a shortlist$/ });
      if (surface.shortlists) {
        await expect(shortlist.first()).toBeVisible();
      } else {
        // Shortlists are client-owned; the route is unreachable for operators,
        // so offering the action would be a button that cannot work.
        await expect(shortlist).toHaveCount(0);
      }
    });
  });
}

test.describe("compare is reachable by every role that holds the permission", () => {
  for (const role of ["clientOwner", "superAdmin", "analyst"] as const) {
    test(`${role} can open a comparison`, async ({ page, request }) => {
      const ids = await creatorIds(request, 2);
      await signIn(page, ACCOUNTS[role]);
      const response = await page.goto(`/compare?ids=${ids.join(",")}`, {
        waitUntil: "networkidle",
      });
      expect(response?.status()).toBe(200);
      await expect(page).toHaveURL(/\/compare/);
      await expect(page.getByRole("region", { name: "Creator comparison" })).toBeVisible();
    });
  }

  test("a creator, who holds no compare permission, is redirected away", async ({ page, request }) => {
    const ids = await creatorIds(request, 2);
    await signIn(page, ACCOUNTS.creator);
    await page.goto(`/compare?ids=${ids.join(",")}`);
    await expect(page).toHaveURL(/\/creator/);
  });
});
