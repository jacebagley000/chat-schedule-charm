import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
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

/**
 * Parse the SQL suite to build an ordered index of `Group N: <title>` headers
 * so a failure can be reported with the exact group name and source line.
 */
function loadGroupIndex(): Map<number, { title: string; line: number }> {
  const groups = new Map<number, { title: string; line: number }>();
  if (!existsSync(sqlFile)) return groups;
  const src = readFileSync(sqlFile, "utf8").split(/\r?\n/);
  const re = /Group\s+(\d+)\s*:\s*(.+?)\s*$/i;
  src.forEach((line, i) => {
    const m = line.match(re);
    if (m) {
      const n = Number(m[1]);
      if (!groups.has(n)) groups.set(n, { title: m[2].replace(/\.$/, ""), line: i + 1 });
    }
  });
  return groups;
}

/**
 * Given full psql output, return the highest group number that already
 * printed `OK (N)` or `SKIP (N)` so the failing group is N+1.
 */
function lastCompletedGroup(output: string): number {
  let max = 0;
  const re = /\b(?:OK|SKIP)\s+\((\d+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(output))) {
    const n = Number(m[1]);
    if (n > max) max = n;
  }
  return max;
}

/**
 * Extract the meaningful lines around the first psql ERROR: the ERROR itself,
 * any CONTEXT/DETAIL/HINT lines that immediately follow, and up to 3 lines of
 * NOTICE breadcrumbs before it. Keeps the failure report short and targeted.
 */
function extractFailureExcerpt(output: string): string {
  const lines = output.split(/\r?\n/);
  const errIdx = lines.findIndex((l) => /\bERROR:/.test(l));
  if (errIdx === -1) {
    // No explicit ERROR (e.g. connection failure); return the tail.
    return lines.slice(-20).join("\n").trim();
  }
  const start = Math.max(0, errIdx - 3);
  let end = errIdx + 1;
  while (
    end < lines.length &&
    /^(?:psql:|\s*)(CONTEXT|DETAIL|HINT|LINE|QUERY|STATEMENT)\b/.test(lines[end])
  ) {
    end += 1;
  }
  return lines.slice(start, end).join("\n").trim();
}

function formatFailure(output: string): string {
  const groups = loadGroupIndex();
  const lastOk = lastCompletedGroup(output);
  const failingNum = lastOk + 1;
  const failing = groups.get(failingNum);
  const totalGroups = groups.size;

  const header = failing
    ? `Failing group: ${failingNum}/${totalGroups} — ${failing.title}\n` +
      `Source:        supabase/tests/security_surface.sql:${failing.line}`
    : `Failing group: unknown (last completed: ${lastOk}/${totalGroups})`;

  const passed =
    lastOk > 0
      ? `Passed groups: ${Array.from({ length: lastOk }, (_, i) => i + 1).join(", ")}`
      : "Passed groups: none";

  const excerpt = extractFailureExcerpt(output);

  return [
    "Security regression suite failed.",
    "",
    header,
    passed,
    "",
    "psql output (relevant slice):",
    "----------------------------------------",
    excerpt,
    "----------------------------------------",
  ].join("\n");
}

describe.skipIf(!canRun)("security surface (SQL regression)", () => {
  it("passes every SECURITY DEFINER + RLS + trigger assertion", () => {
    const result = spawnSync("psql", ["-v", "ON_ERROR_STOP=1", "-f", sqlFile], {
      encoding: "utf8",
    });
    const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;

    if (result.status !== 0) {
      throw new Error(formatFailure(combined));
    }

    if (!combined.includes("ALL SECURITY REGRESSION CHECKS PASSED")) {
      throw new Error(
        `Security regression suite exited 0 but never printed the final "ALL SECURITY REGRESSION CHECKS PASSED" banner.\n\n` +
          formatFailure(combined),
      );
    }

    // Every non-skipped group must have printed its OK line; catch silent drops.
    const okOrSkip = combined.match(/\b(?:OK|SKIP)\s+\((\d+)\)/g) ?? [];
    expect(
      okOrSkip.length,
      `Expected at least 12 group results, got ${okOrSkip.length}.\n${formatFailure(combined)}`,
    ).toBeGreaterThanOrEqual(12);
  }, 30_000);
});

describe.skipIf(canRun)("security surface (SQL regression)", () => {
  it.skip("skipped: psql/PGHOST unavailable in this environment", () => {});
});
