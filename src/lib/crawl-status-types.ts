/** Shared shapes for the live crawl health check (client- and server-safe). */

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

/** One thing that is currently broken, as shown in the UI and in alert emails. */
export interface CrawlFailure {
  label: string;
  detail: string;
}

export interface CrawlAlertSettings {
  recipientEmail: string;
  enabled: boolean;
  minIntervalMinutes: number;
  lastAlertAt: string | null;
}

export interface CrawlAlertEvent {
  id: string;
  recipientEmail: string;
  subject: string;
  failureCount: number;
  kind: string;
  ok: boolean;
  error: string | null;
  createdAt: string;
}

export interface CrawlAlertResult {
  /** Whether an email went out on this run. */
  sent: boolean;
  /** Why nothing was sent, when `sent` is false. */
  reason?:
    | "disabled"
    | "no-recipient"
    | "healthy"
    | "throttled"
    | "unchanged"
    | "send-failed";
  failures: CrawlFailure[];
  error?: string;
}

/** Everything currently failing in a crawl status report. */
export function collectFailures(report: CrawlStatusReport): CrawlFailure[] {
  const failures: CrawlFailure[] = [];

  for (const resource of [report.robotsTxt, report.sitemapXml]) {
    if (!resource.ok || resource.error) {
      failures.push({
        label: resource.path,
        detail: resource.error ?? `HTTP ${resource.status ?? "no response"}`,
      });
    }
    for (const check of resource.checks) {
      if (!check.ok) {
        failures.push({
          label: resource.path,
          detail: check.detail ? `${check.label} — ${check.detail}` : check.label,
        });
      }
    }
  }

  for (const route of report.routes) {
    if (route.problems.length > 0) {
      failures.push({ label: route.path, detail: route.problems.join("; ") });
    }
  }

  return failures;
}

/** Stable fingerprint so an unchanged failure set does not re-alert. */
export function failureSignature(failures: CrawlFailure[]): string {
  return failures
    .map((f) => `${f.label}::${f.detail}`)
    .sort()
    .join("|");
}
