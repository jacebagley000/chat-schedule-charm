import { createFileRoute, HeadContent } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { pageMeta, canonicalLink } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getIndexCoverage } from "@/lib/search-console.functions";

export const Route = createFileRoute("/_authenticated/admin/index-coverage")({
  head: () => ({
    meta: pageMeta({
      title: "Index coverage — FrontDesk AI",
      description:
        "How many allowlisted routes Google has indexed compared with the submitted sitemap.",
      path: "/admin/index-coverage",
      noindex: true,
    }),
    links: [canonicalLink("/admin/index-coverage")],
  }),
  component: IndexCoveragePage,
});

function CountCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold tracking-tight">{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function formatTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function IndexCoveragePage() {
  const fetchCoverage = useServerFn(getIndexCoverage);

  const coverage = useMutation({
    mutationFn: () => fetchCoverage({ data: {} }),
    onError: (error: Error) => toast.error(error.message),
  });

  const { mutate } = coverage;
  useEffect(() => {
    mutate();
  }, [mutate]);

  const data = coverage.data;
  const rows = data?.urls ?? [];
  const indexedCount = rows.filter((r) => r.indexed).length;
  const allowlistCount = data?.allowlistUrls.length ?? 0;
  const missingFromSitemap = rows.filter((r) => !r.inSitemap).length;

  return (
    <div className="container mx-auto max-w-5xl p-6">
      <HeadContent />

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Index coverage</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Allowlisted routes compared against what Google reports for the submitted
            sitemap. Last checked {formatTime(data?.checkedAt)}.
          </p>
        </div>
        <Button onClick={() => coverage.mutate()} disabled={coverage.isPending}>
          <RefreshCw
            className={`mr-2 h-4 w-4 ${coverage.isPending ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          {coverage.isPending ? "Refreshing…" : "Refresh"}
        </Button>
      </header>

      {data && data.resolution.status !== "selected" ? (
        <Card className="mb-6">
          <CardContent className="p-6 text-sm text-muted-foreground">
            {data.resolution.status === "no_property"
              ? "No verified Search Console property covers this site yet."
              : "Several verified properties cover this site — pick one on the Search Console page first."}
          </CardContent>
        </Card>
      ) : null}

      <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CountCard label="Allowlisted routes" value={allowlistCount} hint="From robots-rules.json" />
        <CountCard
          label="Indexed by Google"
          value={`${indexedCount} / ${allowlistCount}`}
          hint="URL Inspection verdict"
        />
        <CountCard
          label="Sitemap submitted"
          value={data?.sitemapTotals?.submitted ?? "—"}
          hint={`Last read ${formatTime(data?.sitemapTotals?.lastDownloaded)}`}
        />
        <CountCard
          label="Sitemap errors"
          value={data?.sitemapTotals?.errors ?? "—"}
          hint={`${data?.sitemapTotals?.warnings ?? 0} warnings`}
        />
      </section>

      {missingFromSitemap > 0 ? (
        <p className="mb-4 text-sm text-destructive">
          {missingFromSitemap} allowlisted route
          {missingFromSitemap === 1 ? " is" : "s are"} not attributed to the submitted
          sitemap.
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Index status of each allowlisted route
          </caption>
          <thead className="bg-muted/50 text-left">
            <tr>
              <th scope="col" className="p-3 font-medium">URL</th>
              <th scope="col" className="p-3 font-medium">Index status</th>
              <th scope="col" className="p-3 font-medium">In sitemap</th>
              <th scope="col" className="p-3 font-medium">Robots</th>
              <th scope="col" className="p-3 font-medium">Last crawled</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  {coverage.isPending ? "Checking Google…" : "No data yet."}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.url} className="border-t">
                  <td className="p-3 font-mono text-xs break-all">{row.url}</td>
                  <td className="p-3">
                    <Badge variant={row.indexed ? "default" : "secondary"}>
                      {row.error ?? row.coverageState}
                    </Badge>
                  </td>
                  <td className="p-3">{row.inSitemap ? "Yes" : "No"}</td>
                  <td className="p-3 text-xs text-muted-foreground">{row.robotsTxtState}</td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {formatTime(row.lastCrawlTime)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
