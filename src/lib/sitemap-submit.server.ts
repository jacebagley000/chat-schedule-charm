/**
 * Server-only helper that submits the live sitemap.xml to Google Search Console
 * and records the attempt in public.sitemap_submission_runs.
 * Used by the daily cron hook route.
 */
import { BASE_URL } from "@/lib/public-routes";

const GATEWAY = "https://connector-gateway.lovable.dev/google_search_console";
const ORIGIN = BASE_URL.replace(/\/$/, "");
export const CRON_SITEMAP_URL = `${ORIGIN}/sitemap.xml`;

type SiteEntry = { siteUrl: string; permissionLevel?: string };

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

async function resolveSiteUrl(): Promise<string | null> {
  const response = await fetch(`${GATEWAY}/webmasters/v3/sites`, {
    headers: gatewayHeaders(),
  });
  if (!response.ok) {
    throw new Error(
      `Could not list Search Console properties [${response.status}]: ${await response.text()}`,
    );
  }
  const { siteEntry = [] } = (await response.json()) as { siteEntry?: SiteEntry[] };
  const target = new URL(CRON_SITEMAP_URL);
  const matches = siteEntry
    .filter((e) => e.permissionLevel !== "siteUnverifiedUser" && coversTarget(e.siteUrl, target))
    .map((e) => e.siteUrl);
  return matches[0] ?? null;
}

export type SubmissionRunResult = {
  success: boolean;
  siteUrl: string | null;
  sitemapUrl: string;
  message: string;
};

export async function runDailySitemapSubmission(
  source = "cron",
): Promise<SubmissionRunResult> {
  let result: SubmissionRunResult = {
    success: false,
    siteUrl: null,
    sitemapUrl: CRON_SITEMAP_URL,
    message: "",
  };

  try {
    const siteUrl = await resolveSiteUrl();
    if (!siteUrl) {
      result.message = "No verified Search Console property covers this site";
    } else {
      result.siteUrl = siteUrl;
      const response = await fetch(
        `${GATEWAY}/webmasters/v3/sites/${encodeURIComponent(
          siteUrl,
        )}/sitemaps/${encodeURIComponent(CRON_SITEMAP_URL)}`,
        { method: "PUT", headers: gatewayHeaders() },
      );
      if (!response.ok) {
        result.message = `Submission failed [${response.status}]: ${await response.text()}`;
      } else {
        result = { ...result, success: true, message: "Sitemap submitted" };
      }
    }
  } catch (error) {
    result.message = error instanceof Error ? error.message : String(error);
  }

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("sitemap_submission_runs").insert({
      source,
      site_url: result.siteUrl,
      sitemap_url: result.sitemapUrl,
      success: result.success,
      message: result.message,
    });
  } catch (error) {
    console.error("Failed to record sitemap submission run", error);
  }

  return result;
}
