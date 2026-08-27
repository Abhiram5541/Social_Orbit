import { test, type Page } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";
import { ACCOUNTS, signIn } from "../support";

/* ---------------------------------------------------------------------------
 * Control audit.
 *
 * Clicks every enabled button on a screen and reports the ones where nothing
 * observable happened — no navigation, no dialog, no DOM change, no request.
 * A control that looks pressable and does nothing is the defect this is
 * hunting; the report separates those from controls that are genuinely inert
 * by design.
 *
 * Run: npx playwright test e2e/audit/controls --project=desktop --workers=1
 * Report: test-results/control-audit.json
 * ------------------------------------------------------------------------ */

interface ControlResult {
  route: string;
  role: string;
  name: string;
  outcome: "navigated" | "dialog" | "dom-changed" | "request" | "no-effect" | "disabled";
  detail?: string;
}

const results: ControlResult[] = [];

/** Clicking these would end the session or destroy data mid-audit. */
const SKIP = /sign out|log out|delete|revoke|rotate|remove|disconnect|clear|reset/i;

const SCREENS: { path: string; as: keyof typeof ACCOUNTS }[] = [
  { path: "/dashboard", as: "clientOwner" },
  { path: "/discovery", as: "clientOwner" },
  { path: "/influencers/inf_0001", as: "clientOwner" },
  { path: "/shortlists", as: "clientOwner" },
  { path: "/shortlists/sl_q4_tech", as: "clientOwner" },
  { path: "/compare?ids=inf_0001,inf_0004", as: "clientOwner" },
  { path: "/campaigns", as: "clientOwner" },
  { path: "/campaigns/new", as: "clientOwner" },
  { path: "/campaigns/cmp_orbit_launch", as: "clientOwner" },
  { path: "/reports", as: "clientOwner" },
  { path: "/api-portal", as: "clientOwner" },
  { path: "/usage", as: "clientOwner" },
  { path: "/settings", as: "clientOwner" },
  { path: "/admin", as: "superAdmin" },
  { path: "/admin/influencers", as: "superAdmin" },
  { path: "/admin/verification", as: "superAdmin" },
  { path: "/admin/analytics", as: "superAdmin" },
  { path: "/admin/connectors", as: "superAdmin" },
  { path: "/admin/users", as: "superAdmin" },
  { path: "/creator", as: "creator" },
  { path: "/creator/connections", as: "creator" },
  { path: "/creator/corrections", as: "creator" },
  { path: "/creator/verification", as: "creator" },
];

async function snapshot(page: Page) {
  return page.evaluate(() => ({
    url: location.href,
    dialogs: document.querySelectorAll("dialog[open]").length,
    // A coarse fingerprint of the rendered text; enough to notice a real change.
    body: (document.querySelector("main")?.innerText ?? "").length,
    checked: document.querySelectorAll("input:checked").length,
    expanded: document.querySelectorAll("details[open], [aria-expanded='true']").length,
  }));
}

test("audit interactive controls", async ({ page }) => {
  test.setTimeout(25 * 60_000);
  let signedInAs: string | null = null;

  for (const screen of SCREENS) {
    if (signedInAs !== screen.as) {
      await page.context().clearCookies();
      await signIn(page, ACCOUNTS[screen.as]);
      signedInAs = screen.as;
    }

    await page.goto(screen.path, { waitUntil: "networkidle" });

    const total = await page.locator("main button:visible").count();

    for (let index = 0; index < total; index += 1) {
      // Re-navigate before each click so every control is tested from the same
      // starting state and one click cannot mask the next.
      await page.goto(screen.path, { waitUntil: "networkidle" });
      const button = page.locator("main button:visible").nth(index);
      if ((await button.count()) === 0) continue;

      const name =
        (await button.getAttribute("aria-label")) ||
        (await button.innerText().catch(() => "")).trim().split("\n")[0] ||
        `button #${index}`;

      if (SKIP.test(name)) continue;

      if (await button.isDisabled()) {
        results.push({ route: screen.path, role: screen.as, name, outcome: "disabled" });
        continue;
      }

      // A control already in its selected state — the open tab, the current
      // sort — correctly does nothing when pressed again. Reporting that as a
      // dead control would train the reader to ignore this list.
      const alreadyActive =
        (await button.getAttribute("aria-selected")) === "true" ||
        (await button.getAttribute("aria-pressed")) === "true" ||
        (await button.getAttribute("aria-current")) !== null;
      if (alreadyActive) {
        results.push({
          route: screen.path,
          role: screen.as,
          name,
          outcome: "disabled",
          detail: "already in its selected state",
        });
        continue;
      }

      const before = await snapshot(page);
      let sawRequest = false;
      const onRequest = () => {
        sawRequest = true;
      };
      page.on("request", onRequest);

      try {
        await button.click({ timeout: 4000, trial: false });
      } catch {
        page.off("request", onRequest);
        results.push({
          route: screen.path,
          role: screen.as,
          name,
          outcome: "no-effect",
          detail: "click did not land (obscured or detached)",
        });
        continue;
      }

      await page.waitForTimeout(450);
      const after = await snapshot(page);
      page.off("request", onRequest);

      let outcome: ControlResult["outcome"] = "no-effect";
      if (after.url !== before.url) outcome = "navigated";
      else if (after.dialogs > before.dialogs) outcome = "dialog";
      else if (
        after.body !== before.body ||
        after.checked !== before.checked ||
        after.expanded !== before.expanded
      ) {
        outcome = "dom-changed";
      } else if (sawRequest) outcome = "request";

      results.push({
        route: screen.path,
        role: screen.as,
        name,
        outcome,
        detail: outcome === "navigated" ? after.url.replace(/^https?:\/\/[^/]+/, "") : undefined,
      });
    }

    process.stdout.write(`  ${screen.path}: ${total} controls\n`);
  }

  mkdirSync("test-results", { recursive: true });
  writeFileSync("test-results/control-audit.json", JSON.stringify(results, null, 2));

  const dead = results.filter((r) => r.outcome === "no-effect");
  process.stdout.write(`\nCONTROLS: ${results.length} tested, ${dead.length} with no effect\n`);
  for (const control of dead) {
    process.stdout.write(`  DEAD  ${control.route} — "${control.name}"\n`);
  }
});
