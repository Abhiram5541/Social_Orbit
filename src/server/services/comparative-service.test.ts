import { describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/contracts/auth";

const post = (over: Record<string, unknown>) => ({
  id: "p", influencerId: "a", platform: "youtube", title: "", caption: "",
  publishedAt: "2026-08-15T00:00:00.000Z", views: 1000, likes: 100, comments: 0, shares: null,
  ...over,
});

vi.mock("@/server/data/records", () => ({
  readRecords: () => ({
    influencers: [],
    accounts: [
      { influencerId: "a", platform: "youtube", followers: 1000 },
      { influencerId: "b", platform: "instagram", followers: 500 },
    ],
    content: [
      post({ id: "1", influencerId: "a", title: "loving my Acme shoes" }),
      post({ id: "2", influencerId: "a", title: "another Acme run" }),
      // Instagram publishes no views: this must not be summed as zero.
      post({ id: "3", influencerId: "b", platform: "instagram", views: null, caption: "Bolt gear", likes: 50 }),
    ],
  }),
}));
vi.mock("@/server/repositories/influencer-repository", () => ({ toSummary: () => null }));
vi.mock("@/server/repositories/workspace-repository", () => ({
  listCampaigns: () => [], getCampaign: () => null,
}));

const USER = { orgId: "org_x" } as SessionUser;

describe("share of voice", () => {
  it("withholds a views share when a list had no views to contribute", async () => {
    const svc = await import("./comparative-service");
    svc.createWatchlist(USER, { name: "Acme", kind: "own", influencerIds: ["a"], terms: ["acme"] });
    svc.createWatchlist(USER, { name: "Bolt", kind: "competitor", influencerIds: ["b"], terms: ["bolt"] });

    const voice = svc.shareOfVoice(USER, "2026-01-01", "2026-12-31");
    const acme = voice.rows.find((row) => row.name === "Acme")!;
    const bolt = voice.rows.find((row) => row.name === "Bolt")!;

    expect(acme.mentions).toBe(2);
    expect(bolt.mentions).toBe(1);
    // Engagement share is computable for both.
    expect(acme.sharePctByEngagement + bolt.sharePctByEngagement).toBeCloseTo(100, 0);
    // Views are not: Bolt's post reported none, so no list gets a views share
    // rather than Bolt being flattened to zero.
    expect(bolt.views).toBeNull();
    expect(acme.sharePctByViews).toBeNull();
    expect(voice.viewsIncomplete).toBe(true);
  });
});

describe("cross-network", () => {
  it("reports an engagement rate per network and never averages across them", async () => {
    const svc = await import("./comparative-service");
    const out = svc.crossNetwork(["a", "b"], "2026-01-01", "2026-12-31");
    const yt = out.networks.find((n) => n.platform === "youtube")!;
    const ig = out.networks.find((n) => n.platform === "instagram")!;
    // YouTube against views, Instagram against followers — stated, not mixed.
    expect(yt.engagementBasis).toBe("views");
    expect(ig.engagementBasis).toBe("followers");
    expect(ig.views).toBeNull();
    expect(out.totals.followers).toBe(1500);
  });
});

describe("watchlist overlap", () => {
  it("measures overlap against the union, not the smaller list", async () => {
    const svc = await import("./comparative-service");
    const lists = svc.listWatchlists(USER);
    const overlap = svc.watchlistOverlap(USER, lists[0].id, lists[1].id);
    // No shared creators between the two lists.
    expect(overlap.overlapPct).toBe(0);
  });
});
