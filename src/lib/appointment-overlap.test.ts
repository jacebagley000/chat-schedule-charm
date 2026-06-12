import { describe, it, expect } from "vitest";
import {
  assertSaveAllowed,
  findStaffConflict,
  OverlapError,
  InvalidRangeError,
  type AppointmentRow,
} from "./appointment-overlap";

const BIZ = "biz-1";
const STAFF_A = "staff-a";
const STAFF_B = "staff-b";

function appt(overrides: Partial<AppointmentRow> = {}): AppointmentRow {
  return {
    id: "existing-1",
    business_id: BIZ,
    staff_id: STAFF_A,
    starts_at: "2026-06-15T10:00:00.000Z",
    ends_at: "2026-06-15T11:00:00.000Z",
    status: "confirmed",
    ...overrides,
  };
}

describe("staff overlap validation", () => {
  const existing = [appt()];

  describe("insert flow (new appointment, no matching id)", () => {
    it("blocks an overlapping save for the same staff member", () => {
      const candidate = appt({
        id: "new-1",
        starts_at: "2026-06-15T10:30:00.000Z",
        ends_at: "2026-06-15T11:30:00.000Z",
      });
      expect(findStaffConflict(candidate, existing)).not.toBeNull();
      expect(() => assertSaveAllowed(candidate, existing)).toThrow(OverlapError);
    });

    it("blocks a save fully contained within an existing booking", () => {
      const candidate = appt({
        id: "new-2",
        starts_at: "2026-06-15T10:15:00.000Z",
        ends_at: "2026-06-15T10:45:00.000Z",
      });
      expect(() => assertSaveAllowed(candidate, existing)).toThrow(OverlapError);
    });

    it("allows a back-to-back save (half-open boundary)", () => {
      const candidate = appt({
        id: "new-3",
        starts_at: "2026-06-15T11:00:00.000Z",
        ends_at: "2026-06-15T12:00:00.000Z",
      });
      expect(findStaffConflict(candidate, existing)).toBeNull();
      expect(() => assertSaveAllowed(candidate, existing)).not.toThrow();
    });

    it("allows an overlapping save for a different staff member", () => {
      const candidate = appt({
        id: "new-4",
        staff_id: STAFF_B,
        starts_at: "2026-06-15T10:30:00.000Z",
        ends_at: "2026-06-15T11:30:00.000Z",
      });
      expect(() => assertSaveAllowed(candidate, existing)).not.toThrow();
    });

    it("ignores cancelled/no_show existing appointments", () => {
      const candidate = appt({
        id: "new-5",
        starts_at: "2026-06-15T10:30:00.000Z",
        ends_at: "2026-06-15T11:30:00.000Z",
      });
      expect(
        assertSaveAllowed(candidate, [appt({ status: "cancelled" })]),
      ).toBeUndefined();
      expect(
        assertSaveAllowed(candidate, [appt({ status: "no_show" })]),
      ).toBeUndefined();
    });

    it("does not block when the candidate itself is cancelled/no_show", () => {
      const candidate = appt({
        id: "new-6",
        status: "cancelled",
        starts_at: "2026-06-15T10:30:00.000Z",
        ends_at: "2026-06-15T11:30:00.000Z",
      });
      expect(() => assertSaveAllowed(candidate, existing)).not.toThrow();
    });
  });

  describe("update flow (existing appointment, matching id)", () => {
    it("does not conflict with itself when unchanged", () => {
      const candidate = appt(); // same id as existing
      expect(findStaffConflict(candidate, existing)).toBeNull();
      expect(() => assertSaveAllowed(candidate, existing)).not.toThrow();
    });

    it("blocks an update that moves onto another booking for the same staff", () => {
      const rows = [
        appt({ id: "a" }),
        appt({
          id: "b",
          starts_at: "2026-06-15T12:00:00.000Z",
          ends_at: "2026-06-15T13:00:00.000Z",
        }),
      ];
      const candidate = appt({
        id: "b",
        starts_at: "2026-06-15T10:30:00.000Z",
        ends_at: "2026-06-15T11:30:00.000Z",
      });
      expect(findStaffConflict(candidate, rows)?.id).toBe("a");
      expect(() => assertSaveAllowed(candidate, rows)).toThrow(OverlapError);
    });

    it("allows an update that stays clear of other bookings", () => {
      const rows = [
        appt({ id: "a" }),
        appt({
          id: "b",
          starts_at: "2026-06-15T12:00:00.000Z",
          ends_at: "2026-06-15T13:00:00.000Z",
        }),
      ];
      const candidate = appt({
        id: "b",
        starts_at: "2026-06-15T14:00:00.000Z",
        ends_at: "2026-06-15T15:00:00.000Z",
      });
      expect(() => assertSaveAllowed(candidate, rows)).not.toThrow();
    });

    it("allows resolving a conflict by cancelling the moved appointment", () => {
      const rows = [appt({ id: "a" })];
      const candidate = appt({
        id: "b",
        status: "cancelled",
        starts_at: "2026-06-15T10:30:00.000Z",
        ends_at: "2026-06-15T11:30:00.000Z",
      });
      expect(() => assertSaveAllowed(candidate, rows)).not.toThrow();
    });
  });

  describe("end == start boundary (half-open, not an overlap)", () => {
    it("allows a candidate that starts exactly when an existing booking ends", () => {
      const candidate = appt({
        id: "after",
        starts_at: "2026-06-15T11:00:00.000Z",
        ends_at: "2026-06-15T12:00:00.000Z",
      });
      expect(findStaffConflict(candidate, existing)).toBeNull();
      expect(() => assertSaveAllowed(candidate, existing)).not.toThrow();
    });

    it("allows a candidate that ends exactly when an existing booking starts", () => {
      const candidate = appt({
        id: "before",
        starts_at: "2026-06-15T09:00:00.000Z",
        ends_at: "2026-06-15T10:00:00.000Z",
      });
      expect(findStaffConflict(candidate, existing)).toBeNull();
      expect(() => assertSaveAllowed(candidate, existing)).not.toThrow();
    });

    it("blocks when the candidate overlaps by even a single minute", () => {
      const candidate = appt({
        id: "barely",
        starts_at: "2026-06-15T10:59:00.000Z",
        ends_at: "2026-06-15T11:59:00.000Z",
      });
      expect(() => assertSaveAllowed(candidate, existing)).toThrow(OverlapError);
    });
  });



  describe("range validation", () => {
    it("rejects an end time that is not after the start time", () => {
      const candidate = appt({
        id: "new-bad",
        starts_at: "2026-06-15T11:00:00.000Z",
        ends_at: "2026-06-15T11:00:00.000Z",
      });
      expect(() => assertSaveAllowed(candidate, [])).toThrow(InvalidRangeError);
    });
  });
});
