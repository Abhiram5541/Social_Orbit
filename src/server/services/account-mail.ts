import type { RegisterInput } from "@/lib/contracts/auth";
import type { NotificationItem } from "@/lib/contracts/notifications";
import { sendEmail } from "@/server/services/notification-service";

/* ---------------------------------------------------------------------------
 * Account email: reset links, invites, and the sales enquiry.
 *
 * Plain HTML, inline styles, one link. Links are built on APP_URL — the
 * canonical public host — rather than on the request, because an email is
 * read away from whatever host the request arrived on. Every sender returns
 * false rather than throwing: the reset endpoint must answer the same way
 * whether or not the mail went out.
 * ------------------------------------------------------------------------ */

const escape = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function publicOrigin(fallback?: string): string {
  return (process.env.APP_URL?.trim().replace(/\/$/, "") || fallback || "").replace(/\/$/, "");
}

function layout(title: string, body: string): string {
  return `<!doctype html><html><body style="margin:0;padding:32px 16px;background:#f3f2f6;font-family:Inter,Helvetica,Arial,sans-serif;color:#1a0a2e">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="520" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border-radius:16px;padding:32px">
<tr><td style="font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#5b2cf0">SENSO</td></tr>
<tr><td style="padding-top:16px;font-size:20px;font-weight:700">${title}</td></tr>
<tr><td style="padding-top:12px;font-size:15px;line-height:1.55;color:#4b4458">${body}</td></tr>
<tr><td style="padding-top:28px;font-size:12px;color:#8a8399">SENSO · Influencer intelligence. If you did not expect this email, you can ignore it.</td></tr>
</table></td></tr></table></body></html>`;
}

const button = (href: string, label: string) =>
  `<p style="margin:20px 0"><a href="${href}" style="display:inline-block;background:#5b2cf0;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:999px">${label}</a></p>
<p style="font-size:13px;color:#8a8399;word-break:break-all">Or paste this link into your browser:<br>${href}</p>`;

export function sendPasswordResetMail(to: string, token: string, origin: string): Promise<boolean> {
  const href = `${publicOrigin(origin)}/reset-password?token=${encodeURIComponent(token)}`;
  return sendEmail({
    to,
    subject: "Reset your SENSO password",
    html: layout(
      "Reset your password",
      `Someone asked to reset the password for ${escape(to)}. The link works once and expires in 30 minutes.${button(href, "Choose a new password")}`,
    ),
  });
}

export function sendInviteMail(input: {
  to: string;
  name: string;
  orgName: string;
  invitedBy: string;
  token: string;
  origin: string;
}): Promise<boolean> {
  const href = `${publicOrigin(input.origin)}/reset-password?token=${encodeURIComponent(input.token)}&invite=1`;
  return sendEmail({
    to: input.to,
    subject: `${escape(input.invitedBy)} invited you to SENSO`,
    html: layout(
      `You're invited to ${escape(input.orgName)}`,
      `Hi ${escape(input.name)}, ${escape(input.invitedBy)} has set up a SENSO account for you in <strong>${escape(input.orgName)}</strong>. Choose a password to sign in. The link expires in 7 days.${button(href, "Set your password")}`,
    ),
  });
}

/** The public registration form is an enquiry: it goes to the sales inbox. */
export function sendEnquiryMail(input: Omit<RegisterInput, "password" | "confirmPassword" | "acceptTerms">): Promise<boolean> {
  const to = process.env.EMAIL_REPORT_TO?.trim();
  if (!to) return Promise.resolve(false);
  return sendEmail({
    to,
    subject: `SENSO access request — ${input.organisation}`,
    html: layout(
      "New access request",
      `<table cellpadding="4" style="font-size:15px">
<tr><td style="color:#8a8399">Name</td><td>${escape(input.name)}</td></tr>
<tr><td style="color:#8a8399">Email</td><td>${escape(input.email)}</td></tr>
<tr><td style="color:#8a8399">Organisation</td><td>${escape(input.organisation)}</td></tr>
<tr><td style="color:#8a8399">Account type</td><td>${escape(input.accountType)}</td></tr>
</table><p>Create the account from <strong>Administration → Users</strong> to send them an invite.</p>`,
    ),
  });
}

/** The daily digest: only alerts that were not in the previous digest. */
export function sendAlertDigestMail(input: {
  to: string;
  name: string;
  alerts: NotificationItem[];
  origin?: string;
}): Promise<boolean> {
  const origin = publicOrigin(input.origin);
  const critical = input.alerts.filter((a) => a.severity === "critical").length;
  const rows = input.alerts
    .map(
      (a) => `<tr><td style="padding:10px 0;border-top:1px solid #e9e6ef">
<span style="display:inline-block;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${a.severity === "critical" ? "#b3261e" : "#8a5a00"}">${a.severity}</span><br>
<strong>${escape(a.title)}</strong><br>
<span style="color:#4b4458">${escape(a.detail)}</span>${a.href ? `<br><a href="${origin}${a.href}" style="color:#5b2cf0">Open in SENSO</a>` : ""}
</td></tr>`,
    )
    .join("");
  return sendEmail({
    to: input.to,
    subject: `SENSO: ${input.alerts.length} new alert${input.alerts.length === 1 ? "" : "s"}${critical ? ` (${critical} critical)` : ""}`,
    html: layout(
      `${input.alerts.length} new alert${input.alerts.length === 1 ? "" : "s"} on the creators you track`,
      `Hi ${escape(input.name)}, since your last digest SENSO detected the following on your shortlisted creators.<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:8px">${rows}</table>
<p style="margin-top:16px"><a href="${origin}/notifications" style="color:#5b2cf0">All notifications</a></p>`,
    ),
  });
}
