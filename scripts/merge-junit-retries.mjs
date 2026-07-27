#!/usr/bin/env node
// Merge an initial JUnit XML with a retry run's JUnit XML.
// Cases that failed in the initial run but passed on retry are marked FLAKY:
// their <failure>/<error> child is stripped, and a <properties><property
// name="flaky" value="true"/></properties> block is inserted so downstream
// reporters (junit-to-summary, junit-to-html) can surface them.
//
// Usage: node scripts/merge-junit-retries.mjs <initial.xml> <retry.xml> [out.xml]
// Default output overwrites <initial.xml>.

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const [, , initialPath, retryPath, outPathArg] = process.argv;
if (!initialPath || !retryPath) {
  console.error("usage: merge-junit-retries.mjs <initial.xml> <retry.xml> [out.xml]");
  process.exit(2);
}
const outPath = outPathArg || initialPath;

if (!existsSync(initialPath)) {
  console.error(`initial JUnit not found: ${initialPath}`);
  process.exit(0);
}
if (!existsSync(retryPath)) {
  console.error(`retry JUnit not found: ${retryPath} — nothing to merge`);
  process.exit(0);
}

const initialXml = readFileSync(initialPath, "utf8");
const retryXml = readFileSync(retryPath, "utf8");

const attr = (tag, name) => {
  const m = tag.match(new RegExp(`${name}="([^"]*)"`));
  return m ? m[1] : "";
};
const caseKey = (openAttrs) => `${attr(openAttrs, "classname")}::${attr(openAttrs, "name")}`;

// Build the set of retry cases that PASSED (no <failure|error> child).
const retryPassed = new Set();
const retryCaseRe = /<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g;
let rm;
while ((rm = retryCaseRe.exec(retryXml))) {
  const openAttrs = rm[1] || "";
  const inner = rm[2] || "";
  if (/<(failure|error)\b/.test(inner)) continue;
  if (/<skipped\b/.test(inner)) continue;
  retryPassed.add(caseKey(openAttrs));
}

let flakyCount = 0;
const flakyNames = [];

// Rewrite the initial XML: for each testcase that had a failure/error and now
// passes on retry, strip the failure child and mark it flaky.
const caseWithBodyRe = /<testcase\b([^>]*)>([\s\S]*?)<\/testcase>/g;
let merged = initialXml.replace(caseWithBodyRe, (whole, openAttrs, inner) => {
  const failMatch = inner.match(/<(failure|error)\b[\s\S]*?<\/\1>|<(failure|error)\b[^>]*\/>/);
  if (!failMatch) return whole;
  const key = caseKey(openAttrs);
  if (!retryPassed.has(key)) return whole;

  flakyCount += 1;
  flakyNames.push(key);
  const originalMessage = attr(failMatch[0], "message") || "initial failure";
  const strippedInner = inner
    .replace(/<failure\b[\s\S]*?<\/failure>/g, "")
    .replace(/<error\b[\s\S]*?<\/error>/g, "")
    .replace(/<failure\b[^>]*\/>/g, "")
    .replace(/<error\b[^>]*\/>/g, "");
  const flakyProps =
    `\n      <properties>\n` +
    `        <property name="flaky" value="true"/>\n` +
    `        <property name="flaky.initial_message" value="${escapeAttr(originalMessage)}"/>\n` +
    `      </properties>\n` +
    `      <system-out>FLAKY: passed on retry after initial failure — ${escapeXml(originalMessage)}</system-out>\n`;
  return `<testcase${openAttrs}>${flakyProps}${strippedInner}</testcase>`;
});

// Adjust <testsuite> failures/errors counters to reflect the reclassification.
if (flakyCount > 0) {
  merged = merged.replace(/<testsuite\b([^>]*)>/g, (tag, openAttrs) => {
    const failures = Number(attr(openAttrs, "failures") || 0);
    const errors = Number(attr(openAttrs, "errors") || 0);
    // We don't know per-suite split, so drain proportionally, failures first.
    let drain = flakySuiteQuota(openAttrs, flakyNames);
    if (!drain) return tag;
    let newFailures = failures;
    let newErrors = errors;
    while (drain > 0 && newFailures > 0) {
      newFailures -= 1;
      drain -= 1;
    }
    while (drain > 0 && newErrors > 0) {
      newErrors -= 1;
      drain -= 1;
    }
    let updated = openAttrs
      .replace(/failures="\d+"/, `failures="${newFailures}"`)
      .replace(/errors="\d+"/, `errors="${newErrors}"`);
    return `<testsuite${updated}>`;
  });
}

writeFileSync(outPath, merged);
console.log(
  `merged: ${flakyCount} flaky case(s) reclassified (initial fail → retry pass). wrote ${outPath}`,
);
if (flakyCount) for (const n of flakyNames) console.log(`  flaky: ${n}`);

function escapeXml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function escapeAttr(s) {
  return escapeXml(s).replace(/"/g, "&quot;");
}

// Count how many flaky cases belong to this suite by matching classnames.
// Fallback: distribute evenly if we can't tell — the root <testsuites> aggregate
// is fine to over-drain because summary reports sum leaves.
function flakySuiteQuota(openAttrs, names) {
  const suiteName = attr(openAttrs, "name");
  if (!suiteName) return names.length; // root aggregate
  let n = 0;
  for (const key of names) {
    const [cls] = key.split("::");
    if (cls === suiteName || cls.startsWith(suiteName)) n += 1;
  }
  return n;
}
