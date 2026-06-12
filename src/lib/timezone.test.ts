import { describe, it, expect } from "vitest";
import {
  getZonedParts,
  tzOffsetMinutes,
  zonedTimeToUtc,
  minutesSinceMidnight,
  startOfZonedDay,
  isSameZonedDay,
  utcToInputValue,
  inputValueToUtc,
  resolveTimeZone,
} from "./timezone";

describe("timezone helpers", () => {
  describe("getZonedParts", () => {
    it("reads wall-clock parts in a non-UTC zone", () => {
      // 2026-06-15T12:00:00Z is 08:00 in New York (EDT, UTC-4).
      const p = getZonedParts(new Date("2026-06-15T12:00:00.000Z"), "America/New_York");
      expect(p).toMatchObject({ year: 2026, month: 6, day: 15, hour: 8, minute: 0 });
    });

    it("rolls the date back across midnight", () => {
      // 2026-06-15T02:00:00Z is 22:00 on the 14th in New York.
      const p = getZonedParts(new Date("2026-06-15T02:00:00.000Z"), "America/New_York");
      expect(p).toMatchObject({ month: 6, day: 14, hour: 22 });
    });
  });

  describe("tzOffsetMinutes", () => {
    it("returns DST offset for New York in summer", () => {
      expect(
        tzOffsetMinutes(new Date("2026-06-15T12:00:00.000Z"), "America/New_York"),
      ).toBe(-240);
    });

    it("returns standard offset for New York in winter", () => {
      expect(
        tzOffsetMinutes(new Date("2026-01-15T12:00:00.000Z"), "America/New_York"),
      ).toBe(-300);
    });

    it("returns positive offset east of UTC", () => {
      expect(
        tzOffsetMinutes(new Date("2026-06-15T12:00:00.000Z"), "Asia/Kolkata"),
      ).toBe(330);
    });
  });

  describe("zonedTimeToUtc round-trips with getZonedParts", () => {
    it("maps a wall-clock time to the right instant (summer DST)", () => {
      const utc = zonedTimeToUtc(2026, 6, 15, 9, 30, "America/New_York");
      // 09:30 EDT == 13:30 UTC
      expect(utc.toISOString()).toBe("2026-06-15T13:30:00.000Z");
    });

    it("maps a wall-clock time to the right instant (winter standard)", () => {
      const utc = zonedTimeToUtc(2026, 1, 15, 9, 30, "America/New_York");
      // 09:30 EST == 14:30 UTC
      expect(utc.toISOString()).toBe("2026-01-15T14:30:00.000Z");
    });

    it("round-trips a zone east of UTC", () => {
      const utc = zonedTimeToUtc(2026, 6, 15, 17, 45, "Asia/Kolkata");
      const p = getZonedParts(utc, "Asia/Kolkata");
      expect(p).toMatchObject({ hour: 17, minute: 45, day: 15 });
    });
  });

  describe("minutesSinceMidnight", () => {
    it("uses the target zone, not the host zone", () => {
      // 13:30 UTC == 09:30 New York → 9*60 + 30
      expect(
        minutesSinceMidnight(new Date("2026-06-15T13:30:00.000Z"), "America/New_York"),
      ).toBe(570);
    });
  });

  describe("startOfZonedDay", () => {
    it("returns the UTC instant of local midnight", () => {
      // Midnight June 15 in New York (EDT) == 04:00 UTC
      expect(startOfZonedDay(2026, 6, 15, "America/New_York").toISOString()).toBe(
        "2026-06-15T04:00:00.000Z",
      );
    });
  });

  describe("isSameZonedDay", () => {
    it("treats instants in the same local day as equal", () => {
      // Both are June 15 in New York even though one is June 16 in UTC.
      const a = new Date("2026-06-15T13:00:00.000Z"); // 09:00 NY
      const b = new Date("2026-06-16T01:00:00.000Z"); // 21:00 NY same day
      expect(isSameZonedDay(a, b, "America/New_York")).toBe(true);
    });

    it("separates instants on different local days", () => {
      const a = new Date("2026-06-15T13:00:00.000Z"); // 09:00 NY 15th
      const b = new Date("2026-06-16T13:00:00.000Z"); // 09:00 NY 16th
      expect(isSameZonedDay(a, b, "America/New_York")).toBe(false);
    });
  });

  describe("datetime-local input conversions", () => {
    it("formats an instant as the zone's wall clock", () => {
      expect(
        utcToInputValue("2026-06-15T13:30:00.000Z", "America/New_York"),
      ).toBe("2026-06-15T09:30");
    });

    it("parses a wall-clock value back to the right instant", () => {
      expect(inputValueToUtc("2026-06-15T09:30", "America/New_York")).toBe(
        "2026-06-15T13:30:00.000Z",
      );
    });

    it("round-trips input value through UTC and back", () => {
      const value = "2026-12-01T08:15";
      const iso = inputValueToUtc(value, "Europe/Berlin");
      expect(utcToInputValue(iso, "Europe/Berlin")).toBe(value);
    });
  });

  describe("resolveTimeZone", () => {
    it("keeps a valid zone", () => {
      expect(resolveTimeZone("Asia/Tokyo")).toBe("Asia/Tokyo");
    });

    it("falls back when the zone is missing or invalid", () => {
      expect(resolveTimeZone(null)).toBeTruthy();
      expect(resolveTimeZone("Not/AZone")).toBeTruthy();
    });
  });
});
