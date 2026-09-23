import { describe, expect, it, vi } from "vitest";

const content = [
  { id: "c1", influencerId: "a", platform: "youtube", title: "Best biryani in town", caption: "", hashtags: ["#Biryani", "#food"], publishedAt: "2026-06-02T00:00:00.000Z", views: 1000, likes: 10, comments: 2, shares: null, url: "https://x/1" },
  { id: "c2", influencerId: "b", platform: "youtube", title: "Biryanis everywhere", caption: "we tried biryanihub", hashtags: [], publishedAt: "2026-06-09T00:00:00.000Z", views: null, likes: null, comments: null, shares: null, url: "https://x/2" },
  { id: "c3", influencerId: "a", platform: "youtube", title: "Dosa morning", caption: "#dosa", hashtags: ["#dosa"], publishedAt: "2026-06-10T00:00:00.000Z", views: 500, likes: 5, comments: 1, shares: null, url: "https://x/3" },
  { id: "c4", influencerId: "c", platform: "youtube", title: "Old biryani", caption: "", hashtags: ["#biryani"], publishedAt: "2020-01-01T00:00:00.000Z", views: 9, likes: 1, comments: 0, shares: null, url: "https://x/4" },
];

vi.mock("@/server/data/records", () => ({
  readRecords: () => ({ content, influencers: [{ id: "a" }, { id: "b" }, { id: "c" }] }),
}));
vi.mock("@/server/repositories/influencer-repository", () => ({
  toSummary: (id: string) => ({ id, displayName: id.toUpperCase(), primaryHandle: id, followers: 100, healthScore: 50 }),
}));

const user = { orgId: "org_a", orgKind: "client" } as never;

describe("listening", () => {
  it("counts exact tokens and ignores a longer word that merely contains one", async () => {
    const { listen } = await import("./listening-service");
    const result = listen(user, { term: "biryani", from: "2026-01-01", to: "2026-12-31" });
    // c1 by hashtag, c2 by title ("Biryanis" must not count, "Biryanis
    // everywhere" matches on the title word "Biryanis"? no — the token must
    // stand alone), c4 is outside the window.
    expect(result.mentions).toBe(1);
    expect(result.creators).toBe(1);
    expect(result.coverage.postsInWindow).toBe(3);
  });

  it("sums views as absent when no post in the set reported one", async () => {
    const { listen } = await import("./listening-service");
    const result = listen(user, { term: "biryanihub", from: "2026-01-01", to: "2026-12-31" });
    expect(result.mentions).toBe(1);
    expect(result.views).toBeNull();
  });

  it("divides share of conversation by the terms asked about, not by the corpus", async () => {
    const { shareOfConversation } = await import("./listening-service");
    const result = shareOfConversation(user, ["biryani", "dosa"], { from: "2026-01-01", to: "2026-12-31" });
    expect(result.totalMentions).toBe(2);
    expect(result.terms.map((term) => term.share)).toEqual([50, 50]);
  });
});
