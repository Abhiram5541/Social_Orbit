import { test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import { ACCOUNTS, creatorIds, signIn } from "../test-helpers";
import { AUDIT_ROUTES, withCreatorIds } from "./route-inventory";

/* ---------------------------------------------------------------------------
 * UI audit.
 *
 * This does not assert — it reports. Every route is loaded as a role that can
 * see it, and everything that looks wrong is collected into one file so the
 * findings can be triaged in one pass rather than discovered one at a time.
 *
 * Run: npx playwright test e2e/audit --project=desktop --workers=1
 * Report: test-results/ui-audit.json
 * ------------------------------------------------------------------------ */

interface Finding {
  route: string;
  role: string;
  kind:
    | "console-error"
    | "page-error"
    | "request-failed"
    | "bad-status"
    | "broken-link"
    | "a11y"
    | "overflow"
    | "empty-render"
    | "dead-control";
  detail: string;
  severity: "high" | "medium" | "low";
}

const findings: Finding[] = [];
const linkCache = new Map<string, { status: number; to: string | null }>();

function record(f: Finding) {
  findings.push(f);
}

/** Resolves a link once and caches the status, so a nav link is not fetched 50 times. */
/**
 * The immediate response to a link, not the end of its redirect chain.
 *
 * Following redirects hid a whole class of defect: a link to a route this role
 * cannot reach answers 307 and lands on the dashboard, and reporting only the
 * final 200 made that look healthy. What matters is whether clicking the link
 * takes you where its text said it would.
 */
async function probeLink(page: Page, url: string): Promise<{ status: number; to: string | null }> {
  const cached = linkCache.get(url);
  if (cached) return cached;

  let result: { status: number; to: string | null };
  try {
    const response = await page.request.get(url, { maxRedirects: 0 });
    const location = response.headers()["location"] ?? null;
    result = { status: response.status(), to: location };
  } catch {
    result = { status: 0, to: null };
  }

  linkCache.set(url, result);
  return result;
}

test.describe.configure({ mode: "serial" });

test("audit every route", async ({ page, baseURL, request }) => {
  test.setTimeout(20 * 60_000);

  let signedInAs: string | null = null;
  const routes = withCreatorIds(AUDIT_ROUTES, await creatorIds(request, 3));

  for (const route of routes) {
    const label = `${route.path} [${route.as}]`;

    // Session per role, reused across that role's routes.
    if (route.as === "anonymous") {
      if (signedInAs !== null) {
        await page.context().clearCookies();
        signedInAs = null;
      }
    } else if (signedInAs !== route.as) {
      await page.context().clearCookies();
      await signIn(page, ACCOUNTS[route.as]);
      signedInAs = route.as;
    }

    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const failedRequests: string[] = [];

    const onConsole = (message: { type: () => string; text: () => string }) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    };
    const onPageError = (error: Error) => pageErrors.push(error.message);
    const onRequestFailed = (request: {
      url: () => string;
      failure: () => { errorText: string } | null;
    }) => {
      const url = request.url();
      const error = request.failure()?.errorText ?? "unknown";

      // An abort is a cancelled request, not a failed one. Two produce them
      // here and both are correct: Next aborts prefetches during navigation,
      // and the search view aborts a superseded query when its filters change
      // (which React's development double-effect makes visible on first load).
      // Verified separately: one request completes 200 and results render.
      if (error === "net::ERR_ABORTED") return;

      failedRequests.push(`${url} — ${error}`);
    };

    page.on("console", onConsole);
    page.on("pageerror", onPageError);
    page.on("requestfailed", onRequestFailed);

    let status = 0;
    try {
      const response = await page.goto(route.path, { waitUntil: "networkidle", timeout: 30_000 });
      status = response?.status() ?? 0;
    } catch (error) {
      record({
        route: route.path,
        role: route.as,
        kind: "request-failed",
        detail: `navigation threw: ${(error as Error).message}`,
        severity: "high",
      });
    }

    if (status >= 400) {
      record({
        route: route.path,
        role: route.as,
        kind: "bad-status",
        detail: `HTTP ${status}`,
        severity: "high",
      });
    }

    for (const detail of consoleErrors) {
      record({ route: route.path, role: route.as, kind: "console-error", detail, severity: "medium" });
    }
    for (const detail of pageErrors) {
      record({ route: route.path, role: route.as, kind: "page-error", detail, severity: "high" });
    }
    for (const detail of failedRequests) {
      record({ route: route.path, role: route.as, kind: "request-failed", detail, severity: "medium" });
    }

    page.off("console", onConsole);
    page.off("pageerror", onPageError);
    page.off("requestfailed", onRequestFailed);

    // Did anything actually render?
    const bodyText = (await page.locator("main, body").first().innerText().catch(() => "")) ?? "";
    if (!route.redirects && bodyText.trim().length < 40) {
      record({
        route: route.path,
        role: route.as,
        kind: "empty-render",
        detail: `main region rendered ${bodyText.trim().length} characters`,
        severity: "high",
      });
    }

    // Layout: the page itself must never scroll sideways. Reload at each width
    // rather than resizing in place — chart containers keep their previous
    // pixel width until they re-measure, which reads as overflow that no real
    // visitor encounters.
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.reload({ waitUntil: "networkidle" });
      const overflow = await page.evaluate(
        () => document.body.scrollWidth - document.documentElement.clientWidth,
      );
      if (overflow > 1) {
        record({
          route: route.path,
          role: route.as,
          kind: "overflow",
          detail: `${overflow}px of horizontal page scroll at ${width}px`,
          severity: "medium",
        });
      }
    }
    await page.setViewportSize({ width: 1440, height: 900 });

    // Links: every destination must resolve.
    const hrefs = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a[href]"))
        .map((a) => (a as HTMLAnchorElement).getAttribute("href") ?? "")
        .filter(
          (href) =>
            href.length > 0 &&
            !href.startsWith("#") &&
            !href.startsWith("mailto:") &&
            !href.startsWith("http") &&
            !href.startsWith("tel:"),
        ),
    );
    for (const href of [...new Set(hrefs)]) {
      const target = new URL(href, baseURL).toString();
      const { status, to } = await probeLink(page, target);

      if (status === 0 || status >= 400) {
        record({
          route: route.path,
          role: route.as,
          kind: "broken-link",
          detail: `${href} → ${status === 0 ? "request failed" : status}`,
          severity: "high",
        });
        continue;
      }

      if (status >= 300 && status < 400 && to) {
        const destination = new URL(to, baseURL);
        const landsOn = destination.pathname;

        // A redirect off this origin is the point of the link, not a fault:
        // the OAuth start route exists to hand the browser to Google.
        const leavesTheApp = destination.origin !== new URL(baseURL!).origin;

        if (!leavesTheApp && landsOn !== new URL(target).pathname) {
          record({
            route: route.path,
            role: route.as,
            kind: "broken-link",
            detail:
              `${href} → ${status} → ${landsOn}. This role cannot reach the linked page, ` +
              `so the link goes somewhere other than its label promises.`,
            severity: "high",
          });
        }
      }
    }

    // Accessibility.
    try {
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      for (const violation of results.violations) {
        record({
          route: route.path,
          role: route.as,
          kind: "a11y",
          detail: `${violation.id}: ${violation.help} (${violation.nodes.length} node${violation.nodes.length === 1 ? "" : "s"}) — ${violation.nodes[0]?.target?.join(" ") ?? ""}`,
          severity: violation.impact === "critical" || violation.impact === "serious" ? "high" : "low",
        });
      }
    } catch (error) {
      record({
        route: route.path,
        role: route.as,
        kind: "a11y",
        detail: `axe failed to run: ${(error as Error).message}`,
        severity: "low",
      });
    }

    process.stdout.write(`  checked ${label}\n`);
  }

  mkdirSync("test-results", { recursive: true });
  writeFileSync("test-results/ui-audit.json", JSON.stringify(findings, null, 2));

  const bySeverity = (s: Finding["severity"]) => findings.filter((f) => f.severity === s).length;
  process.stdout.write(
    `\nAUDIT: ${findings.length} findings — ${bySeverity("high")} high, ${bySeverity("medium")} medium, ${bySeverity("low")} low\n`,
  );

  const byKind = new Map<string, number>();
  for (const f of findings) byKind.set(f.kind, (byKind.get(f.kind) ?? 0) + 1);
  for (const [kind, count] of [...byKind].sort((a, b) => b[1] - a[1])) {
    process.stdout.write(`  ${kind}: ${count}\n`);
  }
});
