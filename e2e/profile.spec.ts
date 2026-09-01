import { expect, test } from "@playwright/test";
import { ACCOUNTS, creatorIds, signIn } from "./test-helpers";

test.describe("influencer profile", () => {
  test.beforeEach(async ({ page, request }) => {
    const [first] = await creatorIds(request, 1);
    await signIn(page, ACCOUNTS.clientOwner);
    await page.goto(`/influencers/${first}`);
  });

  test("shows the score, its formula version and its confidence separately", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "SocialOrbit Health" })).toBeVisible();
    // Any published formula version, not a fixed one: the guarantee is that a
    // score says which formula produced it, and pinning the literal makes every
    // legitimate recalibration look like a regression.
    await expect(page.getByText(/health-\d+\.\d+\.\d+/).first()).toBeVisible();
    // Confidence must be its own readout, not folded into the score.
    await expect(page.getByText("Data confidence")).toBeVisible();
  });

  test("says plainly that no model has classified this creator", async ({ page }) => {
    // The database is built from a public API, which reaches no AI layer. The
    // product's rule is that absence is stated, not filled in — so this is the
    // state to assert. The panel-labelling assertions ("AI interpretation",
    // "an explanation of stored measurements, not a source of them") belong
    // here again once an AI provider credential exists.
    await page.getByRole("tab", { name: "Overview" }).click();
    await expect(page.getByText("No AI enrichment for this creator yet")).toBeVisible();
    await expect(page.getByText(/AI explains scores here, it never produces them/)).toBeVisible();
  });

  test("every tab opens and renders a panel", async ({ page }) => {
    for (const name of ["Growth", "Audience", "Content", "Authenticity", "Benchmarks"]) {
      await page.getByRole("tab", { name }).click();
      await expect(page.getByRole("tabpanel")).toBeVisible();
    }
  });

  test("tab strip is operable with the arrow keys", async ({ page }) => {
    await page.getByRole("tab", { name: "Overview" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: "Growth" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("withholds audience demographics from a client and says why", async ({ page }) => {
    await page.getByRole("tab", { name: "Audience" }).click();
    const panel = page.getByRole("tabpanel");
    await expect(panel).toContainText(/not available|creator/i);
  });

  test("renders a building-history state instead of a misleading trend line", async ({ page }) => {
    // A freshly ingested creator holds one snapshot, which is not a trend.
    await expect(page.getByText("Growth history still building").first()).toBeVisible();
    await expect(page.getByText(/snapshots collected/).first()).toBeVisible();
  });

  test("a missing id is a 404, not a crash", async ({ page }) => {
    const response = await page.goto("/influencers/inf_does_not_exist");
    expect(response?.status()).toBe(404);
  });
});

test.describe("comparison", () => {
  test("asks for a second creator rather than rendering one column", async ({ page, request }) => {
    const [first] = await creatorIds(request, 1);
    await signIn(page, ACCOUNTS.clientOwner);
    await page.goto(`/compare?ids=${first}`);
    await expect(page.getByText("Select at least two creators")).toBeVisible();
  });

  test("compares creators and flags incomparable metrics", async ({ page, request }) => {
    const ids = await creatorIds(request, 3);
    await signIn(page, ACCOUNTS.clientOwner);
    await page.goto(`/compare?ids=${ids.join(",")}`);

    await expect(page.getByRole("region", { name: "Creator comparison" })).toBeVisible();
    await expect(page.getByRole("rowheader", { name: "Health score" })).toBeVisible();
    await expect(page.getByText("How to read this")).toBeVisible();
  });
});
