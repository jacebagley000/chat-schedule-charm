import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { pageMeta, canonicalLink } from "@/lib/seo";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/signup-funnel")({
  head: () => ({
    meta: pageMeta({
      title: "Sign-up conversions — FrontDesk AI",
      description: "Business sign-ups from the Get started page and which plan they bought.",
      path: "/admin/signup-funnel",
      noindex: true,
    }),
    links: [canonicalLink("/admin/signup-funnel")],
  }),
  component: SignupFunnelPage,
});

const RANGES = [7, 30, 90] as const;
const PLAN_NAMES: Record<string, string> = {
  soloist: "Soloist ($49)",
  professional: "Professional ($99)",
  multi_location: "Multi-location ($199)",
};
const PAID = new Set(["active", "trialing", "past_due"]);
const planName = (p: string) => PLAN_NAMES[p] ?? p;

function SignupFunnelPage() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["signup-funnel", days],
    queryFn: async () => {
      const since = new Date(Date.now() - days * 86_400_000).toISOString();
      const { data, error } = await supabase.rpc("admin_signup_conversions", { _since: since });
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = data ?? [];
  const signups = rows.length;
  const confirmed = rows.filter((r) => r.confirmed).length;
  const paid = rows.filter((r) => r.sub_status && PAID.has(r.sub_status));
  const pct = (n: number) => (signups ? `${Math.round((n / signups) * 100)}%` : "—");
  const byPlan = new Map<string, number>();
  paid.forEach((r) => byPlan.set(r.product_id ?? "unknown", (byPlan.get(r.product_id ?? "unknown") ?? 0) + 1));

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Sign-up conversions</h1>
          <p className="text-muted-foreground">Businesses that signed up on Get started, and which plan they paid for.</p>
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
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            {[["Signed up", signups, ""], ["Confirmed email", confirmed, pct(confirmed)], ["Paying", paid.length, pct(paid.length)]].map(([l, n, p]) => (
              <div key={l as string} className="rounded-xl border border-border bg-card p-5">
                <p className="text-sm text-muted-foreground">{l}</p>
                <p className="text-3xl font-bold">{n}</p>
                {p && <p className="text-sm text-muted-foreground">{p} of sign-ups</p>}
              </div>
            ))}
          </div>

          <h2 className="mb-3 text-xl font-semibold">Plans chosen</h2>
          <div className="mb-8 rounded-xl border border-border bg-card p-5">
            {byPlan.size === 0 ? <p className="text-muted-foreground">No paid plans yet.</p> : (
              <ul className="space-y-2">
                {[...byPlan].map(([p, n]) => (
                  <li key={p} className="flex justify-between"><span>{planName(p)}</span><span>{n} ({pct(n)})</span></li>
                ))}
              </ul>
            )}
          </div>

          <h2 className="mb-3 text-xl font-semibold">Recent sign-ups</h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left">
                <tr><th className="p-3">Date</th><th className="p-3">Business</th><th className="p-3">Industry</th><th className="p-3">Email confirmed</th><th className="p-3">Plan</th><th className="p-3">Trial started</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.user_id} className="border-t border-border">
                    <td className="p-3">{new Date(r.signed_up_at).toLocaleDateString()}</td>
                    <td className="p-3">{r.business_name}</td>
                    <td className="p-3">{r.industry || "—"}</td>
                    <td className="p-3">{r.confirmed ? "Yes" : "No"}</td>
                    <td className="p-3">{r.product_id ? `${planName(r.product_id)} · ${r.sub_status}` : "No plan yet"}</td>
                    <td className="p-3">{r.trial_started_at ? new Date(r.trial_started_at).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
