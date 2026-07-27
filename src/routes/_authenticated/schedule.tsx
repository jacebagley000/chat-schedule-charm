import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, LogOut, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  UpcomingShiftsBoard,
  type ShiftRow,
  type ShiftStatus,
  type StaffOption,
} from "@/components/schedule/upcoming-shifts-board";

export const Route = createFileRoute("/_authenticated/schedule")({
  component: UnifiedSchedulePage,
  head: () => ({
    meta: [
      { title: "Upcoming Shifts — FrontDesk AI" },
      {
        name: "description",
        content:
          "One dashboard for every workspace: view upcoming shifts and update work assignments in real time.",
      },
      { property: "og:title", content: "Upcoming Shifts — FrontDesk AI" },
      {
        property: "og:description",
        content:
          "Unified schedule dashboard for viewing upcoming shifts and reassigning staff across every workspace.",
      },
    ],
  }),
});

const WINDOW_DAYS = 7;

function UnifiedSchedulePage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    const nowIso = new Date(Date.now() - 60 * 60_000).toISOString();
    const horizonIso = new Date(
      Date.now() + WINDOW_DAYS * 86400_000,
    ).toISOString();

    const [apptRes, staffRes] = await Promise.all([
      supabase
        .from("appointments")
        .select(
          "id, business_id, starts_at, ends_at, status, staff_id, " +
            "businesses(name, timezone), staff(name), services(name), customers(name)",
        )
        .gte("starts_at", nowIso)
        .lte("starts_at", horizonIso)
        .order("starts_at", { ascending: true }),
      supabase.from("staff").select("id, name, business_id"),
    ]);

    if (apptRes.error) toast.error(apptRes.error.message);
    if (staffRes.error) toast.error(staffRes.error.message);

    const rows: ShiftRow[] = (apptRes.data ?? []).map((a: any) => ({
      id: a.id,
      business_id: a.business_id,
      business_name: a.businesses?.name ?? "Workspace",
      business_timezone: a.businesses?.timezone ?? null,
      starts_at: a.starts_at,
      ends_at: a.ends_at,
      status: a.status as ShiftStatus,
      staff_id: a.staff_id,
      staff_name: a.staff?.name ?? null,
      service_name: a.services?.name ?? null,
      customer_name: a.customers?.name ?? null,
    }));

    setShifts(rows);
    setStaff((staffRes.data ?? []) as StaffOption[]);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Realtime: any appointment change repulls the window.
  useEffect(() => {
    const channel = supabase
      .channel("unified-schedule")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        () => { load(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const handleAssignStaff = async (shiftId: string, staffId: string | null) => {
    const prev = shifts;
    setShifts((s) =>
      s.map((r) =>
        r.id === shiftId
          ? {
              ...r,
              staff_id: staffId,
              staff_name: staff.find((x) => x.id === staffId)?.name ?? null,
            }
          : r,
      ),
    );
    const { error } = await supabase
      .from("appointments")
      .update({ staff_id: staffId })
      .eq("id", shiftId);
    if (error) {
      setShifts(prev);
      toast.error(error.message);
    } else {
      toast.success(staffId ? "Assignment updated" : "Shift unassigned");
    }
  };

  const handleStatusChange = async (shiftId: string, status: ShiftStatus) => {
    const prev = shifts;
    setShifts((s) => s.map((r) => (r.id === shiftId ? { ...r, status } : r)));
    const { error } = await supabase
      .from("appointments")
      .update({ status })
      .eq("id", shiftId);
    if (error) {
      setShifts(prev);
      toast.error(error.message);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
            >
              <ArrowLeft className="h-4 w-4" /> Dashboard
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {user?.email}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => { await signOut(); navigate({ to: "/" }); }}
            >
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-end justify-between mb-8 gap-4">
          <div>
            <h1 className="font-serif text-3xl tracking-tight">
              Upcoming shifts
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Every workspace, next {WINDOW_DAYS} days. Reassign staff or update
              status inline.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={refreshing}>
            <RefreshCw className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Refresh
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <UpcomingShiftsBoard
            shifts={shifts}
            staff={staff}
            mode="edit"
            windowDays={WINDOW_DAYS}
            onAssignStaff={handleAssignStaff}
            onStatusChange={handleStatusChange}
            emptyMessage="No shifts scheduled in the next week across your workspaces."
          />
        )}
      </main>
    </div>
  );
}
