import { z } from "zod";

/* ---------------------------------------------------------------------------
 * Identity, tenancy and permissions — DPR §12, decision D1 in CLAUDE.md
 *
 * Two kinds of organisation share one table: the single `platform` org that
 * SocialOrbit staff belong to, and any number of `client` orgs. The influencer
 * database is global; everything a client creates is scoped to its org.
 * ------------------------------------------------------------------------ */

export const Role = z.enum([
  "super_admin",
  "manager",
  "analytics_manager",
  "influencer",
  "client_owner",
  "client_member",
]);
export type Role = z.infer<typeof Role>;

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Super Admin",
  manager: "Manager",
  analytics_manager: "Analytics Manager",
  influencer: "Influencer",
  client_owner: "Client Owner",
  client_member: "Client Member",
};

export const OrgKind = z.enum(["platform", "client"]);
export type OrgKind = z.infer<typeof OrgKind>;

/** Which workspace shell a role lands in after sign-in. */
export const Workspace = z.enum(["admin", "client", "influencer"]);
export type Workspace = z.infer<typeof Workspace>;

export const ROLE_WORKSPACE: Record<Role, Workspace> = {
  super_admin: "admin",
  manager: "admin",
  analytics_manager: "admin",
  influencer: "influencer",
  client_owner: "client",
  client_member: "client",
};

/* --- Permissions ---------------------------------------------------------
 * Fine-grained and explicit. Route handlers ask for a permission, never for a
 * role, so adding a role never means auditing every route again.
 * ---------------------------------------------------------------------- */

export const Permission = z.enum([
  // Influencer intelligence
  "influencer:search",
  "influencer:read",
  "influencer:read_authorized_audience",
  "influencer:write",
  "influencer:publish",
  "influencer:compare",
  "influencer:export",

  // Client-owned artifacts
  "shortlist:read",
  "shortlist:write",
  "campaign:read",
  "campaign:write",
  "report:read",
  "report:create",

  // Creator self-service
  "self:profile_read",
  "self:profile_write",
  "self:connections_write",
  "self:analytics_read",
  "self:correction_request",

  // Analytics operations
  "analytics:read",
  "analytics:benchmarks",
  "analytics:anomaly_queue",
  "analytics:score_review",
  "analytics:ai_review",

  // Platform administration
  "admin:users",
  "admin:orgs",
  "admin:connectors",
  "admin:ingestion",
  "admin:ai_config",
  "admin:scoring_config",
  "admin:audit",
  "admin:system_health",

  // Verification
  "verification:review",

  // External API + billing
  "api_key:read",
  "api_key:write",
  "billing:read",
  "billing:write",
]);
export type Permission = z.infer<typeof Permission>;

const CLIENT_MEMBER: Permission[] = [
  "influencer:search",
  "influencer:read",
  "influencer:compare",
  "influencer:export",
  "shortlist:read",
  "shortlist:write",
  "campaign:read",
  "campaign:write",
  "report:read",
  "report:create",
];

const ANALYTICS_MANAGER: Permission[] = [
  "influencer:search",
  "influencer:read",
  "influencer:read_authorized_audience",
  "influencer:compare",
  "influencer:export",
  "analytics:read",
  "analytics:benchmarks",
  "analytics:anomaly_queue",
  "analytics:score_review",
  "analytics:ai_review",
  "report:read",
  "report:create",
];

const MANAGER: Permission[] = [
  ...CLIENT_MEMBER,
  "influencer:read_authorized_audience",
  "influencer:write",
  "influencer:publish",
  "verification:review",
  "analytics:read",
  "analytics:benchmarks",
];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  super_admin: Permission.options,
  manager: MANAGER,
  analytics_manager: ANALYTICS_MANAGER,
  influencer: [
    "self:profile_read",
    "self:profile_write",
    "self:connections_write",
    "self:analytics_read",
    "self:correction_request",
  ],
  client_owner: [...CLIENT_MEMBER, "api_key:read", "api_key:write", "billing:read", "billing:write"],
  client_member: CLIENT_MEMBER,
};

export function roleHas(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/* --- Plans — Arch §3 ---------------------------------------------------- */

export const Plan = z.enum(["free", "growth", "enterprise"]);
export type Plan = z.infer<typeof Plan>;

export const PLAN_CONFIG: Record<
  Plan,
  {
    label: string;
    /** Influencer Intelligence searches per billing month. null = unlimited. */
    searchesPerMonth: number | null;
    seats: number | null;
    apiRequestsPerMonth: number | null;
    features: { compare: boolean; campaigns: boolean; api: boolean; exports: boolean };
  }
> = {
  free: {
    label: "Free",
    searchesPerMonth: 5,
    seats: 2,
    apiRequestsPerMonth: null,
    features: { compare: true, campaigns: false, api: false, exports: false },
  },
  growth: {
    label: "Growth",
    searchesPerMonth: 500,
    seats: 10,
    apiRequestsPerMonth: 50_000,
    features: { compare: true, campaigns: true, api: true, exports: true },
  },
  enterprise: {
    label: "Enterprise",
    searchesPerMonth: null,
    seats: null,
    apiRequestsPerMonth: null,
    features: { compare: true, campaigns: true, api: true, exports: true },
  },
};

/* --- Session ------------------------------------------------------------ */

export const SessionUser = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
  role: Role,
  orgId: z.string(),
  orgName: z.string(),
  orgKind: OrgKind,
  plan: Plan,
  /** Set only for role `influencer` — the creator record they own. */
  influencerId: z.string().nullable(),
});
export type SessionUser = z.infer<typeof SessionUser>;

/* --- Credentials -------------------------------------------------------- */

export const LoginInput = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});
export type LoginInput = z.infer<typeof LoginInput>;

export const RegisterInput = z
  .object({
    name: z.string().trim().min(2, "Enter your full name").max(80),
    email: z.string().trim().toLowerCase().email("Enter a valid email address"),
    organisation: z.string().trim().min(2, "Enter your organisation name").max(80),
    accountType: z.enum(["client", "influencer"]),
    password: z
      .string()
      .min(12, "Use at least 12 characters")
      .regex(/[a-z]/, "Include a lowercase letter")
      .regex(/[A-Z]/, "Include an uppercase letter")
      .regex(/[0-9]/, "Include a number"),
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, { message: "Accept the terms to continue" }),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type RegisterInput = z.infer<typeof RegisterInput>;

export const RequestResetInput = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
});
export type RequestResetInput = z.infer<typeof RequestResetInput>;
