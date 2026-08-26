import { expect, test } from "@playwright/test";
import { ACCOUNTS, signIn } from "./support";

test.describe("influencer profile", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, ACCOUNTS.clientOwner);
    await page.goto("/influencers/inf_0001");
  });

  test("shows the score, its formula version and its confidence separately", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "SocialOrbit Health" })).toBeVisible();
    await expect(page.getByText("health-1.0.0").first()).toBeVisible();
    // Confidence must be its own readout, not folded into the score.
    await expect(page.getByText("Data confidence")).toBeVisible();
  });

  test("labels the AI panel as interpretation, not measurement", async ({ page }) => {
    await expect(page.getByText("What the signals say")).toBeVisible();
    await expect(page.getByText("AI interpretation")).toBeVisible();
    await expect(
      page.getByText(/explanation of stored measurements, not a source of them/),
    ).toBeVisible();
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
    // inf_0001 is seeded with too few snapshots to draw an honest trend.
    await expect(page.getByText("Growth history still building").first()).toBeVisible();
    await expect(page.getByText(/snapshots collected/).first()).toBeVisible();
  });

  test("a missing id is a 404, not a crash", async ({ page }) => {
    const response = await page.goto("/influencers/inf_does_not_exist");
    expect(response?.status()).toBe(404);
  });
});

test.describe("comparison", () => {
  test("asks for a second creator rather than rendering one column", async ({ page }) => {
    await signIn(page, ACCOUNTS.clientOwner);
    await page.goto("/compare?ids=inf_0001");
    await expect(page.getByText("Select at least two creators")).toBeVisible();
  });

  test("compares creators and flags incomparable metrics", async ({ page }) => {
    await signIn(page, ACCOUNTS.clientOwner);
    await page.goto("/compare?ids=inf_0001,inf_0004,inf_0009");

    await expect(page.getByRole("region", { name: "Creator comparison" })).toBeVisible();
    await expect(page.getByRole("rowheader", { name: "Health score" })).toBeVisible();
    await expect(page.getByText("How to read this")).toBeVisible();
  });
});
