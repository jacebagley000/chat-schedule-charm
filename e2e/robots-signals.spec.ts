import { expect, test } from "@playwright/test";
import { NOINDEX_HEADER } from "../src/lib/public-routes";

/**
 * Robots contract, end to end against a real deployment:
 *
 *   public route  -> no X-Robots-Tag header AND no noindex in the rendered HTML
 *   private route -> X-Robots-Tag: noindex, nofollow, noarchive AND a
 *                    <meta name="robots" content="noindex..."> in the HTML
 *
 * Both layers are asserted because either one alone can silently regress.
 */

const PUBLIC_PATHS = ["/", "/login", "/comparison/polyai"];
const PRIVATE_PATHS = ["/dashboard", "/admin/leads", "/schedule"];

/** Pull <meta name="robots" content="..."> values out of raw HTML. */
function robotsMetaFromHtml(html: string): string[] {
  const out: string[] = [];
  for (const tag of html.matchAll(/<meta[^>]*>/gi)) {
    const t = tag[0];
    if (!/name=["']robots["']/i.test(t)) continue;
    out.push(t.match(/content=["']([^"']*)["']/i)?.[1] ?? "");
  }
  return out;
}

test.describe("public routes stay indexable", () => {
  for (const path of PUBLIC_PATHS) {
    test(`${path} has no noindex header or meta`, async ({ request, page }) => {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status(), `${path} should be served directly`).toBe(200);

      const header = res.headers()["x-robots-tag"];
      expect(header, `${path} must not send X-Robots-Tag (got "${header}")`).toBeUndefined();

      const metas = robotsMetaFromHtml(await res.text());
      expect(metas.join(" | "), `${path} SSR HTML must not contain noindex`).not.toMatch(
        /noindex/i,
      );

      // Rendered (post-hydration) DOM must agree with the SSR HTML.
      await page.goto(path, { waitUntil: "domcontentloaded" });
      const rendered = await page
        .locator('meta[name="robots"]')
        .evaluateAll((els) => els.map((e) => e.getAttribute("content") ?? ""));
      expect(rendered.join(" | "), `${path} rendered DOM must not contain noindex`).not.toMatch(
        /noindex/i,
      );
    });
  }
});

test.describe("private routes are blocked from indexing", () => {
  for (const path of PRIVATE_PATHS) {
    test(`${path} sends noindex header and meta`, async ({ request, page }) => {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(
        res.headers()["x-robots-tag"],
        `${path} must send the noindex X-Robots-Tag`,
      ).toBe(NOINDEX_HEADER);

      // A private route may redirect unauthenticated visitors; only inspect the
      // HTML when this response actually is the page.
      if (res.status() === 200) {
        const metas = robotsMetaFromHtml(await res.text());
        expect(metas.length, `${path} SSR HTML must declare a robots meta`).toBeGreaterThan(0);
        expect(metas.join(" | ")).toMatch(/noindex/i);
      }

      await page.goto(path, { waitUntil: "domcontentloaded" });
      const landed = new URL(page.url()).pathname;
      if (landed === path) {
        const rendered = await page
          .locator('meta[name="robots"]')
          .evaluateAll((els) => els.map((e) => e.getAttribute("content") ?? ""));
        expect(rendered.join(" | "), `${path} rendered DOM must contain noindex`).toMatch(
          /noindex/i,
        );
      } else {
        // Redirected to a public auth page — that page must itself be clean.
        expect(landed, `${path} redirected somewhere unexpected`).toMatch(/^\/(login|signup)$/);
      }
    });
  }
});

test("robots.txt and sitemap.xml stay crawlable", async ({ request }) => {
  for (const path of ["/robots.txt", "/sitemap.xml"]) {
    const res = await request.get(path, { maxRedirects: 0 });
    expect(res.status(), `${path} should return 200`).toBe(200);
    expect(res.headers()["x-robots-tag"], `${path} must not be noindexed`).toBeUndefined();
  }
});
