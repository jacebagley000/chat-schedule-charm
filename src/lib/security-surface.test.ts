import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Automated regression tests for the SECURITY DEFINER helpers, RLS policies,
 * and audit triggers. Runs the SQL suite in supabase/tests/security_surface.sql
 * via psql. Skipped locally when the managed PG* env vars aren't present;
 * always runs in CI where they are.
 */

const sqlFile = resolve(__dirname, "../../supabase/tests/security_surface.sql");
const hasPsql = spawnSync("psql", ["--version"]).status === 0;
const hasEnv = Boolean(process.env.PGHOST);
const canRun = hasPsql && hasEnv && existsSync(sqlFile);

describe.skipIf(!canRun)("security surface (SQL regression)", () => {
  it("passes every SECURITY DEFINER + RLS + trigger assertion", () => {
    const result = spawnSync("psql", ["-v", "ON_ERROR_STOP=1", "-f", sqlFile], {
      encoding: "utf8",
    });
    const output = `${result.stdout}\n${result.stderr}`;
    if (result.status !== 0) {
      throw new Error(`psql regression suite failed:\n${output}`);
    }
    expect(output).toContain("ALL SECURITY REGRESSION CHECKS PASSED");
    // Every non-skipped group must have printed its OK line; catch silent drops.
    const okOrSkip = output.match(/NOTICE:\s+(OK|SKIP)\s+\(\d+\)/g) ?? [];
    expect(okOrSkip.length).toBeGreaterThanOrEqual(12);
  }, 30_000);
});

describe.skipIf(canRun)("security surface (SQL regression)", () => {
  it.skip("skipped: psql/PGHOST unavailable in this environment", () => {});
});
