import { ACCOUNTS } from "../test-helpers";

/**
 * Every route in the application, paired with the role that is allowed to see
 * it. The audit walks this list; a route missing from here is a route nobody
 * is checking.
 */
export interface AuditRoute {
  path: string;
  as: keyof typeof ACCOUNTS | "anonymous";
  /** Set when the route is expected to redirect rather than render. */
  redirects?: boolean;
}

/**
 * Creator ids are substituted at run time. The influencer database is built by
 * ingesting real channels, so no fixed id survives a rebuild — see
 * `creatorIds` in e2e/support.ts.
 */
export const CREATOR_SLOT = ["__creator1__", "__creator2__", "__creator3__"] as const;

export function withCreatorIds<T extends { path: string }>(routes: T[], ids: string[]): T[] {
  return routes.map((route) => ({
    ...route,
    path: CREATOR_SLOT.reduce(
      (path, slot, index) => path.split(slot).join(ids[index] ?? ids[0]),
      route.path,
    ),
  }));
}

export const AUDIT_ROUTES: AuditRoute[] = [
  // Public
  { path: "/", as: "anonymous" },
  { path: "/login", as: "anonymous" },
  { path: "/register", as: "anonymous" },
  { path: "/register/submitted", as: "anonymous" },
  { path: "/forgot-password", as: "anonymous" },

  // Client workspace
  { path: "/dashboard", as: "clientOwner" },
  { path: "/discovery", as: "clientOwner" },
  { path: "/discovery?platform=youtube&healthMin=60", as: "clientOwner" },
  { path: "/influencers", as: "clientOwner", redirects: true },
  { path: "/influencers/__creator1__", as: "clientOwner" },
  { path: "/influencers/__creator2__", as: "clientOwner" },
  { path: "/shortlists", as: "clientOwner" },
  { path: "/shortlists/sl_q4_tech", as: "clientOwner" },
  { path: "/shortlists/sl_beauty_always_on", as: "clientOwner" },
  { path: "/compare", as: "clientOwner" },
  { path: "/compare?ids=__creator1__,__creator2__,__creator3__", as: "clientOwner" },
  { path: "/campaigns", as: "clientOwner" },
  { path: "/campaigns/new", as: "clientOwner" },
  { path: "/campaigns/cmp_orbit_launch", as: "clientOwner" },
  { path: "/campaigns/cmp_summer_beauty", as: "clientOwner" },
  { path: "/reports", as: "clientOwner" },
  { path: "/api-portal", as: "clientOwner" },
  { path: "/usage", as: "clientOwner" },
  { path: "/settings", as: "clientOwner" },
  { path: "/notifications", as: "clientOwner" },
  { path: "/help", as: "clientOwner" },

  // Free plan — exercises quota messaging
  { path: "/dashboard", as: "freeClient" },
  { path: "/usage", as: "freeClient" },

  // Admin workspace
  { path: "/admin", as: "superAdmin" },
  { path: "/admin/influencers", as: "superAdmin" },
  { path: "/admin/verification", as: "superAdmin" },
  { path: "/admin/analytics", as: "superAdmin" },
  { path: "/admin/benchmarks", as: "superAdmin" },
  { path: "/admin/anomalies", as: "superAdmin" },
  { path: "/admin/ai", as: "superAdmin" },
  { path: "/admin/connectors", as: "superAdmin" },
  { path: "/admin/ingestion", as: "superAdmin" },
  { path: "/admin/users", as: "superAdmin" },
  { path: "/admin/orgs", as: "superAdmin" },
  { path: "/admin/api", as: "superAdmin" },
  { path: "/admin/audit", as: "superAdmin" },
  { path: "/admin/health", as: "superAdmin" },
  { path: "/admin/settings", as: "superAdmin" },

  // Analytics manager sees a narrower admin surface
  { path: "/admin", as: "analyst" },
  { path: "/admin/analytics", as: "analyst" },

  // Creator portal
  { path: "/creator", as: "creator" },
  { path: "/creator/profile", as: "creator" },
  { path: "/creator/connections", as: "creator" },
  { path: "/creator/verification", as: "creator" },
  { path: "/creator/analytics", as: "creator" },
  { path: "/creator/campaigns", as: "creator" },
  { path: "/creator/corrections", as: "creator" },
  { path: "/creator/notifications", as: "creator" },
  { path: "/creator/settings", as: "creator" },
];
