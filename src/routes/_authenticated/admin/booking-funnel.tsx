import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { pageMeta, canonicalLink } from "@/lib/seo";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/booking-funnel")({
  head: () => ({
    meta: pageMeta({
      title: "Booking funnel — FrontDesk AI",
      description: "How visitors move through the booking confirmation page.",
      path: "/admin/booking-funnel",
      noindex: true,
    }),
    links: [canonicalLink("/admin/booking-funnel")],
  }),
  component: BookingFunnelPage,
});

const RANGES = [7, 30, 90] as const;
const STATUS_LABELS: Record<string, string> = {
  booked: "Booked into calendar",
  slot_taken: "Time already taken",
  none: "No time picked",
  past_time: "Time in the past",
  not_configured: "Calendar not set up",
  error: "Booking failed",
};

function BookingFunnelPage() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["booking-funnel", days],
    queryFn: async () => {
      const since = new Date(Date.now() - days * 86_400_000).toISOString();
      const { data, error } = await supabase
        .from("booking_funnel_events")
        .select("event, visit_id, booking_status")
        .gte("created_at", since)
        .limit(10000);
      if (error) throw error;
      return data;
    },
  });

  const visits = (e: string, status?: string) =>
    new Set(
      (data ?? [])
        .filter((r) => r.event === e && (status === undefined || (r.booking_status ?? "none") === status))
        .map((r) => r.visit_id),
    ).size;

  const views = visits("view");
  const calendly = visits("click_calendly");
  const home = visits("click_home");
  const pct = (n: number) => (views ? `${Math.round((n / views) * 100)}%` : "—");
  const statuses = [...new Set((data ?? []).map((r) => r.booking_status ?? "none"))];

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Booking funnel</h1>
          <p className="text-muted-foreground">Visitors who reached the booking confirmation page and what they clicked next.</p>
        </div>
        <div className="flex gap-2">
          {RANGES.map((r) => (
            <Button key={r} size="sm" variant={r === days ? "default" : "outline"} onClick={() => setDays(r)}>
              {r} days
            </Button>
          ))}
          <Button size="sm" variant="outline" onClick={() => refetch()} aria-label="Refresh">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {error && <p className="text-destructive">Couldn't load data: {(error as Error).message}</p>}
      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["Reached confirmation page", views, "100%"],
              ['Clicked "Pick an exact time"', calendly, pct(calendly)],
              ['Clicked "Back to homepage"', home, pct(home)],
            ].map(([label, n, p]) => (
              <div key={label as string} className="rounded-xl border border-border bg-card p-5">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-1 text-3xl font-bold">{n}</p>
                <p className="text-sm text-muted-foreground">{p} of visitors</p>
              </div>
            ))}
          </div>

          <h2 className="mt-10 mb-3 text-xl font-semibold">By booking outcome</h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-3">Outcome</th>
                  <th className="p-3">Visitors</th>
                  <th className="p-3">Picked exact time</th>
                  <th className="p-3">Back to homepage</th>
                </tr>
              </thead>
              <tbody>
                {statuses.length === 0 && (
                  <tr><td className="p-3 text-muted-foreground" colSpan={4}>No visits yet in this period.</td></tr>
                )}
                {statuses.map((s) => (
                  <tr key={s} className="border-t border-border">
                    <td className="p-3">{STATUS_LABELS[s] ?? s}</td>
                    <td className="p-3">{visits("view", s)}</td>
                    <td className="p-3">{visits("click_calendly", s)}</td>
                    <td className="p-3">{visits("click_home", s)}</td>
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
