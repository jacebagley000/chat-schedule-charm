import { useState } from "react";
import { createFileRoute, HeadContent } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { pageMeta, canonicalLink } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import {
  getSitemapSubmission,
  submitSitemap,
  getLiveCrawlFiles,
} from "@/lib/search-console.functions";

export const Route = createFileRoute("/_authenticated/admin/search-console")({
  head: () => ({
    meta: pageMeta({
      title: "Search Console sitemap — FrontDesk AI",
      description:
        "Submit the generated sitemap.xml to Google Search Console and review its submission status.",
      path: "/admin/search-console",
      noindex: true,
    }),
    links: [canonicalLink("/admin/search-console")],
  }),
  component: SearchConsolePage,
});

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-t border-border py-3 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="w-56 shrink-0 text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm break-all">{value}</dd>
    </div>
  );
}

function formatDate(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

function SearchConsolePage() {
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const loadStatus = useServerFn(getSitemapSubmission);
  const submit = useServerFn(submitSitemap);
  const loadFiles = useServerFn(getLiveCrawlFiles);

  const query = useQuery({
    queryKey: ["gsc-sitemap", selected],
    queryFn: () => loadStatus({ data: { siteUrl: selected } }),
    retry: false,
  });

  const filesQuery = useQuery({
    queryKey: ["gsc-live-files"],
    queryFn: () => loadFiles(),
    retry: false,
  });
  const files = filesQuery.data;

  const mutation = useMutation({
    mutationFn: () => submit({ data: { siteUrl: selected } }),
    onSuccess: (result) => {
      if (result.submitted) toast.success("Sitemap submitted to Google Search Console");
      query.refetch();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const data = query.data;
  const resolution = data?.resolution;
  const status = data?.status;

  return (
    <div className="container mx-auto max-w-3xl p-6">
      <HeadContent />

      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Search Console sitemap</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Submit the generated sitemap to Google Search Console and check what Google
          reports back about it.
        </p>
      </header>

      <section className="mb-6 rounded-lg border border-border p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-medium">Live crawl files</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => filesQuery.refetch()}
            disabled={filesQuery.isFetching}
          >
            {filesQuery.isFetching ? "Checking…" : "Re-check"}
          </Button>
        </div>

        {filesQuery.isLoading && (
          <p className="text-sm text-muted-foreground">Fetching robots.txt and sitemap.xml…</p>
        )}
        {filesQuery.isError && (
          <p className="text-sm text-destructive">{(filesQuery.error as Error).message}</p>
        )}

        {files && (
          <dl>
            <Row
              label="sitemap.xml"
              value={
                <span className={files.sitemap.ok ? "" : "text-destructive"}>
                  HTTP {files.sitemap.status || "—"} · {files.sitemap.urlCount} URLs ·{" "}
                  <a
                    href={files.sitemap.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-xs underline underline-offset-4"
                  >
                    {files.sitemap.url}
                  </a>
                  {files.sitemap.error ? ` · ${files.sitemap.error}` : ""}
                </span>
              }
            />
            <Row
              label="robots.txt"
              value={
                <span className={files.robots.ok ? "" : "text-destructive"}>
                  HTTP {files.robots.status || "—"} ·{" "}
                  {files.robots.matchesGenerated ? "matches generated rules" : "differs from generated rules"}
                  {" · "}
                  {files.robots.referencesSitemap ? "links the sitemap" : "missing Sitemap: line"} ·{" "}
                  <a
                    href={files.robots.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-xs underline underline-offset-4"
                  >
                    {files.robots.url}
                  </a>
                  {files.robots.error ? ` · ${files.robots.error}` : ""}
                </span>
              }
            />
            <Row
              label="Allowlisted routes in sync"
              value={
                files.missingFromLive.length === 0 && files.extraInLive.length === 0 ? (
                  `Yes — all ${files.expectedUrls.length} allowlisted URLs are live`
                ) : (
                  <span className="text-destructive">
                    {files.missingFromLive.length > 0 && (
                      <>Missing from live sitemap: {files.missingFromLive.join(", ")}. </>
                    )}
                    {files.extraInLive.length > 0 && (
                      <>Unexpected in live sitemap: {files.extraInLive.join(", ")}.</>
                    )}
                  </span>
                )
              }
            />
            <Row label="Checked" value={formatDate(files.checkedAt)} />
          </dl>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Google fetches robots.txt on its own schedule — it cannot be submitted through the
          API. Keeping it live and in sync here is what lets Google crawl the allowlisted
          routes listed in the sitemap you submit below.
        </p>
      </section>


      <div className="rounded-lg border border-border p-5">
        <dl className="mb-4">
          <Row
            label="Sitemap URL"
            value={
              <a
                href={data?.sitemapUrl ?? "/sitemap.xml"}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs underline underline-offset-4"
              >
                {data?.sitemapUrl ?? "/sitemap.xml"}
              </a>
            }
          />
          <Row
            label="Search Console property"
            value={
              resolution?.status === "selected" ? (
                <span className="font-mono text-xs">{resolution.siteUrl}</span>
              ) : (
                "—"
              )
            }
          />
        </dl>

        {query.isLoading && (
          <p className="text-sm text-muted-foreground">Loading submission status…</p>
        )}

        {query.isError && (
          <p className="text-sm text-destructive">{(query.error as Error).message}</p>
        )}

        {resolution?.status === "no_property" && (
          <p className="text-sm text-muted-foreground">
            No verified Search Console property covers this site yet. Verify the site in
            Search Console first, then reload this page.
          </p>
        )}

        {resolution?.status === "selection_required" && (
          <div className="space-y-2">
            <p className="text-sm">
              Several verified properties cover this site. Choose which one to submit to:
            </p>
            <ul className="space-y-2">
              {resolution.candidates.map((candidate) => (
                <li key={candidate}>
                  <Button
                    variant="secondary"
                    onClick={() => setSelected(candidate)}
                    className="font-mono text-xs"
                  >
                    {candidate}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {resolution?.status === "selected" && (
          <>
            {status ? (
              <dl className="mb-4">
                <Row label="Last submitted" value={formatDate(status.lastSubmitted)} />
                <Row label="Last downloaded by Google" value={formatDate(status.lastDownloaded)} />
                <Row label="Processing" value={status.isPending ? "Pending" : "Processed"} />
                <Row label="Errors reported" value={status.errors ?? "0"} />
                <Row label="Warnings reported" value={status.warnings ?? "0"} />
                <Row
                  label="URLs submitted / indexed"
                  value={
                    status.contents?.length
                      ? status.contents
                          .map(
                            (c) =>
                              `${c.type ?? "web"}: ${c.submitted ?? "—"} submitted, ${
                                c.indexed ?? "—"
                              } indexed`,
                          )
                          .join(" · ")
                      : "Not reported yet"
                  }
                />
              </dl>
            ) : (
              <p className="mb-4 text-sm text-muted-foreground">
                This sitemap has not been submitted to the selected property yet.
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
                {mutation.isPending ? "Submitting…" : status ? "Resubmit sitemap" : "Submit sitemap"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => query.refetch()}
                disabled={query.isFetching}
              >
                Refresh status
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Error and warning counts come straight from Google; they are counts, not
              causes. Google may take a while to download the sitemap after submission.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
