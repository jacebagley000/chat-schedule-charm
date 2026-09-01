import { createFileRoute, HeadContent, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { pageMeta, canonicalLink } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getCrawlStatus, type ResourceStatus } from "@/lib/crawl-status.functions";

export const Route = createFileRoute("/_authenticated/admin/crawl-dashboard")({
  head: () => ({
    meta: pageMeta({
      title: "Crawlability dashboard — FrontDesk AI",
      description:
        "Live status of robots.txt, sitemap.xml and every allowlisted route, with a refresh button.",
      path: "/admin/crawl-dashboard",
      noindex: true,
    }),
    links: [canonicalLink("/admin/crawl-dashboard")],
  }),
  component: CrawlDashboardPage,
});

function ResourceCard({ title, resource, extra }: {
  title: string;
  resource: ResourceStatus;
  extra?: string;
}) {
  const failing = resource.checks.filter((c) => !c.ok);
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium">{title}</h2>
        <Badge variant={resource.ok && failing.length === 0 ? "secondary" : "destructive"}>
          {resource.error ? "error" : `${resource.status ?? "—"}`}
        </Badge>
      </div>
      <a
        href={resource.path}
        target="_blank"
        rel="noreferrer"
        className="mt-2 block font-mono text-xs underline underline-offset-4 break-all"
      >
        {resource.path}
      </a>
      <p className="mt-2 text-xs text-muted-foreground">
        {resource.error
          ? resource.error
          : `${resource.contentType ?? "unknown type"} · ${resource.bytes ?? 0} bytes${
              extra ? ` · ${extra}` : ""
            }`}
      </p>
      {resource.checks.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs">
          {resource.checks.map((c) => (
            <li key={c.label} className={c.ok ? "text-muted-foreground" : "text-destructive"}>
              {c.ok ? "✓" : "✗"} {c.label}
              {c.detail && !c.ok ? ` — ${c.detail}` : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CountCard({ label, value, tone }: {
  label: string;
  value: number;
  tone?: "bad";
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold ${
          tone === "bad" && value > 0 ? "text-destructive" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function CrawlDashboardPage() {
  const load = useServerFn(getCrawlStatus);
  const [onlyProblems, setOnlyProblems] = useState(false);
  const { data, isFetching, isError, error, refetch } = useQuery({
    queryKey: ["crawl-status"],
    queryFn: () => load(),
    retry: false,
  });
  const visibleRoutes = (data?.routes ?? []).filter(
    (r) => !onlyProblems || r.problems.length > 0,
  );

  return (
    <div className="container mx-auto max-w-5xl p-6">
      <HeadContent />

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Crawlability dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live status of robots.txt, sitemap.xml and every allowlisted route
            {data ? ` · checked ${new Date(data.checkedAt).toLocaleString()}` : ""}.
          </p>
        </div>
        <Button onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? "Refreshing…" : "Refresh"}
        </Button>
      </header>

      {isError && (
        <p className="mb-4 text-sm text-destructive">{(error as Error).message}</p>
      )}

      {!data && isFetching && (
        <p className="text-sm text-muted-foreground">Checking routes…</p>
      )}

      {data && (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2">
            <ResourceCard title="robots.txt" resource={data.robotsTxt} />
            <ResourceCard
              title="sitemap.xml"
              resource={data.sitemapXml}
              extra={`${data.sitemapLocCount} URLs`}
            />
          </div>

          <div className="mb-6 grid gap-4 sm:grid-cols-4">
            <CountCard label="Passing" value={data.healthy} />
            <CountCard label="Contradictions" value={data.failed} tone="bad" />
            <CountCard label="Public failing" value={data.publicFailed} tone="bad" />
            <CountCard label="Private failing" value={data.privateFailed} tone="bad" />
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              {data.healthy} of {data.total} checked paths pass ({data.publicPassed} public,{" "}
              {data.privatePassed} private)
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="font-mono text-xs text-muted-foreground">{data.origin}</span>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={onlyProblems}
                onChange={(e) => setOnlyProblems(e.target.checked)}
              />
              Only contradictions
            </label>
            <Link
              to="/admin/search-console"
              className="text-sm underline underline-offset-4"
            >
              Search Console submission
            </Link>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Live crawl status per path</caption>
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3">Route</th>
                  <th scope="col" className="px-4 py-3">Kind</th>
                  <th scope="col" className="px-4 py-3">HTTP</th>
                  <th scope="col" className="px-4 py-3">In sitemap</th>
                  <th scope="col" className="px-4 py-3">robots.txt</th>
                  <th scope="col" className="px-4 py-3">X-Robots-Tag</th>
                  <th scope="col" className="px-4 py-3">Meta robots</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleRoutes.map((r) => (
                  <tr key={`${r.kind}:${r.path}`} className="border-t border-border align-top">
                    <td className="px-4 py-3 font-mono text-xs">
                      <a
                        href={r.path}
                        target="_blank"
                        rel="noreferrer"
                        className="underline underline-offset-4"
                      >
                        {r.path}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-xs capitalize">{r.kind}</td>

                    <td className="px-4 py-3">{r.status ?? "—"}</td>
                    <td className="px-4 py-3">{r.inSitemap ? "Yes" : "No"}</td>
                    <td className="px-4 py-3">{r.robotsAllowed ? "Allowed" : "Disallowed"}</td>
                    <td className="px-4 py-3 text-xs">{r.xRobotsTag ?? "—"}</td>
                    <td className="px-4 py-3 text-xs">{r.metaRobots ?? "—"}</td>
                    <td className="px-4 py-3">
                      {r.problems.length === 0 ? (
                        <Badge variant="secondary">OK</Badge>
                      ) : (
                        <span className="text-xs text-destructive">
                          {r.problems.join("; ")}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
