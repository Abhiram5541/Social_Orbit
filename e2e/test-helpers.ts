import { expect, type Locator, type Page, type APIRequestContext } from "@playwright/test";

/** Development seed accounts — see src/server/repositories/user-repository.ts. */
export const ACCOUNTS = {
  superAdmin: "admin@senso360.com",
  manager: "manager@senso360.com",
  analyst: "analyst@senso360.com",
  clientOwner: "owner@northwind.example",
  clientMember: "member@northwind.example",
  freeClient: "hello@lumen.example",
  creator: "creator@senso360.com",
} as const;

export const PASSWORD = process.env.DEV_SEED_PASSWORD ?? "SENSO-Dev-2026";

/** Signs in through the real form, so the test exercises the actual flow. */
export async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });
}

/** Authenticates an API context directly, for endpoint-level assertions. */
export async function apiSignIn(request: APIRequestContext, email: string) {
  const response = await request.post("/api/internal/auth/login", {
    data: { email, password: PASSWORD },
  });
  expect(response.ok()).toBeTruthy();
  return response;
}

/* ---------------------------------------------------------------------------
 * Creator ids
 *
 * The database is built from real ingested channels, so there are no fixed
 * fixture ids to hard-code. Tests that need a concrete creator ask for one
 * here: the ids are read once from the API and reused across the file, which
 * keeps assertions honest against whatever the database actually holds.
 * ------------------------------------------------------------------------ */

let cachedIds: string[] | null = null;

export async function creatorIds(request: APIRequestContext, count = 3): Promise<string[]> {
  if (!cachedIds) {
    await apiSignIn(request, ACCOUNTS.clientOwner);
    const response = await request.get("/api/internal/influencers?pageSize=25&sort=followers_desc");
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    cachedIds = (body.page?.items ?? []).map((item: { id: string }) => item.id);
  }
  expect(
    cachedIds!.length,
    "the influencer database is empty — run a harvest before the E2E suite",
  ).toBeGreaterThanOrEqual(count);
  return cachedIds!.slice(0, count);
}

/* ---------------------------------------------------------------------------
 * Discovery filters
 *
 * The filter surface has three shapes, chosen by viewport rather than probed:
 * `isVisible()` is a one-shot check that can run before hydration and send a
 * test down the wrong branch.
 *
 *   >= 1280  a persistent rail — nothing to open, and applied on change
 *   >= 1024  a dropdown — opened by the Filters button, applied on change
 *   <  1024  a sheet — opened by the Filters button, applied on "Show results"
 * ------------------------------------------------------------------------ */

export type FilterSurface = { scope: Locator; commit: () => Promise<void> };

export async function openFilters(page: Page): Promise<FilterSurface> {
  const width = page.viewportSize()?.width ?? 1440;

  // Filters sit beside the search field at every width: a popover from `lg`
  // up, a sheet below it. There is no persistent rail.
  await page.getByRole("button", { name: /^Filters/ }).click();
  const scope = page.getByRole("dialog", { name: "Filters" });

  if (width >= 1024) return { scope, commit: async () => {} };

  return {
    scope,
    commit: async () => {
      await page.getByRole("button", { name: "Show results" }).click();
    },
  };
}
