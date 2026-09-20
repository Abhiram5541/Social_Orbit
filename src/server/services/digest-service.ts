import { appRows, persist } from "@/server/data/app-store";
import { findOrg, listUsers, toSessionUser } from "@/server/repositories/user-repository";
import { sendAlertDigestMail } from "./account-mail";
import { alertsFor } from "./alert-service";

/* ---------------------------------------------------------------------------
 * The daily alert digest.
 *
 * Alerts are derived from current state, not stored as events, so a daily
 * email would repeat itself forever. Each person's last digest keeps the ids
 * it covered; the next one sends only what is new, and sends nothing when
 * nothing is. Informational rows (preliminary confidence) stay in the inbox
 * and out of the email.
 * ------------------------------------------------------------------------ */

export interface DigestRecord {
  /** The user id. */
  id: string;
  sentAt: string;
  alertIds: string[];
}

export interface DigestReport {
  users: number;
  emailed: number;
  alerts: number;
}

const digests = () => appRows<DigestRecord>("digests", () => []);

export async function sendAlertDigests(now = new Date()): Promise<DigestReport> {
  const report: DigestReport = { users: 0, emailed: 0, alerts: 0 };
  const users = await listUsers();

  for (const user of users) {
    if (user.status !== "active") continue;
    const org = await findOrg(user.orgId);
    if (!org || org.kind !== "client" || user.role === "influencer") continue;
    report.users += 1;

    const alerts = alertsFor(toSessionUser(user, org)).filter((a) => a.severity !== "info");
    const previous = digests().find((d) => d.id === user.id);
    const seen = new Set(previous?.alertIds ?? []);
    const fresh = alerts.filter((a) => !seen.has(a.id));

    // The record moves forward even when nothing was mailed, so an alert that
    // cleared and came back counts as new again.
    const record: DigestRecord = { id: user.id, sentAt: now.toISOString(), alertIds: alerts.map((a) => a.id) };
    if (fresh.length > 0) {
      const sent = await sendAlertDigestMail({ to: user.email, name: user.name, alerts: fresh });
      if (!sent) continue; // Mail unconfigured or failed: try again tomorrow with the same set.
      report.emailed += 1;
      report.alerts += fresh.length;
    }
    if (previous) Object.assign(previous, record);
    else digests().push(record);
    persist("digests", [record]);
  }
  return report;
}
