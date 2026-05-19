import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { addDays, format, parseISO, startOfDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import {
  ArrowLeft, CalendarIcon, ChevronLeft, ChevronRight, Radio, Users, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/_authenticated/workspaces/$businessId/schedule")({
  component: SchedulePage,
  head: () => ({
    meta: [
      { title: "Live Schedule — FrontDesk AI" },
      {
        name: "description",
        content: "Real-time work schedule for your business, grouped by staff.",
      },
    ],
  }),
});

type Business = { id: string; name: string };
type Staff = { id: string; name: string; color: string | null; role: string | null };
type Service = { id: string; name: string };
type Customer = { id: string; name: string | null; phone: string | null };
type Appointment = {
  id: string;
  business_id: string;
  starts_at: string;
  ends_at: string;
  status: "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
  customer_id: string | null;
  staff_id: string | null;
  service_id: string | null;
  notes: string | null;
};

const STATUS_STYLES: Record<Appointment["status"], string> = {
  pending: "bg-amber-100 text-amber-900 border-amber-300",
  confirmed: "bg-emerald-100 text-emerald-900 border-emerald-300",
  completed: "bg-stone-200 text-stone-700 border-stone-300",
  cancelled: "bg-rose-100 text-rose-900 border-rose-300 line-through",
  no_show: "bg-rose-50 text-rose-700 border-rose-200",
};

const HOUR_START = 7;
const HOUR_END = 21;
const PX_PER_MIN = 1;
const TOTAL_MIN = (HOUR_END - HOUR_START) * 60;

function SchedulePage() {
  const { businessId } = useParams({
    from: "/_authenticated/workspaces/$businessId/schedule",
  });
  const [business, setBusiness] = useState<Business | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [day, setDay] = useState<Date>(startOfDay(new Date()));
  const [connected, setConnected] = useState(false);
  const [pulse, setPulse] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Keep selected appointment in sync with realtime updates (or close if deleted).
  const editing = useMemo(
    () => appointments.find((a) => a.id === editingId) ?? null,
    [appointments, editingId],
  );


  // Load core entities once per business.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: b }, { data: s }, { data: sv }, { data: cu }] = await Promise.all([
        supabase.from("businesses").select("id, name").eq("id", businessId).maybeSingle(),
        supabase
          .from("staff")
          .select("id, name, color, role")
          .eq("business_id", businessId)
          .eq("active", true)
          .order("name"),
        supabase.from("services").select("id, name").eq("business_id", businessId),
        supabase.from("customers").select("id, name, phone").eq("business_id", businessId),
      ]);
      if (cancelled) return;
      setBusiness((b as Business) ?? null);
      setStaff((s ?? []) as Staff[]);
      setServices((sv ?? []) as Service[]);
      setCustomers((cu ?? []) as Customer[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  // Load appointments for the selected day.
  const loadAppointments = async (d: Date) => {
    const from = startOfDay(d).toISOString();
    const to = addDays(startOfDay(d), 1).toISOString();
    const { data } = await supabase
      .from("appointments")
      .select(
        "id, business_id, starts_at, ends_at, status, customer_id, staff_id, service_id, notes",
      )
      .eq("business_id", businessId)
      .gte("starts_at", from)
      .lt("starts_at", to)
      .order("starts_at");
    setAppointments((data ?? []) as Appointment[]);
  };

  useEffect(() => {
    loadAppointments(day);
  }, [businessId, day]);

  // Realtime subscription — re-fetch the day on any change to this business's
  // appointments. Simple and correct; row-level merging would be brittle since
  // an update can move an appointment in or out of the visible day.
  useEffect(() => {
    const channel = supabase
      .channel(`schedule:${businessId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `business_id=eq.${businessId}`,
        },
        () => {
          setPulse((p) => p + 1);
          loadAppointments(day);
        },
      )
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [businessId, day]);

  const customerName = (id: string | null) => {
    const c = customers.find((x) => x.id === id);
    return c?.name || c?.phone || "Walk-in";
  };
  const serviceName = (id: string | null) =>
    services.find((s) => s.id === id)?.name || "Service";

  const isToday = startOfDay(new Date()).getTime() === day.getTime();

  // Now-indicator position within the visible window.
  const [nowMin, setNowMin] = useState(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes() - HOUR_START * 60;
  });
  useEffect(() => {
    if (!isToday) return;
    const tick = () => {
      const n = new Date();
      setNowMin(n.getHours() * 60 + n.getMinutes() - HOUR_START * 60);
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [isToday]);

  const hours = useMemo(
    () => Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i),
    [],
  );

  const apptsByStaff = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const s of staff) map.set(s.id, []);
    map.set("__unassigned", []);
    for (const a of appointments) {
      const key = a.staff_id && map.has(a.staff_id) ? a.staff_id : "__unassigned";
      map.get(key)!.push(a);
    }
    return map;
  }, [staff, appointments]);

  const columns = useMemo(() => {
    const cols: Array<{ id: string; name: string; role: string | null; color: string | null }> = staff.map(
      (s) => ({ id: s.id, name: s.name, role: s.role, color: s.color }),
    );
    if ((apptsByStaff.get("__unassigned")?.length ?? 0) > 0) {
      cols.push({ id: "__unassigned", name: "Unassigned", role: null, color: null });
    }
    return cols;
  }, [staff, apptsByStaff]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Link to="/dashboard" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-mono">
                Live Schedule
              </p>
              <h1 className="font-serif text-xl tracking-tight truncate">
                {business?.name ?? "…"}
              </h1>
            </div>
            <span
              key={pulse}
              className={cn(
                "ml-2 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide transition-colors",
                connected
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-stone-300 bg-stone-50 text-stone-600",
              )}
              title={connected ? "Connected to realtime" : "Reconnecting…"}
            >
              <Radio
                className={cn(
                  "h-3 w-3",
                  connected && "animate-pulse",
                )}
              />
              {connected ? "Live" : "Offline"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setDay(addDays(day, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="font-medium">
                  <CalendarIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">{format(day, "EEE, MMM d")}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={day}
                  onSelect={(d) => d && setDay(startOfDay(d))}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="sm" onClick={() => setDay(addDays(day, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDay(startOfDay(new Date()))}>
              Today
            </Button>
            <Link
              to="/workspaces/$businessId/calendar"
              params={{ businessId }}
              className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline ml-2"
            >
              Edit calendar →
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        {columns.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center">
            <Users className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-serif text-xl mb-2">No staff yet</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              Add staff in the calendar workspace to see their schedules here.
            </p>
            <Link
              to="/workspaces/$businessId/calendar"
              params={{ businessId }}
              className="text-sm underline"
            >
              Go to calendar →
            </Link>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div
              className="grid"
              style={{
                gridTemplateColumns: `64px repeat(${columns.length}, minmax(180px, 1fr))`,
              }}
            >
              {/* Header row */}
              <div className="border-b border-r border-border bg-muted/30" />
              {columns.map((c) => (
                <div
                  key={c.id}
                  className="border-b border-border bg-muted/30 px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full border border-border"
                      style={{ background: c.color ?? "var(--muted)" }}
                    />
                    <span className="font-medium truncate">{c.name}</span>
                  </div>
                  {c.role && (
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-mono mt-0.5">
                      {c.role}
                    </p>
                  )}
                </div>
              ))}

              {/* Body row */}
              <div className="border-r border-border">
                {hours.map((h) => (
                  <div
                    key={h}
                    className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground px-2 pt-1"
                    style={{ height: `${60 * PX_PER_MIN}px` }}
                  >
                    {format(new Date().setHours(h, 0, 0, 0), "h a")}
                  </div>
                ))}
              </div>

              {columns.map((c) => {
                const list = apptsByStaff.get(c.id) ?? [];
                return (
                  <div
                    key={c.id}
                    className="relative border-r border-border last:border-r-0"
                    style={{ height: `${TOTAL_MIN * PX_PER_MIN}px` }}
                  >
                    {hours.map((h) => (
                      <div
                        key={h}
                        className="border-b border-border/60"
                        style={{ height: `${60 * PX_PER_MIN}px` }}
                      />
                    ))}

                    {isToday && nowMin >= 0 && nowMin <= TOTAL_MIN && (
                      <div
                        className="absolute left-0 right-0 z-10 flex items-center"
                        style={{ top: nowMin * PX_PER_MIN }}
                      >
                        <span className="h-2 w-2 rounded-full bg-rose-500 -ml-1" />
                        <span className="flex-1 h-px bg-rose-500" />
                      </div>
                    )}

                    {list.map((a) => {
                      const start = parseISO(a.starts_at);
                      const end = parseISO(a.ends_at);
                      const startMin =
                        start.getHours() * 60 + start.getMinutes() - HOUR_START * 60;
                      const duration = Math.max(
                        15,
                        (end.getTime() - start.getTime()) / 60000,
                      );
                      const top = Math.max(0, startMin) * PX_PER_MIN;
                      const height = Math.max(28, duration * PX_PER_MIN);
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => setEditingId(a.id)}
                          className={cn(
                            "absolute left-1 right-1 rounded-md border px-2 py-1 text-xs text-left shadow-sm hover:shadow-md hover:ring-2 hover:ring-accent/40 transition-all",
                            STATUS_STYLES[a.status],
                          )}
                          style={{ top, height }}
                        >
                          <div className="font-medium truncate">
                            {customerName(a.customer_id)}
                          </div>
                          <div className="opacity-75 truncate">
                            {serviceName(a.service_id)}
                          </div>
                          <div className="opacity-60 text-[10px] mt-0.5 font-mono">
                            {format(start, "h:mm a")} – {format(end, "h:mm a")}
                          </div>
                        </button>
                      );


        <p className="text-xs text-muted-foreground mt-4 font-mono">
          Updates in real time. {appointments.length} appointment
          {appointments.length === 1 ? "" : "s"} on {format(day, "EEE, MMM d")}.
        </p>
      </main>
    </div>
  );
}
