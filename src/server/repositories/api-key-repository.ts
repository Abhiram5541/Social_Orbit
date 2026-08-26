import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Plan, SessionUser } from "@/lib/contracts/auth";
import { PLAN_CONFIG } from "@/lib/contracts/auth";
import type { ApiKeyView, ApiScope } from "@/lib/contracts/api-key";
import { ApiFailure, assertTenantAccess } from "@/server/auth/rbac";
import { shared } from "@/server/data/store";

export type { ApiKeyView, ApiScope };

/* ---------------------------------------------------------------------------
 * API keys — DPR §17.2.
 *
 * The raw key is generated, shown once, and never stored. What persists is a
 * SHA-256 hash of the key plus a server-side pepper, alongside a short
 * non-secret prefix used for display and lookup.
 *
 * SHA-256 rather than a slow KDF is the right call *here specifically*: an API
 * key is 256 bits of server-generated entropy, not a human-chosen password, so
 * there is nothing to brute-force and the hash sits on every authenticated
 * request's hot path. The pepper defends against a stolen database being
 * checked against precomputed hashes.
 * ------------------------------------------------------------------------ */

export interface ApiKeyRecord {
  id: string;
  orgId: string;
  name: string;
  /** Non-secret. Shown in listings so a key can be identified without revealing it. */
  prefix: string;
  hash: string;
  createdAt: string;
  createdByName: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  /** Optional CIDR/IP allowlist. Empty means any source. */
  ipAllowlist: string[];
  scopes: ApiScope[];
}

function pepper(): string {
  const configured = process.env.API_KEY_PEPPER;
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("API_KEY_PEPPER must be set in production.");
  }
  return "development-only-api-key-pepper";
}

function hashKey(raw: string): string {
  return createHash("sha256").update(`${pepper()}:${raw}`).digest("hex");
}

/** `so_live_` + 32 bytes of entropy, base64url. */
function generateKey(): { raw: string; prefix: string } {
  const secret = randomBytes(32).toString("base64url");
  const raw = `so_live_${secret}`;
  return { raw, prefix: raw.slice(0, 16) };
}

const SEED_KEYS: ApiKeyRecord[] = [
  {
    id: "key_9c21",
    orgId: "org_northwind",
    name: "Production integration",
    prefix: "so_live_7Kq2Xd",
    hash: hashKey("so_live_seeded-development-key-not-a-real-secret"),
    createdAt: "2026-03-04T11:20:00.000Z",
    createdByName: "Marcus Whitfield",
    lastUsedAt: "2026-08-26T06:58:00.000Z",
    revokedAt: null,
    ipAllowlist: [],
    scopes: ["influencers:read", "analytics:read"],
  },
  {
    id: "key_3f9a",
    orgId: "org_northwind",
    name: "Retired staging key",
    prefix: "so_live_2Bn8Rp",
    hash: hashKey("so_live_retired-development-key"),
    createdAt: "2026-02-20T09:00:00.000Z",
    createdByName: "Marcus Whitfield",
    lastUsedAt: "2026-08-23T14:02:00.000Z",
    revokedAt: "2026-08-23T14:20:00.000Z",
    ipAllowlist: [],
    scopes: ["influencers:read"],
  },
];

const KEYS = shared("api-keys", () => [...SEED_KEYS]);

function toView(record: ApiKeyRecord): ApiKeyView {
  // The hash never leaves this module.
  const { hash: _hash, orgId: _orgId, ...view } = record;
  void _hash;
  void _orgId;
  return view;
}

export function listApiKeys(user: SessionUser): ApiKeyView[] {
  return KEYS.filter((key) =>
    user.orgKind === "platform" ? true : key.orgId === user.orgId,
  ).map(toView);
}

/** Returns the raw key exactly once — the caller must show it and discard it. */
export function createApiKey(
  user: SessionUser,
  input: { name: string; scopes: ApiScope[]; ipAllowlist?: string[] },
): { key: ApiKeyView; raw: string } {
  const active = KEYS.filter((key) => key.orgId === user.orgId && !key.revokedAt);
  if (active.length >= 10) {
    throw new ApiFailure(
      "conflict",
      "This organisation already has 10 active keys. Revoke one before creating another.",
    );
  }

  const { raw, prefix } = generateKey();
  const record: ApiKeyRecord = {
    id: `key_${randomBytes(3).toString("hex")}`,
    orgId: user.orgId,
    name: input.name,
    prefix,
    hash: hashKey(raw),
    createdAt: new Date().toISOString(),
    createdByName: user.name,
    lastUsedAt: null,
    revokedAt: null,
    ipAllowlist: input.ipAllowlist ?? [],
    scopes: input.scopes,
  };
  KEYS.push(record);
  return { key: toView(record), raw };
}

export function revokeApiKey(user: SessionUser, id: string): ApiKeyView {
  const record = KEYS.find((key) => key.id === id);
  if (!record) throw new ApiFailure("not_found", "No such API key.");
  assertTenantAccess(user, record.orgId);
  record.revokedAt ??= new Date().toISOString();
  return toView(record);
}

/**
 * Rotation issues a new secret and revokes the old one in a single step, so a
 * caller is never tempted to leave the compromised key active "just until the
 * deploy lands".
 */
export function rotateApiKey(
  user: SessionUser,
  id: string,
): { key: ApiKeyView; raw: string } {
  const record = KEYS.find((key) => key.id === id);
  if (!record) throw new ApiFailure("not_found", "No such API key.");
  assertTenantAccess(user, record.orgId);

  const created = createApiKey(user, {
    name: record.name,
    scopes: record.scopes,
    ipAllowlist: record.ipAllowlist,
  });
  record.revokedAt = new Date().toISOString();
  return created;
}

export interface ApiKeyPrincipal {
  keyId: string;
  orgId: string;
  plan: Plan;
  scopes: ApiScope[];
}

/**
 * Resolves a bearer token to its organisation. Every stored key is compared in
 * constant time and the loop always runs to completion, so response timing
 * does not reveal how many keys exist or how far a prefix matched.
 */
export function authenticateApiKey(
  raw: string | null,
  planOf: (orgId: string) => Plan,
): ApiKeyPrincipal | null {
  if (!raw || !raw.startsWith("so_live_")) return null;

  const candidate = Buffer.from(hashKey(raw), "hex");
  let matched: ApiKeyRecord | null = null;

  for (const record of KEYS) {
    const stored = Buffer.from(record.hash, "hex");
    if (stored.length !== candidate.length) continue;
    if (timingSafeEqual(stored, candidate) && !record.revokedAt) matched = record;
  }

  if (!matched) return null;
  matched.lastUsedAt = new Date().toISOString();

  return {
    keyId: matched.id,
    orgId: matched.orgId,
    plan: planOf(matched.orgId),
    scopes: matched.scopes,
  };
}

export function planLimits(plan: Plan) {
  return {
    requestsPerMonth: PLAN_CONFIG[plan].apiRequestsPerMonth,
    apiEnabled: PLAN_CONFIG[plan].features.api,
  };
}
