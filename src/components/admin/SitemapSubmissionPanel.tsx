import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getSitemapSubmission, submitSitemap } from "@/lib/search-console.functions";

/** Re-submit automatically when the last submission is older than this. */
const RESUBMIT_AFTER_MS = 24 * 60 * 60 * 1000;

type Attempt = {
  at: string;
  trigger: "automatic" | "manual";
  ok: boolean;
  detail: string;
};

export function SitemapSubmissionPanel() {
  const load = useServerFn(getSitemapSubmission);
  const send = useServerFn(submitSitemap);

  const [siteUrl, setSiteUrl] = useState<string | undefined>(undefined);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const autoSubmitted = useRef(false);

  const { data, isFetching, isError, error, refetch } = useQuery({
    queryKey: ["sitemap-submission", siteUrl],
    queryFn: () => load({ data: { siteUrl } }),
    retry: false,
  });

  const status = data?.status ?? null;
  const resolution = data?.resolution;

  const run = async (trigger: Attempt["trigger"]) => {
    setSubmitting(true);
    try {
      const res = await send({ data: { siteUrl } });
      const detail = res.submitted
        ? `Submitted ${res.sitemapUrl}`
        : "No verified Search Console property covers this site";
      setAttempts((a) => [
        { at: new Date().toISOString(), trigger, ok: res.submitted, detail },
        ...a,
      ].slice(0, 10));
      if (res.submitted) {
        if (trigger === "manual") toast.success("Sitemap submitted to Google");
        await refetch();
      } else if (trigger === "manual") {
        toast.error(detail);
      }
    } catch (e) {
      const detail = (e as Error).message;
      setAttempts((a) => [
        { at: new Date().toISOString(), trigger, ok: false, detail },
        ...a,
      ].slice(0, 10));
      if (trigger === "manual") toast.error(detail);
    } finally {
      setSubmitting(false);
    }
  };

  // Automatic submission: once per page load, when the property is resolved and
  // the sitemap has never been submitted or the last submission is stale.
  useEffect(() => {
    if (autoSubmitted.current || !data || resolution?.status !== "selected") return;
    const last = status?.lastSubmitted ? Date.parse(status.lastSubmitted) : 0;
    const stale = !last || Date.now() - last > RESUBMIT_AFTER_MS;
    if (!stale) return;
    autoSubmitted.current = true;
    void run("automatic");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, resolution?.status, status?.lastSubmitted]);

  const submissionState = status?.isPending
    ? "pending"
    : status?.errors && Number(status.errors) > 0
      ? "errors"
      : status
        ? "submitted"
        : "not submitted";

  return (
    <section className="mb-6 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Google Search Console</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            sitemap.xml is submitted automatically when it has never been sent or the
            last submission is over 24 hours old.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={
              submissionState === "submitted" || submissionState === "pending"
                ? "secondary"
                : "destructive"
            }
          >
            {submissionState}
          </Badge>
          <Button size="sm" onClick={() => run("manual")} disabled={submitting || isFetching}>
            {submitting ? "Submitting…" : "Submit now"}
          </Button>
        </div>
      </div>

      {isError && (
        <p className="mt-3 text-sm text-destructive">{(error as Error).message}</p>
      )}

      {resolution?.status === "no_property" && (
        <p className="mt-3 text-sm text-destructive">
          No verified Search Console property covers {data?.sitemapUrl}. Verify the
          domain in Search Console, then refresh.
        </p>
      )}

      {resolution?.status === "selection_required" && (
        <div className="mt-3 space-y-2">
          <p className="text-sm">Several verified properties match — pick one:</p>
          <div className="flex flex-wrap gap-2">
            {resolution.candidates.map((c) => (
              <Button key={c} size="sm" variant="outline" onClick={() => setSiteUrl(c)}>
                {c}
              </Button>
            ))}
          </div>
        </div>
      )}

      {resolution?.status === "selected" && (
        <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Property" value={resolution.siteUrl} />
          <Field
            label="Last submitted"
            value={
              status?.lastSubmitted
                ? new Date(status.lastSubmitted).toLocaleString()
                : "never"
            }
          />
          <Field
            label="Last read by Google"
            value={
              status?.lastDownloaded
                ? new Date(status.lastDownloaded).toLocaleString()
                : "not yet"
            }
          />
          <Field
            label="Warnings / errors"
            value={`${status?.warnings ?? 0} / ${status?.errors ?? 0}`}
          />
        </dl>
      )}

      {attempts.length > 0 && (
        <ul className="mt-4 space-y-1 text-xs">
          {attempts.map((a) => (
            <li
              key={a.at}
              className={a.ok ? "text-muted-foreground" : "text-destructive"}
            >
              {a.ok ? "✓" : "✗"} {new Date(a.at).toLocaleTimeString()} · {a.trigger} ·{" "}
              {a.detail}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-all font-mono">{value}</dd>
    </div>
  );
}
