#!/usr/bin/env node
/**
 * CI artifact report: every route with its noindex setting and whether it is
 * allowed by robots.txt and present in sitemap.xml.
 *
 * Usage:
 *   node scripts/route-index-report.mjs [--out artifacts/route-index] [--base-url http://localhost:8080]
 *
 * With --base-url the report also records the live HTTP status and the
 * X-Robots-Tag response header for each route.
 * Writes report.json, report.md and report.html; appends the Markdown table to
 * $GITHUB_STEP_SUMMARY when running in GitHub Actions.
 */
import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import {
  NON_PAGE,
  parseRegistry,
  routeFiles,
  filePathToUrl,
  robotsSignals,
  describeSignals,
} from "./noindex-core.mjs";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

const ROOT = process.cwd();
const OUT_DIR = resolve(ROOT, flag("out", "artifacts/route-index"));
const BASE_URL = (flag("base-url", "") || "").replace(/\/+$/, "");

const routesDir = join(ROOT, "src/routes");
const registrySource = readFileSync(join(ROOT, "src/lib/public-routes.ts"), "utf8");
const { publicPaths, privatePrefixes } = parseRegistry(registrySource);
const publicSet = new Set(publicPaths);

const rows = [];
const seen = new Set();

/** Crawlable non-page files that robots.txt allows explicitly. */
const ALLOWED_FILES = new Set(["/sitemap.xml", "/robots.txt"]);

for (const file of routeFiles(routesDir)) {
  const base = basename(file).replace(/\.tsx?$/, "");
  // Pathless layouts (_authenticated.tsx, route.tsx) render no indexable URL.
  if (base.startsWith("_") || base === "route") continue;

  const url = filePathToUrl(file);
  const nonPage = NON_PAGE.some((re) => re.test(url));
  const source = readFileSync(join(routesDir, file), "utf8");
  const signals = robotsSignals(source);
  const noindex = signals.some((s) => s.noindex);
  const isPublic = publicSet.has(url) || ALLOWED_FILES.has(url);
  const privatePrefix = privatePrefixes.find((p) => url === p || url.startsWith(p)) ?? null;
  if (!nonPage) seen.add(url);

  rows.push({
    route: url,
    file: `src/routes/${file}`,
    type: nonPage ? "non-page" : "page",
    noindex: nonPage ? null : noindex,
    noindexSource: nonPage ? "n/a" : describeSignals(signals),
    robotsAllowed: isPublic,
    robotsRule: isPublic
      ? `Allow: ${url === "/" ? "/$" : url}`
      : privatePrefix
        ? `Disallow: ${privatePrefix}`
        : "Disallow: / (catch-all)",
    inSitemap: publicSet.has(url),
    expectedXRobotsTag: isPublic ? null : "noindex, nofollow, noarchive",
    consistent: nonPage ? true : isPublic !== noindex,
  });
}

// Sitemap entries with no matching route file.
for (const path of publicPaths) {
  if (seen.has(path)) continue;
  rows.push({
    route: path,
    file: null,
    type: "missing",
    noindex: null,
    noindexSource: "no route file resolves to this path",
    robotsAllowed: true,
    robotsRule: `Allow: ${path === "/" ? "/$" : path}`,
    inSitemap: true,
    expectedXRobotsTag: null,
    consistent: false,
  });
}

rows.sort((a, b) => a.route.localeCompare(b.route));

if (BASE_URL) {
  await Promise.all(
    rows.map(async (r) => {
      try {
        const res = await fetch(`${BASE_URL}${r.route}`, { redirect: "manual" });
        r.liveStatus = res.status;
        r.liveXRobotsTag = res.headers.get("x-robots-tag");
      } catch (err) {
        r.liveStatus = null;
        r.liveXRobotsTag = null;
        r.liveError = String(err?.message ?? err);
      }
    }),
  );
}

const summary = {
  total: rows.length,
  pages: rows.filter((r) => r.type === "page").length,
  indexable: rows.filter((r) => r.robotsAllowed && r.type !== "missing").length,
  noindex: rows.filter((r) => r.noindex === true).length,
  inconsistent: rows.filter((r) => !r.consistent).length,
};

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl: BASE_URL || null,
  commit: process.env["GITHUB_SHA"] ?? null,
  ref: process.env["GITHUB_REF"] ?? null,
  runId: process.env["GITHUB_RUN_ID"] ?? null,
  summary,
  routes: rows,
};

const yn = (v) => (v === null || v === undefined ? "—" : v ? "yes" : "no");

const header = ["Route", "Type", "noindex", "robots.txt", "sitemap.xml", "Rule", "Consistent"];
if (BASE_URL) header.push("HTTP", "X-Robots-Tag");

const mdRows = rows.map((r) => {
  const cells = [
    `\`${r.route}\``,
    r.type,
    yn(r.noindex),
    yn(r.robotsAllowed),
    yn(r.inSitemap),
    `\`${r.robotsRule}\``,
    r.consistent ? "✅" : "❌",
  ];
  if (BASE_URL) cells.push(String(r.liveStatus ?? "—"), r.liveXRobotsTag ?? "—");
  return `| ${cells.join(" | ")} |`;
});

const md = [
  "## Route index report",
  "",
  `Generated ${report.generatedAt}${BASE_URL ? ` against ${BASE_URL}` : " (static analysis)"}`,
  "",
  `**${summary.total}** routes · **${summary.indexable}** crawlable · **${summary.noindex}** noindex · **${summary.inconsistent}** inconsistent`,
  "",
  `| ${header.join(" | ")} |`,
  `| ${header.map(() => "---").join(" | ")} |`,
  ...mdRows,
  "",
].join("\n");

const esc = (s) =>
  String(s ?? "—").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Route index report</title>
<style>
 body{font:14px/1.5 ui-sans-serif,system-ui,sans-serif;margin:2rem;color:#111}
 h1{font-size:1.4rem;margin:0 0 .25rem}
 .meta{color:#555;margin-bottom:1rem}
 table{border-collapse:collapse;width:100%}
 th,td{border:1px solid #ddd;padding:.4rem .6rem;text-align:left;vertical-align:top}
 th{background:#f5f5f5}
 tr.bad{background:#fff4f4}
 code{font:12px ui-monospace,monospace}
</style></head><body>
<h1>Route index report</h1>
<p class="meta">${esc(report.generatedAt)}${BASE_URL ? ` · ${esc(BASE_URL)}` : " · static analysis"}${
  report.commit ? ` · <code>${esc(report.commit.slice(0, 8))}</code>` : ""
}<br>${summary.total} routes · ${summary.indexable} crawlable · ${summary.noindex} noindex · ${summary.inconsistent} inconsistent</p>
<table><thead><tr>${header.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>
${rows
  .map((r) => {
    const cells = [
      `<code>${esc(r.route)}</code>`,
      esc(r.type),
      yn(r.noindex),
      yn(r.robotsAllowed),
      yn(r.inSitemap),
      `<code>${esc(r.robotsRule)}</code>`,
      r.consistent ? "✅" : "❌",
    ];
    if (BASE_URL) cells.push(esc(r.liveStatus), esc(r.liveXRobotsTag));
    return `<tr class="${r.consistent ? "" : "bad"}">${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
  })
  .join("\n")}
</tbody></table>
<h2>Details</h2>
<table><thead><tr><th>Route</th><th>File</th><th>noindex signal</th><th>Expected X-Robots-Tag</th></tr></thead><tbody>
${rows
  .map(
    (r) =>
      `<tr><td><code>${esc(r.route)}</code></td><td><code>${esc(r.file)}</code></td><td>${esc(r.noindexSource)}</td><td>${esc(r.expectedXRobotsTag)}</td></tr>`,
  )
  .join("\n")}
</tbody></table>
</body></html>`;

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
writeFileSync(join(OUT_DIR, "report.md"), md);
writeFileSync(join(OUT_DIR, "report.html"), html);

if (process.env["GITHUB_STEP_SUMMARY"]) {
  appendFileSync(process.env["GITHUB_STEP_SUMMARY"], md + "\n");
}

console.log(md);
console.log(`Wrote report.json / report.md / report.html to ${OUT_DIR}`);
