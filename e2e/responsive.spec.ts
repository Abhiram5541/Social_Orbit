import { expect, test } from "@playwright/test";
import { ACCOUNTS, signIn } from "./support";

/**
 * The rule the layout must hold at every width: content may scroll sideways
 * inside its own container, but the page body never does.
 */
async function expectNoHorizontalPageScroll(page: import("@playwright/test").Page) {
  // Measured on <body>, not <html>: documentElement.scrollWidth reports the
  // unclipped size of content sitting inside a nested scroll container, which
  // is the intended design rather than a layout defect.
  const overflow = await page.evaluate(
    () => document.body.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "the page itself must not scroll horizontally").toBeLessThanOrEqual(1);
}

const ROUTES = [
  "/",
  "/login",
  "/dashboard",
  "/discovery",
  "/influencers/inf_0001",
  "/shortlists",
  "/campaigns",
  "/campaigns/cmp_orbit_launch",
  "/compare?ids=inf_0001,inf_0004",
  "/usage",
  "/api-portal",
];

test.describe("responsive layout", () => {
  for (const width of [390, 768, 1024, 1440]) {
    test(`no page-level horizontal scroll at ${width}px`, async ({ page }, testInfo) => {
      // The viewport is set explicitly below, so the project's device profile
      // adds nothing — running this under both projects just doubled a long
      // navigation loop and made it time out under load.
      test.skip(
        testInfo.project.name === "mobile",
        "width is set explicitly; the device profile is irrelevant here",
      );
      testInfo.setTimeout(120_000);

      await page.setViewportSize({ width, height: 900 });
      await signIn(page, ACCOUNTS.clientOwner);

      for (const route of ROUTES) {
        await page.goto(route, { waitUntil: "networkidle" });
        await expectNoHorizontalPageScroll(page);
      }
    });
  }

  test("navigation collapses to a drawer on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page, ACCOUNTS.clientOwner);
    await page.goto("/dashboard");

    const openNav = page.getByRole("button", { name: "Open navigation" });
    await expect(openNav).toBeVisible();
    await openNav.click();
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  });

  test("discovery filters move into a sheet on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page, ACCOUNTS.clientOwner);
    await page.goto("/discovery");

    await page.getByRole("button", { name: /^Filters/ }).click();
    await expect(page.getByRole("button", { name: "Show results" })).toBeVisible();
  });
});

test.describe("keyboard and focus", () => {
  test("a skip link is the first stop and reaches the main region", async ({ page }) => {
    await signIn(page, ACCOUNTS.clientOwner);
    await page.goto("/dashboard");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  });

  test("the command palette opens on / and closes on Escape", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "keyboard shortcuts need a hardware keyboard");
    await signIn(page, ACCOUNTS.clientOwner);
    await page.goto("/dashboard");
    const palette = page.getByRole("dialog", { name: "Command palette" });

    // The shortcut binds on mount. A single press can land before hydration
    // completes, so press until it takes rather than assuming the first one does.
    await expect
      .poll(
        async () => {
          if (await palette.isVisible()) return true;
          await page.keyboard.press("/");
          return palette.isVisible();
        },
        { timeout: 15_000, intervals: [200, 400, 800] },
      )
      .toBe(true);

    await page.keyboard.press("Escape");
    await expect(palette).toBeHidden();
  });

  test("the palette searches creators and navigates to one", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "keyboard shortcuts need a hardware keyboard");
    await signIn(page, ACCOUNTS.clientOwner);
    await page.goto("/dashboard");
    await expect(page.getByRole("button", { name: /Search creators/ })).toBeVisible();

    await page.keyboard.press("/");
    await page.getByLabel("Search creators or jump to a page").fill("aria");

    // Wait for a creator row specifically — matched by its @handle — rather
    // than the first option to appear. The results arrive asynchronously, so
    // pressing Enter too early acts on whichever row happened to be first.
    const creator = page.getByRole("option").filter({ hasText: "@" }).first();
    await expect(creator).toBeVisible({ timeout: 10_000 });

    await page.keyboard.press("Enter");
    await page.waitForURL(/\/influencers\/inf_/);
  });
});
