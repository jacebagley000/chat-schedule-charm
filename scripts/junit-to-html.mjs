#!/usr/bin/env node
// Minimal JUnit XML -> HTML report converter (no external deps).
// Usage: node scripts/junit-to-html.mjs <input.xml> <output.html>

import { readFileSync, writeFileSync } from "node:fs";

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) {
  console.error("usage: junit-to-html.mjs <input.xml> <output.html>");
  process.exit(2);
}

const xml = readFileSync(inPath, "utf8");

const attr = (tag, name) => {
  const m = tag.match(new RegExp(`${name}="([^"]*)"`));
  return m ? decodeXml(m[1]) : "";
};

function decodeXml(s) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const suites = [];
const suiteRe = /<testsuite\b([^>]*)>([\s\S]*?)<\/testsuite>/g;
const caseRe =
  /<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g;
const failRe = /<(failure|error)\b([^>]*)>([\s\S]*?)<\/\1>/;

let sm;
while ((sm = suiteRe.exec(xml))) {
  const openTag = `<testsuite ${sm[1]}>`;
  const body = sm[2];
  const suite = {
    name: attr(openTag, "name"),
    tests: Number(attr(openTag, "tests") || 0),
    failures: Number(attr(openTag, "failures") || 0),
    errors: Number(attr(openTag, "errors") || 0),
    skipped: Number(attr(openTag, "skipped") || 0),
    time: Number(attr(openTag, "time") || 0),
    cases: [],
  };
  let cm;
  while ((cm = caseRe.exec(body))) {
    const openCase = `<testcase ${cm[1]}>`;
    const inner = cm[2] || "";
    const fm = failRe.exec(inner);
    const isFlaky = /<property\s+name="flaky"\s+value="true"\s*\/>/.test(inner);
    const initialMsg =
      (inner.match(/<property\s+name="flaky\.initial_message"\s+value="([^"]*)"/) || [])[1] || "";
    suite.cases.push({
      name: attr(openCase, "name"),
      classname: attr(openCase, "classname"),
      time: Number(attr(openCase, "time") || 0),
      status: isFlaky ? "flaky" : fm ? fm[1] : /<skipped\b/.test(inner) ? "skipped" : "passed",
      message: fm ? attr(`<x ${fm[2]}>`, "message") : isFlaky ? initialMsg : "",
      detail: fm ? decodeXml(fm[3]).trim() : "",
    });
  }

  suites.push(suite);
}

const totals = suites.reduce(
  (acc, s) => ({
    tests: acc.tests + s.tests,
    failures: acc.failures + s.failures,
    errors: acc.errors + s.errors,
    skipped: acc.skipped + s.skipped,
    time: acc.time + s.time,
  }),
  { tests: 0, failures: 0, errors: 0, skipped: 0, time: 0 },
);

const passed = totals.tests - totals.failures - totals.errors - totals.skipped;
const status = totals.failures + totals.errors > 0 ? "FAILED" : "PASSED";
const statusColor = status === "PASSED" ? "#16a34a" : "#dc2626";

const rows = suites
  .map(
    (s) => `
    <section class="suite">
      <h2>${escapeHtml(s.name)} <small>(${s.tests} tests, ${s.time.toFixed(3)}s)</small></h2>
      <table>
        <thead><tr><th>Status</th><th>Test</th><th>Time (s)</th></tr></thead>
        <tbody>
          ${s.cases
            .map((c) => {
              const badge =
                c.status === "passed"
                  ? '<span class="badge pass">PASS</span>'
                  : c.status === "skipped"
                    ? '<span class="badge skip">SKIP</span>'
                    : '<span class="badge fail">FAIL</span>';
              const detail =
                c.status === "failure" || c.status === "error"
                  ? `<tr><td colspan="3"><pre>${escapeHtml(c.message ? c.message + "\n\n" : "")}${escapeHtml(c.detail)}</pre></td></tr>`
                  : "";
              return `<tr><td>${badge}</td><td>${escapeHtml(c.name)}</td><td>${c.time.toFixed(3)}</td></tr>${detail}`;
            })
            .join("")}
        </tbody>
      </table>
    </section>`,
  )
  .join("");

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Security regression report</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 2rem; max-width: 1100px; }
  header { border-bottom: 1px solid #e5e7eb; padding-bottom: 1rem; margin-bottom: 1.5rem; }
  .status { display: inline-block; padding: .35rem .75rem; border-radius: 999px;
            color: white; background: ${statusColor}; font-weight: 700; letter-spacing: .05em; }
  .totals { display: flex; gap: 1.5rem; margin-top: .75rem; color: #4b5563; font-size: .95rem; }
  .totals b { color: #111827; }
  section.suite { margin-bottom: 2rem; }
  h2 { font-size: 1.1rem; margin: 0 0 .5rem; }
  h2 small { color: #6b7280; font-weight: 400; }
  table { width: 100%; border-collapse: collapse; font-size: .92rem; }
  th, td { text-align: left; padding: .5rem .6rem; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  th { background: #f8fafc; font-weight: 600; }
  pre { background: #0f172a; color: #f1f5f9; padding: 1rem; border-radius: 6px;
        overflow: auto; font-size: .82rem; white-space: pre-wrap; word-break: break-word; }
  .badge { display: inline-block; padding: .15rem .5rem; border-radius: 4px;
           font-size: .75rem; font-weight: 700; letter-spacing: .04em; color: white; }
  .badge.pass { background: #16a34a; }
  .badge.fail { background: #dc2626; }
  .badge.skip { background: #64748b; }
</style>
</head>
<body>
<header>
  <h1>Security regression report</h1>
  <span class="status">${status}</span>
  <div class="totals">
    <span><b>${passed}</b> passed</span>
    <span><b>${totals.failures}</b> failed</span>
    <span><b>${totals.errors}</b> errored</span>
    <span><b>${totals.skipped}</b> skipped</span>
    <span><b>${totals.time.toFixed(2)}s</b> total</span>
  </div>
</header>
${rows || "<p><em>No test suites reported.</em></p>"}
</body>
</html>
`;

writeFileSync(outPath, html);
console.log(`wrote ${outPath} (${status}, ${totals.tests} tests)`);
