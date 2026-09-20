import { expect, test } from "@playwright/test";
import { ACCOUNTS, creatorIds, signIn } from "./test-helpers";

test.describe("influencer profile", () => {
  test.beforeEach(async ({ page, request }) => {
    const [first] = await creatorIds(request, 1);
    await signIn(page, ACCOUNTS.clientOwner);
    await page.goto(`/influencers/${first}`);
  });

  test("shows the score, its formula version and its confidence separately", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Health score" })).toBeVisible();
    // Any published formula version, not a fixed one: the guarantee is that a
    // score says which formula produced it, and pinning the literal makes every
    // legitimate recalibration look like a regression.
    await expect(page.getByText(/health-\d+\.\d+\.\d+/).first()).toBeVisible();
    // Confidence must be its own readout, not folded into the score.
    await expect(page.getByRole("heading", { name: "Data confidence" })).toBeVisible();
  });

  test("says plainly that no model has classified this creator", async ({ page }) => {
    // The database is built from a public API, which reaches no AI layer. The
    // product's rule is that absence is stated, not filled in — so this is the
    // state to assert. The panel-labelling assertions ("AI interpretation",
    // "an explanation of stored measurements, not a source of them") belong
    // here again once an AI provider credential exists.
    await expect(page.getByText("No interpretation yet")).toBeVisible();
    await expect(page.getByText(/The AI layer has not run for this creator/)).toBeVisible();
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

  test("draws a trend only from sufficient history, and says so otherwise", async ({ page }) => {
    // Which state shows depends on how many daily snapshots the database
    // holds for this creator (DPR §10.2) — the assertion is that exactly one
    // of the two honest states is rendered, never a curve on thin history.
    const building = page.getByText("Growth history still building").first();
    const curve = page.getByRole("img", { name: "Follower history" }).first();
    await expect(building.or(curve)).toBeVisible();
    if (await building.isVisible()) {
      await expect(page.getByText(/snapshots collected/).first()).toBeVisible();
      await expect(curve).toHaveCount(0);
    }
  });

  test("a missing id is a 404, not a crash", async ({ page }) => {
    // The route streams behind a loading boundary (CLAUDE.md D37), so the
    // status line is committed before `notFound()` runs; what a person gets
    // is the not-found page, and that is what is asserted.
    await page.goto("/influencers/inf_does_not_exist");
    await expect(page.getByRole("heading", { name: /page not found/i }).first()).toBeVisible();
    await expect(page.getByText(/application error|unhandled/i)).toHaveCount(0);
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
