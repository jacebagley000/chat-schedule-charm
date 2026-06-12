// Timezone-aware scheduling helpers.
//
// Appointments are stored as UTC instants (timestamptz). Conflict detection in
// the DB trigger and in src/lib/appointment-overlap.ts compares instants, which
// is timezone-invariant — two instants overlap regardless of how they are
// displayed. These helpers make DISPLAY and INPUT consistent by converting
// between a UTC instant and the wall-clock time in a specific IANA timezone
// (the business's configured timezone), so every user sees and edits the same
// local time end-to-end.

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number;
  second: number;
}

/** Resolve a usable IANA timezone, falling back to the viewer's own zone. */
export function resolveTimeZone(timeZone?: string | null): string {
  if (timeZone) {
    try {
      // Throws RangeError for an invalid identifier.
      new Intl.DateTimeFormat("en-US", { timeZone });
      return timeZone;
    } catch {
      /* fall through */
    }
  }
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

/** Wall-clock parts of an instant as observed in `timeZone`. */
export function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  // Intl can emit "24" for midnight in some environments; normalize to 0.
  const hour = Number(map.hour) % 24;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour,
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

/** Offset (minutes) of `timeZone` from UTC at the given instant. */
export function tzOffsetMinutes(date: Date, timeZone: string): number {
  const p = getZonedParts(date, timeZone);
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUTC - date.getTime()) / 60000);
}

/**
 * Convert wall-clock components in `timeZone` to the corresponding UTC instant.
 * Iterates twice so it stays correct across DST offset changes.
 */
export function zonedTimeToUtc(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const guessMs = Date.UTC(year, month - 1, day, hour, minute);
  let result = new Date(guessMs - tzOffsetMinutes(new Date(guessMs), timeZone) * 60000);
  // Refine once: the offset at the guess may differ from the offset at result.
  result = new Date(guessMs - tzOffsetMinutes(result, timeZone) * 60000);
  return result;
}

/** Minutes since local midnight for `date` as seen in `timeZone`. */
export function minutesSinceMidnight(date: Date, timeZone: string): number {
  const p = getZonedParts(date, timeZone);
  return p.hour * 60 + p.minute;
}

/** UTC instant for the start of the given calendar day in `timeZone`. */
export function startOfZonedDay(
  year: number,
  month: number,
  day: number,
  timeZone: string,
): Date {
  return zonedTimeToUtc(year, month, day, 0, 0, timeZone);
}

/** `true` when both instants fall on the same calendar day in `timeZone`. */
export function isSameZonedDay(a: Date, b: Date, timeZone: string): boolean {
  const pa = getZonedParts(a, timeZone);
  const pb = getZonedParts(b, timeZone);
  return pa.year === pb.year && pa.month === pb.month && pa.day === pb.day;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO instant → "YYYY-MM-DDTHH:mm" wall clock in `timeZone` (datetime-local). */
export function utcToInputValue(iso: string, timeZone: string): string {
  const p = getZonedParts(new Date(iso), timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** "YYYY-MM-DDTHH:mm" wall clock in `timeZone` → UTC ISO instant. */
export function inputValueToUtc(value: string, timeZone: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return new Date(value).toISOString();
  const [, y, mo, d, h, mi] = m;
  return zonedTimeToUtc(
    Number(y),
    Number(mo),
    Number(d),
    Number(h),
    Number(mi),
    timeZone,
  ).toISOString();
}

/** Short timezone label for display, e.g. "EDT" or "GMT+2". */
export function tzAbbreviation(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "short",
  }).formatToParts(date);
  return parts.find((p) => p.type === "timeZoneName")?.value ?? timeZone;
}
