import { createFileRoute, HeadContent, Link } from "@tanstack/react-router";
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
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium">{title}</h2>
        <Badge variant={resource.ok ? "secondary" : "destructive"}>
          {resource.status ?? "error"}
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
    </div>
  );
}

function CrawlDashboardPage() {
  const load = useServerFn(getCrawlStatus);
  const { data, isFetching, isError, error, refetch } = useQuery({
    queryKey: ["crawl-status"],
    queryFn: () => load({ data: {} }),
    retry: false,
  });

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

          <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              {data.healthy} of {data.total} allowlisted routes healthy
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="font-mono text-xs text-muted-foreground">{data.origin}</span>
            <Link
              to="/admin/search-console"
              className="text-sm underline underline-offset-4"
            >
              Search Console submission
            </Link>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Allowlisted route crawl status</caption>
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3">Route</th>
                  <th scope="col" className="px-4 py-3">HTTP</th>
                  <th scope="col" className="px-4 py-3">In sitemap</th>
                  <th scope="col" className="px-4 py-3">robots.txt</th>
                  <th scope="col" className="px-4 py-3">X-Robots-Tag</th>
                  <th scope="col" className="px-4 py-3">Meta robots</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.routes.map((r) => (
                  <tr key={r.path} className="border-t border-border align-top">
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
