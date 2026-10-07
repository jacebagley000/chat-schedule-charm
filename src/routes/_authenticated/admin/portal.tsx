import { useEffect, useState } from "react";
import { createFileRoute, HeadContent, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format, differenceInCalendarDays } from "date-fns";
import { CalendarDays, CreditCard, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/use-subscription";
import { PLANS } from "@/content/marketing";
import { pageMeta, canonicalLink } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/portal")({
  head: () => ({
    meta: pageMeta({
      title: "Customer Portal — FrontDesk AI",
      description: "Your plan, trial end date and upcoming appointments in one place.",
      path: "/admin/portal",
      noindex: true,
    }),
    links: [canonicalLink("/admin/portal")],
  }),
  component: CustomerPortal,
});

const STATUS_LABEL: Record<string, string> = {
  trialing: "Free trial",
  active: "Active",
  past_due: "Payment issue",
  canceled: "Canceled",
  paused: "Paused",
};

function CustomerPortal() {
  const { subscription, isActive, loading } = useSubscription();
  const plan = PLANS.find((p) => p.priceId === subscription?.price_id) ?? null;

  const businesses = useQuery({
    queryKey: ["portal-businesses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("businesses")
        .select("id, name, timezone")
        .order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
  const [businessId, setBusinessId] = useState<string | null>(null);
  useEffect(() => {
    if (!businessId && businesses.data?.length) setBusinessId(businesses.data[0]!.id);
  }, [businesses.data, businessId]);
  const business = businesses.data?.find((b) => b.id === businessId);

  const appts = useQuery({
    queryKey: ["portal-appts", businessId],
    enabled: Boolean(businessId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select(
          "id, starts_at, ends_at, status, staff:staff_id(name), service:service_id(name), customer:customer_id(name)",
        )
        .eq("business_id", businessId!)
        .gte("starts_at", new Date().toISOString())
        .neq("status", "cancelled")
        .order("starts_at")
        .limit(20);
      if (error) throw new Error(error.message);
      return (data ?? []) as any[];
    },
  });

  const fmtTime = (iso: string) =>
    new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: business?.timezone || undefined,
    }).format(new Date(iso));

  const end = subscription?.current_period_end ? new Date(subscription.current_period_end) : null;
  const daysLeft = end ? differenceInCalendarDays(end, new Date()) : null;

  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-6">
      <HeadContent />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customer portal</h1>
          <p className="text-sm text-muted-foreground">Your plan and what's coming up.</p>
        </div>
        {(businesses.data?.length ?? 0) > 1 && (
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={businessId ?? ""}
            onChange={(e) => setBusinessId(e.target.value)}
          >
            {businesses.data!.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4" /> Plan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : !isActive || !subscription ? (
              <>
                <p className="text-sm text-muted-foreground">You're not on a plan yet.</p>
                <Button asChild size="sm"><Link to="/trial">Start 14-day free trial</Link></Button>
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-semibold">{plan?.name ?? "Your plan"}</span>
                  {plan && <span className="text-muted-foreground">{plan.price}/mo</span>}
                </div>
                <Badge variant="secondary">
                  {subscription.cancel_at_period_end
                    ? "Cancels at period end"
                    : STATUS_LABEL[subscription.status] ?? subscription.status}
                </Badge>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" />
              {subscription?.status === "trialing" ? "Trial ends" : "Next billing date"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!isActive || !end ? (
              <p className="text-sm text-muted-foreground">No date yet.</p>
            ) : (
              <>
                <div className="text-lg font-semibold">{format(end, "MMMM d, yyyy")}</div>
                <p className="text-sm text-muted-foreground">
                  {daysLeft !== null && daysLeft >= 0
                    ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`
                    : ""}
                  {subscription?.status === "trialing" && plan
                    ? ` · then ${plan.price}/mo`
                    : ""}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-4 w-4" /> Upcoming appointments
          </CardTitle>
          <Button asChild variant="outline" size="sm"><Link to="/admin">Dashboard</Link></Button>
        </CardHeader>
        <CardContent>
          {appts.isLoading || businesses.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : !businessId ? (
            <p className="text-sm text-muted-foreground">No workspace yet.</p>
          ) : !appts.data?.length ? (
            <p className="text-sm text-muted-foreground">No upcoming appointments.</p>
          ) : (
            <ul className="divide-y">
              {appts.data.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <div className="font-medium">{a.service?.name ?? "Appointment"}</div>
                    <div className="text-sm text-muted-foreground">
                      {a.customer?.name ?? "No customer"}
                      {a.staff?.name ? ` · with ${a.staff.name}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span>{fmtTime(a.starts_at)}</span>
                    <Badge variant="outline">{a.status}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
