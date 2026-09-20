/**
 * One row in a notifications inbox — and one line in the daily digest email.
 * Shared by the server (which derives them) and the inbox component (which
 * draws them), so it lives here rather than in either.
 */
export interface NotificationItem {
  id: string;
  kind:
    | "dormancy"
    | "growth_spike"
    | "view_anomaly"
    | "engagement_decline"
    | "data_stale"
    | "oauth_reauth"
    | "ai_conflict"
    | "brand_safety"
    | "quota_warning"
    | "verification";
  title: string;
  detail: string;
  /**
   * A real event anchor — lastRefreshedAt, lastActiveAt. Optional on purpose:
   * when no anchor exists the row shows no time rather than a render-minted
   * "just now", which would be a manufactured observation.
   */
  at?: string;
  href?: string;
  severity: "info" | "warning" | "critical";
}
