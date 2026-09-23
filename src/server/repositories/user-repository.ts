import { createHash, randomBytes } from "node:crypto";
import { PLAN_CONFIG, type OrgKind, type Plan, type Role, type SessionUser } from "@/lib/contracts/auth";
import { hashPassword, verifyPassword, equaliseTiming } from "@/server/auth/password";
import { appRows, persist } from "@/server/data/app-store";
import { postgresDriver } from "@/server/data/postgres";
import { readRecords } from "@/server/data/records";

/* ---------------------------------------------------------------------------
 * Users and organisations.
 *
 * Backed by the development driver today (see src/server/data/README.md); the
 * interface below is what the PostgreSQL implementation will satisfy.
 *
 * Multi-tenant model (CLAUDE.md D1): one `platform` org holds SENSO
 * staff, and any number of `client` orgs hold customers. Creator accounts
 * belong to their own client-kind org so quota and billing have an owner.
 * ------------------------------------------------------------------------ */

export interface Org {
  id: string;
  name: string;
  kind: OrgKind;
  plan: Plan;
  createdAt: string;
  seatsUsed: number;
  /** The organisation's own mark (a path under /brand/clients or a URL). */
  logoUrl?: string | null;
}

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: Role;
  orgId: string;
  influencerId: string | null;
  passwordHash: string;
  createdAt: string;
  lastLoginAt: string | null;
  status: "active" | "suspended";
  /** An outstanding emailed link — a reset or an invite. Only its hash is
   *  kept, so a database read cannot be replayed as the link. */
  passwordToken?: { hash: string; expiresAt: string; purpose: "reset" | "invite" } | null;
  /** Agency workflow: the clients this person handles. Empty = the whole org. */
  brandIds?: string[];
}

const ORGS: Org[] = [
  { id: "org_platform", name: "SENSO", kind: "platform", plan: "enterprise", createdAt: "2025-01-08T00:00:00.000Z", seatsUsed: 3 },
  { id: "org_northwind", name: "Northwind Brands", kind: "client", plan: "growth", createdAt: "2026-02-14T00:00:00.000Z", seatsUsed: 6 },
  { id: "org_lumen", name: "Lumen Collective", kind: "client", plan: "free", createdAt: "2026-07-30T00:00:00.000Z", seatsUsed: 2 },
  { id: "org_creators", name: "Creator accounts", kind: "client", plan: "free", createdAt: "2025-01-08T00:00:00.000Z", seatsUsed: 1 },
];

/**
 * Development sign-ins. The shared password comes from DEV_SEED_PASSWORD so it
 * is never committed; `.env.example` documents it. These rows exist only under
 * the development driver and are not created by the Postgres migration.
 */
const DEV_USERS: Omit<UserRecord, "passwordHash">[] = [
  { id: "usr_admin", email: "admin@senso360.com", name: "Rahul Vithala", avatarUrl: null, role: "super_admin", orgId: "org_platform", influencerId: null, createdAt: "2025-01-08T00:00:00.000Z", lastLoginAt: "2026-08-26T07:12:00.000Z", status: "active" },
  { id: "usr_manager", email: "manager@senso360.com", name: "Abhiram Vemuri", avatarUrl: null, role: "manager", orgId: "org_platform", influencerId: null, createdAt: "2025-03-19T00:00:00.000Z", lastLoginAt: "2026-08-25T16:40:00.000Z", status: "active" },
  { id: "usr_analyst", email: "analyst@senso360.com", name: "Hana Sato", avatarUrl: null, role: "analytics_manager", orgId: "org_platform", influencerId: null, createdAt: "2025-06-02T00:00:00.000Z", lastLoginAt: "2026-08-26T06:05:00.000Z", status: "active" },
  { id: "usr_client_owner", email: "owner@northwind.example", name: "Marcus Whitfield", avatarUrl: null, role: "client_owner", orgId: "org_northwind", influencerId: null, createdAt: "2026-02-14T00:00:00.000Z", lastLoginAt: "2026-08-26T08:31:00.000Z", status: "active" },
  { id: "usr_client_member", email: "member@northwind.example", name: "Ines Duarte", avatarUrl: null, role: "client_member", orgId: "org_northwind", influencerId: null, createdAt: "2026-03-02T00:00:00.000Z", lastLoginAt: "2026-08-25T11:18:00.000Z", status: "active" },
  { id: "usr_free_client", email: "hello@lumen.example", name: "Tomas Berg", avatarUrl: null, role: "client_owner", orgId: "org_lumen", influencerId: null, createdAt: "2026-07-30T00:00:00.000Z", lastLoginAt: "2026-08-24T09:02:00.000Z", status: "active" },
  // The creator portal needs an account that owns a record in the influencer
  // database. That database is built by ingesting real channels, so there is no
  // fixed id to point at and the link is resolved at load time instead. The
  // account is a development sign-in for exercising the portal — it is not a
  // claim that this person holds the channel.
  { id: "usr_creator", email: "creator@senso360.com", name: "Creator Portal Demo", avatarUrl: null, role: "influencer", orgId: "org_creators", influencerId: null, createdAt: "2026-05-11T00:00:00.000Z", lastLoginAt: "2026-08-26T05:55:00.000Z", status: "active" },
];

/** Lowest id in the database, so the portal opens on the same creator each run. */
function firstCreatorId(): string | null {
  return [...readRecords().influencers].sort((a, b) => a.id.localeCompare(b.id))[0]?.id ?? null;
}

let users: UserRecord[] | null = null;

/**
 * The seed accounts with their password hash resolved — what the Postgres
 * store is primed with on a database that holds no users yet, and what the
 * development driver serves directly.
 */
export async function seedUsers(): Promise<UserRecord[]> {

  // These accounts include a super_admin, and the fallback password below is
  // published in the README. Seeding them in production with a well-known
  // password would hand platform administration to anyone who read the repo —
  // and hiding the hint on the sign-in page is presentation, not a control.
  //
  // So production requires DEV_SEED_PASSWORD to be set explicitly. Without it
  // there are no accounts at all: an unreachable deployment is a safe failure,
  // an administrable one is not.
  const configured = process.env.DEV_SEED_PASSWORD;
  if (process.env.NODE_ENV === "production" && !configured) {
    console.warn(
      "[auth] DEV_SEED_PASSWORD is not set, so no development sign-ins were created. " +
        "Set it to enable them, or attach a real user store.",
    );
    return [];
  }

  const hash = await hashPassword(configured ?? "SENSO-Dev-2026");
  const creatorId = firstCreatorId();
  return DEV_USERS.map((user) => ({
    ...user,
    influencerId: user.role === "influencer" ? creatorId : user.influencerId,
    passwordHash: hash,
  }));
}

export const seedOrgs = (): Org[] => [...ORGS];

async function load(): Promise<UserRecord[]> {
  // Under Postgres the rows were installed at boot by `warmAppStore`.
  if (postgresDriver()) return appRows<UserRecord>("users", () => []);
  users ??= await seedUsers();
  return users;
}

function orgs(): Org[] {
  return postgresDriver() ? appRows<Org>("orgs", () => []) : ORGS;
}

export async function findOrg(orgId: string): Promise<Org | null> {
  return orgs().find((org) => org.id === orgId) ?? null;
}

export async function listOrgs(): Promise<Org[]> {
  return [...orgs()];
}

/** A new organisation. Seats count the users created into it. */
export async function createOrg(input: {
  name: string;
  kind: OrgKind;
  plan: Plan;
  logoUrl?: string | null;
}): Promise<Org> {
  const org: Org = {
    id: `org_${Date.now().toString(36)}`,
    name: input.name.trim(),
    kind: input.kind,
    plan: input.plan,
    createdAt: new Date().toISOString(),
    seatsUsed: 0,
    logoUrl: input.logoUrl?.trim() || null,
  };
  orgs().push(org);
  persist("orgs", [org]);
  return org;
}

/** Renames, re-plans or re-brands an organisation. Absent fields are left alone. */
export async function updateOrg(
  orgId: string,
  patch: { name?: string; plan?: Plan; logoUrl?: string | null },
): Promise<Org> {
  const org = orgs().find((entry) => entry.id === orgId);
  if (!org) throw new Error("No such organisation.");
  if (patch.name !== undefined) org.name = patch.name.trim();
  if (patch.plan !== undefined) org.plan = patch.plan;
  if (patch.logoUrl !== undefined) org.logoUrl = patch.logoUrl?.trim() || null;
  persist("orgs", [org]);
  return org;
}

/**
 * A new sign-in. The password is hashed here and never stored; the caller
 * decides how the person learns it. Rejects a duplicate address rather than
 * silently returning the existing account — that would let one client's
 * admin attach a user to their org by guessing an email in another.
 */
export async function createUser(input: {
  email: string;
  name: string;
  role: Role;
  orgId: string;
  password: string;
}): Promise<UserRecord> {
  const org = await findOrg(input.orgId);
  if (!org) throw new Error("No such organisation.");
  if (await findUserByEmail(input.email)) throw new Error("An account with that email already exists.");

  // Seats are a plan limit, so they are enforced where the seat is taken.
  // Counting live rows rather than trusting `seatsUsed` — a counter that
  // drifts is a limit that silently stops being one.
  const seats = PLAN_CONFIG[org.plan].seats;
  if (seats !== null) {
    const active = (await load()).filter(
      (user) => user.orgId === org.id && user.status === "active",
    ).length;
    if (active >= seats) {
      throw new Error(
        `The ${PLAN_CONFIG[org.plan].label} plan includes ${seats} seats and ${active} are in use. Upgrade the plan or suspend an account first.`,
      );
    }
  }

  const user: UserRecord = {
    id: `usr_${Date.now().toString(36)}`,
    email: input.email.trim().toLowerCase(),
    name: input.name.trim(),
    avatarUrl: null,
    role: input.role,
    orgId: org.id,
    influencerId: null,
    passwordHash: await hashPassword(input.password),
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
    status: "active",
  };
  (await load()).push(user);
  org.seatsUsed += 1;
  persist("users", [user]);
  persist("orgs", [org]);
  return user;
}

/** Replaces a user's password. For an admin reset; the old one is not needed. */
export async function setUserPassword(userId: string, password: string): Promise<void> {
  const user = (await load()).find((entry) => entry.id === userId);
  if (!user) throw new Error("No such user.");
  user.passwordHash = await hashPassword(password);
  user.passwordToken = null;
  persist("users", [user]);
}

export async function setUserStatus(userId: string, status: UserRecord["status"]): Promise<void> {
  const user = (await load()).find((entry) => entry.id === userId);
  if (!user) throw new Error("No such user.");
  user.status = status;
  persist("users", [user]);
}

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * Issues a one-time link token for a reset (30 minutes) or an invite (7 days)
 * and returns the raw token to put in the email. Issuing again replaces the
 * previous one, so only the latest link works.
 */
export async function issuePasswordToken(
  userId: string,
  purpose: "reset" | "invite",
): Promise<string> {
  const user = (await load()).find((entry) => entry.id === userId);
  if (!user) throw new Error("No such user.");
  const token = randomBytes(32).toString("base64url");
  const ttl = purpose === "invite" ? 7 * 24 * 60 * 60_000 : 30 * 60_000;
  user.passwordToken = {
    hash: tokenHash(token),
    expiresAt: new Date(Date.now() + ttl).toISOString(),
    purpose,
  };
  persist("users", [user]);
  return token;
}

/** Sets the password behind a live token and spends the token. */
export async function redeemPasswordToken(token: string, password: string): Promise<UserRecord | null> {
  const hash = tokenHash(token);
  const user = (await load()).find((entry) => entry.passwordToken?.hash === hash);
  if (!user || !user.passwordToken) return null;
  if (Date.parse(user.passwordToken.expiresAt) < Date.now()) return null;
  if (user.status !== "active") return null;
  user.passwordHash = await hashPassword(password);
  user.passwordToken = null;
  persist("users", [user]);
  return user;
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const all = await load();
  const normalised = email.trim().toLowerCase();
  return all.find((user) => user.email.toLowerCase() === normalised) ?? null;
}

export async function listUsers(orgId?: string): Promise<UserRecord[]> {
  const all = await load();
  return orgId ? all.filter((user) => user.orgId === orgId) : [...all];
}

/** Limits a colleague to a set of agency clients. Empty restores full access. */
export async function setUserBrands(
  orgId: string,
  userId: string,
  brandIds: string[],
): Promise<string[]> {
  const user = (await load()).find((entry) => entry.id === userId);
  // Scoped by org here rather than at the call site: changing who can see
  // what is exactly the kind of write a missing tenant check leaks.
  if (!user || user.orgId !== orgId) throw new Error("No such user.");
  user.brandIds = brandIds;
  persist("users", [user]);
  return brandIds;
}

/**
 * The caller's current brand restriction, read from the user record rather
 * than from their session. An access change has to bite immediately — a
 * cookie minted before it lasts a week, and "you keep seeing that client
 * until you sign out" is not an access control.
 *
 * Falls back to the session's copy only before the rows are loaded, which is
 * the one moment the record cannot be consulted.
 */
export function currentBrandIds(user: SessionUser): string[] {
  const rows = postgresDriver() ? appRows<UserRecord>("users", () => []) : users;
  const row = rows?.find((entry) => entry.id === user.id);
  return row?.brandIds ?? user.brandIds ?? [];
}

/**
 * Re-reads the parts of a session that the *organisation* owns rather than
 * the person: plan, name, mark, and the client restriction.
 *
 * A session cookie is signed at sign-in and lives a week. Everything above
 * decides on it — what the plan includes, what quota is left, which clients
 * are visible — so without this an approved upgrade would not take effect for
 * seven days and a revoked access would not either. Identity stays whatever
 * was signed; only the org's own fields are refreshed.
 *
 * Synchronous on purpose: both stores are already in memory (D29), and a
 * session read happens on every request.
 */
export function freshenSession(user: SessionUser): SessionUser {
  const org = orgs().find((entry) => entry.id === user.orgId);
  const rows = postgresDriver() ? appRows<UserRecord>("users", () => []) : users;
  const row = rows?.find((entry) => entry.id === user.id);
  if (!org && !row) return user;
  return {
    ...user,
    plan: org?.plan ?? user.plan,
    orgName: org?.name ?? user.orgName,
    orgKind: org?.kind ?? user.orgKind,
    orgLogoUrl: org ? (org.logoUrl ?? null) : (user.orgLogoUrl ?? null),
    brandIds: row?.brandIds ?? user.brandIds ?? null,
    role: row?.role ?? user.role,
  };
}

export function toSessionUser(user: UserRecord, org: Org): SessionUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    role: user.role,
    orgId: org.id,
    orgName: org.name,
    orgKind: org.kind,
    plan: org.plan,
    orgLogoUrl: org.logoUrl ?? null,
    brandIds: user.brandIds ?? null,
    influencerId: user.influencerId,
  };
}

export type AuthResult =
  | { ok: true; user: SessionUser }
  | { ok: false; reason: "invalid_credentials" | "suspended" };

/**
 * Authenticates a credential pair. An unknown email still performs a hash
 * comparison so the response time does not reveal which accounts exist, and
 * both failure modes return the same message to the caller.
 */
export async function authenticate(email: string, password: string): Promise<AuthResult> {
  const user = await findUserByEmail(email);

  if (!user) {
    await equaliseTiming(password);
    return { ok: false, reason: "invalid_credentials" };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return { ok: false, reason: "invalid_credentials" };
  if (user.status !== "active") return { ok: false, reason: "suspended" };

  const org = await findOrg(user.orgId);
  if (!org) return { ok: false, reason: "invalid_credentials" };

  return { ok: true, user: toSessionUser(user, org) };
}
