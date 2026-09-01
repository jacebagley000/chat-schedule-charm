import { createFileRoute, HeadContent } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";
import { pageMeta, canonicalLink } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDailyCrawlReport, submitSitemap } from "@/lib/search-console.functions";
import type { DailyCrawlRow } from "@/lib/search-console.functions";

export const Route = createFileRoute("/_authenticated/admin/crawl-report")({
  head: () => ({
    meta: pageMeta({
      title: "Daily crawl report — FrontDesk AI",
      description:
        "Which allowlisted routes Google crawled and indexed today, and which return 404 on the live site.",
      path: "/admin/crawl-report",
      noindex: true,
    }),
    links: [canonicalLink("/admin/crawl-report")],
  }),
  component: CrawlReportPage,
});

const BUCKET_LABEL: Record<DailyCrawlRow["bucket"], string> = {
  indexed: "Indexed",
  crawled_not_indexed: "Crawled, not indexed",
  not_crawled: "Not crawled yet",
  missing: "404 / error page",
  error: "Check failed",
};

const BUCKET_VARIANT: Record<DailyCrawlRow["bucket"], "default" | "secondary" | "destructive" | "outline"> = {
  indexed: "default",
  crawled_not_indexed: "secondary",
  not_crawled: "outline",
  missing: "destructive",
  error: "destructive",
};

function CountCard({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
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

function CrawlReportPage() {
  const fetchReport = useServerFn(getDailyCrawlReport);
  const resend = useServerFn(submitSitemap);

  const report = useMutation({
    mutationFn: () => fetchReport({ data: {} }),
    onError: (error: Error) => toast.error(error.message),
  });

  const { mutate } = report;
  useEffect(() => {
    mutate();
  }, [mutate]);

  const resubmit = useMutation({
    mutationFn: () => resend({ data: {} }),
    onSuccess: (result) => {
      if (result.submitted) {
        toast.success("Sitemap resent to Google");
        mutate();
      } else {
        toast.error("No verified Search Console property to resend to");
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const data = report.data;
  const rows = data?.rows ?? [];
  const totals = data?.totals;

  return (
    <div className="container mx-auto max-w-5xl p-6">
      <HeadContent />

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Daily crawl report</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Allowlisted routes with Google&apos;s crawl and index state, plus a live check for
            404s. Generated {formatTime(data?.generatedAt)}.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => mutate()}
            disabled={report.isPending}
            aria-label="Refresh crawl report"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${report.isPending ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={() => resubmit.mutate()} disabled={resubmit.isPending}>
            <Send className="mr-2 h-4 w-4" />
            {resubmit.isPending ? "Resending…" : "Resend sitemap"}
          </Button>
        </div>
      </header>

      <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CountCard
          label="Crawled in last 24h"
          value={totals?.crawledInWindow ?? "—"}
          hint={`of ${totals?.total ?? 0} allowlisted routes`}
        />
        <CountCard label="Indexed" value={totals?.indexed ?? "—"} />
        <CountCard
          label="Crawled, not indexed"
          value={totals?.crawledNotIndexed ?? "—"}
          hint={`${totals?.notCrawled ?? 0} never crawled`}
        />
        <CountCard
          label="404 / errors"
          value={(totals?.missing ?? 0) + (totals?.errors ?? 0)}
          hint="live HTTP check"
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Routes</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {report.isPending && rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading crawl data…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No data yet. Connect a verified Search Console property, then refresh.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">URL</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">HTTP</th>
                  <th className="py-2 pr-4 font-medium">Last crawl</th>
                  <th className="py-2 font-medium">Coverage</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.url} className="border-b last:border-0 align-top">
                    <td className="py-2 pr-4 break-all">
                      <a
                        href={row.url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline underline-offset-2"
                      >
                        {new URL(row.url).pathname}
                      </a>
                    </td>
                    <td className="py-2 pr-4">
                      <Badge variant={BUCKET_VARIANT[row.bucket]}>{BUCKET_LABEL[row.bucket]}</Badge>
                    </td>
                    <td className="py-2 pr-4">{row.httpStatus ?? row.httpError ?? "—"}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{formatTime(row.lastCrawlTime)}</td>
                    <td className="py-2 text-muted-foreground">
                      {row.error ?? row.coverageState}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <p className="mt-4 text-xs text-muted-foreground">
        Sitemap last submitted {formatTime(data?.lastSubmitted)} · last downloaded by Google{" "}
        {formatTime(data?.lastDownloaded)}
      </p>
    </div>
  );
}
