import { describe, expect, it, vi } from "vitest";
import type { RawContent } from "@/server/data/records";

const post = (over: Partial<RawContent>): RawContent =>
  ({
    id: "c1", accountId: "a1", influencerId: "i1", platform: "youtube",
    title: "", url: "https://example.com/1", thumbnailUrl: null,
    publishedAt: "2026-08-10T00:00:00.000Z", views: 100, likes: 10, comments: 5,
    shares: null, durationSeconds: null, isSponsored: null, caption: "",
    hashtags: [], platformCategoryId: null, ...over,
  }) as RawContent;

const CONTENT: RawContent[] = [
  post({ id: "in_tag", hashtags: ["#Launch"] }),
  post({ id: "in_caption", caption: "out now #launch today", hashtags: [] }),
  post({ id: "near_miss", hashtags: ["#launchday"] }),
  post({ id: "out_of_window", hashtags: ["#launch"], publishedAt: "2026-06-01T00:00:00.000Z" }),
  post({ id: "wrong_platform", hashtags: ["#launch"], platform: "instagram" }),
  post({ id: "other_creator", hashtags: ["#launch"], influencerId: "i2" }),
];

vi.mock("@/server/data/records", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/data/records")>()),
  readRecords: () => ({ content: CONTENT }),
}));

const WINDOW = {
  hashtag: "launch", platforms: ["youtube"] as const, startsOn: "2026-08-01", endsOn: "2026-08-31",
};

describe("campaign attribution", () => {
  it("matches the tag in hashtags and caption, and nothing else", async () => {
    const { attributedPostsFor } = await import("./attribution-service");
    const ids = attributedPostsFor("i1", { ...WINDOW, platforms: ["youtube"] }).map((p) => p.id);
    // `#launchday` must not satisfy `#launch`; the window, platform and
    // creator all exclude the rest.
    expect(ids.sort()).toEqual(["in_caption", "in_tag"]);
  });

  it("honours manual include and exclude over automatic detection", async () => {
    const { attributedPostsFor } = await import("./attribution-service");
    const ids = attributedPostsFor("i1", {
      ...WINDOW,
      platforms: ["youtube"],
      overrides: { include: ["out_of_window"], exclude: ["in_tag"] },
    }).map((p) => p.id);
    expect(ids.sort()).toEqual(["in_caption", "out_of_window"]);
  });

  it("sums only what was observed and never invents a zero", async () => {
    const { totalsOf, campaignScoreOf } = await import("./attribution-service");
    const totals = totalsOf([post({ views: null, likes: 3, comments: null })]);
    expect(totals.views).toBeNull();
    expect(totals.engagements).toBe(3);
    // No views means no engagement rate — not a division by zero.
    expect(totals.engagementRate).toBeNull();
    // And no attributed posts means no score at all.
    expect(campaignScoreOf(totalsOf([]), 2)).toBeNull();
  });
});

describe("extra detection signals", () => {
  const sample = (over: Partial<RawContent> = {}): RawContent =>
    ({
      id: "p1",
      accountId: "a",
      influencerId: "i",
      platform: "youtube",
      title: "Morning routine",
      url: "https://x/1",
      thumbnailUrl: null,
      publishedAt: "2026-06-02T00:00:00.000Z",
      views: 10,
      likes: 1,
      comments: 0,
      shares: null,
      durationSeconds: null,
      isSponsored: null,
      caption: "",
      hashtags: [],
      platformCategoryId: null,
      ...over,
    }) as RawContent;

  const base = {
    hashtag: "launch",
    platforms: ["youtube" as const],
    startsOn: "2026-01-01",
    endsOn: "2026-12-31",
  };

  it("attributes an @mention and a keyword, and names which signal did it", async () => {
    const { signalFor } = await import("./attribution-service");
    expect(signalFor(sample({ caption: "loved working with @northwind" }), { ...base, mentions: ["@Northwind"] })).toBe("mention");
    expect(signalFor(sample({ caption: "the new orbit series is out" }), { ...base, keywords: ["orbit series"] })).toBe("keyword");
    expect(signalFor(sample({ hashtags: ["#Launch"] }), base)).toBe("hashtag");
    expect(signalFor(sample(), base)).toBeNull();
  });

  it("never matches on an empty term — that would claim credit for everything", async () => {
    const { signalFor } = await import("./attribution-service");
    expect(signalFor(sample({ caption: "anything at all" }), { ...base, keywords: ["", "   "] })).toBeNull();
    expect(signalFor(sample({ caption: "anything at all" }), { ...base, mentions: [""] })).toBeNull();
  });

  it("checks a post against what the deliverable required", async () => {
    const { complianceOf } = await import("./attribution-service");
    const result = complianceOf(sample({ caption: "#ad with @northwind, paid partnership" }), {
      requiredHashtags: ["#ad"],
      requiredMentions: ["northwind"],
      captionMustInclude: ["paid partnership", "discount code"],
    });
    expect(result.compliant).toBe(false);
    expect(result.checks.filter((check) => check.met)).toHaveLength(3);
    // No requirements is an absence, not a pass.
    expect(complianceOf(sample(), { requiredHashtags: [], requiredMentions: [], captionMustInclude: [] }).compliant).toBeNull();
  });
});
