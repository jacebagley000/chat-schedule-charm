#!/usr/bin/env node
/**
 * Build-time guard: page-level noindex must never contradict the
 * robots.txt / sitemap.xml allowlist.
 *
 * Rules enforced for every page route in src/routes/**:
 *   1. A route listed in PUBLIC_ROUTES (allowed in robots.txt + present in
 *      sitemap.xml) must NOT emit `noindex`.
 *   2. Every other crawlable page route (blocked by the robots catch-all or by
 *      an explicit Disallow prefix) MUST emit `noindex`.
 *   3. Every PUBLIC_ROUTES entry must correspond to a real route file.
 *
 * Logic lives in scripts/noindex-core.mjs (unit tested).
 * Run standalone: `node scripts/check-noindex.mjs`
 *
 * Always writes a machine-readable JSON report so CI can parse the results:
 *   --json <path>      report location (default artifacts/noindex/noindex-report.json)
 *   --no-json          skip writing the report
 *   --dry-run          list every route as PASS/FAIL and always exit 0 (no CI failure)
 *   --allowlist <path> override the allowlist file (default src/lib/public-routes.ts)
 *                      Useful for testing alternate policies without changing repo code.
 */
import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { checkNoindex } from "./noindex-core.mjs";

const args = process.argv.slice(2);
const flagValue = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback;
};

const ROOT = process.cwd();
const routesDir = join(ROOT, "src/routes");
const allowlistPath = resolve(ROOT, flagValue("allowlist", "src/lib/public-routes.ts"));
const registrySource = readFileSync(allowlistPath, "utf8");
console.log(`ℹ Allowlist file: ${allowlistPath}`);

const dryRun = args.includes("--dry-run");

const { errors, problems, routes } = checkNoindex({ routesDir, registrySource });

/** Per-route pass/fail breakdown (a route can only have one problem). */
const problemByRoute = new Map(problems.map((p) => [p.route, p]));
const results = [...new Set([...routes, ...problems.map((p) => p.route)])]
  .sort((a, b) => a.localeCompare(b))
  .map((route) => {
    const problem = problemByRoute.get(route) ?? null;
    return {
      route,
      status: problem ? "fail" : "pass",
      file: problem?.file ?? null,
      kind: problem?.kind ?? null,
      reason: problem?.why ?? null,
      evidence: problem?.evidence ?? [],
      fix: problem?.fix ?? null,
    };
  });

const report = {
  check: "noindex-vs-robots-allowlist",
  generatedAt: new Date().toISOString(),
  status: errors.length ? "fail" : "pass",
  dryRun,
  allowlistFile: allowlistPath,
  commit: process.env["GITHUB_SHA"] ?? null,
  ref: process.env["GITHUB_REF"] ?? null,
  runId: process.env["GITHUB_RUN_ID"] ?? null,
  summary: {
    routesChecked: routes.length,
    passed: results.filter((r) => r.status === "pass").length,
    failed: results.filter((r) => r.status === "fail").length,
    problemCount: problems.length,
    byKind: problems.reduce((acc, p) => {
      acc[p.kind] = (acc[p.kind] ?? 0) + 1;
      return acc;
    }, {}),
  },
  routesChecked: routes,
  results,
  problems,
};

if (!args.includes("--no-json")) {
  const jsonPath = resolve(ROOT, flagValue("json", "artifacts/noindex/noindex-report.json"));
  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(jsonPath, JSON.stringify(report, null, 2) + "\n");
  console.log(`ℹ JSON report: ${jsonPath}`);
}

if (dryRun) {
  console.log("\nnoindex / robots allowlist — dry run (no failures reported)\n");
  for (const r of results) {
    const mark = r.status === "pass" ? "✓ PASS" : "✗ FAIL";
    console.log(`  ${mark}  ${r.route}${r.file ? `  (${r.file})` : ""}`);
    if (r.status === "fail") {
      console.log(`          ${r.kind}: ${r.reason}`);
      for (const line of r.evidence) console.log(`          source: ${line}`);
      console.log(`          fix: ${r.fix}`);
    }
  }
  console.log(
    `\n${report.summary.passed} passing, ${report.summary.failed} failing of ${results.length} route(s).` +
      (report.summary.failed ? " Dry run — exiting 0." : ""),
  );

  if (process.env["GITHUB_STEP_SUMMARY"]) {
    appendFileSync(
      process.env["GITHUB_STEP_SUMMARY"],
      [
        "## noindex / robots allowlist (dry run)",
        "",
        `${report.summary.passed} passing · ${report.summary.failed} failing · ${results.length} routes`,
        "",
        "| Route | Result | Detail |",
        "| --- | --- | --- |",
        ...results.map(
          (r) =>
            `| \`${r.route}\` | ${r.status === "pass" ? "✅ pass" : "❌ fail"} | ${r.reason ?? "—"} |`,
        ),
        "",
      ].join("\n") + "\n",
    );
  }
  process.exit(0);
}

if (errors.length) {
  console.error("\n✗ noindex / robots allowlist contradictions:\n");
  errors.forEach((e, i) => console.error(`  ${i + 1}) ${e}\n`));
  console.error(`${errors.length} problem(s) found.\n`);

  if (process.env["GITHUB_STEP_SUMMARY"]) {
    appendFileSync(
      process.env["GITHUB_STEP_SUMMARY"],
      [
        "## ✗ noindex / robots allowlist contradictions",
        "",
        "| Route | Kind | Expected | Actual | Source | Fix |",
        "| --- | --- | --- | --- | --- | --- |",
        ...problems.map(
          (p) =>
            `| \`${p.route}\` | ${p.kind} | ${p.expected} | ${p.actual} | ${(p.evidence ?? []).map((e) => `\`${e.replace(/\|/g, "\\|")}\``).join("<br>")} | ${p.fix} |`,
        ),
        "",
      ].join("\n") + "\n",
    );
  }
  for (const p of problems) {
    console.error(`::error file=${p.file ?? "src/lib/public-routes.ts"},line=${p.signals?.[0]?.line ?? p.anchors?.[0]?.line ?? 1}::${p.route}: ${p.why} | source: ${(p.evidence ?? []).join(" ⏎ ")}`);
  }
  process.exit(1);
}

console.log(`✓ noindex settings agree with robots/sitemap allowlist (${routes.length} routes)`);
