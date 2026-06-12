// Mirrors the database trigger `public.prevent_staff_appointment_overlap`
// (see supabase/migrations) so the scheduling overlap rule can be unit-tested.
// The database trigger remains the source of truth and the only enforcement
// point at runtime; this helper documents and verifies the same logic.
//
// BOUNDARY RULE (decided, documented, and enforced everywhere):
// Appointments use HALF-OPEN time intervals [starts_at, ends_at). An end time
// that exactly equals another appointment's start time is NOT an overlap —
// e.g. 10:00–11:00 and 11:00–12:00 are valid back-to-back bookings for the
// same staff member. The comparison is strict on both sides:
//   existing.starts_at < candidate.ends_at AND existing.ends_at > candidate.starts_at
// A zero-length appointment (ends_at == starts_at) is rejected separately as an
// invalid range, not as an overlap. The same predicate is used by the DB trigger
// and the UI conflict lookup so all three layers agree.


export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";

export interface AppointmentRow {
  id: string;
  business_id: string;
  staff_id: string | null;
  starts_at: string; // ISO timestamp
  ends_at: string; // ISO timestamp
  status: AppointmentStatus;
}

/** Statuses that free up the slot and are ignored for conflict checks. */
export const INACTIVE_STATUSES: AppointmentStatus[] = ["cancelled", "no_show"];

export class OverlapError extends Error {}
export class InvalidRangeError extends Error {}

function isActive(status: AppointmentStatus): boolean {
  return !INACTIVE_STATUSES.includes(status);
}

/**
 * Returns the first existing appointment that conflicts with `candidate`
 * for the same staff member, or `null` when the save is allowed.
 *
 * Covers both insert (candidate.id not present in `existing`) and update
 * (candidate.id matches a row in `existing`, which is excluded from itself).
 */
export function findStaffConflict(
  candidate: AppointmentRow,
  existing: AppointmentRow[],
): AppointmentRow | null {
  // No staff assigned or inactive status → never blocks.
  if (candidate.staff_id === null) return null;
  if (!isActive(candidate.status)) return null;

  const candidateStart = new Date(candidate.starts_at).getTime();
  const candidateEnd = new Date(candidate.ends_at).getTime();

  return (
    existing.find((row) => {
      if (row.id === candidate.id) return false; // exclude self (update flow)
      if (row.staff_id !== candidate.staff_id) return false;
      if (row.business_id !== candidate.business_id) return false;
      if (!isActive(row.status)) return false;
      const rowStart = new Date(row.starts_at).getTime();
      const rowEnd = new Date(row.ends_at).getTime();
      // Half-open overlap: starts_at < other.ends_at AND ends_at > other.starts_at
      return rowStart < candidateEnd && rowEnd > candidateStart;
    }) ?? null
  );
}

/**
 * Validates a save the way the database trigger does. Throws on an invalid
 * time range or an overlap, otherwise returns normally.
 */
export function assertSaveAllowed(
  candidate: AppointmentRow,
  existing: AppointmentRow[],
): void {
  if (candidate.staff_id !== null && isActive(candidate.status)) {
    const start = new Date(candidate.starts_at).getTime();
    const end = new Date(candidate.ends_at).getTime();
    if (end <= start) {
      throw new InvalidRangeError(
        "Appointment end time must be after start time",
      );
    }
  }

  const conflict = findStaffConflict(candidate, existing);
  if (conflict) {
    throw new OverlapError("Time conflict: staff member is already booked");
  }
}
