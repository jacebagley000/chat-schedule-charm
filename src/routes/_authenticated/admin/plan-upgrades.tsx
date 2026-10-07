import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { pageMeta, canonicalLink } from "@/lib/seo";
import { supabase } from "@/integrations/supabase/client";
import { getPaddleEnvironment } from "@/lib/paddle";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/plan-upgrades")({
  head: () => ({
    meta: pageMeta({
      title: "Plan upgrades — FrontDesk AI",
      description: "How many customers upgrade from their current plan.",
      path: "/admin/plan-upgrades",
      noindex: true,
    }),
    links: [canonicalLink("/admin/plan-upgrades")],
  }),
  component: PlanUpgradesPage,
});

const RANGES = [30, 90, 365] as const;
const PLAN_NAMES: Record<string, string> = {
  soloist: "Soloist ($49)",
  professional: "Professional ($99)",
  multi_location: "Multi-location ($199)",
};
const PLAN_RANK: Record<string, number> = { soloist: 1, professional: 2, multi_location: 3 };
const planName = (p: string | null) => (p ? (PLAN_NAMES[p] ?? p) : "Unknown");

type ChangeKind = "upgrade" | "downgrade" | "other";
function changeKind(from: string | null, to: string): ChangeKind {
  const f = from ? PLAN_RANK[from] : undefined;
  const t = PLAN_RANK[to];
  if (f === undefined || t === undefined) return "other";
  if (t > f) return "upgrade";
  if (t < f) return "downgrade";
  return "other";
}

function PlanUpgradesPage() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(90);
  const env = getPaddleEnvironment();
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["plan-upgrades", days, env],
    queryFn: async () => {
      const since = new Date(Date.now() - days * 86_400_000).toISOString();
      const { data, error } = await supabase.rpc("admin_plan_upgrades", { _since: since, _env: env });
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = data ?? [];
  const count = (k: ChangeKind) => rows.filter((r) => changeKind(r.from_product_id, r.to_product_id) === k).length;
  const upgrades = count("upgrade"), downgrades = count("downgrade"), other = count("other");
  const total = rows.length;
  const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");

  const pairs = new Map<string, number>();
  rows.forEach((r) => {
    const key = `${planName(r.from_product_id)} → ${planName(r.to_product_id)}`;
    pairs.set(key, (pairs.get(key) ?? 0) + 1);
  });

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Plan upgrades</h1>
          <p className="text-muted-foreground">
            Plan changes in the last {days} days — how many customers moved to a higher plan.
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
              ["Plan changes", total, ""],
              ["Upgrades", upgrades, pct(upgrades, total) + " of changes"],
              ["Downgrades", downgrades, pct(downgrades, total) + " of changes"],
              ["Other", other, "switches we couldn't rank"],
            ] as const).map(([l, n, p]) => (
              <div key={l} className="rounded-xl border border-border bg-card p-5">
                <p className="text-sm text-muted-foreground">{l}</p>
                <p className="text-3xl font-bold">{n}</p>
                {p && <p className="text-sm text-muted-foreground">{p}</p>}
              </div>
            ))}
          </div>

          <h2 className="mb-3 text-xl font-semibold">Upgrade paths</h2>
          <div className="mb-8 rounded-xl border border-border bg-card p-5">
            {pairs.size === 0 ? <p className="text-muted-foreground">No plan changes yet.</p> : (
              <ul className="space-y-2">
                {[...pairs].map(([k, n]) => (
                  <li key={k} className="flex justify-between">
                    <span>{k}</span>
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <h2 className="mb-3 text-xl font-semibold">Recent changes</h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Business</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">From</th>
                  <th className="px-4 py-3 font-medium">To</th>
                  <th className="px-4 py-3 font-medium">Changed</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No plan changes yet.</td></tr>
                ) : rows.map((r, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">{r.business_name || "—"}</td>
                    <td className="px-4 py-3">{r.email}</td>
                    <td className="px-4 py-3">{planName(r.from_product_id)}</td>
                    <td className="px-4 py-3">{planName(r.to_product_id)}</td>
                    <td className="px-4 py-3">{new Date(r.changed_at).toLocaleDateString()}</td>
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
