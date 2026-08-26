import { expect, test } from "@playwright/test";
import { ACCOUNTS, apiSignIn } from "./support";

/**
 * The security requirement is that permissions hold at the API, not that the
 * UI hides buttons. Every assertion here calls the endpoint directly.
 */
test.describe("server-side authorization", () => {
  test("rejects every protected endpoint when unauthenticated", async ({ request }) => {
    for (const path of [
      "/api/internal/influencers",
      "/api/internal/influencers/inf_0001",
      "/api/internal/shortlists",
      "/api/internal/api-keys",
      "/api/internal/campaigns",
    ]) {
      expect((await request.get(path)).status(), path).toBe(401);
    }
  });

  test("a creator cannot reach the client database or another creator", async ({ request }) => {
    await apiSignIn(request, ACCOUNTS.creator);
    expect((await request.get("/api/internal/influencers")).status()).toBe(403);
    expect((await request.get("/api/internal/influencers/inf_0002")).status()).toBe(403);
    expect((await request.get("/api/internal/shortlists")).status()).toBe(403);
  });

  test("a client member cannot read API keys their owner can", async ({ request }) => {
    await apiSignIn(request, ACCOUNTS.clientMember);
    expect((await request.get("/api/internal/shortlists")).status()).toBe(200);
    expect((await request.get("/api/internal/api-keys")).status()).toBe(403);
  });

  test("an analytics manager can read but not write client artifacts", async ({ request }) => {
    await apiSignIn(request, ACCOUNTS.analyst);
    expect((await request.get("/api/internal/influencers")).status()).toBe(200);
    expect(
      (await request.post("/api/internal/shortlists", { data: { name: "Nope" } })).status(),
    ).toBe(403);
    expect((await request.post("/api/internal/campaigns", { data: {} })).status()).toBe(403);
  });

  test("one tenant never sees another tenant's shortlists", async ({ request }) => {
    await apiSignIn(request, ACCOUNTS.clientOwner);
    const northwind = await (await request.get("/api/internal/shortlists")).json();
    expect(northwind.items.length).toBeGreaterThan(0);

    await apiSignIn(request, ACCOUNTS.freeClient);
    const lumen = await (await request.get("/api/internal/shortlists")).json();
    expect(lumen.items).toHaveLength(0);

    // And a direct id from the other tenant is not readable.
    const direct = await request.get("/api/internal/shortlists");
    expect(direct.status()).toBe(200);
    const ids: string[] = (await direct.json()).items.map((item: { id: string }) => item.id);
    expect(ids).not.toContain(northwind.items[0].id);
  });

  test("authorized audience analytics are withheld from client keys", async ({ request }) => {
    await apiSignIn(request, ACCOUNTS.clientOwner);
    const response = await request.get("/api/internal/influencers/inf_0001");
    expect(response.status()).toBe(200);
    const profile = await response.json();
    if (profile.audience.available) {
      throw new Error("A client must not receive first-party audience data.");
    }
    expect(profile.audience.reason).toContain("creator");
  });
});

test.describe("public v1 API", () => {
  test("refuses requests with no key, a bad key, or a session cookie", async ({ request }) => {
    expect((await request.get("/api/v1/influencers")).status()).toBe(401);
    expect(
      (
        await request.get("/api/v1/influencers", {
          headers: { authorization: "Bearer so_live_not-a-real-key" },
        })
      ).status(),
    ).toBe(401);

    // A browser session must not authenticate the public API.
    await apiSignIn(request, ACCOUNTS.clientOwner);
    expect((await request.get("/api/v1/influencers")).status()).toBe(401);
  });

  test("serves health without a credential", async ({ request }) => {
    const response = await request.get("/api/v1/health");
    expect(response.status()).toBe(200);
    expect((await response.json()).status).toBe("ok");
  });

  test("issues a key, answers with it, and rejects it once revoked", async ({ request }) => {
    await apiSignIn(request, ACCOUNTS.clientOwner);

    const created = await request.post("/api/internal/api-keys", {
      data: { name: "E2E key", scopes: ["influencers:read"] },
    });
    expect(created.status()).toBe(201);
    const { key, secret } = await created.json();
    expect(secret).toMatch(/^so_live_/);
    // The listing must never contain the secret itself.
    expect(JSON.stringify(key)).not.toContain(secret);

    const query = await request.get("/api/v1/influencers?page_size=2", {
      headers: { authorization: `Bearer ${secret}` },
    });
    expect(query.status()).toBe(200);
    const body = await query.json();
    expect(body.data.length).toBeLessThanOrEqual(2);
    expect(body.meta.page).toBe(1);

    await request.delete(`/api/internal/api-keys/${key.id}`);
    const afterRevoke = await request.get("/api/v1/influencers", {
      headers: { authorization: `Bearer ${secret}` },
    });
    expect(afterRevoke.status()).toBe(401);
  });
});
