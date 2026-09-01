import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BASE_URL, sitemapUrls, renderRobotsTxt } from "@/lib/public-routes";

const GATEWAY = "https://connector-gateway.lovable.dev/google_search_console";

const ORIGIN = BASE_URL.replace(/\/$/, "");
export const SITEMAP_URL = `${ORIGIN}/sitemap.xml`;
export const ROBOTS_URL = `${ORIGIN}/robots.txt`;

type SiteEntry = { siteUrl: string; permissionLevel?: string };

export type SiteResolution =
  | { status: "selected"; siteUrl: string }
  | { status: "selection_required"; candidates: string[] }
  | { status: "no_property" };

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(`Role check failed: ${error.message}`);
  if (!isAdmin) throw new Error("Forbidden");
}

function gatewayHeaders() {
  const lovableApiKey = process.env["LOVABLE_API_KEY"];
  const connectionApiKey = process.env["GOOGLE_SEARCH_CONSOLE_API_KEY"];
  if (!lovableApiKey || !connectionApiKey) {
    throw new Error("Search Console is not connected for this project");
  }
  return {
    Authorization: `Bearer ${lovableApiKey}`,
    "X-Connection-Api-Key": connectionApiKey,
  };
}

function coversTarget(siteUrl: string, target: URL) {
  if (siteUrl.startsWith("sc-domain:")) {
    const domain = siteUrl.slice("sc-domain:".length).toLowerCase();
    const host = target.hostname.toLowerCase();
    return host === domain || host.endsWith(`.${domain}`);
  }
  try {
    return target.href.startsWith(new URL(siteUrl).href);
  } catch {
    return false;
  }
}

async function listVerifiedMatches(): Promise<string[]> {
  const response = await fetch(`${GATEWAY}/webmasters/v3/sites`, {
    headers: gatewayHeaders(),
  });
  if (!response.ok) {
    const body = await response.text();
    console.error(`Search Console /sites failed [${response.status}]: ${body}`);
    throw new Error(`Could not list Search Console properties [${response.status}]: ${body}`);
  }
  const { siteEntry = [] } = (await response.json()) as { siteEntry?: SiteEntry[] };
  const target = new URL(SITEMAP_URL);
  return siteEntry
    .filter((e) => e.permissionLevel !== "siteUnverifiedUser" && coversTarget(e.siteUrl, target))
    .map((e) => e.siteUrl);
}

async function resolveSiteUrl(selected?: string): Promise<SiteResolution> {
  const matches = await listVerifiedMatches();
  if (selected) {
    if (!matches.includes(selected)) {
      throw new Error("The selected Search Console property is not verified for this site");
    }
    return { status: "selected", siteUrl: selected };
  }
  if (matches.length === 0) return { status: "no_property" };
  if (matches.length === 1) return { status: "selected", siteUrl: matches[0] };
  return { status: "selection_required", candidates: matches };
}

type SitemapStatus = {
  path: string;
  lastSubmitted?: string;
  lastDownloaded?: string;
  isPending?: boolean;
  warnings?: string;
  errors?: string;
  contents?: { type?: string; submitted?: string; indexed?: string }[];
};

async function fetchSitemapStatus(siteUrl: string) {
  const path = `${GATEWAY}/webmasters/v3/sites/${encodeURIComponent(
    siteUrl,
  )}/sitemaps/${encodeURIComponent(SITEMAP_URL)}`;
  const response = await fetch(path, { headers: gatewayHeaders() });
  if (response.status === 404) return null;
  if (!response.ok) {
    const body = await response.text();
    console.error(`Sitemap status failed [${response.status}]: ${body}`);
    throw new Error(`Sitemap status request failed [${response.status}]: ${body}`);
  }
  return (await response.json()) as SitemapStatus;
}

const selectionInput = (d: unknown) =>
  z.object({ siteUrl: z.string().max(300).optional() }).parse(d ?? {});

export const getSitemapSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(selectionInput)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const resolution = await resolveSiteUrl(data.siteUrl);
    if (resolution.status !== "selected") {
      return { sitemapUrl: SITEMAP_URL, resolution, status: null };
    }
    const status = await fetchSitemapStatus(resolution.siteUrl);
    return { sitemapUrl: SITEMAP_URL, resolution, status };
  });

export const submitSitemap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(selectionInput)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const resolution = await resolveSiteUrl(data.siteUrl);
    if (resolution.status !== "selected") {
      return { sitemapUrl: SITEMAP_URL, resolution, status: null, submitted: false };
    }

    const response = await fetch(
      `${GATEWAY}/webmasters/v3/sites/${encodeURIComponent(
        resolution.siteUrl,
      )}/sitemaps/${encodeURIComponent(SITEMAP_URL)}`,
      { method: "PUT", headers: gatewayHeaders() },
    );
    if (!response.ok) {
      const body = await response.text();
      console.error(`Sitemap submit failed [${response.status}]: ${body}`);
      throw new Error(`Sitemap submission failed [${response.status}]: ${body}`);
    }

    const status = await fetchSitemapStatus(resolution.siteUrl);
    return { sitemapUrl: SITEMAP_URL, resolution, status, submitted: true };
  });

/** Live check of the two files Google fetches, plus expected/actual URL sync. */
export const getLiveCrawlFiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);

    const expectedUrls = sitemapUrls();

    async function probe(url: string) {
      try {
        const res = await fetch(url, { headers: { "User-Agent": "FrontDeskAI-CrawlCheck" } });
        const body = await res.text();
        return { url, ok: res.ok, status: res.status, body };
      } catch (error) {
        return { url, ok: false, status: 0, body: "", error: (error as Error).message };
      }
    }

    const [sitemap, robots] = await Promise.all([probe(SITEMAP_URL), probe(ROBOTS_URL)]);

    const liveUrls = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    const missingFromLive = expectedUrls.filter((u) => !liveUrls.includes(u));
    const extraInLive = liveUrls.filter((u) => !expectedUrls.includes(u));
    const robotsMatchesGenerated = robots.body.trim() === renderRobotsTxt().trim();
    const robotsReferencesSitemap = robots.body.includes(SITEMAP_URL);

    return {
      sitemap: {
        url: sitemap.url,
        ok: sitemap.ok,
        status: sitemap.status,
        urlCount: liveUrls.length,
        error: (sitemap as { error?: string }).error ?? null,
      },
      robots: {
        url: robots.url,
        ok: robots.ok,
        status: robots.status,
        matchesGenerated: robotsMatchesGenerated,
        referencesSitemap: robotsReferencesSitemap,
        error: (robots as { error?: string }).error ?? null,
      },
      expectedUrls,
      missingFromLive,
      extraInLive,
      checkedAt: new Date().toISOString(),
    };
  });

export type UrlIndexState = {
  url: string;
  verdict: string;
  coverageState: string;
  robotsTxtState: string;
  pageFetchState: string;
  lastCrawlTime: string | null;
  inSitemap: boolean;
  indexed: boolean;
  error: string | null;
};

async function inspectUrl(siteUrl: string, inspectionUrl: string): Promise<UrlIndexState> {
  const base: UrlIndexState = {
    url: inspectionUrl,
    verdict: "UNKNOWN",
    coverageState: "Unknown",
    robotsTxtState: "UNKNOWN",
    pageFetchState: "UNKNOWN",
    lastCrawlTime: null,
    inSitemap: false,
    indexed: false,
    error: null,
  };
  try {
    const response = await fetch(`${GATEWAY}/v1/urlInspection/index:inspect`, {
      method: "POST",
      headers: { ...gatewayHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ inspectionUrl, siteUrl }),
    });
    if (!response.ok) {
      const body = await response.text();
      console.error(`URL inspection failed [${response.status}]: ${body}`);
      return { ...base, error: `Inspection failed [${response.status}]` };
    }
    const json = (await response.json()) as {
      inspectionResult?: {
        indexStatusResult?: {
          verdict?: string;
          coverageState?: string;
          robotsTxtState?: string;
          pageFetchState?: string;
          lastCrawlTime?: string;
          sitemap?: string[];
        };
      };
    };
    const r = json.inspectionResult?.indexStatusResult ?? {};
    return {
      ...base,
      verdict: r.verdict ?? "UNKNOWN",
      coverageState: r.coverageState ?? "Unknown",
      robotsTxtState: r.robotsTxtState ?? "UNKNOWN",
      pageFetchState: r.pageFetchState ?? "UNKNOWN",
      lastCrawlTime: r.lastCrawlTime ?? null,
      inSitemap: (r.sitemap ?? []).includes(SITEMAP_URL),
      indexed: r.verdict === "PASS",
    };
  } catch (error) {
    return { ...base, error: (error as Error).message };
  }
}

/** Per-URL index coverage for every allowlisted sitemap URL, plus sitemap totals. */
export const getIndexCoverage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(selectionInput)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const allowlistUrls = sitemapUrls();
    const resolution = await resolveSiteUrl(data.siteUrl);
    if (resolution.status !== "selected") {
      return {
        resolution,
        sitemapUrl: SITEMAP_URL,
        allowlistUrls,
        urls: [] as UrlIndexState[],
        sitemapTotals: null,
        checkedAt: new Date().toISOString(),
      };
    }

    const siteUrl = resolution.siteUrl;
    const urls: UrlIndexState[] = [];
    // Small batches keep us well inside Search Console's inspection quota.
    for (let i = 0; i < allowlistUrls.length; i += 3) {
      const batch = allowlistUrls.slice(i, i + 3);
      urls.push(...(await Promise.all(batch.map((u) => inspectUrl(siteUrl, u)))));
    }

    const status = await fetchSitemapStatus(siteUrl);
    const web = status?.contents?.find((c) => c.type === "web") ?? status?.contents?.[0];

    return {
      resolution,
      sitemapUrl: SITEMAP_URL,
      allowlistUrls,
      urls,
      sitemapTotals: status
        ? {
            submitted: Number(web?.submitted ?? 0),
            indexed: Number(web?.indexed ?? 0),
            lastSubmitted: status.lastSubmitted ?? null,
            lastDownloaded: status.lastDownloaded ?? null,
            errors: Number(status.errors ?? 0),
            warnings: Number(status.warnings ?? 0),
          }
        : null,
      checkedAt: new Date().toISOString(),
    };
  });

export type DailyCrawlRow = UrlIndexState & {
  /** HTTP status returned by fetching the live URL right now. */
  httpStatus: number | null;
  httpError: string | null;
  /** True when Google reports a crawl within the report window. */
  crawledToday: boolean;
  /** Bucket used for grouping in the daily report UI. */
  bucket: "indexed" | "crawled_not_indexed" | "not_crawled" | "missing" | "error";
};

async function probeUrl(url: string): Promise<{ status: number | null; error: string | null }> {
  try {
    const res = await fetch(url, { method: "GET", redirect: "manual" });
    return { status: res.status, error: null };
  } catch (error) {
    return { status: null, error: (error as Error).message };
  }
}

/**
 * Daily crawl report: for every allowlisted sitemap URL, what Google crawled and
 * indexed, and which URLs return 404 (or another non-200) on the live site.
 */
export const getDailyCrawlReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ siteUrl: z.string().max(300).optional(), windowHours: z.number().min(1).max(720).optional() })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const windowHours = data.windowHours ?? 24;
    const allowlistUrls = sitemapUrls();
    const generatedAt = new Date();
    const cutoff = generatedAt.getTime() - windowHours * 3600_000;

    const resolution = await resolveSiteUrl(data.siteUrl);
    const siteUrl = resolution.status === "selected" ? resolution.siteUrl : null;

    const rows: DailyCrawlRow[] = [];
    for (let i = 0; i < allowlistUrls.length; i += 3) {
      const batch = allowlistUrls.slice(i, i + 3);
      const results = await Promise.all(
        batch.map(async (url) => {
          const [inspection, probe] = await Promise.all([
            siteUrl
              ? inspectUrl(siteUrl, url)
              : Promise.resolve({
                  url,
                  verdict: "UNKNOWN",
                  coverageState: "No verified property",
                  robotsTxtState: "UNKNOWN",
                  pageFetchState: "UNKNOWN",
                  lastCrawlTime: null,
                  inSitemap: false,
                  indexed: false,
                  error: null,
                } as UrlIndexState),
            probeUrl(url),
          ]);

          const crawledAt = inspection.lastCrawlTime
            ? new Date(inspection.lastCrawlTime).getTime()
            : null;
          const crawledToday = crawledAt !== null && crawledAt >= cutoff;

          let bucket: DailyCrawlRow["bucket"];
          if (probe.status !== null && probe.status >= 400) bucket = "missing";
          else if (inspection.error || probe.error) bucket = "error";
          else if (inspection.indexed) bucket = "indexed";
          else if (crawledAt !== null) bucket = "crawled_not_indexed";
          else bucket = "not_crawled";

          return {
            ...inspection,
            httpStatus: probe.status,
            httpError: probe.error,
            crawledToday,
            bucket,
          } satisfies DailyCrawlRow;
        }),
      );
      rows.push(...results);
    }

    const status = siteUrl ? await fetchSitemapStatus(siteUrl) : null;

    return {
      resolution,
      sitemapUrl: SITEMAP_URL,
      generatedAt: generatedAt.toISOString(),
      windowHours,
      rows,
      totals: {
        total: rows.length,
        indexed: rows.filter((r) => r.bucket === "indexed").length,
        crawledNotIndexed: rows.filter((r) => r.bucket === "crawled_not_indexed").length,
        notCrawled: rows.filter((r) => r.bucket === "not_crawled").length,
        missing: rows.filter((r) => r.bucket === "missing").length,
        errors: rows.filter((r) => r.bucket === "error").length,
        crawledInWindow: rows.filter((r) => r.crawledToday).length,
      },
      lastSubmitted: status?.lastSubmitted ?? null,
      lastDownloaded: status?.lastDownloaded ?? null,
    };
  });
