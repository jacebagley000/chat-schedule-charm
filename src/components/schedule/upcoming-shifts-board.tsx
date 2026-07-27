// Shared "upcoming shifts" board used by the app (editable) and any
// public/marketing embed (read-only). Callers own data fetching and mutations;
// this component is pure presentation + a couple of controlled Selects.

import { useMemo } from "react";
import { Building2, Clock, User } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  formatZonedTime,
  getZonedParts,
  isSameZonedDay,
  resolveTimeZone,
  tzAbbreviation,
} from "@/lib/timezone";
import { cn } from "@/lib/utils";

export type ShiftStatus =
  | "pending" | "confirmed" | "completed" | "cancelled" | "no_show";

export interface ShiftRow {
  id: string;
  business_id: string;
  business_name: string;
  business_timezone: string | null;
  starts_at: string; // ISO
  ends_at: string;   // ISO
  status: ShiftStatus;
  staff_id: string | null;
  staff_name: string | null;
  service_name: string | null;
  customer_name: string | null;
}

export interface StaffOption {
  id: string;
  name: string;
  business_id: string;
}

export interface UpcomingShiftsBoardProps {
  shifts: ShiftRow[];
  staff: StaffOption[];
  mode?: "view" | "edit";
  windowDays?: number; // default 7
  onAssignStaff?: (shiftId: string, staffId: string | null) => void | Promise<void>;
  onStatusChange?: (shiftId: string, status: ShiftStatus) => void | Promise<void>;
  emptyMessage?: string;
}

const STATUS_STYLES: Record<ShiftStatus, string> = {
  pending: "bg-amber-100 text-amber-900 border-amber-300",
  confirmed: "bg-emerald-100 text-emerald-900 border-emerald-300",
  completed: "bg-stone-200 text-stone-700 border-stone-300",
  cancelled: "bg-rose-100 text-rose-900 border-rose-300",
  no_show: "bg-rose-50 text-rose-700 border-rose-200",
};

const STATUSES: ShiftStatus[] = [
  "pending", "confirmed", "completed", "cancelled", "no_show",
];

interface DayGroup {
  key: string;
  label: string;
  timezone: string;
  rows: ShiftRow[];
}

function buildDayGroups(shifts: ShiftRow[], windowDays: number): DayGroup[] {
  const now = new Date();
  const horizon = new Date(now.getTime() + windowDays * 86400_000);
  const inWindow = shifts
    .filter((s) => {
      const start = new Date(s.starts_at);
      return start >= new Date(now.getTime() - 60 * 60_000) && start <= horizon;
    })
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  const groups = new Map<string, DayGroup>();
  for (const row of inWindow) {
    const tz = resolveTimeZone(row.business_timezone);
    const p = getZonedParts(new Date(row.starts_at), tz);
    const key = `${p.year}-${p.month}-${p.day}-${tz}`;
    if (!groups.has(key)) {
      const dateObj = new Date(row.starts_at);
      const label = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        weekday: "long",
        month: "short",
        day: "numeric",
      }).format(dateObj);
      const today = isSameZonedDay(dateObj, now, tz);
      const tomorrow = isSameZonedDay(
        dateObj,
        new Date(now.getTime() + 86400_000),
        tz,
      );
      groups.set(key, {
        key,
        label: today ? `Today · ${label}` : tomorrow ? `Tomorrow · ${label}` : label,
        timezone: tz,
        rows: [],
      });
    }
    groups.get(key)!.rows.push(row);
  }
  return Array.from(groups.values());
}

export function UpcomingShiftsBoard({
  shifts,
  staff,
  mode = "view",
  windowDays = 7,
  onAssignStaff,
  onStatusChange,
  emptyMessage = "No upcoming shifts in this window.",
}: UpcomingShiftsBoardProps) {
  const groups = useMemo(() => buildDayGroups(shifts, windowDays), [shifts, windowDays]);
  const staffByBusiness = useMemo(() => {
    const map = new Map<string, StaffOption[]>();
    for (const s of staff) {
      if (!map.has(s.business_id)) map.set(s.business_id, []);
      map.get(s.business_id)!.push(s);
    }
    return map;
  }, [staff]);

  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`day-${group.key}`}>
          <div className="flex items-baseline justify-between mb-3">
            <h2
              id={`day-${group.key}`}
              className="font-serif text-lg tracking-tight"
            >
              {group.label}
            </h2>
            <span className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
              {tzAbbreviation(new Date(group.rows[0].starts_at), group.timezone)}
              {" · "}
              {group.rows.length} shift{group.rows.length === 1 ? "" : "s"}
            </span>
          </div>

          <ul className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
            {group.rows.map((row) => {
              const tz = resolveTimeZone(row.business_timezone);
              const start = new Date(row.starts_at);
              const end = new Date(row.ends_at);
              const bizStaff = staffByBusiness.get(row.business_id) ?? [];
              return (
                <li
                  key={row.id}
                  className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto] items-center gap-4 p-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-mono tabular-nums">
                        {formatZonedTime(start, tz)} – {formatZonedTime(end, tz)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <Building2 className="h-3 w-3" />
                      <span className="truncate">{row.business_name}</span>
                    </div>
                    <div className="mt-1 text-sm truncate">
                      {row.service_name ?? <span className="text-muted-foreground italic">No service</span>}
                      {row.customer_name && (
                        <span className="text-muted-foreground"> · {row.customer_name}</span>
                      )}
                    </div>
                  </div>

                  <div className="min-w-0">
                    {mode === "edit" && onAssignStaff ? (
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <Select
                          value={row.staff_id ?? "__unassigned"}
                          onValueChange={(v) =>
                            onAssignStaff(row.id, v === "__unassigned" ? null : v)
                          }
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Unassigned" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__unassigned">Unassigned</SelectItem>
                            {bizStaff.map((s) => (
                              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className={cn(!row.staff_name && "text-muted-foreground italic")}>
                          {row.staff_name ?? "Unassigned"}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="justify-self-start md:justify-self-end">
                    {mode === "edit" && onStatusChange ? (
                      <Select
                        value={row.status}
                        onValueChange={(v) => onStatusChange(row.id, v as ShiftStatus)}
                      >
                        <SelectTrigger
                          className={cn(
                            "h-8 w-[140px] text-xs font-medium border",
                            STATUS_STYLES[row.status],
                          )}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline" className={cn("border", STATUS_STYLES[row.status])}>
                        {row.status.replace("_", " ")}
                      </Badge>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
