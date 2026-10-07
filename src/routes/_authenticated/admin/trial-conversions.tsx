import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { pageMeta, canonicalLink } from "@/lib/seo";
import { supabase } from "@/integrations/supabase/client";
import { getPaddleEnvironment } from "@/lib/paddle";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/trial-conversions")({
  head: () => ({
    meta: pageMeta({
      title: "Trial to payment — FrontDesk AI",
      description: "How many 14-day trials turn into paying plans.",
      path: "/admin/trial-conversions",
      noindex: true,
    }),
    links: [canonicalLink("/admin/trial-conversions")],
  }),
  component: TrialConversionsPage,
});

const RANGES = [30, 90, 365] as const;
const PLAN_NAMES: Record<string, string> = {
  soloist: "Soloist ($49)",
  professional: "Professional ($99)",
  multi_location: "Multi-location ($199)",
};
const planName = (p: string) => PLAN_NAMES[p] ?? p;

type Outcome = "trial" | "paid" | "canceled";
function outcome(status: string): Outcome {
  if (status === "trialing") return "trial";
  if (status === "active" || status === "past_due") return "paid";
  return "canceled";
}
const OUTCOME_LABEL: Record<Outcome, string> = { trial: "Still in trial", paid: "Paying", canceled: "Canceled" };

function TrialConversionsPage() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(90);
  const env = getPaddleEnvironment();
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["trial-conversions", days, env],
    queryFn: async () => {
      const since = new Date(Date.now() - days * 86_400_000).toISOString();
      const { data, error } = await supabase.rpc("admin_trial_conversions", { _since: since, _env: env });
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = data ?? [];
  const started = rows.length;
  const count = (o: Outcome) => rows.filter((r) => outcome(r.status) === o).length;
  const paid = count("paid"), trial = count("trial"), canceled = count("canceled");
  const finished = paid + canceled;
  const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");

  const plans = new Map<string, { started: number; paid: number }>();
  rows.forEach((r) => {
    const p = plans.get(r.product_id) ?? { started: 0, paid: 0 };
    p.started++;
    if (outcome(r.status) === "paid") p.paid++;
    plans.set(r.product_id, p);
  });

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Trial to payment</h1>
          <p className="text-muted-foreground">
            Trials started in the last {days} days and how many went on to pay.
            {env === "sandbox" && " Showing test payments (preview)."}
          </p>
        </div>
        <div className="flex gap-2">
          {RANGES.map((r) => (
            <Button key={r} size="sm" variant={r === days ? "default" : "outline"} onClick={() => setDays(r)}>{r} days</Button>
          ))}
          <Button size="sm" variant="outline" onClick={() => refetch()} aria-label="Refresh">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {error && <p className="text-destructive">Couldn't load data: {(error as Error).message}</p>}
      {isLoading ? <p className="text-muted-foreground">Loading…</p> : (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-4">
            {([
              ["Trials started", started, ""],
              ["Still in trial", trial, pct(trial, started) + " of trials"],
              ["Paying", paid, pct(paid, finished) + " of finished trials"],
              ["Canceled", canceled, pct(canceled, finished) + " of finished trials"],
            ] as const).map(([l, n, p]) => (
              <div key={l} className="rounded-xl border border-border bg-card p-5">
                <p className="text-sm text-muted-foreground">{l}</p>
                <p className="text-3xl font-bold">{n}</p>
                {p && <p className="text-sm text-muted-foreground">{p}</p>}
              </div>
            ))}
          </div>

          <h2 className="mb-3 text-xl font-semibold">By plan</h2>
          <div className="mb-8 rounded-xl border border-border bg-card p-5">
            {plans.size === 0 ? <p className="text-muted-foreground">No trials yet.</p> : (
              <ul className="space-y-2">
                {[...plans].map(([p, v]) => (
                  <li key={p} className="flex justify-between">
                    <span>{planName(p)}</span>
                    <span>{v.started} trials · {v.paid} paying</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <h2 className="mb-3 text-xl font-semibold">Recent trials</h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left">
                <tr><th className="p-3">Started</th><th className="p-3">Business</th><th className="p-3">Email</th><th className="p-3">Plan</th><th className="p-3">Outcome</th></tr>
              </thead>
              <tbody>
                {rows.length === 0 && <tr><td className="p-3 text-muted-foreground" colSpan={5}>No trials in this period.</td></tr>}
                {rows.map((r) => {
                  const o = outcome(r.status);
                  return (
                    <tr key={r.user_id} className="border-t border-border">
                      <td className="p-3">{new Date(r.started_at).toLocaleDateString()}</td>
                      <td className="p-3">{r.business_name || "—"}</td>
                      <td className="p-3">{r.email}</td>
                      <td className="p-3">{planName(r.product_id)}</td>
                      <td className="p-3">
                        {OUTCOME_LABEL[o]}
                        {o === "trial" && r.current_period_end && ` · ends ${new Date(r.current_period_end).toLocaleDateString()}`}
                        {o === "trial" && r.cancel_at_period_end && " (set to cancel)"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
