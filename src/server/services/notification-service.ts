import { createHmac } from "node:crypto";

/* ---------------------------------------------------------------------------
 * Outbound delivery — Slack, Microsoft Teams, email, signed webhooks.
 *
 * One service because the four share a shape: read a credential from the
 * environment, post one HTTP request, report honestly whether it was sent.
 * Nothing here retries or queues; a notification that matters enough to
 * guarantee belongs in a real queue (deferred with Redis, CLAUDE.md §3), and
 * pretending a fire-and-forget POST is guaranteed would be the integrations
 * page's cardinal sin restated in code.
 *
 * Every sender returns `false` rather than throwing when unconfigured or
 * failed: callers are producers like the nightly cron, and a missing webhook
 * must never fail the job that tried to announce itself.
 * ------------------------------------------------------------------------ */

const configured = (key: string): string | null => {
  const value = process.env[key]?.trim();
  return value ? value : null;
};

export interface NotifyChannels {
  slack: boolean;
  teams: boolean;
  email: boolean;
  /** Webhook signing — always available once the secret is set. */
  webhook: boolean;
}

export function notifyChannels(): NotifyChannels {
  return {
    slack: Boolean(configured("SLACK_WEBHOOK_URL")),
    teams: Boolean(configured("TEAMS_WEBHOOK_URL")),
    email: Boolean(configured("RESEND_API_KEY") && configured("EMAIL_FROM")),
    webhook: Boolean(configured("WEBHOOK_SIGNING_SECRET")),
  };
}

async function post(url: string, body: unknown): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function sendSlack(text: string): Promise<boolean> {
  const url = configured("SLACK_WEBHOOK_URL");
  if (!url) return false;
  return post(url, { text });
}

/**
 * Teams "Workflows" webhooks expect an Adaptive Card envelope; the legacy
 * connector accepted bare text. The card form works on both current setups.
 */
export async function sendTeams(text: string): Promise<boolean> {
  const url = configured("TEAMS_WEBHOOK_URL");
  if (!url) return false;
  return post(url, {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body: [{ type: "TextBlock", text, wrap: true }],
        },
      },
    ],
  });
}

export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const key = configured("RESEND_API_KEY");
  const from = configured("EMAIL_FROM");
  if (!key || !from) return false;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [options.to], subject: options.subject, html: options.html }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * HMAC-SHA256 over the exact bytes being sent, so a receiver can verify the
 * payload came from SocialOrbit and was not altered. The signature goes in
 * `X-SocialOrbit-Signature` as `sha256=<hex>` — the shape GitHub and Stripe
 * receivers already know how to check.
 */
export function signPayload(body: string): string | null {
  const secret = configured("WEBHOOK_SIGNING_SECRET");
  if (!secret) return null;
  return `sha256=${createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;
}

export async function deliverWebhook(url: string, event: unknown): Promise<boolean> {
  const body = JSON.stringify(event);
  const signature = signPayload(body);
  if (!signature) return false;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-SocialOrbit-Signature": signature,
      },
      body,
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * An operations event, fanned out to every configured channel at once.
 *
 * The producers are jobs — the nightly snapshot, a finished harvest — and a
 * job does not care which chat tool the team reads, so it says it once here.
 * Returns which channels actually accepted it.
 */
export async function sendOpsEvent(
  title: string,
  lines: string[],
): Promise<{ slack: boolean; teams: boolean; email: boolean }> {
  const text = [`*${title}*`, ...lines].join("\n");
  const reportTo = configured("EMAIL_REPORT_TO");

  const [slack, teams, email] = await Promise.all([
    sendSlack(text),
    sendTeams([title, ...lines].join("\n\n")),
    reportTo
      ? sendEmail({
          to: reportTo,
          subject: title,
          html: `<h3>${title}</h3>${lines.map((line) => `<p>${line}</p>`).join("")}`,
        })
      : Promise.resolve(false),
  ]);

  return { slack, teams, email };
}
