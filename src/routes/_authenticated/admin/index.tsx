import { useEffect, useMemo, useState } from "react";
import { createFileRoute, HeadContent, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowUpRight, CalendarDays, CreditCard, RefreshCw, Scissors, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/use-subscription";
import { PLANS } from "@/content/marketing";
import { pageMeta, canonicalLink } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: pageMeta({
      title: "Business Dashboard — FrontDesk AI",
      description: "Your workspace appointments, staff and services at a glance.",
      path: "/admin",
      noindex: true,
    }),
    links: [canonicalLink("/admin")],
  }),
  component: BusinessDashboard,
});

function useBusinesses() {
  return useQuery({
    queryKey: ["dash-businesses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("businesses")
        .select("id, name, timezone")
        .order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

function useWorkspaceData(businessId: string | null) {
  return useQuery({
    queryKey: ["dash-workspace", businessId],
    enabled: Boolean(businessId),
    queryFn: async () => {
      const since = new Date();
      since.setHours(0, 0, 0, 0);
      const [appts, staff, services] = await Promise.all([
        supabase
          .from("appointments")
          .select(
            "id, starts_at, ends_at, status, source, staff:staff_id(name), service:service_id(name), customer:customer_id(name, phone)",
          )
          .eq("business_id", businessId!)
          .gte("starts_at", since.toISOString())
          .order("starts_at")
          .limit(50),
        supabase
          .from("staff")
          .select("id, name, role, location, email, phone, active")
          .eq("business_id", businessId!)
          .order("name"),
        supabase
          .from("services")
          .select("id, name, duration_minutes, price_cents, active")
          .eq("business_id", businessId!)
          .order("name"),
      ]);
      for (const r of [appts, staff, services]) if (r.error) throw new Error(r.error.message);
      return {
        appointments: (appts.data ?? []) as any[],
        staff: staff.data ?? [],
        services: services.data ?? [],
      };
    },
  });
}

function BusinessDashboard() {
  const businesses = useBusinesses();
  const [businessId, setBusinessId] = useState<string | null>(null);
  useEffect(() => {
    if (!businessId && businesses.data?.length) setBusinessId(businesses.data[0]!.id);
  }, [businesses.data, businessId]);

  const ws = useWorkspaceData(businessId);

  // Live updates from the workspace tables.
  useEffect(() => {
    if (!businessId) return;
    const filter = `business_id=eq.${businessId}`;
    const channel = supabase
      .channel(`dash-${businessId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments", filter }, () =>
        ws.refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [businessId]);

  const stats = useMemo(() => {
    const a = ws.data?.appointments ?? [];
    const today = new Date().toDateString();
    return {
      today: a.filter((x) => new Date(x.starts_at).toDateString() === today).length,
      upcoming: a.length,
      staff: (ws.data?.staff ?? []).filter((s) => s.active).length,
      services: (ws.data?.services ?? []).filter((s) => s.active).length,
    };
  }, [ws.data]);

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-6">
      <HeadContent />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Business dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Appointments, staff and services for your workspace.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(businesses.data?.length ?? 0) > 1 && (
            <Select value={businessId ?? undefined} onValueChange={setBusinessId}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Choose workspace" />
              </SelectTrigger>
              <SelectContent>
                {businesses.data!.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            variant="outline"
            size="icon"
            aria-label="Refresh"
            onClick={() => ws.refetch()}
            disabled={ws.isFetching}
          >
            <RefreshCw className={`h-4 w-4 ${ws.isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {businesses.isLoading && <p className="text-muted-foreground">Loading workspaces...</p>}
      {(businesses.error || ws.error) && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {((businesses.error || ws.error) as Error).message}
        </div>
      )}
      {businesses.data?.length === 0 && (
        <p className="text-muted-foreground">
          You don't belong to a workspace yet.{" "}
          <Link to="/dashboard" className="underline">
            Create one
          </Link>
          .
        </p>
      )}

      {businessId && (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            <Stat label="Today" value={stats.today} />
            <Stat label="Upcoming" value={stats.upcoming} />
            <Stat label="Active staff" value={stats.staff} />
            <Stat label="Active services" value={stats.services} />
          </div>

          <PlanCard />

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="h-4 w-4" /> Upcoming appointments
              </CardTitle>
              <Button asChild variant="outline" size="sm">
                <Link to="/workspaces/$businessId/calendar" params={{ businessId }}>
                  Open calendar
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Staff</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(ws.data?.appointments ?? []).map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-sm">
                        {format(new Date(a.starts_at), "EEE, MMM d · h:mm a")}
                      </TableCell>
                      <TableCell>{a.customer?.name ?? "—"}</TableCell>
                      <TableCell>{a.service?.name ?? "—"}</TableCell>
                      <TableCell>{a.staff?.name ?? "Unassigned"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{a.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {ws.data && ws.data.appointments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                        No upcoming appointments.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4" /> Staff
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(ws.data?.staff ?? []).map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                    <div>
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {[s.role, s.location].filter(Boolean).join(" · ") || "—"}
                      </div>
                    </div>
                    <Badge variant={s.active ? "secondary" : "outline"}>
                      {s.active ? "active" : "inactive"}
                    </Badge>
                  </div>
                ))}
                {ws.data?.staff.length === 0 && (
                  <p className="text-sm text-muted-foreground">No staff yet.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Scissors className="h-4 w-4" /> Services
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(ws.data?.services ?? []).map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                    <div>
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.duration_minutes} min
                        {s.price_cents != null ? ` · $${(s.price_cents / 100).toFixed(2)}` : ""}
                      </div>
                    </div>
                    <Badge variant={s.active ? "secondary" : "outline"}>
                      {s.active ? "active" : "inactive"}
                    </Badge>
                  </div>
                ))}
                {ws.data?.services.length === 0 && (
                  <p className="text-sm text-muted-foreground">No services yet.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}
