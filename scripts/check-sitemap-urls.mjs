#!/usr/bin/env node
/**
 * Fetch every URL listed in /sitemap.xml and report which ones are broken.
 *
 * A sitemap URL is a problem when it:
 *   - returns 404 (or any non-200 status)
 *   - is disallowed by robots.txt            (robots contradiction)
 *   - responds with `X-Robots-Tag: noindex`  (robots contradiction)
 *   - renders `<meta name="robots" ... noindex>` (robots contradiction)
 *
 * Usage:
 *   node scripts/check-sitemap-urls.mjs [--base-url http://localhost:8080]
 *                                       [--out artifacts/sitemap-urls]
 *                                       [--dry-run]
 *
 * Always writes <out>/sitemap-urls.json and appends a table to
 * GITHUB_STEP_SUMMARY when running in CI. Exits 1 when any URL fails
 * (unless --dry-run).
 */
import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback;
};

const baseUrl = (flag("base-url", process.env["BASE_URL"] ?? "http://localhost:8080")).replace(
  /\/+$/,
  "",
);
const outDir = resolve(process.cwd(), flag("out", "artifacts/sitemap-urls"));
const dryRun = args.includes("--dry-run");

/** Minimal robots.txt matcher for `User-agent: *` (longest match wins, Allow breaks ties). */
function parseRobots(text) {
  const groups = [];
  let current = null;
  let uaOpen = false;
  for (const raw of text.split("\n")) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const [field, ...rest] = line.split(":");
    const key = field.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (key === "user-agent") {
      if (!uaOpen) {
        current = { agents: [], rules: [] };
        groups.push(current);
        uaOpen = true;
      }
      current.agents.push(value.toLowerCase());
    } else if (key === "allow" || key === "disallow") {
      uaOpen = false;
      if (current) current.rules.push({ type: key, pattern: value });
    }
  }
  const group = groups.find((g) => g.agents.includes("*"));
  return group?.rules ?? [];
}

function matches(pattern, path) {
  if (pattern === "") return false;
  const anchored = pattern.endsWith("$");
  const p = anchored ? pattern.slice(0, -1) : pattern;
  const re = new RegExp(
    "^" + p.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*") + (anchored ? "$" : ""),
  );
  return re.test(path);
}

function isAllowed(rules, path) {
  let best = null;
  for (const rule of rules) {
    if (!matches(rule.pattern, path)) continue;
    const len = rule.pattern.length;
    if (!best || len > best.len || (len === best.len && rule.type === "allow")) {
      best = { len, type: rule.type };
    }
  }
  return best ? best.type === "allow" : true;
}

const res = await fetch(`${baseUrl}/robots.txt`);
if (!res.ok) {
  console.error(`::error::GET ${baseUrl}/robots.txt -> ${res.status}`);
  process.exit(1);
}
const robotsRules = parseRobots(await res.text());

const sitemapRes = await fetch(`${baseUrl}/sitemap.xml`);
if (!sitemapRes.ok) {
  console.error(`::error::GET ${baseUrl}/sitemap.xml -> ${sitemapRes.status}`);
  process.exit(1);
}
const sitemapXml = await sitemapRes.text();
const locs = [...sitemapXml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) => m[1]);
if (!locs.length) {
  console.error("::error::sitemap.xml contains no <loc> entries");
  process.exit(1);
}

const results = [];
for (const loc of locs) {
  const path = new URL(loc, baseUrl).pathname || "/";
  const target = `${baseUrl}${path}`;
  const problems = [];
  let status = 0;
  let xRobots = null;
  let metaRobots = null;

  try {
    const r = await fetch(target, { redirect: "manual" });
    status = r.status;
    xRobots = r.headers.get("x-robots-tag");
    const body = r.headers.get("content-type")?.includes("text/html") ? await r.text() : "";
    const meta = body.match(
      /<meta[^>]+name=["']robots["'][^>]*content=["']([^"']*)["'][^>]*>/i,
    );
    metaRobots = meta ? meta[1] : null;
  } catch (e) {
    problems.push({ kind: "fetch-error", detail: e.message });
  }

  if (status === 404) problems.push({ kind: "not-found", detail: "HTTP 404" });
  else if (status && status !== 200) problems.push({ kind: "bad-status", detail: `HTTP ${status}` });

  if (!isAllowed(robotsRules, path)) {
    problems.push({ kind: "robots-contradiction", detail: "disallowed by robots.txt" });
  }
  if (xRobots && /noindex/i.test(xRobots)) {
    problems.push({ kind: "robots-contradiction", detail: `X-Robots-Tag: ${xRobots}` });
  }
  if (metaRobots && /noindex/i.test(metaRobots)) {
    problems.push({ kind: "robots-contradiction", detail: `<meta name="robots" content="${metaRobots}">` });
  }

  results.push({
    loc,
    path,
    url: target,
    status,
    xRobotsTag: xRobots,
    metaRobots,
    ok: problems.length === 0,
    problems,
  });
}

const failed = results.filter((r) => !r.ok);
const report = {
  check: "sitemap-url-fetch",
  generatedAt: new Date().toISOString(),
  baseUrl,
  dryRun,
  status: failed.length ? "fail" : "pass",
  summary: {
    urlsChecked: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    notFound: failed.filter((r) => r.problems.some((p) => p.kind === "not-found")).length,
    robotsContradictions: failed.filter((r) =>
      r.problems.some((p) => p.kind === "robots-contradiction"),
    ).length,
  },
  results,
};

mkdirSync(outDir, { recursive: true });
const jsonPath = resolve(outDir, "sitemap-urls.json");
writeFileSync(jsonPath, JSON.stringify(report, null, 2) + "\n");

console.log(`==> Base URL: ${baseUrl}`);
for (const r of results) {
  const mark = r.ok ? "✓ PASS" : "✗ FAIL";
  console.log(`  ${mark}  ${r.path}  (HTTP ${r.status})`);
  for (const p of r.problems) console.log(`          ${p.kind}: ${p.detail}`);
}
console.log(
  `\n${report.summary.passed} passing · ${report.summary.failed} failing of ${results.length} sitemap URL(s) ` +
    `(${report.summary.notFound} not found, ${report.summary.robotsContradictions} robots contradiction(s)).`,
);
console.log(`ℹ JSON report: ${jsonPath}`);

if (process.env["GITHUB_STEP_SUMMARY"]) {
  appendFileSync(
    process.env["GITHUB_STEP_SUMMARY"],
    [
      `## ${failed.length ? "❌" : "✅"} Sitemap URL fetch (${baseUrl})`,
      "",
      `${report.summary.passed} passing · ${report.summary.failed} failing of ${results.length} URL(s)`,
      "",
      "| URL | Status | Result | Detail |",
      "| --- | --- | --- | --- |",
      ...results.map(
        (r) =>
          `| \`${r.path}\` | ${r.status} | ${r.ok ? "✅ ok" : "❌ fail"} | ${
            r.problems.map((p) => `${p.kind}: ${p.detail}`).join("<br>") || "—"
          } |`,
      ),
      "",
    ].join("\n") + "\n",
  );
}

for (const r of failed) {
  console.error(
    `::error::${r.path}: ${r.problems.map((p) => `${p.kind} (${p.detail})`).join("; ")}`,
  );
}

process.exit(failed.length && !dryRun ? 1 : 0);
