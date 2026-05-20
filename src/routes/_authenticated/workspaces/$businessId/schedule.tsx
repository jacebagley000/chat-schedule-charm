import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
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
  ArrowLeft, CalendarIcon, ChevronLeft, ChevronRight, Radio, Users, Loader2, Trash2,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const dragInfoRef = useRef<{ id: string; grabOffsetMin: number; durationMin: number } | null>(null);

  const SNAP_MIN = 15;

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, colId: string) => {
    e.preventDefault();
    setDropTarget(null);
    setDraggingId(null);
    const info = dragInfoRef.current;
    dragInfoRef.current = null;
    if (!info) return;
    const appt = appointments.find((a) => a.id === info.id);
    if (!appt) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const rawMin = y / PX_PER_MIN - info.grabOffsetMin;
    const snapped = Math.round(rawMin / SNAP_MIN) * SNAP_MIN;
    const startMin = Math.max(0, Math.min(TOTAL_MIN - info.durationMin, snapped));

    const newStart = new Date(day);
    newStart.setHours(HOUR_START, 0, 0, 0);
    newStart.setMinutes(newStart.getMinutes() + startMin);
    const newEnd = new Date(newStart.getTime() + info.durationMin * 60_000);

    const newStaffId = colId === "__unassigned" ? null : colId;

    // No-op if nothing actually changed.
    if (
      newStart.toISOString() === appt.starts_at &&
      newEnd.toISOString() === appt.ends_at &&
      newStaffId === appt.staff_id
    ) {
      return;
    }

    const { error } = await supabase
      .from("appointments")
      .update({
        starts_at: newStart.toISOString(),
        ends_at: newEnd.toISOString(),
        staff_id: newStaffId,
      })
      .eq("id", appt.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Moved to ${format(newStart, "h:mm a")}`);
    }
  };

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
                const isOver = dropTarget === c.id;
                return (
                  <div
                    key={c.id}
                    className={cn(
                      "relative border-r border-border last:border-r-0 transition-colors",
                      isOver && "bg-accent/30",
                    )}
                    style={{ height: `${TOTAL_MIN * PX_PER_MIN}px` }}
                    onDragOver={(e) => {
                      if (!dragInfoRef.current) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      if (dropTarget !== c.id) setDropTarget(c.id);
                    }}
                    onDragLeave={(e) => {
                      // Only clear if leaving the column itself (not bubbling from a child).
                      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                      if (dropTarget === c.id) setDropTarget(null);
                    }}
                    onDrop={(e) => handleDrop(e, c.id)}
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
                        className="absolute left-0 right-0 z-10 flex items-center pointer-events-none"
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
                      const isDragging = draggingId === a.id;
                      return (
                        <button
                          key={a.id}
                          type="button"
                          draggable
                          onDragStart={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const grabOffsetMin = (e.clientY - rect.top) / PX_PER_MIN;
                            dragInfoRef.current = {
                              id: a.id,
                              grabOffsetMin,
                              durationMin: duration,
                            };
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData("text/plain", a.id);
                            setDraggingId(a.id);
                          }}
                          onDragEnd={() => {
                            dragInfoRef.current = null;
                            setDraggingId(null);
                            setDropTarget(null);
                          }}
                          onClick={() => {
                            if (draggingId) return;
                            setEditingId(a.id);
                          }}
                          className={cn(
                            "absolute left-1 right-1 rounded-md border px-2 py-1 text-xs text-left shadow-sm hover:shadow-md hover:ring-2 hover:ring-accent/40 transition-all cursor-grab active:cursor-grabbing",
                            STATUS_STYLES[a.status],
                            isDragging && "opacity-40 ring-2 ring-primary",
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
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-4 font-mono">
          Updates in real time. {appointments.length} appointment
          {appointments.length === 1 ? "" : "s"} on {format(day, "EEE, MMM d")}.
        </p>
      </main>

      <EditAppointmentSheet
        appointment={editing}
        staff={staff}
        customers={customers}
        services={services}
        onClose={() => setEditingId(null)}
      />
    </div>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const STATUS_OPTIONS: Array<{ value: Appointment["status"]; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show", label: "No-show" },
];

function EditAppointmentSheet({
  appointment, staff, customers, services, onClose,
}: {
  appointment: Appointment | null;
  staff: Staff[];
  customers: Customer[];
  services: Service[];
  onClose: () => void;
}) {
  const [status, setStatus] = useState<Appointment["status"]>("pending");
  const [staffId, setStaffId] = useState<string>("__unassigned");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [conflict, setConflict] = useState<Appointment | null>(null);

  const remove = async () => {
    if (!appointment) return;
    setDeleting(true);
    const { error } = await supabase
      .from("appointments")
      .delete()
      .eq("id", appointment.id);
    setDeleting(false);
    if (error) return toast.error(error.message);
    toast.success("Appointment deleted");
    onClose();
  };

  useEffect(() => {
    if (!appointment) return;
    setStatus(appointment.status);
    setStaffId(appointment.staff_id ?? "__unassigned");
    setStartsAt(toLocalInput(appointment.starts_at));
    setEndsAt(toLocalInput(appointment.ends_at));
    setNotes(appointment.notes ?? "");
    setConflict(null);
  }, [appointment?.id]);

  const open = !!appointment;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!appointment) return;
    const startDate = new Date(startsAt);
    const endDate = new Date(endsAt);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return toast.error("Please enter valid start and end times.");
    }
    if (endDate <= startDate) {
      return toast.error("End time must be after start time.");
    }
    setConflict(null);
    setSaving(true);
    const targetStaffId = staffId === "__unassigned" ? null : staffId;
    const { error } = await supabase
      .from("appointments")
      .update({
        status,
        staff_id: targetStaffId,
        starts_at: startDate.toISOString(),
        ends_at: endDate.toISOString(),
        notes: notes.trim() || null,
      })
      .eq("id", appointment.id);
    setSaving(false);
    if (error) {
      if (/time conflict/i.test(error.message) && targetStaffId) {
        const { data: conflicts } = await supabase
          .from("appointments")
          .select("*")
          .eq("business_id", appointment.business_id)
          .eq("staff_id", targetStaffId)
          .neq("id", appointment.id)
          .not("status", "in", "(cancelled,no_show)")
          .lt("starts_at", endDate.toISOString())
          .gt("ends_at", startDate.toISOString())
          .limit(1);
        setConflict((conflicts?.[0] as Appointment | undefined) ?? null);
      }
      return toast.error(error.message);
    }
    toast.success("Appointment updated");
    onClose();
  };


  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="font-serif text-2xl">Edit appointment</SheetTitle>
          <SheetDescription>
            Changes save instantly and broadcast to everyone watching.
          </SheetDescription>
        </SheetHeader>

        {appointment && (
          <form onSubmit={submit} className="flex-1 flex flex-col gap-4 mt-4">
            {conflict && (
              <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">
                <div className="font-semibold mb-1">Time conflict</div>
                <div className="text-xs">
                  Overlaps with{" "}
                  <span className="font-medium">
                    {customers.find((c) => c.id === conflict.customer_id)?.name ?? "Unknown customer"}
                  </span>
                  {conflict.service_id && (
                    <> — {services.find((s) => s.id === conflict.service_id)?.name ?? "service"}</>
                  )}
                  <br />
                  {format(parseISO(conflict.starts_at), "EEE, MMM d · h:mm a")} –{" "}
                  {format(parseISO(conflict.ends_at), "h:mm a")}
                  {" · "}
                  <span className="capitalize">{conflict.status.replace("_", " ")}</span>
                  {conflict.staff_id && (
                    <> · {staff.find((s) => s.id === conflict.staff_id)?.name ?? "staff"}</>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as Appointment["status"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Staff</Label>
              <Select value={staffId} onValueChange={setStaffId}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unassigned">Unassigned</SelectItem>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="startsAt">Starts</Label>
                <Input
                  id="startsAt" type="datetime-local"
                  value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endsAt">Ends</Label>
                <Input
                  id="endsAt" type="datetime-local"
                  value={endsAt} onChange={(e) => setEndsAt(e.target.value)} required
                />
              </div>
            </div>

            <div className="space-y-2 flex-1">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes" rows={5} value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything the team should know…"
              />
            </div>

            <SheetFooter className="mt-auto flex-row justify-between sm:justify-between gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    disabled={saving || deleting}
                  >
                    {deleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this appointment?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently removes the appointment from the schedule.
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={remove}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={onClose} disabled={saving || deleting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving || deleting}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </SheetFooter>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}

