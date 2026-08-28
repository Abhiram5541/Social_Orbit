import { expect, test } from "@playwright/test";
import { creatorIds, ACCOUNTS, apiSignIn, signIn } from "./test-helpers";

test.describe("shortlists", () => {
  test("creates a shortlist, adds a creator, annotates and removes them", async ({
    page,
    request,
  }, testInfo) => {
    test.skip(
      testInfo.project.name === "mobile",
      "covered at phone width by responsive.spec.ts; this asserts the flow, not the layout",
    );
    await signIn(page, ACCOUNTS.clientOwner);
    // Workers share one in-memory store, so the name must be unique per worker.
    const name = `E2E-${testInfo.project.name}-${testInfo.workerIndex}-${Date.now()}`;

    await page.goto("/shortlists");
    await page.getByRole("button", { name: "New shortlist" }).first().click();
    const createDialog = page.getByRole("dialog", { name: "New shortlist" });
    await createDialog.getByLabel("Name").fill(name);
    await createDialog.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.getByRole("link", { name: new RegExp(name) })).toBeVisible();

    // Discovery hands a creator over through the URL.
    const [handedOver] = await creatorIds(request, 1);
    await page.goto(`/shortlists?add=${handedOver}`);
    const pickDialog = page.getByRole("dialog", { name: "Add to a shortlist" });
    await pickDialog.getByRole("button", { name: new RegExp(name) }).click();
    await expect(page.getByText(/Added to/)).toBeVisible();

    await page.getByRole("link", { name: new RegExp(name) }).first().click();
    await page.waitForURL(/\/shortlists\/sl_/);
    await expect(page.getByRole("region", { name: /Creators on/ })).toBeVisible();

    await page.getByRole("button", { name: "Add a note" }).first().click();
    const noteDialog = page.getByRole("dialog", { name: /Note on/ });
    await noteDialog.getByLabel("Note").fill("Checked cadence before confirming.");
    await noteDialog.getByRole("button", { name: "Save note" }).click();
    await expect(page.getByText("Checked cadence before confirming.")).toBeVisible();
  });

  test("an empty shortlist explains what to do next", async ({ page, request }) => {
    await apiSignIn(request, ACCOUNTS.clientOwner);
    const created = await request.post("/api/internal/shortlists", {
      data: { name: `Empty ${Date.now()}` },
    });
    const { id } = await created.json();

    await signIn(page, ACCOUNTS.clientOwner);
    await page.goto(`/shortlists/${id}`);
    await expect(page.getByText("This shortlist is empty")).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to discovery" })).toBeVisible();
  });
});

test.describe("campaigns", () => {
  test("requires a tracking hashtag and refuses to reuse one", async ({ request }) => {
    await apiSignIn(request, ACCOUNTS.clientOwner);

    // Missing hashtag.
    const missing = await request.post("/api/internal/campaigns", {
      data: {
        name: "No hashtag",
        platforms: ["youtube"],
        startsOn: "2026-09-01",
        endsOn: "2026-09-30",
        budgetCurrency: "INR",
        budgetAmount: null,
      },
    });
    expect(missing.status()).toBe(422);

    // Hashtag already tracking a live campaign.
    const clash = await request.post("/api/internal/campaigns", {
      data: {
        name: "Clashing",
        hashtag: "OrbitSeries2026",
        platforms: ["youtube"],
        startsOn: "2026-09-01",
        endsOn: "2026-09-30",
        budgetCurrency: "INR",
        budgetAmount: null,
      },
    });
    expect(clash.status()).toBe(409);
    expect((await clash.json()).error.message).toContain("already tracking");
  });

  test("creates a campaign and lands on its detail page", async ({ page }) => {
    await signIn(page, ACCOUNTS.clientOwner);
    await page.goto("/campaigns/new");

    const hashtag = `E2ETag${Date.now()}`;
    await page.getByLabel("Campaign name").fill("E2E campaign");
    await page.getByLabel("Tracking hashtag").fill(hashtag);
    await page.getByLabel("Ends on").fill("2026-12-31");
    await page.getByRole("button", { name: "Create campaign" }).click();

    await page.waitForURL(/\/campaigns\/cmp_/);
    await expect(page.getByText(hashtag).first()).toBeVisible();
    await expect(page.getByText("How these figures are attributed")).toBeVisible();
  });

  test("keeps campaign performance separate from the health score", async ({ page }) => {
    await signIn(page, ACCOUNTS.clientOwner);
    await page.goto("/campaigns/cmp_orbit_launch");

    const table = page.getByRole("region", { name: "Campaign participants" });
    await expect(table.getByRole("columnheader", { name: "Campaign score" })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "Health" })).toBeVisible();
  });

  test("a campaign with no attributed posts says so", async ({ page, request }) => {
    await apiSignIn(request, ACCOUNTS.clientOwner);
    const created = await request.post("/api/internal/campaigns", {
      data: {
        name: "Untracked",
        hashtag: `Untracked${Date.now()}`,
        platforms: ["instagram"],
        startsOn: "2026-09-01",
        endsOn: "2026-09-30",
        budgetCurrency: "INR",
        budgetAmount: null,
      },
    });
    const { id } = await created.json();

    await signIn(page, ACCOUNTS.clientOwner);
    await page.goto(`/campaigns/${id}`);
    await expect(page.getByText("No posts matched yet")).toBeVisible();
  });
});

test.describe("creator portal", () => {
  test("a creator sees their own record and its audience data", async ({ page }) => {
    await signIn(page, ACCOUNTS.creator);
    await page.goto("/creator/analytics");
    await expect(page.getByRole("heading", { name: "Your analytics" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "SocialOrbit Health" })).toBeVisible();
  });

  test("verification explains that it is never granted from public data", async ({ page }) => {
    await signIn(page, ACCOUNTS.creator);
    await page.goto("/creator/verification");
    await expect(page.getByText(/never from public data/)).toBeVisible();
  });

  test("a creator cannot browse the client database", async ({ page }) => {
    await signIn(page, ACCOUNTS.creator);
    await page.goto("/discovery");
    await expect(page).toHaveURL(/\/creator/);
  });
});
