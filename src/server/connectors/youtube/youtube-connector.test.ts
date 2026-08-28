import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectorUnavailable, fetchChannel, parseChannelInput, parseDuration } from "./youtube-connector";

/**
 * The parsers and the failure mapping are what break silently when YouTube
 * changes something, so those are what is asserted here. The live API is not
 * called: `GET /api/internal/connectors/youtube/probe` is the live check, and
 * it spends real quota.
 */

describe("parseChannelInput", () => {
  it("passes a channel id through untouched", () => {
    expect(parseChannelInput("UCBJycsmduvYEL83R_U4JriQ")).toEqual({
      kind: "id",
      value: "UCBJycsmduvYEL83R_U4JriQ",
    });
  });

  it("reads an id, handle or legacy username out of a URL", () => {
    expect(parseChannelInput("https://www.youtube.com/channel/UCBJycsmduvYEL83R_U4JriQ")).toEqual({
      kind: "id",
      value: "UCBJycsmduvYEL83R_U4JriQ",
    });
    expect(parseChannelInput("https://www.youtube.com/@mkbhd/videos")).toEqual({
      kind: "handle",
      value: "@mkbhd",
    });
    expect(parseChannelInput("https://youtube.com/user/marquesbrownlee")).toEqual({
      kind: "username",
      value: "marquesbrownlee",
    });
  });

  it("treats a bare name as a handle", () => {
    expect(parseChannelInput("mkbhd")).toEqual({ kind: "handle", value: "@mkbhd" });
    expect(parseChannelInput("  @mkbhd ")).toEqual({ kind: "handle", value: "@mkbhd" });
  });
});

describe("parseDuration", () => {
  it("reads hours, minutes and seconds", () => {
    expect(parseDuration("PT1H2M3S")).toBe(3723);
    expect(parseDuration("PT12M")).toBe(720);
    expect(parseDuration("PT45S")).toBe(45);
  });

  it("returns null for a live stream or an unreadable value", () => {
    // A running live stream reports P0D — a zero here would drag every
    // average length calculation down as though the video had no duration.
    expect(parseDuration("P0D")).toBeNull();
    expect(parseDuration("nonsense")).toBeNull();
  });
});

describe("fetchChannel", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("YOUTUBE_API_KEY", "test-key");
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  function respond(status: number, body: unknown) {
    fetchMock.mockResolvedValue({ ok: status < 400, status, json: async () => body });
  }

  const channelBody = (statistics: Record<string, unknown>) => ({
    items: [
      {
        id: "UCBJycsmduvYEL83R_U4JriQ",
        snippet: {
          title: "Marques Brownlee",
          customUrl: "@mkbhd",
          publishedAt: "2008-03-21T15:25:54Z",
          thumbnails: { default: { url: "https://example.com/a.jpg" } },
        },
        statistics,
        contentDetails: { relatedPlaylists: { uploads: "UUBJycsmduvYEL83R_U4JriQ" } },
      },
    ],
  });

  it("reads string counters as numbers", async () => {
    respond(200, channelBody({ viewCount: "5550015388", subscriberCount: "21200000", videoCount: "1844" }));
    const channel = await fetchChannel("@mkbhd");
    expect(channel?.subscribers).toBe(21_200_000);
    expect(channel?.totalViews).toBe(5_550_015_388);
  });

  it("reports a hidden subscriber count as null, not zero", async () => {
    respond(
      200,
      channelBody({ viewCount: "100", subscriberCount: "0", hiddenSubscriberCount: true, videoCount: "3" }),
    );
    const channel = await fetchChannel("@mkbhd");
    expect(channel?.subscribers).toBeNull();
    expect(channel?.subscribersHidden).toBe(true);
  });

  it("returns null when no channel matches", async () => {
    respond(200, { items: [] });
    await expect(fetchChannel("@nobody")).resolves.toBeNull();
  });

  it("distinguishes an exhausted quota from a rejected key", async () => {
    respond(403, { error: { message: "quota", errors: [{ reason: "quotaExceeded" }] } });
    await expect(fetchChannel("@mkbhd")).rejects.toMatchObject({
      name: "ConnectorUnavailable",
      reason: "quota_exceeded",
    });

    respond(400, { error: { message: "bad key", errors: [{ reason: "keyInvalid" }] } });
    await expect(fetchChannel("@mkbhd")).rejects.toMatchObject({ reason: "credentials_missing" });
  });

  it("refuses to call the API without a key", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "");
    await expect(fetchChannel("@mkbhd")).rejects.toBeInstanceOf(ConnectorUnavailable);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
