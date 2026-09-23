import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BadgeCheck,
  Bell,
  Blocks,
  Building2,
  Radio,
  ChartNoAxesCombined,
  ClipboardList,
  Code2,
  CreditCard,
  Database,
  FileText,
  Gauge,
  LayoutDashboard,
  Link2,
  ListChecks,
  Megaphone,
  ScrollText,
  Search,
  Settings,
  Scale,
  Sparkles,
  UserCircle,
  Users,
  Plug,
  Handshake,
  Send,} from "lucide-react";
import type { Permission, Workspace, OrgKind } from "@/lib/contracts/auth";

/* ---------------------------------------------------------------------------
 * Navigation is derived from permissions, not from roles. A nav item and the
 * route handler behind it name the same permission, so the sidebar cannot show
 * a destination the server would refuse.
 *
 * Hiding a link is a convenience for the user. It is never the control — that
 * lives in `src/server/auth/rbac.ts`.
 * ------------------------------------------------------------------------ */

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Item is shown only if the session holds this permission. */
  permission?: Permission;
  /** Matches nested routes too — `/campaigns/123` lights up `/campaigns`. */
  matchNested?: boolean;
}

export interface NavSection {
  label?: string;
  items: NavItem[];
}

/* ---------------------------------------------------------------------------
 * Information architecture.
 *
 * Grouped by what the user is trying to do, not by which backend module owns
 * the route. The old grouping ("Workspace", "Data platform") named the
 * implementation; a marketing director does not have a workspace task, they
 * have a discovery task and an activation task.
 *
 * Technical operations sit at the bottom of every workspace, behind a section
 * label that says so, so the daily path is the top of the rail.
 * ------------------------------------------------------------------------ */

const CLIENT_NAV: NavSection[] = [
  {
    items: [{ href: "/dashboard", label: "Overview", icon: LayoutDashboard }],
  },
  {
    label: "Discover",
    items: [
      {
        href: "/discovery",
        label: "Creator search",
        icon: Search,
        permission: "influencer:search",
        matchNested: true,
      },
      // `/influencers` is deliberately absent. It is a shared route that sends
      // each role to their own list, and for a client that is `/discovery` —
      // the item directly above.
      {
        href: "/shortlists",
        label: "Shortlists",
        icon: ListChecks,
        permission: "shortlist:read",
        matchNested: true,
      },
      {
        href: "/compare",
        label: "Compare",
        icon: Scale,
        permission: "influencer:compare",
      },
    ],
  },
  {
    label: "Activate",
    items: [
      {
        href: "/relationships",
        label: "Relationships",
        icon: Handshake,
        permission: "crm:read",
        matchNested: true,
      },
      {
        href: "/outreach",
        label: "Outreach",
        icon: Send,
        permission: "outreach:send",
      },
      {
        href: "/campaigns",
        label: "Campaigns",
        icon: Megaphone,
        permission: "campaign:read",
        matchNested: true,
      },
      {
        href: "/listening",
        label: "Listening",
        icon: Radio,
        permission: "influencer:read",
      },
      {
        href: "/clients",
        label: "Clients",
        icon: Building2,
        permission: "campaign:read",
        matchNested: true,
      },
      {
        href: "/reports",
        label: "Reporting",
        icon: FileText,
        permission: "report:read",
        matchNested: true,
      },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/api-portal", label: "API access", icon: Code2, permission: "api_key:read", matchNested: true },
      { href: "/usage", label: "Usage & billing", icon: CreditCard, permission: "billing:read" },
      { href: "/settings", label: "Settings", icon: Settings, matchNested: true },
    ],
  },
];

const ADMIN_NAV: NavSection[] = [
  {
    items: [{ href: "/admin", label: "Overview", icon: LayoutDashboard }],
  },
  {
    label: "Discover",
    items: [
      {
        href: "/admin/influencers",
        label: "Creator database",
        icon: Users,
        permission: "influencer:read",
        matchNested: true,
      },
    ],
  },
  {
    label: "Intelligence",
    items: [
      {
        href: "/admin/analytics",
        label: "Analytics",
        icon: ChartNoAxesCombined,
        permission: "analytics:read",
      },
      {
        href: "/admin/benchmarks",
        label: "Benchmarks",
        icon: Gauge,
        permission: "analytics:benchmarks",
      },
      {
        href: "/admin/anomalies",
        label: "Anomalies",
        icon: Activity,
        permission: "analytics:anomaly_queue",
      },
      {
        href: "/admin/ai",
        label: "AI enrichment",
        icon: Sparkles,
        permission: "analytics:ai_review",
        matchNested: true,
      },
    ],
  },
  {
    // Verification moves here from the top group: it is not a daily browsing
    // destination, it is the trust apparatus — and it reads as what it is
    // beside the connectors and the ingestion log that feed it.
    label: "Trust & data",
    items: [
      {
        href: "/admin/verification",
        label: "Verification",
        icon: BadgeCheck,
        permission: "verification:review",
        matchNested: true,
      },
      { href: "/admin/connectors", label: "Connectors", icon: Blocks, permission: "admin:connectors" },
      { href: "/admin/integrations", label: "Integrations", icon: Plug, permission: "admin:connectors" },
      { href: "/admin/ingestion", label: "Ingestion", icon: Database, permission: "admin:ingestion" },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/admin/users", label: "Users", icon: UserCircle, permission: "admin:users" },
      { href: "/admin/orgs", label: "Client orgs", icon: Building2, permission: "admin:orgs" },
      { href: "/admin/api", label: "API management", icon: Code2, permission: "api_key:read" },
      { href: "/admin/audit", label: "Audit log", icon: ScrollText, permission: "admin:audit" },
      { href: "/admin/health", label: "System health", icon: Activity, permission: "admin:system_health" },
      { href: "/admin/settings", label: "Settings", icon: Settings, matchNested: true },
    ],
  },
];

const INFLUENCER_NAV: NavSection[] = [
  {
    items: [{ href: "/creator", label: "Overview", icon: LayoutDashboard }],
  },
  {
    label: "My presence",
    items: [
      {
        href: "/creator/profile",
        label: "Profile",
        icon: UserCircle,
        permission: "self:profile_read",
      },
      {
        href: "/creator/connections",
        label: "Connected accounts",
        icon: Link2,
        permission: "self:connections_write",
      },
      {
        href: "/creator/verification",
        label: "Verification",
        icon: BadgeCheck,
        permission: "self:profile_read",
      },
    ],
  },
  {
    label: "Performance",
    items: [
      {
        href: "/creator/analytics",
        label: "Analytics",
        icon: ChartNoAxesCombined,
        permission: "self:analytics_read",
        matchNested: true,
      },
      {
        href: "/creator/campaigns",
        label: "Campaigns",
        icon: Megaphone,
        permission: "self:analytics_read",
        matchNested: true,
      },
      {
        href: "/creator/corrections",
        label: "Corrections",
        icon: ClipboardList,
        permission: "self:correction_request",
      },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/creator/notifications", label: "Notifications", icon: Bell },
      { href: "/creator/settings", label: "Settings", icon: Settings },
    ],
  },
];

export const WORKSPACE_NAV: Record<Workspace, NavSection[]> = {
  client: CLIENT_NAV,
  admin: ADMIN_NAV,
  influencer: INFLUENCER_NAV,
};

export const WORKSPACE_HOME: Record<Workspace, string> = {
  client: "/dashboard",
  admin: "/admin",
  influencer: "/creator",
};

/** Drop items the session cannot reach, then drop sections left empty. */
/**
 * Where a given viewer browses creators.
 *
 * Platform staff and clients reach the same profile pages but from different
 * lists — `/discovery` is a client route and redirects staff away, so a link
 * hard-coded to it silently bounces half the people who click it.
 */
export function discoveryHomeFor(orgKind: OrgKind): string {
  return orgKind === "platform" ? "/admin/influencers" : "/discovery";
}

export function visibleNav(
  workspace: Workspace,
  can: (permission: Permission) => boolean,
): NavSection[] {
  return WORKSPACE_NAV[workspace]
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.permission || can(item.permission)),
    }))
    .filter((section) => section.items.length > 0);
}

export function isActive(item: NavItem, pathname: string): boolean {
  if (pathname === item.href) return true;
  return Boolean(item.matchNested) && pathname.startsWith(`${item.href}/`);
}
