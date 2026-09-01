import { createFileRoute, HeadContent, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo } from "react";
import { RefreshCw, RotateCw, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { pageMeta, canonicalLink } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getIndexCoverage,
  submitSitemap,
  type UrlIndexState,
} from "@/lib/search-console.functions";

export const Route = createFileRoute("/_authenticated/admin/index-gap")({
  head: () => ({
    meta: pageMeta({
      title: "Indexing gap report — FrontDesk AI",
      description:
        "Which allowlisted routes Google actually indexes, why the rest are missing, and a re-crawl nudge.",
      path: "/admin/index-gap",
      noindex: true,
    }),
    links: [canonicalLink("/admin/index-gap")],
  }),
  component: IndexGapPage,
});

function formatTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

/** Plain-language reason a URL is not in Google's index yet. */
function gapReason(row: UrlIndexState): string {
  if (row.error) return "Inspection failed";
  if (row.robotsTxtState && row.robotsTxtState !== "ALLOWED") return "Blocked by robots.txt";
  if (row.pageFetchState === "SOFT_404" || row.pageFetchState === "NOT_FOUND")
    return "Page not reachable";
  if (row.pageFetchState && !["SUCCESSFUL", "UNKNOWN"].includes(row.pageFetchState))
    return "Fetch problem";
  if (!row.inSitemap) return "Not attributed to sitemap";
  if (row.lastCrawlTime) return "Crawled, not indexed yet";
  return "Discovered, not crawled yet";
}

function SearchConsoleUrl({ url }: { url: string }) {
  return (
    <a
      className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
      href={`https://search.google.com/search-console/inspect?resource_id=${encodeURIComponent(
        new URL(url).origin + "/",
      )}&id=${encodeURIComponent(url)}`}
      target="_blank"
      rel="noreferrer"
    >
      Inspect
      <ExternalLink className="h-3 w-3" aria-hidden="true" />
    </a>
  );
}

function IndexGapPage() {
  const fetchCoverage = useServerFn(getIndexCoverage);
  const resubmit = useServerFn(submitSitemap);

  const coverage = useMutation({
    mutationFn: () => fetchCoverage({ data: {} }),
    onError: (error: Error) => toast.error(error.message),
  });

  const recrawl = useMutation({
    mutationFn: async () => {
      const result = await resubmit({ data: {} });
      await coverage.mutateAsync();
      return result;
    },
    onSuccess: (result) =>
      result.submitted
        ? toast.success("Sitemap resubmitted — Google will re-crawl these URLs.")
        : toast.error("No verified property to resubmit to."),
    onError: (error: Error) => toast.error(error.message),
  });

  const { mutate } = coverage;
  useEffect(() => {
    mutate();
  }, [mutate]);

  const data = coverage.data;
  const rows = useMemo(() => data?.urls ?? [], [data]);
  const indexed = rows.filter((r) => r.indexed);
  const gaps = rows.filter((r) => !r.indexed);

  const byReason = useMemo(() => {
    const groups = new Map<string, UrlIndexState[]>();
    for (const row of gaps) {
      const reason = gapReason(row);
      groups.set(reason, [...(groups.get(reason) ?? []), row]);
    }
    return [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [gaps]);

  const busy = coverage.isPending || recrawl.isPending;

  return (
    <div className="container mx-auto max-w-5xl p-6">
      <HeadContent />

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Indexing gap report</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Allowlisted routes Google actually indexes versus the ones still missing, with
            the reason for each gap. Last checked {formatTime(data?.checkedAt)}.{" "}
            <Link to="/admin/index-coverage" className="text-primary hover:underline">
              Full coverage table
            </Link>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => coverage.mutate()} disabled={busy}>
            <RefreshCw
              className={`mr-2 h-4 w-4 ${coverage.isPending ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            Refresh
          </Button>
          <Button onClick={() => recrawl.mutate()} disabled={busy}>
            <RotateCw
              className={`mr-2 h-4 w-4 ${recrawl.isPending ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            {recrawl.isPending ? "Requesting…" : "Request re-crawl"}
          </Button>
        </div>
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

      <section className="mb-6 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Allowlisted", value: data?.allowlistUrls.length ?? 0, hint: "Routes in sitemap.xml" },
          { label: "Indexed", value: indexed.length, hint: "URL Inspection verdict PASS" },
          { label: "Gap", value: gaps.length, hint: "Allowlisted but not indexed" },
        ].map((card) => (
          <Card key={card.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tracking-tight">{card.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{card.hint}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-lg font-semibold">Gap by reason</h2>
        {byReason.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {busy ? "Checking Google…" : "No gaps — every allowlisted route is indexed."}
          </p>
        ) : (
          <div className="space-y-4">
            {byReason.map(([reason, urls]) => (
              <Card key={reason}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    {reason}
                    <Badge variant="secondary">{urls.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {urls.map((row) => (
                    <div
                      key={row.url}
                      className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-sm first:border-t-0 first:pt-0"
                    >
                      <span className="font-mono text-xs break-all">{row.url}</span>
                      <span className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{row.error ?? row.coverageState}</span>
                        <span>crawled {formatTime(row.lastCrawlTime)}</span>
                        <SearchConsoleUrl url={row.url} />
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Indexed routes</h2>
        {indexed.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {busy ? "Checking Google…" : "Google reports no indexed allowlisted routes yet."}
          </p>
        ) : (
          <ul className="space-y-1 rounded-lg border p-4">
            {indexed.map((row) => (
              <li key={row.url} className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-mono text-xs break-all">{row.url}</span>
                <Badge>{row.coverageState}</Badge>
                <span className="text-xs text-muted-foreground">
                  crawled {formatTime(row.lastCrawlTime)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-6 text-xs text-muted-foreground">
        “Request re-crawl” resubmits sitemap.xml, which is the only re-crawl signal the
        Search Console API can send. Per-URL “Request indexing” is only available inside
        Search Console — use the Inspect link on a row for that.
      </p>
    </div>
  );
}
