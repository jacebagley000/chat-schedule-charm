import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { format, addDays, startOfDay, addMinutes, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  ChevronLeft, ChevronRight, Plus, ArrowLeft, CalendarIcon, Trash2, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/workspaces/$businessId/calendar")({
  component: CalendarPage,
  head: () => ({ meta: [{ title: "Calendar — FrontDesk AI" }] }),
});

type Business = { id: string; name: string };
type Staff = { id: string; name: string; color: string | null; role: string | null; location: string | null };
type Service = { id: string; name: string; duration_minutes: number; color: string | null };
type Customer = { id: string; name: string | null; phone: string | null };
type Appointment = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
  source: string;
  notes: string | null;
  customer_id: string | null;
  staff_id: string | null;
  service_id: string | null;
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
const PX_PER_MIN = 1.2;

function CalendarPage() {
  const { businessId } = useParams({ from: "/_authenticated/workspaces/$businessId/calendar" });
  const navigate = useNavigate();
  const [business, setBusiness] = useState<Business | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [day, setDay] = useState<Date>(startOfDay(new Date()));
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [creating, setCreating] = useState<{ start: Date } | null>(null);

  const loadCore = async () => {
    const [{ data: b }, { data: s }, { data: sv }, { data: cu }] = await Promise.all([
      supabase.from("businesses").select("id, name").eq("id", businessId).maybeSingle(),
      supabase.from("staff").select("id, name, color, role, location").eq("business_id", businessId).eq("active", true).order("name"),
      supabase.from("services").select("id, name, duration_minutes, color").eq("business_id", businessId).eq("active", true).order("name"),
      supabase.from("customers").select("id, name, phone").eq("business_id", businessId).order("name"),
    ]);
    if (!b) { toast.error("Workspace not found"); navigate({ to: "/dashboard" }); return; }
    setBusiness(b as Business);
    setStaff((s ?? []) as Staff[]);
    setServices((sv ?? []) as Service[]);
    setCustomers((cu ?? []) as Customer[]);
  };

  const loadAppointments = async (d: Date) => {
    const from = startOfDay(d).toISOString();
    const to = addDays(startOfDay(d), 1).toISOString();
    const { data, error } = await supabase
      .from("appointments")
      .select("id, starts_at, ends_at, status, source, notes, customer_id, staff_id, service_id")
      .eq("business_id", businessId)
      .gte("starts_at", from)
      .lt("starts_at", to)
      .order("starts_at");
    if (error) return toast.error(error.message);
    setAppointments((data ?? []) as Appointment[]);
  };

  useEffect(() => { loadCore(); }, [businessId]);
  useEffect(() => { loadAppointments(day); }, [businessId, day]);

  const hours = useMemo(
    () => Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i),
    []
  );

  const positioned = useMemo(() => {
    return appointments.map((a) => {
      const start = parseISO(a.starts_at);
      const end = parseISO(a.ends_at);
      const startMin = start.getHours() * 60 + start.getMinutes() - HOUR_START * 60;
      const duration = Math.max(15, (end.getTime() - start.getTime()) / 60000);
      return { appt: a, top: startMin * PX_PER_MIN, height: duration * PX_PER_MIN };
    });
  }, [appointments]);

  const customerName = (id: string | null) =>
    customers.find((c) => c.id === id)?.name || customers.find((c) => c.id === id)?.phone || "Walk-in";
  const staffName = (id: string | null) => staff.find((s) => s.id === id)?.name || "Unassigned";
  const serviceName = (id: string | null) => services.find((s) => s.id === id)?.name || "Service";

  const needsSetup = !staff.length || !services.length;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Link to="/dashboard" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-mono">Calendar</p>
              <h1 className="font-serif text-xl tracking-tight truncate">{business?.name ?? "…"}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setDay(addDays(day, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <DatePopover value={day} onChange={(d) => d && setDay(startOfDay(d))} />
            <Button variant="outline" size="sm" onClick={() => setDay(addDays(day, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDay(startOfDay(new Date()))}>Today</Button>
            <Button
              size="sm"
              disabled={needsSetup}
              onClick={() => {
                const start = new Date(day);
                start.setHours(9, 0, 0, 0);
                setCreating({ start });
              }}
            >
              <Plus className="h-4 w-4" /> New appointment
            </Button>
          </div>
        </div>
      </header>

      {needsSetup && (
        <SetupPanel
          businessId={businessId}
          staff={staff}
          services={services}
          onChanged={loadCore}
        />
      )}

      {!needsSetup && (
        <AvailabilityPanel
          businessId={businessId}
          day={day}
          staff={staff}
          services={services}
          onPickSlot={(start) => setCreating({ start })}
        />
      )}

      <main className="mx-auto max-w-7xl px-6 py-6">

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="grid grid-cols-[64px_1fr]">
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
            <div className="relative">
              {hours.map((h) => (
                <button
                  key={h}
                  type="button"
                  className="block w-full border-b border-border/60 hover:bg-accent/5 transition-colors"
                  style={{ height: `${60 * PX_PER_MIN}px` }}
                  onClick={() => {
                    if (needsSetup) return toast.message("Add staff and services first");
                    const start = new Date(day);
                    start.setHours(h, 0, 0, 0);
                    setCreating({ start });
                  }}
                />
              ))}

              {positioned.map(({ appt, top, height }) => (
                <button
                  key={appt.id}
                  type="button"
                  onClick={() => setEditing(appt)}
                  className={cn(
                    "absolute left-2 right-2 rounded-md border px-2 py-1 text-left text-xs shadow-sm hover:shadow-md transition-shadow",
                    STATUS_STYLES[appt.status]
                  )}
                  style={{ top, height: Math.max(28, height) }}
                >
                  <div className="font-medium truncate">{customerName(appt.customer_id)}</div>
                  <div className="opacity-75 truncate">
                    {serviceName(appt.service_id)} · {staffName(appt.staff_id)}
                  </div>
                  <div className="opacity-60 text-[10px] mt-0.5 font-mono">
                    {format(parseISO(appt.starts_at), "h:mm a")} – {format(parseISO(appt.ends_at), "h:mm a")}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>

      {creating && (
        <AppointmentDialog
          mode="create"
          businessId={businessId}
          initialStart={creating.start}
          staff={staff}
          services={services}
          customers={customers}
          onClose={() => setCreating(null)}
          onSaved={() => { setCreating(null); loadAppointments(day); loadCore(); }}
        />
      )}

      {editing && (
        <AppointmentDialog
          mode="edit"
          businessId={businessId}
          appointment={editing}
          staff={staff}
          services={services}
          customers={customers}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); loadAppointments(day); }}
        />
      )}
    </div>
  );
}

function DatePopover({ value, onChange }: { value: Date; onChange: (d: Date | undefined) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="font-medium">
          <CalendarIcon className="h-4 w-4" />
          <span className="hidden sm:inline">{format(value, "EEE, MMM d")}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar
          mode="single"
          selected={value}
          onSelect={onChange}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}

const TIME_PRESETS: { value: string; label: string }[] = [
  { value: "any", label: "Any time" },
  { value: "morning", label: "Morning (7a–12p)" },
  { value: "afternoon", label: "Afternoon (12p–5p)" },
  { value: "evening", label: "Evening (5p–9p)" },
];

function AvailabilityPanel({
  businessId, day, staff, services, onPickSlot,
}: {
  businessId: string;
  day: Date;
  staff: Staff[];
  services: Service[];
  onPickSlot: (start: Date) => void;
}) {
  const [open, setOpen] = useState(false);
  const [serviceId, setServiceId] = useState<string>(services[0]?.id ?? "");
  const [dateStr, setDateStr] = useState<string>(format(day, "yyyy-MM-dd"));
  const [timeBand, setTimeBand] = useState<string>("any");
  const [userId, setUserId] = useState<string | null>(null);
  const [durationOverride, setDurationOverride] = useState<string>("service");
  const [durationHydrated, setDurationHydrated] = useState(false);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [results, setResults] = useState<Array<{ staffId: string; slots: Array<{ start: Date; end: Date }> }> | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => { setDateStr(format(day, "yyyy-MM-dd")); }, [day]);

  // Load persisted preferences per user
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        try {
          const dur = localStorage.getItem(`availability:durationOverride:${uid}`);
          if (dur) setDurationOverride(dur);
          const tb = localStorage.getItem(`availability:timeBand:${uid}`);
          if (tb) setTimeBand(tb);
          const rf = localStorage.getItem(`availability:roleFilter:${uid}`);
          if (rf) setRoleFilter(rf);
          const lf = localStorage.getItem(`availability:locationFilter:${uid}`);
          if (lf) setLocationFilter(lf);
        } catch { /* ignore */ }
      }
      setDurationHydrated(true);
    });
    return () => { cancelled = true; };
  }, []);

  // Persist preferences when they change
  useEffect(() => {
    if (!durationHydrated || !userId) return;
    try {
      localStorage.setItem(`availability:durationOverride:${userId}`, durationOverride);
      localStorage.setItem(`availability:timeBand:${userId}`, timeBand);
      localStorage.setItem(`availability:roleFilter:${userId}`, roleFilter);
      localStorage.setItem(`availability:locationFilter:${userId}`, locationFilter);
    } catch { /* ignore */ }
  }, [durationOverride, timeBand, roleFilter, locationFilter, durationHydrated, userId]);



  const roleOptions = useMemo(() => {
    const set = new Set<string>();
    staff.forEach((s) => { if (s.role?.trim()) set.add(s.role.trim()); });
    return Array.from(set).sort();
  }, [staff]);
  const locationOptions = useMemo(() => {
    const set = new Set<string>();
    staff.forEach((s) => { if (s.location?.trim()) set.add(s.location.trim()); });
    return Array.from(set).sort();
  }, [staff]);

  const search = async () => {
    const svc = services.find((s) => s.id === serviceId);
    if (!svc) return toast.error("Pick a service");
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return toast.error("Pick a date");

    const candidates = staff.filter((s) => {
      if (roleFilter !== "all" && (s.role ?? "") !== roleFilter) return false;
      if (locationFilter !== "all" && (s.location ?? "") !== locationFilter) return false;
      return true;
    });
    if (candidates.length === 0) { setResults([]); return; }

    const dayStart = new Date(y, m - 1, d, HOUR_START, 0, 0, 0);
    const dayEnd = new Date(y, m - 1, d, HOUR_END, 0, 0, 0);
    const [bandStart, bandEnd] =
      timeBand === "morning" ? [7, 12] :
      timeBand === "afternoon" ? [12, 17] :
      timeBand === "evening" ? [17, 21] :
      [HOUR_START, HOUR_END];
    const windowStart = new Date(y, m - 1, d, bandStart, 0, 0, 0);
    const windowEnd = new Date(y, m - 1, d, bandEnd, 0, 0, 0);

    setSearching(true);
    const { data, error } = await supabase
      .from("appointments")
      .select("staff_id, starts_at, ends_at, status")
      .eq("business_id", businessId)
      .in("staff_id", candidates.map((c) => c.id))
      .gte("starts_at", dayStart.toISOString())
      .lt("starts_at", addDays(dayStart, 1).toISOString())
      .not("status", "in", "(cancelled,no_show)");
    setSearching(false);
    if (error) return toast.error(error.message);

    const busy = new Map<string, Array<{ s: Date; e: Date }>>();
    (data ?? []).forEach((r) => {
      const arr = busy.get(r.staff_id as string) ?? [];
      arr.push({ s: parseISO(r.starts_at as string), e: parseISO(r.ends_at as string) });
      busy.set(r.staff_id as string, arr);
    });

    const dur = durationOverride === "service" ? svc.duration_minutes : Number(durationOverride);
    const MAX_SLOTS = 3;
    const found: Array<{ staffId: string; slots: Array<{ start: Date; end: Date }> }> = [];
    for (const c of candidates) {
      const intervals = (busy.get(c.id) ?? []).sort((a, b) => a.s.getTime() - b.s.getTime());
      let cursor = new Date(Math.max(windowStart.getTime(), dayStart.getTime()));
      const stop = new Date(Math.min(windowEnd.getTime(), dayEnd.getTime()));
      const slots: Array<{ start: Date; end: Date }> = [];
      while (slots.length < MAX_SLOTS && addMinutes(cursor, dur).getTime() <= stop.getTime()) {
        const slotEnd = addMinutes(cursor, dur);
        const clash = intervals.find((i) => i.s < slotEnd && i.e > cursor);
        if (!clash) {
          slots.push({ start: new Date(cursor), end: slotEnd });
          cursor = addMinutes(cursor, dur);
        } else {
          cursor = clash.e;
        }
        const mins = cursor.getMinutes();
        if (mins % 5 !== 0) cursor = addMinutes(cursor, 5 - (mins % 5));
      }
      if (slots.length > 0) found.push({ staffId: c.id, slots });
    }
    setResults(found);
  };

  const reset = () => {
    setServiceId(services[0]?.id ?? "");
    setDateStr(format(day, "yyyy-MM-dd"));
    setTimeBand("any");
    setDurationOverride("service");
    setRoleFilter("all");
    setLocationFilter("all");
    setResults(null);
  };

  const clearSavedPreferences = () => {
    try {
      setTimeBand("any");
      setRoleFilter("all");
      setLocationFilter("all");
      if (userId) {
        localStorage.removeItem(`availability:timeBand:${userId}`);
        localStorage.removeItem(`availability:roleFilter:${userId}`);
        localStorage.removeItem(`availability:locationFilter:${userId}`);
      }
      toast.success("Filters reset to defaults");
    } catch (err) {
      console.error("Failed to reset filters", err);
      toast.error("Couldn't reset filters. Please try again.");
    }
  };

  const staffNameOf = (id: string) => staff.find((s) => s.id === id)?.name ?? "Staff";
  const staffMeta = (id: string) => {
    const s = staff.find((x) => x.id === id);
    return [s?.role, s?.location].filter(Boolean).join(" · ");
  };

  return (
    <div className="mx-auto max-w-7xl px-6 pt-4">
      <div className="rounded-xl border border-border bg-card">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-accent/5 transition-colors"
        >
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] font-mono text-muted-foreground">Availability</p>
            <p className="text-sm font-medium">Find an open slot by service, day, role, or location</p>
          </div>
          <ChevronRight className={cn("h-4 w-4 transition-transform", open && "rotate-90")} />
        </button>
        {open && (
          <div className="border-t border-border p-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wide font-mono text-muted-foreground">Service</Label>
                <Select value={serviceId} onValueChange={setServiceId}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Service" /></SelectTrigger>
                  <SelectContent>
                    {services.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name} ({s.duration_minutes}m)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wide font-mono text-muted-foreground">Date</Label>
                <Input type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wide font-mono text-muted-foreground">Time</Label>
                <Select value={timeBand} onValueChange={setTimeBand}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIME_PRESETS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wide font-mono text-muted-foreground">Duration</Label>
                <Select value={durationOverride} onValueChange={setDurationOverride}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="service">Service default</SelectItem>
                    {[15, 30, 45, 60, 75, 90, 120, 150, 180].map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {m < 60 ? `${m} min` : m % 60 === 0 ? `${m / 60} hr` : `${Math.floor(m / 60)} hr ${m % 60} min`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wide font-mono text-muted-foreground">Role</Label>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All roles</SelectItem>
                    {roleOptions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wide font-mono text-muted-foreground">Location</Label>
                <Select value={locationFilter} onValueChange={setLocationFilter}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All locations</SelectItem>
                    {locationOptions.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={search} disabled={searching || !serviceId}>
                {searching ? "Searching…" : "Find availability"}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={reset}>Reset</Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" size="sm" variant="outline">
                    Reset filters to defaults
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reset filters to defaults?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will clear your saved Time band, Role, and Location selections for this calendar and reset them to the defaults (Any time, All roles, All locations).
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={clearSavedPreferences}>
                      Reset
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {results !== null && (
              <div className="rounded-md border border-border divide-y divide-border">
                {results.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-muted-foreground italic">
                    No staff available for that service in the selected window.
                  </p>
                ) : (
                  results.map((r) => (
                    <div key={r.staffId} className="px-3 py-2 flex items-start justify-between gap-3 text-sm">
                      <div className="min-w-0 pt-0.5">
                        <p className="font-medium truncate">{staffNameOf(r.staffId)}</p>
                        {staffMeta(r.staffId) && (
                          <p className="text-xs text-muted-foreground truncate">{staffMeta(r.staffId)}</p>
                        )}
                      </div>
                      <div className="flex flex-wrap justify-end gap-1.5 shrink-0 max-w-[60%]">
                        {r.slots.map((slot, i) => (
                          <Button
                            key={i}
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="h-7 px-2 font-mono text-xs"
                            onClick={() => onPickSlot(slot.start)}
                            title={`${format(slot.start, "h:mm a")}–${format(slot.end, "h:mm a")}`}
                          >
                            {format(slot.start, "h:mm a")}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SetupPanel({
  businessId, staff, services, onChanged,
}: {
  businessId: string;
  staff: Staff[];
  services: Service[];
  onChanged: () => void;
}) {
  const [staffName, setStaffName] = useState("");
  const [staffQuery, setStaffQuery] = useState("");
  const [staffRoleFilter, setStaffRoleFilter] = useState<string>("all");
  const [staffLocationFilter, setStaffLocationFilter] = useState<string>("all");
  const [svcName, setSvcName] = useState("");
  const [svcDuration, setSvcDuration] = useState(30);

  const staffRoleOptions = useMemo(() => {
    const set = new Set<string>();
    staff.forEach((s) => { if (s.role && s.role.trim()) set.add(s.role.trim()); });
    return Array.from(set).sort();
  }, [staff]);
  const staffLocationOptions = useMemo(() => {
    const set = new Set<string>();
    staff.forEach((s) => { if (s.location && s.location.trim()) set.add(s.location.trim()); });
    return Array.from(set).sort();
  }, [staff]);

  const filteredStaff = useMemo(() => {
    const q = staffQuery.trim().toLowerCase();
    return staff.filter((s) => {
      if (staffRoleFilter !== "all" && (s.role ?? "") !== staffRoleFilter) return false;
      if (staffLocationFilter !== "all" && (s.location ?? "") !== staffLocationFilter) return false;
      if (q && ![s.name, s.role ?? "", s.location ?? ""].some((v) => v.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [staff, staffQuery, staffRoleFilter, staffLocationFilter]);

  const staffFiltersActive = staffQuery.trim() !== "" || staffRoleFilter !== "all" || staffLocationFilter !== "all";

  const addStaff = async (e: FormEvent) => {
    e.preventDefault();
    if (!staffName.trim()) return;
    const { error } = await supabase.from("staff").insert({ business_id: businessId, name: staffName.trim() });
    if (error) return toast.error(error.message);
    setStaffName(""); onChanged();
  };
  const addService = async (e: FormEvent) => {
    e.preventDefault();
    if (!svcName.trim()) return;
    const { error } = await supabase.from("services").insert({
      business_id: businessId, name: svcName.trim(), duration_minutes: svcDuration,
    });
    if (error) return toast.error(error.message);
    setSvcName(""); setSvcDuration(30); onChanged();
  };

  return (
    <div className="mx-auto max-w-7xl px-6 pt-6">
      <div className="rounded-xl border border-dashed border-border bg-card p-6">
        <h2 className="font-serif text-lg mb-1">Set up your shop</h2>
        <p className="text-sm text-muted-foreground mb-5">Add at least one staff member and one service to start booking.</p>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="text-xs font-mono uppercase tracking-wide text-muted-foreground mb-2">
              Staff {staff.length > 0 && `· ${staff.length}`}
            </p>
            <form onSubmit={addStaff} className="flex gap-2">
              <Input placeholder="Stylist name" value={staffName} onChange={(e) => setStaffName(e.target.value)} />
              <Button type="submit"><Plus className="h-4 w-4" /> Add</Button>
            </form>
            {staff.length > 0 && (
              <div className="mt-2 space-y-2">
                <Input
                  value={staffQuery}
                  onChange={(e) => setStaffQuery(e.target.value)}
                  placeholder="Search by name, role, or location…"
                  className="h-8"
                />
                <div className="flex flex-wrap gap-2">
                  <Select value={staffRoleFilter} onValueChange={setStaffRoleFilter}>
                    <SelectTrigger className="h-8 w-[140px]"><SelectValue placeholder="Role" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All roles</SelectItem>
                      {staffRoleOptions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={staffLocationFilter} onValueChange={setStaffLocationFilter}>
                    <SelectTrigger className="h-8 w-[160px]"><SelectValue placeholder="Location" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All locations</SelectItem>
                      {staffLocationOptions.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {staffFiltersActive && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8"
                      onClick={() => { setStaffQuery(""); setStaffRoleFilter("all"); setStaffLocationFilter("all"); }}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            )}
            <ul className="mt-3 space-y-2">
              {filteredStaff.length === 0 && staff.length > 0 ? (
                <li className="text-xs text-muted-foreground italic">No staff match the current filters.</li>
              ) : (
                filteredStaff.map((s) => <StaffRow key={s.id} staff={s} onChanged={onChanged} />)
              )}
            </ul>
          </div>
          <div>
            <p className="text-xs font-mono uppercase tracking-wide text-muted-foreground mb-2">
              Services {services.length > 0 && `· ${services.length}`}
            </p>
            <form onSubmit={addService} className="flex gap-2">
              <Input placeholder="Haircut" value={svcName} onChange={(e) => setSvcName(e.target.value)} />
              <Input
                type="number" min={5} step={5} className="w-20"
                value={svcDuration} onChange={(e) => setSvcDuration(Number(e.target.value) || 30)}
              />
              <Button type="submit"><Plus className="h-4 w-4" /> Add</Button>
            </form>
            <ul className="mt-3 text-sm space-y-1">
              {services.map((s) => <li key={s.id} className="text-muted-foreground">· {s.name} ({s.duration_minutes}m)</li>)}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function StaffRow({ staff, onChanged }: { staff: Staff; onChanged: () => void }) {
  const [name, setName] = useState(staff.name);
  const [role, setRole] = useState(staff.role ?? "");
  const [location, setLocation] = useState(staff.location ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(staff.name);
    setRole(staff.role ?? "");
    setLocation(staff.location ?? "");
  }, [staff.id, staff.name, staff.role, staff.location]);

  const save = async (patch: { name?: string; role?: string | null; location?: string | null }) => {
    setSaving(true);
    const { error } = await supabase.from("staff").update(patch).eq("id", staff.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    onChanged();
  };

  const commit = (field: "name" | "role" | "location", value: string) => {
    const trimmed = value.trim();
    if (field === "name") {
      if (!trimmed || trimmed === staff.name) return;
      save({ name: trimmed });
    } else {
      const current = (staff[field] ?? "") as string;
      if (trimmed === current) return;
      save({ [field]: trimmed || null });
    }
  };

  return (
    <li className="grid grid-cols-1 sm:grid-cols-3 gap-2 rounded-md border border-border bg-background/50 p-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={(e) => commit("name", e.target.value)}
        placeholder="Name"
        disabled={saving}
        className="h-8"
      />
      <Input
        value={role}
        onChange={(e) => setRole(e.target.value)}
        onBlur={(e) => commit("role", e.target.value)}
        placeholder="Role (e.g. Stylist)"
        disabled={saving}
        className="h-8"
      />
      <Input
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        onBlur={(e) => commit("location", e.target.value)}
        placeholder="Location (e.g. Downtown)"
        disabled={saving}
        className="h-8"
      />
    </li>
  );
}

function AppointmentDialog({
  mode, businessId, appointment, initialStart, staff, services, customers, onClose, onSaved,
}: {
  mode: "create" | "edit";
  businessId: string;
  appointment?: Appointment;
  initialStart?: Date;
  staff: Staff[];
  services: Service[];
  customers: Customer[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const start0 = appointment ? parseISO(appointment.starts_at) : initialStart!;
  const end0 = appointment ? parseISO(appointment.ends_at) : addMinutes(start0, services[0]?.duration_minutes ?? 30);

  const [date, setDate] = useState<Date>(startOfDay(start0));
  const [time, setTime] = useState<string>(format(start0, "HH:mm"));
  const [duration, setDuration] = useState<number>(Math.max(5, Math.round((end0.getTime() - start0.getTime()) / 60000)));
  const [staffId, setStaffId] = useState<string>(appointment?.staff_id ?? staff[0]?.id ?? "");
  const [serviceId, setServiceId] = useState<string>(appointment?.service_id ?? services[0]?.id ?? "");
  const [customerId, setCustomerId] = useState<string>(appointment?.customer_id ?? "");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [notes, setNotes] = useState(appointment?.notes ?? "");
  const [status, setStatus] = useState<Appointment["status"]>(appointment?.status ?? "confirmed");
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState<{
    clashes: Array<{ id: string; starts_at: string; ends_at: string; customer_id: string | null; service_id: string | null }>;
    suggested: Date | null;
    attemptedStart: Date;
    attemptedEnd: Date;
    availableStaffIds: string[];
  } | null>(null);
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterLocation, setFilterLocation] = useState<string>("all");

  useEffect(() => {
    if (conflict) { setFilterRole("all"); setFilterLocation("all"); }
  }, [conflict]);

  const roleOptions = useMemo(() => {
    const set = new Set<string>();
    staff.forEach((s) => { if (s.role && s.role.trim()) set.add(s.role.trim()); });
    return Array.from(set).sort();
  }, [staff]);
  const locationOptions = useMemo(() => {
    const set = new Set<string>();
    staff.forEach((s) => { if (s.location && s.location.trim()) set.add(s.location.trim()); });
    return Array.from(set).sort();
  }, [staff]);

  const filteredAvailableStaffIds = useMemo(() => {
    if (!conflict) return [];
    return conflict.availableStaffIds.filter((id) => {
      const s = staff.find((x) => x.id === id);
      if (!s) return false;
      if (filterRole !== "all" && (s.role ?? "") !== filterRole) return false;
      if (filterLocation !== "all" && (s.location ?? "") !== filterLocation) return false;
      return true;
    });
  }, [conflict, staff, filterRole, filterLocation]);

  const onServiceChange = (id: string) => {
    setServiceId(id);
    const svc = services.find((s) => s.id === id);
    if (svc && mode === "create") setDuration(svc.duration_minutes);
  };

  const findNextAvailableSlot = async (
    sid: string,
    durationMin: number,
    fromDate: Date,
  ): Promise<Date | null> => {
    const horizon = addDays(startOfDay(fromDate), 14);
    const { data } = await supabase
      .from("appointments")
      .select("id, starts_at, ends_at")
      .eq("business_id", businessId)
      .eq("staff_id", sid)
      .not("status", "in", "(cancelled,no_show)")
      .gte("ends_at", fromDate.toISOString())
      .lte("starts_at", horizon.toISOString())
      .order("starts_at");

    const busy = (data ?? [])
      .filter((a) => !(mode === "edit" && appointment && a.id === appointment.id))
      .map((a) => [parseISO(a.starts_at).getTime(), parseISO(a.ends_at).getTime()] as [number, number]);

    const STEP = 5 * 60 * 1000;
    const durMs = durationMin * 60 * 1000;

    for (let i = 0; i < 14; i++) {
      const day = addDays(startOfDay(fromDate), i);
      const dayStart = new Date(day); dayStart.setHours(HOUR_START, 0, 0, 0);
      const dayEnd = new Date(day); dayEnd.setHours(HOUR_END, 0, 0, 0);
      let cursor = Math.max(i === 0 ? fromDate.getTime() : 0, dayStart.getTime());
      cursor = Math.ceil(cursor / STEP) * STEP;
      const dayBusy = busy
        .filter(([s, e]) => e > dayStart.getTime() && s < dayEnd.getTime())
        .sort((a, b) => a[0] - b[0]);
      while (cursor + durMs <= dayEnd.getTime()) {
        const overlap = dayBusy.find(([s, e]) => s < cursor + durMs && e > cursor);
        if (!overlap) return new Date(cursor);
        cursor = Math.ceil(overlap[1] / STEP) * STEP;
      }
    }
    return null;
  };

  const findAvailableStaff = async (
    excludeStaffId: string,
    startsAt: Date,
    endsAt: Date,
  ): Promise<string[]> => {
    const candidates = staff.filter((s) => s.id !== excludeStaffId).map((s) => s.id);
    if (candidates.length === 0) return [];
    let q = supabase
      .from("appointments")
      .select("staff_id")
      .eq("business_id", businessId)
      .in("staff_id", candidates)
      .not("status", "in", "(cancelled,no_show)")
      .lt("starts_at", endsAt.toISOString())
      .gt("ends_at", startsAt.toISOString());
    if (mode === "edit" && appointment) q = q.neq("id", appointment.id);
    const { data, error } = await q;
    if (error) return [];
    const busy = new Set((data ?? []).map((r) => r.staff_id as string));
    return candidates.filter((id) => !busy.has(id));
  };

  const checkAndSurfaceConflict = async (sid: string, startsAt: Date, endsAt: Date) => {
    let q = supabase
      .from("appointments")
      .select("id, starts_at, ends_at, customer_id, service_id")
      .eq("business_id", businessId)
      .eq("staff_id", sid)
      .not("status", "in", "(cancelled,no_show)")
      .lt("starts_at", endsAt.toISOString())
      .gt("ends_at", startsAt.toISOString())
      .order("starts_at");
    if (mode === "edit" && appointment) q = q.neq("id", appointment.id);
    const { data: clashes, error } = await q;
    if (error) { toast.error(error.message); return true; }
    if (!clashes || clashes.length === 0) return false;
    const [suggested, availableStaffIds] = await Promise.all([
      findNextAvailableSlot(sid, duration, endsAt),
      findAvailableStaff(sid, startsAt, endsAt),
    ]);
    setConflict({ clashes, suggested, attemptedStart: startsAt, attemptedEnd: endsAt, availableStaffIds });
    return true;
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);

    let cid = customerId || null;
    if (!cid && (newCustomerName.trim() || newCustomerPhone.trim())) {
      const { data, error } = await supabase.from("customers").insert({
        business_id: businessId,
        name: newCustomerName.trim() || null,
        phone: newCustomerPhone.trim() || null,
      }).select("id").single();
      if (error) { setSaving(false); return toast.error(error.message); }
      cid = data.id;
    }

    const [hh, mm] = time.split(":").map(Number);
    const startsAt = new Date(date); startsAt.setHours(hh, mm, 0, 0);
    const endsAt = addMinutes(startsAt, duration);

    if (endsAt <= startsAt) {
      setSaving(false);
      return toast.error("End time must be after start time");
    }

    if (staffId && status !== "cancelled" && status !== "no_show") {
      const hasConflict = await checkAndSurfaceConflict(staffId, startsAt, endsAt);
      if (hasConflict) { setSaving(false); return; }
    }

    const payload = {
      business_id: businessId,
      customer_id: cid,
      staff_id: staffId || null,
      service_id: serviceId || null,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status,
      notes: notes.trim() || null,
    };

    const { error } = mode === "create"
      ? await supabase.from("appointments").insert({ ...payload, source: "manual" })
      : await supabase.from("appointments").update(payload).eq("id", appointment!.id);

    setSaving(false);
    if (error) {
      const msg = error.message || "";
      if (/time conflict/i.test(msg) || /staff member is already booked/i.test(msg)) {
        await checkAndSurfaceConflict(staffId, startsAt, endsAt);
        return;
      }
      if (/end time must be after start time/i.test(msg)) {
        return toast.error("End time must be after start time");
      }
      return toast.error(msg);
    }
    toast.success(mode === "create" ? "Appointment booked" : "Appointment updated");
    onSaved();
  };

  const applySuggestedSlot = (slot: Date) => {
    setDate(startOfDay(slot));
    setTime(format(slot, "HH:mm"));
    setConflict(null);
  };

  const applySuggestedStaff = (sid: string) => {
    setStaffId(sid);
    setConflict(null);
    toast.message(`Switched to ${staff.find((s) => s.id === sid)?.name ?? "another staff member"}`);
  };

  const remove = async () => {
    if (!appointment) return;
    if (!confirm("Delete this appointment?")) return;
    const { error } = await supabase.from("appointments").delete().eq("id", appointment.id);
    if (error) return toast.error(error.message);
    toast.success("Appointment deleted");
    onSaved();
  };

  const staffNameOf = (id: string) => staff.find((s) => s.id === id)?.name ?? "Staff";
  const custNameOf = (id: string | null) =>
    customers.find((c) => c.id === id)?.name || customers.find((c) => c.id === id)?.phone || "Walk-in";
  const svcNameOf = (id: string | null) => services.find((s) => s.id === id)?.name ?? "Service";

  return (
    <>
      <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">
              {mode === "create" ? "New appointment" : "Edit appointment"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="w-full justify-start font-normal">
                      <CalendarIcon className="h-4 w-4" />
                      {format(date, "EEE, MMM d")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(startOfDay(d))} initialFocus className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">Start time</Label>
                <Input id="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Service</Label>
                <Select value={serviceId} onValueChange={onServiceChange}>
                  <SelectTrigger><SelectValue placeholder="Pick a service" /></SelectTrigger>
                  <SelectContent>
                    {services.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name} · {s.duration_minutes}m</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">Duration (min)</Label>
                <Input id="duration" type="number" min={5} step={5} value={duration} onChange={(e) => setDuration(Number(e.target.value) || 30)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Staff</Label>
              <Select value={staffId} onValueChange={setStaffId}>
                <SelectTrigger><SelectValue placeholder="Pick a staff member" /></SelectTrigger>
                <SelectContent>
                  {staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Customer</Label>
              <Select value={customerId || "__new"} onValueChange={(v) => setCustomerId(v === "__new" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__new">+ New customer</SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name || c.phone || "Unnamed"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!customerId && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Input placeholder="Name" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} />
                  <Input placeholder="Phone" type="tel" value={newCustomerPhone} onChange={(e) => setNewCustomerPhone(e.target.value)} />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as Appointment["status"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="no_show">No show</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              {mode === "edit" && (
                <Button type="button" variant="ghost" onClick={remove} className="text-destructive mr-auto">
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              )}
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : mode === "create" ? "Book appointment" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!conflict} onOpenChange={(o) => { if (!o) setConflict(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Time conflict
            </DialogTitle>
          </DialogHeader>
          {conflict && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{staffNameOf(staffId)}</span> is already booked during{" "}
                <span className="font-mono">
                  {format(conflict.attemptedStart, "h:mm a")}–{format(conflict.attemptedEnd, "h:mm a")}
                </span>{" "}
                on {format(conflict.attemptedStart, "EEE, MMM d")}.
              </p>

              <div className="rounded-md border border-border divide-y divide-border">
                {conflict.clashes.map((c) => (
                  <div key={c.id} className="px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">{custNameOf(c.customer_id)}</span>
                      <span className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {format(parseISO(c.starts_at), "h:mm a")}–{format(parseISO(c.ends_at), "h:mm a")}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{svcNameOf(c.service_id)}</div>
                  </div>
                ))}
              </div>

              {conflict.suggested ? (
                <div className="rounded-md bg-accent/10 border border-accent/30 px-3 py-2 text-sm">
                  <p className="text-xs uppercase tracking-wide font-mono text-muted-foreground mb-1">
                    Next available
                  </p>
                  <p className="font-medium">
                    {format(conflict.suggested, "EEE, MMM d")} · {format(conflict.suggested, "h:mm a")}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No openings found in the next 14 days for {staffNameOf(staffId)}.</p>
              )}

              {conflict.availableStaffIds.length > 0 && (
                <div className="rounded-md bg-primary/5 border border-primary/30 px-3 py-3 text-sm space-y-2">
                  <p className="text-xs uppercase tracking-wide font-mono text-muted-foreground">
                    Available at this time · {filteredAvailableStaffIds.length}
                    {filteredAvailableStaffIds.length !== conflict.availableStaffIds.length && (
                      <span className="normal-case tracking-normal"> of {conflict.availableStaffIds.length}</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Free{" "}
                    <span className="font-mono">
                      {format(conflict.attemptedStart, "h:mm a")}–{format(conflict.attemptedEnd, "h:mm a")}
                    </span>
                  </p>

                  {(roleOptions.length > 0 || locationOptions.length > 0) && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {roleOptions.length > 0 && (
                        <div className="flex flex-col gap-1">
                          <Label className="text-[10px] uppercase tracking-wide font-mono text-muted-foreground">Role</Label>
                          <Select value={filterRole} onValueChange={setFilterRole}>
                            <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All roles</SelectItem>
                              {roleOptions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {locationOptions.length > 0 && (
                        <div className="flex flex-col gap-1">
                          <Label className="text-[10px] uppercase tracking-wide font-mono text-muted-foreground">Location</Label>
                          <Select value={filterLocation} onValueChange={setFilterLocation}>
                            <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All locations</SelectItem>
                              {locationOptions.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {(filterRole !== "all" || filterLocation !== "all") && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="self-end h-8"
                          onClick={() => { setFilterRole("all"); setFilterLocation("all"); }}
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-1">
                    {filteredAvailableStaffIds.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No staff match the selected filters.</p>
                    ) : (
                      filteredAvailableStaffIds.map((id) => {
                        const s = staff.find((x) => x.id === id);
                        const meta = [s?.role, s?.location].filter(Boolean).join(" · ");
                        return (
                          <Button
                            key={id}
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => applySuggestedStaff(id)}
                            title={meta || undefined}
                          >
                            Book with {staffNameOf(id)}
                            {meta && <span className="ml-1 text-[10px] opacity-70">({meta})</span>}
                          </Button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}


              <DialogFooter className="gap-2 sm:gap-2 flex-wrap">
                <Button type="button" variant="outline" onClick={() => setConflict(null)}>
                  Pick another time
                </Button>
                {conflict.suggested && (
                  <Button type="button" onClick={() => applySuggestedSlot(conflict.suggested!)}>
                    Use suggested slot
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
