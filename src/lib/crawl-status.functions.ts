import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  PUBLIC_ROUTES,
  PRIVATE_PREFIXES,
  hasPublicRobots,
  normalizePath,
  robotsPolicyFor,
  renderRobotsTxt,
  sitemapPaths,
} from "@/lib/public-routes";

export interface ResourceStatus {
  path: string;
  url: string;
  ok: boolean;
  status: number | null;
  contentType: string | null;
  bytes: number | null;
  /** Checks derived from the live body vs. the generated config. */
  checks: { label: string; ok: boolean; detail?: string }[];
  error?: string;
}

export interface RouteStatus {
  path: string;
  kind: "public" | "private";
  status: number | null;
  xRobotsTag: string | null;
  metaRobots: string | null;
  inSitemap: boolean;
  robotsAllowed: boolean;
  problems: string[];
  error?: string;
}

export interface CrawlStatusReport {
  origin: string;
  checkedAt: string;
  robotsTxt: ResourceStatus;
  sitemapXml: ResourceStatus;
  sitemapLocCount: number;
  routes: RouteStatus[];
  healthy: number;
  failed: number;
  total: number;
  publicPassed: number;
  publicFailed: number;
  privatePassed: number;
  privateFailed: number;
}


async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(`Role check failed: ${error.message}`);
  if (!isAdmin) throw new Error("Forbidden");
}

async function fetchResource(
  origin: string,
  path: string,
  check?: (body: string) => ResourceStatus["checks"],
): Promise<ResourceStatus> {
  const url = `${origin}${path}`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "FrontDeskAI-AdminCheck" } });
    const body = await res.text();
    return {
      path,
      url,
      ok: res.ok,
      status: res.status,
      contentType: res.headers.get("content-type"),
      bytes: body.length,
      checks: res.ok && check ? check(body) : [],
    };
  } catch (e) {
    return {
      path,
      url,
      ok: false,
      status: null,
      contentType: null,
      bytes: null,
      checks: [],
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

function extractMetaRobots(html: string): string | null {
  const match = html.match(
    /<meta[^>]+name=["']robots["'][^>]*content=["']([^"']*)["'][^>]*>/i,
  );
  return match ? match[1].toLowerCase() : null;
}

export const getCrawlStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CrawlStatusReport> => {
    await assertAdmin(context as never);

    const { getRequest } = await import("@tanstack/react-start/server");
    const origin = new URL(getRequest().url).origin;

    const expectedRobots = renderRobotsTxt();
    const expectedPaths = sitemapPaths();

    const [robotsTxt, sitemapXml] = await Promise.all([
      fetchResource(origin, "/robots.txt", (body) => {
        const norm = (s: string) =>
          s.split("\n").map((l) => l.trim()).filter(Boolean).join("\n");
        return [
          {
            label: "Matches generated rules",
            ok: norm(body) === norm(expectedRobots),
            detail: "Live robots.txt is byte-equivalent to the allowlist output",
          },
          {
            label: "References sitemap.xml",
            ok: /^\s*Sitemap:.*sitemap\.xml\s*$/im.test(body),
          },
        ];
      }),
      fetchResource(origin, "/sitemap.xml", (body) => {
        const locs = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => {
          try {
            return normalizePath(new URL(m[1]).pathname);
          } catch {
            return m[1];
          }
        });
        const missing = expectedPaths.filter((p) => !locs.includes(p));
        const extra = locs.filter((p) => !expectedPaths.includes(p));
        return [
          {
            label: "Every allowlisted path present",
            ok: missing.length === 0,
            detail: missing.length ? `Missing: ${missing.join(", ")}` : undefined,
          },
          {
            label: "No non-allowlisted URLs",
            ok: extra.length === 0,
            detail: extra.length ? `Unexpected: ${extra.join(", ")}` : undefined,
          },
        ];
      }),
    ]);

    let sitemapLocCount = 0;
    try {
      const res = await fetch(`${origin}/sitemap.xml`);
      const xml = await res.text();
      sitemapLocCount = (xml.match(/<loc>/g) ?? []).length;
    } catch {
      sitemapLocCount = 0;
    }

    async function probe(path: string, kind: "public" | "private"): Promise<RouteStatus> {
      const inSitemap = kind === "public" && expectedPaths.includes(path);
      const robotsAllowed = robotsPolicyFor(path).crawlable;
      const problems: string[] = [];

      try {
        const res = await fetch(`${origin}${path}`, {
          headers: { "User-Agent": "FrontDeskAI-AdminCheck" },
        });
        const html = res.headers.get("content-type")?.includes("text/html")
          ? await res.text()
          : "";
        const xRobotsTag = res.headers.get("x-robots-tag");
        const metaRobots = extractMetaRobots(html);
        const headerNoindex = /noindex|none/.test(xRobotsTag ?? "");
        const metaNoindex = /noindex|none/.test(metaRobots ?? "");

        if (kind === "public") {
          if (res.status !== 200) problems.push(`HTTP ${res.status}`);
          if (inSitemap && !robotsAllowed) problems.push("In sitemap but robots-disallowed");
          if (inSitemap && headerNoindex) problems.push(`X-Robots-Tag: ${xRobotsTag}`);
          if (inSitemap && metaNoindex) problems.push(`meta robots: ${metaRobots}`);
        } else {
          if (robotsAllowed) problems.push("Private path is robots-allowed");
          if (!headerNoindex) problems.push("Missing X-Robots-Tag: noindex");
        }

        return {
          path,
          kind,
          status: res.status,
          xRobotsTag,
          metaRobots,
          inSitemap,
          robotsAllowed,
          problems,
        };
      } catch (e) {
        return {
          path,
          kind,
          status: null,
          xRobotsTag: null,
          metaRobots: null,
          inSitemap,
          robotsAllowed,
          problems: ["Request failed"],
          error: e instanceof Error ? e.message : String(e),
        };
      }
    }

    const routes = await Promise.all([
      ...PUBLIC_ROUTES.filter(hasPublicRobots).map((r) =>
        probe(normalizePath(r.path), "public"),
      ),
      ...PRIVATE_PREFIXES.map((p) => probe(normalizePath(p), "private")),
    ]);

    const pub = routes.filter((r) => r.kind === "public");
    const priv = routes.filter((r) => r.kind === "private");
    const passing = (list: RouteStatus[]) =>
      list.filter((r) => r.problems.length === 0).length;

    return {
      origin,
      checkedAt: new Date().toISOString(),
      robotsTxt,
      sitemapXml,
      sitemapLocCount,
      routes,
      healthy: passing(routes),
      failed: routes.length - passing(routes),
      total: routes.length,
      publicPassed: passing(pub),
      publicFailed: pub.length - passing(pub),
      privatePassed: passing(priv),
      privateFailed: priv.length - passing(priv),
    };
  });
