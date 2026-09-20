/*
 * Builds the E2E fixture: a slice of the real database, so CI can run the
 * Playwright suite on a checkout that has no `.data` of its own. Takes the
 * N largest creators with every row that belongs to them, and packs it the
 * way `data:pack` does. Committed at e2e/fixtures/ingested.json.gz; CI copies
 * it to .data/ before starting the dev driver.
 *
 *   node scripts/e2e-fixture.mjs [count=150]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";

const count = Number(process.argv[2] ?? 150);
const source = existsSync(".data/ingested.json")
  ? readFileSync(".data/ingested.json", "utf8")
  : gunzipSync(readFileSync(".data/ingested.json.gz")).toString("utf8");
const all = JSON.parse(source);

const followers = new Map();
for (const account of all.accounts) {
  followers.set(account.influencerId, Math.max(followers.get(account.influencerId) ?? 0, account.followers ?? 0));
}
// A spread across the whole follower range, not the top of it: a slice of
// only mega creators would make an audience-size filter narrow nothing, and
// the suite asserts that filters narrow.
const ranked = [...all.influencers].sort(
  (a, b) => (followers.get(b.id) ?? 0) - (followers.get(a.id) ?? 0),
);
const step = Math.max(1, Math.floor(ranked.length / count));
const keep = new Set(ranked.filter((_, i) => i % step === 0).slice(0, count).map((i) => i.id));
const accounts = all.accounts.filter((a) => keep.has(a.influencerId));
const accountIds = new Set(accounts.map((a) => a.id));
const byInfluencer = (rows) => rows.filter((r) => keep.has(r.influencerId));

const slice = {
  ...all,
  influencers: all.influencers.filter((i) => keep.has(i.id)),
  accounts,
  snapshots: all.snapshots.filter((s) => accountIds.has(s.accountId)),
  content: byInfluencer(all.content),
  ai: byInfluencer(all.ai),
  viewHistory: byInfluencer(all.viewHistory),
  grants: byInfluencer(all.grants ?? []),
  signals: byInfluencer(all.signals ?? []),
  audience: byInfluencer(all.audience ?? []),
};

mkdirSync("e2e/fixtures", { recursive: true });
const packed = gzipSync(Buffer.from(JSON.stringify(slice)), { level: 9 });
writeFileSync("e2e/fixtures/ingested.json.gz", packed);
console.log(
  `fixture: ${slice.influencers.length} creators, ${slice.content.length} content rows, ${slice.snapshots.length} snapshots → ${(packed.length / 1024).toFixed(0)} KB`,
);
