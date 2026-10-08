import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CreditCard, RefreshCw, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getPaddleEnvironment } from "@/lib/paddle";
import { canonicalLink, pageMeta } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/admin/trial-funnel")({
  head: () => ({
    meta: pageMeta({
      title: "Trial funnel — FrontDesk AI",
      description: "Trial journey conversion and drop-off from first visit through payment.",
      path: "/admin/trial-funnel",
      noindex: true,
    }),
    links: [canonicalLink("/admin/trial-funnel")],
  }),
  component: TrialFunnelPage,
});

const RANGES = [30, 90, 365] as const;

type FunnelRow = {
  visitors: number | string;
  clicked: number | string;
  signed_up: number | string;
  confirmed: number | string;
  trial_started: number | string;
  paying: number | string;
};

const percent = (value: number, total: number) => (total ? Math.round((value / total) * 100) : 0);

function TrialFunnelPage() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(90);
  const env = getPaddleEnvironment();
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["trial-funnel", days, env],
    queryFn: async () => {
      const since = new Date(Date.now() - days * 86_400_000).toISOString();
      const { data, error } = await supabase.rpc("admin_trial_signup_funnel", { _since: since, _env: env });
      if (error) throw error;
      return (data?.[0] ?? null) as FunnelRow | null;
    },
  });

  const steps = [
    { label: "Visited trial page", value: Number(data?.visitors ?? 0) },
    { label: "Started free trial", value: Number(data?.clicked ?? 0) },
    { label: "Created account", value: Number(data?.signed_up ?? 0) },
    { label: "Confirmed email", value: Number(data?.confirmed ?? 0) },
    { label: "Reached payment", value: Number(data?.trial_started ?? 0) },
    { label: "Became paying", value: Number(data?.paying ?? 0) },
  ];
  const visitors = steps[0].value;
  const paying = steps.at(-1)?.value ?? 0;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
            <CreditCard className="h-4 w-4" /> Trial acquisition
          </p>
          <h1 className="text-3xl font-bold">Trial funnel</h1>
          <p className="mt-1 text-muted-foreground">
            See where visitors leave before becoming paying customers.
            {env === "sandbox" && " Showing test payments in preview."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {RANGES.map((range) => (
            <Button key={range} size="sm" variant={range === days ? "default" : "outline"} onClick={() => setDays(range)}>
              {range} days
            </Button>
          ))}
          <Button size="icon" variant="outline" onClick={() => refetch()} aria-label="Refresh trial funnel">
            <RefreshCw className={isFetching ? "animate-spin" : ""} />
          </Button>
        </div>
      </div>

      {error && <p className="mb-5 text-destructive">Couldn't load the funnel: {(error as Error).message}</p>}
      {isLoading ? (
        <p className="text-muted-foreground">Loading funnel…</p>
      ) : (
        <>
          <div className="mb-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">Trial-page visitors</p>
              <p className="mt-1 text-3xl font-bold">{visitors}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">Reached payment</p>
              <p className="mt-1 text-3xl font-bold">{steps[4].value}</p>
              <p className="text-sm text-muted-foreground">{percent(steps[4].value, visitors)}% of visitors</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">Visitor-to-paid rate</p>
              <p className="mt-1 text-3xl font-bold">{percent(paying, visitors)}%</p>
              <p className="text-sm text-muted-foreground">{paying} paying customers</p>
            </div>
          </div>

          <section aria-labelledby="funnel-steps-heading">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="funnel-steps-heading" className="text-xl font-semibold">Conversion by step</h2>
                <p className="text-sm text-muted-foreground">Each drop-off compares with the step immediately before it.</p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/admin/trial-conversions">Trial outcomes <ArrowRight /></Link>
              </Button>
            </div>

            <div className="overflow-hidden rounded-lg border border-border bg-card">
              {steps.map((step, index) => {
                const previous = index === 0 ? step.value : steps[index - 1].value;
                const conversion = index === 0 ? 100 : percent(step.value, previous);
                const lost = index === 0 ? 0 : Math.max(previous - step.value, 0);
                const drop = index === 0 ? 0 : Math.max(100 - conversion, 0);
                return (
                  <div key={step.label} className="grid gap-4 border-b border-border p-4 last:border-b-0 sm:grid-cols-[minmax(180px,1fr)_minmax(220px,2fr)_110px_150px] sm:items-center">
                    <div>
                      <p className="text-xs font-medium uppercase text-muted-foreground">Step {index + 1}</p>
                      <p className="font-semibold">{step.label}</p>
                    </div>
                    <div>
                      <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                        <span>{conversion}% from previous</span>
                        <span>{percent(step.value, visitors)}% of all visitors</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted" aria-label={`${step.label}: ${percent(step.value, visitors)}% of visitors`}>
                        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(percent(step.value, visitors), 100)}%` }} />
                      </div>
                    </div>
                    <div className="sm:text-right">
                      <p className="text-2xl font-bold">{step.value}</p>
                      <p className="text-xs text-muted-foreground">visitors</p>
                    </div>
                    <div className="sm:text-right">
                      {index === 0 ? (
                        <p className="text-sm text-muted-foreground">Starting audience</p>
                      ) : (
                        <>
                          <p className="flex items-center gap-1 text-sm font-medium text-destructive sm:justify-end">
                            <TrendingDown className="h-4 w-4" /> {drop}% drop-off
                          </p>
                          <p className="text-xs text-muted-foreground">{lost} visitors lost</p>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {visitors === 0 && (
              <p className="mt-4 rounded-lg border border-dashed border-border p-5 text-center text-muted-foreground">
                No trial visitors were recorded in this period.
              </p>
            )}
          </section>
        </>
      )}
    </main>
  );
}