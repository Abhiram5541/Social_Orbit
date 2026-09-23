import { describe, expect, it, vi } from "vitest";

/* A tiny corpus, so the ranking can be asserted exactly rather than sampled. */
const influencers = [
  { id: "a", displayName: "Ruchi Kitchen", primaryHandle: "ruchi", bio: "Telugu home cooking and Hyderabadi biryani recipes", countryName: "India", categories: ["food"], status: "published" },
  { id: "b", displayName: "Circuit Bench", primaryHandle: "circuit", bio: "Smartphone reviews, laptop benchmarks and gadget teardowns", countryName: "India", categories: ["technology"], status: "published" },
  { id: "c", displayName: "Andhra Ruchulu", primaryHandle: "andhra", bio: "Village style Andhra recipes", countryName: "India", categories: ["food"], status: "published" },
];
const content = [
  { influencerId: "a", title: "Hyderabadi biryani at home", caption: "telugu cooking" },
  { influencerId: "c", title: "Gongura pachadi recipe", caption: "andhra cooking telugu" },
  { influencerId: "b", title: "Budget laptop benchmark", caption: "gadget review" },
];

vi.mock("@/server/data/records", () => ({ readRecords: () => ({ influencers, content }) }));
vi.mock("@/server/data/ingested-store", () => ({ ingestedRevision: () => 1 }));
vi.mock("@/server/data/process-store", () => {
  const cache = new Map<string, unknown>();
  return {
    shared: (key: string, seed: () => unknown) => {
      if (!cache.has(key)) cache.set(key, seed());
      return cache.get(key);
    },
  };
});

describe("semantic index", () => {
  it("finds creators by what they write about, not by their name", async () => {
    const { semanticSearch } = await import("./semantic-index");
    const hits = semanticSearch("telugu cooking recipes", 3);
    // Both cooks, neither of whom has "telugu" or "cooking" in their name;
    // the technology channel scores nothing at all.
    expect(hits.map((hit) => hit.id).sort()).toEqual(["a", "c"]);
    // The terms that earned the score are reported, so a ranking can be defended.
    expect(hits[0].terms).toContain("telugu");
  });

  it("returns nothing rather than everything when no word is in the corpus", async () => {
    const { semanticSearch } = await import("./semantic-index");
    expect(semanticSearch("cryptocurrency arbitrage", 5)).toEqual([]);
  });

  it("ranks a creator's nearest neighbour by shared vocabulary", async () => {
    const { similarCreators } = await import("./semantic-index");
    const similar = similarCreators("a", 2);
    expect(similar[0].id).toBe("c");
    expect(similar.some((hit) => hit.id === "a")).toBe(false);
  });
});
