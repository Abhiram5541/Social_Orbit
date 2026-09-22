import type { SessionUser } from "@/lib/contracts/auth";
import type {
  CreatorRuleReport,
  Rule,
  RuleEvidence,
  RuleHit,
  RuleInput,
  RuleSeverity,
} from "@/lib/contracts/rules";
import { ApiFailure, assertTenantAccess } from "@/server/auth/rbac";
import { appRows, persist } from "@/server/data/app-store";
import { readRecords } from "@/server/data/records";

/* ---------------------------------------------------------------------------
 * The rules engine behind brand-safety policies and custom classifiers.
 *
 * Deterministic term matching over a creator's own words — upload titles,
 * captions and bio. A flag is an accusation about somebody's work, so it has
 * to be checkable: every hit names the rule, the version of it that judged,
 * the term that matched and the posts it matched in, with links.
 *
 * Two things it deliberately does not do. It does not infer intent, so a
 * word in a title is reported as a word in a title and nothing more. And it
 * never reports "clear" for a creator whose content was never read: with no
 * posts indexed the verdict is the absence of evidence, not its absence.
 * ------------------------------------------------------------------------ */

export const RULES_ENGINE_VERSION = "rules-1.0.0";

/** Posts read per creator. Enough for a pattern, bounded for a page render. */
const SCAN_LIMIT = 120;

const rules = () => appRows<Rule>("rules", () => []);

const nextId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function listRules(user: SessionUser, kind?: Rule["kind"]): Rule[] {
  return rules()
    .filter((row) => row.orgId === user.orgId)
    .filter((row) => !kind || row.kind === kind)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function createRule(user: SessionUser, input: RuleInput): Rule {
  const now = new Date().toISOString();
  const row: Rule = {
    id: nextId("rule"),
    orgId: user.orgId,
    kind: input.kind,
    name: input.name,
    label: input.kind === "classifier" ? (input.label ?? input.name) : null,
    severity: input.severity,
    scope: input.scope,
    terms: normalise(input.terms),
    exceptions: normalise(input.exceptions),
    minMatches: input.minMatches,
    enabled: input.enabled,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
  rules().push(row);
  persist("rules", [row]);
  return row;
}

/**
 * Editing the terms of a rule makes a new version of it, because a creator
 * cleared under the old terms was cleared under the old terms — the evidence
 * records which version judged them.
 */
export function updateRule(user: SessionUser, id: string, input: RuleInput): Rule {
  const row = rules().find((entry) => entry.id === id);
  if (!row) throw new ApiFailure("not_found", "Rule not found.");
  assertTenantAccess(user, row.orgId);

  const termsChanged =
    normalise(input.terms).join("|") !== row.terms.join("|") ||
    normalise(input.exceptions).join("|") !== row.exceptions.join("|");

  Object.assign(row, {
    name: input.name,
    label: input.kind === "classifier" ? (input.label ?? input.name) : null,
    severity: input.severity,
    scope: input.scope,
    terms: normalise(input.terms),
    exceptions: normalise(input.exceptions),
    minMatches: input.minMatches,
    enabled: input.enabled,
    version: termsChanged ? row.version + 1 : row.version,
    updatedAt: new Date().toISOString(),
  });
  persist("rules", [row]);
  return row;
}

export function deleteRule(user: SessionUser, id: string): void {
  const row = rules().find((entry) => entry.id === id);
  if (!row) throw new ApiFailure("not_found", "Rule not found.");
  assertTenantAccess(user, row.orgId);
  const list = rules();
  list.splice(list.indexOf(row), 1);
  persist("rules", list.filter((entry) => entry.orgId === user.orgId));
}

const normalise = (terms: string[]) =>
  [...new Set(terms.map((term) => term.trim().toLowerCase()).filter(Boolean))].sort();

/** Whole-word, case-insensitive. "gun" must not match "begun". */
function mentions(haystack: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, "iu").test(haystack);
}

function excerptAround(text: string, term: string): string {
  const index = text.toLowerCase().indexOf(term.toLowerCase());
  if (index < 0) return text.slice(0, 140);
  const start = Math.max(0, index - 60);
  return `${start > 0 ? "…" : ""}${text.slice(start, index + term.length + 60).trim()}…`;
}

const SEVERITY_RANK: Record<RuleSeverity, number> = { note: 0, review: 1, block: 2 };

/**
 * Evaluates one creator against this organisation's enabled rules.
 *
 * A creator with no indexed content returns `no_rules`-style honesty: the
 * report says how many posts were read, so "no hits" can be told apart from
 * "nothing was looked at".
 */
export function evaluateCreator(user: SessionUser, influencerId: string): CreatorRuleReport {
  const active = listRules(user).filter((rule) => rule.enabled);
  const records = readRecords();
  const influencer = records.influencers.find((entry) => entry.id === influencerId);
  const posts = records.content
    .filter((item) => item.influencerId === influencerId)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, SCAN_LIMIT);

  const hits: RuleHit[] = [];
  const labels: string[] = [];

  for (const rule of active) {
    const evidence: RuleEvidence[] = [];

    if (rule.scope !== "content" && influencer?.bio) {
      const matched = rule.terms.filter((term) => mentions(influencer.bio, term));
      const excepted = rule.exceptions.some((term) => mentions(influencer.bio, term));
      if (matched.length > 0 && !excepted) {
        evidence.push({
          contentId: `bio:${influencerId}`,
          url: "",
          publishedAt: "",
          excerpt: excerptAround(influencer.bio, matched[0]),
          terms: matched,
        });
      }
    }

    if (rule.scope !== "bio") {
      for (const post of posts) {
        const text = `${post.title} ${post.caption}`;
        const matched = rule.terms.filter((term) => mentions(text, term));
        if (matched.length === 0) continue;
        // An exception on the same post cancels it: "shot" in "gun shot" is
        // a different claim from "shot" in "shot on iPhone".
        if (rule.exceptions.some((term) => mentions(text, term))) continue;
        evidence.push({
          contentId: post.id,
          url: post.url,
          publishedAt: post.publishedAt,
          excerpt: excerptAround(text, matched[0]),
          terms: matched,
        });
      }
    }

    if (evidence.length < rule.minMatches) continue;

    hits.push({
      ruleId: rule.id,
      ruleName: rule.name,
      kind: rule.kind,
      label: rule.label,
      severity: rule.severity,
      matches: evidence.length,
      evidence: evidence.slice(0, 5),
      ruleVersion: rule.version,
    });
    if (rule.kind === "classifier" && rule.label) labels.push(rule.label);
  }

  hits.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || b.matches - a.matches);

  const safetyHits = hits.filter((hit) => hit.kind === "brand_safety");
  const verdict: CreatorRuleReport["verdict"] =
    active.length === 0
      ? "no_rules"
      : safetyHits.some((hit) => hit.severity === "block")
        ? "block"
        : safetyHits.some((hit) => hit.severity === "review")
          ? "review"
          : safetyHits.length > 0
            ? "note"
            : "clear";

  return {
    influencerId,
    hits,
    labels: [...new Set(labels)],
    postsScanned: posts.length,
    bioScanned: Boolean(influencer?.bio),
    verdict,
    evaluatedAt: new Date().toISOString(),
    engineVersion: RULES_ENGINE_VERSION,
  };
}

/** Evaluates many creators — a shortlist, a campaign roster — in one pass. */
export function evaluateMany(
  user: SessionUser,
  influencerIds: string[],
): Record<string, CreatorRuleReport> {
  const out: Record<string, CreatorRuleReport> = {};
  for (const id of influencerIds.slice(0, 200)) out[id] = evaluateCreator(user, id);
  return out;
}
