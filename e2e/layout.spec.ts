import { expect, test, type Page } from "@playwright/test";
import { ACCOUNTS, signIn } from "./support";

/* ---------------------------------------------------------------------------
 * Layout containment.
 *
 * A card must contain its own contents. The connector cards regressed on this:
 * a `whitespace-nowrap` status badge inside a grid child with the default
 * `min-width: auto` pushed past the card edge and collided with the next
 * platform's name, and unbroken env-var names ran out of their box.
 *
 * These assertions are geometric rather than visual, so they catch the same
 * class of bug anywhere it appears rather than only where a screenshot looked
 * wrong.
 * ------------------------------------------------------------------------ */

/** The widest any descendant escapes past its container's right edge. */
async function worstOverflow(page: Page, containerSelector: string) {
  return page.evaluate((selector) => {
    const containers = Array.from(document.querySelectorAll<HTMLElement>(selector));
    return containers.map((container) => {
      const box = container.getBoundingClientRect();
      let worst = 0;
      let culprit = "";
      for (const child of Array.from(container.querySelectorAll<HTMLElement>("*"))) {
        const childBox = child.getBoundingClientRect();
        if (childBox.width === 0) continue;
        const spill = Math.round(childBox.right - box.right);
        if (spill > worst) {
          worst = spill;
          culprit = `${child.tagName.toLowerCase()}.${String(child.className).slice(0, 40)}`;
        }
      }
      return {
        label: container.textContent?.trim().slice(0, 24) ?? "",
        width: Math.round(box.width),
        height: Math.round(box.height),
        overflow: Math.max(0, worst),
        culprit,
      };
    });
  }, containerSelector);
}

const CONNECTOR_CARD = "li:has(> div > span):has(dl)";

test.describe("connector cards contain their contents", () => {
  for (const width of [390, 768, 1024, 1280, 1440, 1920]) {
    test(`no overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await signIn(page, ACCOUNTS.superAdmin);

      for (const route of ["/admin", "/admin/connectors"]) {
        await page.goto(route, { waitUntil: "networkidle" });
        const cards = await worstOverflow(page, CONNECTOR_CARD);
        expect(cards.length, `${route} should render connector cards`).toBeGreaterThan(0);

        for (const card of cards) {
          expect(
            card.overflow,
            `${route} @${width}px — "${card.label}" spills ${card.overflow}px (${card.culprit})`,
          ).toBeLessThanOrEqual(1);
        }
      }
    });
  }

  test("sibling cards read as a set at the same height", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await signIn(page, ACCOUNTS.superAdmin);
    await page.goto("/admin", { waitUntil: "networkidle" });

    const cards = await worstOverflow(page, CONNECTOR_CARD);
    const heights = [...new Set(cards.map((card) => card.height))];
    // A grid row of peers should align; differing heights mean one card's
    // header wrapped while another's did not.
    expect(heights, `card heights: ${heights.join(", ")}`).toHaveLength(1);
  });

  test("every missing credential name stays inside its box", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await signIn(page, ACCOUNTS.superAdmin);
    await page.goto("/admin", { waitUntil: "networkidle" });

    const clipped = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>("li"))
        .flatMap((li) => Array.from(li.querySelectorAll<HTMLElement>("ul li")))
        .filter((item) => item.scrollWidth > item.clientWidth + 1)
        .map((item) => item.textContent ?? ""),
    );
    expect(clipped, "credential names must wrap, not clip").toEqual([]);
  });
});
