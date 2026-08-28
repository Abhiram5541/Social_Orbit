import { expect, type Page, type APIRequestContext } from "@playwright/test";

/** Development seed accounts — see src/server/repositories/user-repository.ts. */
export const ACCOUNTS = {
  superAdmin: "admin@socialorbit.io",
  manager: "manager@socialorbit.io",
  analyst: "analyst@socialorbit.io",
  clientOwner: "owner@northwind.example",
  clientMember: "member@northwind.example",
  freeClient: "hello@lumen.example",
  creator: "creator@socialorbit.io",
} as const;

export const PASSWORD = process.env.DEV_SEED_PASSWORD ?? "SocialOrbit-Dev-2026";

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
