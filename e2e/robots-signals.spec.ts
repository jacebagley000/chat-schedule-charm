import type { APIRequestContext, APIResponse, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
  BASE_URL,
  isCrawlablePath,
  normalizePath,
  NOINDEX_HEADER,
  PUBLIC_ROUTES,
} from "../src/lib/public-routes";

/**
 * Robots contract, end to end against a real deployment:
 *
 *   public route  -> no X-Robots-Tag header AND no noindex in the rendered HTML
 *   private route -> X-Robots-Tag: noindex, nofollow, noarchive AND a
 *                    <meta name="robots" content="noindex..."> in the HTML
 *
 * Both layers are asserted because either one alone can silently regress.
 */

/** Every allowlisted page — the representative public set is the allowlist itself. */
const PUBLIC_PATHS = PUBLIC_ROUTES.map((r) => r.path);

/** One representative path per private area, plus real-world URL variants. */
const PRIVATE_PATHS = [
  "/dashboard",
  "/admin/leads",
  "/schedule",
  "/workspaces/demo/calendar",
  "/checkout/start",
  "/some/unknown/page",
  "/comparison/polyai/extra",
  "/dashboard?utm_source=newsletter",
];

/**
 * Preview/staging servers restart and cold-start; a connection error is not a
 * robots regression. Retry transport failures before letting the test fail.
 */
async function getWithRetry(
  request: APIRequestContext,
  path: string,
  attempts = 20,
): Promise<APIResponse> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await request.get(path, { maxRedirects: 0, timeout: 20_000 });
    } catch (error) {
      lastError = error;
      await new Promise((r) => setTimeout(r, 5_000));
    }
  }
  throw new Error(`${path} unreachable after ${attempts} attempts: ${String(lastError)}`);
}

/** Same tolerance for navigations. */
async function gotoWithRetry(page: Page, path: string, attempts = 10): Promise<void> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      await page.goto(path, { waitUntil: "domcontentloaded", timeout: 30_000 });
      return;
    } catch (error) {
      lastError = error;
      await new Promise((r) => setTimeout(r, 5_000));
    }
  }
  throw new Error(`${path} navigation failed: ${String(lastError)}`);
}

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

test.describe.configure({ timeout: 120_000 });

test.describe("public routes stay indexable", () => {
  for (const path of PUBLIC_PATHS) {
    test(`${path} has no noindex header or meta`, async ({ request, page }) => {
      const res = await getWithRetry(request, path);
      expect(res.status(), `${path} should be served directly`).toBe(200);

      const header = res.headers()["x-robots-tag"];
      expect(header, `${path} must not send X-Robots-Tag (got "${header}")`).toBeUndefined();

      const metas = robotsMetaFromHtml(await res.text());
      expect(metas.join(" | "), `${path} SSR HTML must not contain noindex`).not.toMatch(
        /noindex/i,
      );

      // Rendered (post-hydration) DOM must agree with the SSR HTML.
      await gotoWithRetry(page, path);
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
      const res = await getWithRetry(request, path);
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

      await gotoWithRetry(page, path);
      const landed = new URL(page.url()).pathname;
      if (landed === normalizePath(path)) {
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

test("every sitemap URL is allowlisted and header-clean", async ({ request }) => {
  const res = await getWithRetry(request, "/sitemap.xml");
  expect(res.status()).toBe(200);
  const locs = [...(await res.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  expect(locs.length, "sitemap must list URLs").toBeGreaterThan(0);

  for (const loc of locs) {
    expect(loc, "sitemap URLs must use the canonical origin").toContain(BASE_URL);
    const path = normalizePath(loc);
    expect(isCrawlablePath(path), `${path} is in the sitemap but not allowlisted`).toBe(true);

    const page = await getWithRetry(request, path);
    expect(page.status(), `${path} from sitemap must return 200`).toBe(200);
    expect(
      page.headers()["x-robots-tag"],
      `${path} is in the sitemap but sends X-Robots-Tag`,
    ).toBeUndefined();
  }
});

test("robots.txt and sitemap.xml stay crawlable", async ({ request }) => {
  for (const path of ["/robots.txt", "/sitemap.xml"]) {
    const res = await getWithRetry(request, path);
    expect(res.status(), `${path} should return 200`).toBe(200);
    expect(res.headers()["x-robots-tag"], `${path} must not be noindexed`).toBeUndefined();
  }
});
