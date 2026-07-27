#!/usr/bin/env node
// Emit a GitHub Actions job summary from a JUnit XML file.
// Usage: node scripts/junit-to-summary.mjs <input.xml> [label]
// Appends Markdown to $GITHUB_STEP_SUMMARY (or stdout if unset).

import { readFileSync, appendFileSync, existsSync } from "node:fs";

const [, , inPath, label = ""] = process.argv;
if (!inPath) {
  console.error("usage: junit-to-summary.mjs <input.xml> [label]");
  process.exit(2);
}

const summaryPath = process.env.GITHUB_STEP_SUMMARY;
const write = (s) => (summaryPath ? appendFileSync(summaryPath, s) : process.stdout.write(s));

if (!existsSync(inPath)) {
  write(`## Vitest results${label ? ` — ${label}` : ""}\n\n> No JUnit XML produced (\`${inPath}\`).\n\n`);
  process.exit(0);
}

const xml = readFileSync(inPath, "utf8");

const decodeXml = (s) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const attr = (tag, name) => {
  const m = tag.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`));
  return m ? decodeXml(m[1]) : "";
};

const escape = (s) => String(s ?? "").replace(/[|`*_<>]/g, (c) => `\\${c}`);

// Aggregate from <testsuite> elements (Vitest emits per-file suites + a root).
const suiteTags = [...xml.matchAll(/<testsuite\b[^>]*>/g)].map((m) => m[0]);
let tests = 0, failures = 0, errors = 0, skipped = 0, timeSec = 0;
for (const t of suiteTags) {
  // Skip the wrapping <testsuites> aggregate — only leaf suites have a name attribute distinct from "".
  // Vitest emits one root <testsuites> + one <testsuite> per file; both patterns are safe to sum since
  // vitest's junit reporter doesn't duplicate counts across the pair (root has no counts).
  const n = Number(attr(t, "tests") || 0);
  tests += n;
  failures += Number(attr(t, "failures") || 0);
  errors += Number(attr(t, "errors") || 0);
  skipped += Number(attr(t, "skipped") || 0);
  timeSec += Number(attr(t, "time") || 0);
}

// Collect failing test cases: <testcase ...>...<failure|error .../></testcase>
// Also collect flaky cases (property name="flaky" value="true" inserted by
// scripts/merge-junit-retries.mjs after a rerun of failed tests).
const failing = [];
const flaky = [];
const caseRe = /<testcase\b([^>]*[^>/])>([\s\S]*?)<\/testcase>|<testcase\b([^>]*)\/>/g;
let m;
while ((m = caseRe.exec(xml))) {
  const openAttrs = m[1] ?? m[3] ?? "";
  const inner = m[2] ?? "";
  const classname = attr(`<x ${openAttrs}>`, "classname");
  const name = attr(`<x ${openAttrs}>`, "name");
  const isFlaky = /<property\s+name="flaky"\s+value="true"\s*\/>/.test(inner);
  if (isFlaky) {
    const initialMsg = (inner.match(/<property\s+name="flaky\.initial_message"\s+value="([^"]*)"/) || [])[1] || "";
    flaky.push({ classname, name, message: initialMsg });
    continue;
  }
  if (!/<(failure|error)\b/.test(inner)) continue;
  const failTag = inner.match(/<(failure|error)\b[^>]*>/)?.[0] ?? "";
  const message = attr(failTag, "message");
  failing.push({ classname, name, message });
}

const passed = Math.max(tests - failures - errors - skipped, 0);
const status =
  failures + errors > 0 ? "❌ Failing" : tests === 0 ? "⚠️ No tests" : flaky.length ? "⚠️ Flaky" : "✅ Passing";

let md = `## Vitest results${label ? ` — ${label}` : ""}\n\n`;
md += `**${status}** — ${passed}/${tests} passed`;
if (failures + errors) md += `, ${failures + errors} failing`;
if (flaky.length) md += `, ${flaky.length} flaky`;
if (skipped) md += `, ${skipped} skipped`;
md += ` (${timeSec.toFixed(2)}s)\n\n`;
md += `| Passed | Failed | Flaky | Errors | Skipped | Total | Duration |\n`;
md += `|-------:|-------:|------:|-------:|--------:|------:|---------:|\n`;
md += `| ${passed} | ${failures} | ${flaky.length} | ${errors} | ${skipped} | ${tests} | ${timeSec.toFixed(2)}s |\n\n`;

if (failing.length) {
  md += `### Failing tests\n\n`;
  for (const f of failing) {
    const title = f.classname ? `${f.classname} › ${f.name}` : f.name;
    md += `- **${escape(title)}**`;
    if (f.message) md += ` — ${escape(f.message.split("\n")[0].slice(0, 300))}`;
    md += `\n`;
  }
  md += `\n`;
}

if (flaky.length) {
  md += `### Flaky tests (failed initially, passed on retry)\n\n`;
  for (const f of flaky) {
    const title = f.classname ? `${f.classname} › ${f.name}` : f.name;
    md += `- **${escape(title)}**`;
    if (f.message) md += ` — initial: ${escape(f.message.split("\n")[0].slice(0, 300))}`;
    md += `\n`;
  }
  md += `\n`;
}


write(md);
