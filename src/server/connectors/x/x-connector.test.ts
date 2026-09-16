import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ConnectorUnavailable,
  fetchAccount,
  fetchRecentPosts,
  parseAccountInput,
  resetBearerTokenCache,
} from "./x-connector";

/**
 * The parsers and the failure mapping are what break silently when X changes
 * something, so those are what is asserted here — same posture as
 * `youtube-connector.test.ts`. The live API is not called: `GET
 * /api/internal/connectors/x/probe` is the live check, and it spends a real
 * call against X's rate limit.
 */

function mockBearerToken(fetchMock: ReturnType<typeof vi.fn>) {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({ token_type: "bearer", access_token: "test-bearer-token" }),
  });
}

describe("parseAccountInput", () => {
  it("treats a bare name as a username", () => {
    expect(parseAccountInput("X")).toEqual({ kind: "username", value: "X" });
    expect(parseAccountInput("  @X ")).toEqual({ kind: "username", value: "X" });
  });

  it("reads a handle out of an x.com or twitter.com URL", () => {
    expect(parseAccountInput("https://x.com/X")).toEqual({ kind: "username", value: "X" });
    expect(parseAccountInput("https://twitter.com/X/status/123")).toEqual({
      kind: "username",
      value: "X",
    });
  });
});

describe("fetchAccount", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("X_API_KEY", "test-key");
    vi.stubEnv("X_API_SECRET", "test-secret");
    fetchMock.mockReset();
    resetBearerTokenCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    resetBearerTokenCache();
  });

  function respond(status: number, body: unknown) {
    fetchMock.mockResolvedValueOnce({ ok: status < 400, status, json: async () => body });
  }

  const userBody = (publicMetrics: Record<string, number>) => ({
    data: {
      id: "783214",
      username: "X",
      name: "X",
      description: "what's happening",
      created_at: "2007-03-21T15:25:54Z",
      public_metrics: {
        followers_count: 0,
        following_count: 0,
        tweet_count: 0,
        listed_count: 0,
        ...publicMetrics,
      },
    },
  });

  it("reads public_metrics as numbers, not strings", async () => {
    mockBearerToken(fetchMock);
    respond(
      200,
      userBody({ followers_count: 628_000_000, following_count: 300, tweet_count: 15_000 }),
    );

    const account = await fetchAccount("@X");
    expect(account?.followers).toBe(628_000_000);
    expect(account?.following).toBe(300);
    expect(account?.postCount).toBe(15_000);
  });

  it("never surfaces X's own verified badge as anything but xVerifiedBadge", async () => {
    // The single easiest way to violate Arch §2: X's legacy/paid blue-check
    // must never be read as SENSO's OAuth-confirmed Verified status.
    mockBearerToken(fetchMock);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: { ...userBody({}).data, verified: true },
      }),
    });

    const account = await fetchAccount("@X");
    expect(account?.xVerifiedBadge).toBe(true);
    // The account shape carries no `isConnected` or `identityMatched` field at
    // all — those only ever exist on the influencer record built downstream,
    // and only OAuth sets them true.
    expect(account).not.toHaveProperty("isConnected");
    expect(account).not.toHaveProperty("identityMatched");
    expect(account).not.toHaveProperty("verified");
  });

  it("returns null when no account matches", async () => {
    mockBearerToken(fetchMock);
    respond(200, {});
    await expect(fetchAccount("@nobody")).resolves.toBeNull();
  });

  it("maps HTTP 402 credits-depleted to billing_required, distinct from quota_exceeded", async () => {
    mockBearerToken(fetchMock);
    respond(402, { detail: "credits depleted", status: 402, title: "Payment Required" });

    await expect(fetchAccount("@X")).rejects.toMatchObject({
      name: "ConnectorUnavailable",
      reason: "billing_required",
    });
  });

  it("maps HTTP 429 to quota_exceeded", async () => {
    mockBearerToken(fetchMock);
    respond(429, { title: "Too Many Requests" });

    await expect(fetchAccount("@X")).rejects.toMatchObject({ reason: "quota_exceeded" });
  });

  it("refuses to call the API without both credentials", async () => {
    vi.stubEnv("X_API_KEY", "");
    vi.stubEnv("X_API_SECRET", "");
    await expect(fetchAccount("@X")).rejects.toBeInstanceOf(ConnectorUnavailable);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("fetchRecentPosts resilience", () => {
  beforeEach(() => resetBearerTokenCache());
  afterEach(() => resetBearerTokenCache());

  it("skips a post it cannot parse instead of failing the whole page", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("X_API_KEY", "test-key");
    vi.stubEnv("X_API_SECRET", "test-secret");

    mockBearerToken(fetchMock);

    const good = (id: string) => ({
      id,
      text: `post ${id}`,
      created_at: "2026-01-01T00:00:00Z",
      public_metrics: { like_count: 10, retweet_count: 1, reply_count: 2, quote_count: 0 },
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: [good("a"), { id: "broken" }, good("b")],
      }),
    });

    const posts = await fetchRecentPosts("783214", 10);
    expect(posts.map((post) => post.postId)).toEqual(["a", "b"]);

    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("keeps impressions absent rather than zero when the API omits them", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("X_API_KEY", "test-key");
    vi.stubEnv("X_API_SECRET", "test-secret");

    mockBearerToken(fetchMock);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          {
            id: "a",
            text: "hello",
            created_at: "2026-01-01T00:00:00Z",
            public_metrics: { like_count: 1, retweet_count: 0, reply_count: 0, quote_count: 0 },
          },
        ],
      }),
    });

    const posts = await fetchRecentPosts("783214", 5);
    expect(posts[0].impressions).toBeNull();

    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
});
