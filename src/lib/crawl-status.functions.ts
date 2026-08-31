import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  PUBLIC_ROUTES,
  hasPublicRobots,
  normalizePath,
  robotsPolicyFor,
} from "@/lib/public-routes";

export interface ResourceStatus {
  path: string;
  url: string;
  ok: boolean;
  status: number | null;
  contentType: string | null;
  bytes: number | null;
  error?: string;
}

export interface RouteStatus {
  path: string;
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
  total: number;
}

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(`Role check failed: ${error.message}`);
  if (!isAdmin) throw new Error("Forbidden");
}

async function fetchResource(origin: string, path: string): Promise<ResourceStatus> {
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
    };
  } catch (e) {
    return {
      path,
      url,
      ok: false,
      status: null,
      contentType: null,
      bytes: null,
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

    const [robotsTxt, sitemapXml] = await Promise.all([
      fetchResource(origin, "/robots.txt"),
      fetchResource(origin, "/sitemap.xml"),
    ]);

    let sitemapLocCount = 0;
    try {
      const res = await fetch(`${origin}/sitemap.xml`);
      const xml = await res.text();
      sitemapLocCount = (xml.match(/<loc>/g) ?? []).length;
    } catch {
      sitemapLocCount = 0;
    }

    const routes = await Promise.all(
      PUBLIC_ROUTES.map(async (route): Promise<RouteStatus> => {
        const path = normalizePath(route.path);
        const inSitemap = hasPublicRobots(route);
        const policy = robotsPolicyFor(path);
        const robotsAllowed = policy.allowed ?? !policy.noindex;
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

          if (res.status !== 200) problems.push(`HTTP ${res.status}`);
          if (inSitemap && !robotsAllowed) problems.push("In sitemap but robots-disallowed");
          if (inSitemap && /noindex|none/.test(xRobotsTag ?? ""))
            problems.push(`X-Robots-Tag: ${xRobotsTag}`);
          if (inSitemap && /noindex|none/.test(metaRobots ?? ""))
            problems.push(`meta robots: ${metaRobots}`);

          return {
            path,
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
            status: null,
            xRobotsTag: null,
            metaRobots: null,
            inSitemap,
            robotsAllowed,
            problems: ["Request failed"],
            error: e instanceof Error ? e.message : String(e),
          };
        }
      }),
    );

    return {
      origin,
      checkedAt: new Date().toISOString(),
      robotsTxt,
      sitemapXml,
      sitemapLocCount,
      routes,
      healthy: routes.filter((r) => r.problems.length === 0).length,
      total: routes.length,
    };
  });
