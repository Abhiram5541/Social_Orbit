import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectorUnavailable, __resetInstagramPool, fetchAccount, parseAccountInput } from "./instagram-connector";

const fetchMock = vi.fn();

function respond(status: number, body: unknown) {
  fetchMock.mockResolvedValueOnce({ ok: status < 400, status, json: async () => body });
}

beforeEach(() => {
  __resetInstagramPool();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("META_IG_TOKEN", "tok");
  vi.stubEnv("META_IG_USER_ID", "17841400000000000");
});
afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("parseAccountInput", () => {
  it("takes @handles, bare handles and instagram.com URLs", () => {
    expect(parseAccountInput("@NatGeo")).toBe("natgeo");
    expect(parseAccountInput("natgeo")).toBe("natgeo");
    expect(parseAccountInput("https://www.instagram.com/natgeo/?hl=en")).toBe("natgeo");
  });
});

describe("fetchAccount", () => {
  it("maps a Business Discovery read, keeping hidden like counts absent", async () => {
    respond(200, {
      business_discovery: {
        id: "178", username: "natgeo", name: "National Geographic", biography: "bio",
        followers_count: 280_000_000, media_count: 30_000,
        media: { data: [{ id: "m1", caption: "Hello #world", permalink: "https://www.instagram.com/p/m1/", timestamp: "2026-09-01T00:00:00+0000", comments_count: 12 }] },
      },
    });
    const found = await fetchAccount("@natgeo");
    expect(found?.account).toMatchObject({ userId: "178", username: "natgeo", followers: 280_000_000 });
    expect(found?.posts[0]).toMatchObject({ postId: "m1", likes: null, comments: 12 });
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.pathname).toContain("/17841400000000000");
    expect(url.searchParams.get("fields")).toContain("business_discovery.username(natgeo)");
  });

  it("returns null for a personal or missing account, and refuses without a token", async () => {
    respond(400, { error: { message: "no such user", code: 110, error_subcode: 2207013 } });
    await expect(fetchAccount("nobody")).resolves.toBeNull();

    vi.stubEnv("META_IG_TOKEN", "");
    __resetInstagramPool();
    await expect(fetchAccount("natgeo")).rejects.toMatchObject({ reason: "credentials_missing" });
  });

  it("distinguishes a dead token from the hourly rate limit", async () => {
    respond(400, { error: { message: "Error validating access token", code: 190 } });
    await expect(fetchAccount("natgeo")).rejects.toMatchObject({ name: "ConnectorUnavailable", reason: "credentials_missing" });
    respond(400, { error: { message: "Application request limit reached", code: 4 } });
    await expect(fetchAccount("natgeo")).rejects.toBeInstanceOf(ConnectorUnavailable);
    await expect(async () => { respond(400, { error: { code: 4 } }); await fetchAccount("natgeo"); }).rejects.toMatchObject({ reason: "quota_exceeded" });
  });
});

describe("graph host", () => {
  it("sends an Instagram Login token to graph.instagram.com", async () => {
    vi.stubEnv("META_IG_TOKEN", "IGAAxyz");
    respond(200, { business_discovery: { id: "1", username: "a", followers_count: 1 } });
    await fetchAccount("a");
    expect(String(fetchMock.mock.calls[0][0])).toContain("https://graph.instagram.com/");
  });
});

describe("credential pool", () => {
  it("moves to the next credential when one hits its hourly limit", async () => {
    vi.stubEnv("META_IG_POOL", "222:tokB");
    respond(400, { error: { message: "limit", code: 4 } });
    respond(200, { business_discovery: { id: "1", username: "a", followers_count: 1 } });
    const found = await fetchAccount("a");
    expect(found?.account.username).toBe("a");
    const hosts = fetchMock.mock.calls.map((c) => new URL(String(c[0])).searchParams.get("access_token"));
    expect(hosts).toEqual(["tok", "tokB"]);
  });
});
