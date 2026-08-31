#!/usr/bin/env bun
/**
 * Build robots.txt from the allowlist + publicRobots flags in
 * src/config/robots-rules.json (the same source the /robots.txt route,
 * sitemap.xml, the X-Robots-Tag middleware and the noindex checker use).
 *
 * Run with bun (it resolves the "@/" alias and the JSON import):
 *   bun scripts/build-robots.mjs [--out artifacts/robots/robots.txt] [--sitemap]
 *
 * The output is written for inspection/upload only — it is deliberately NOT
 * written to public/, so the static file can never shadow (and go stale
 * against) the dynamic /robots.txt server route.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  PUBLIC_ROUTES,
  hasPublicRobots,
  renderRobotsTxt,
  renderSitemapXml,
} from "../src/lib/public-routes.ts";

const args = process.argv.slice(2);
const flagValue = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback;
};

const outPath = resolve(process.cwd(), flagValue("out", "artifacts/robots/robots.txt"));
mkdirSync(dirname(outPath), { recursive: true });

const robots = renderRobotsTxt();
writeFileSync(outPath, robots);
console.log(`✓ robots.txt written to ${outPath}`);

if (args.includes("--sitemap")) {
  const sitemapPath = resolve(dirname(outPath), "sitemap.xml");
  writeFileSync(sitemapPath, renderSitemapXml() + "\n");
  console.log(`✓ sitemap.xml written to ${sitemapPath}`);
}

const allowed = PUBLIC_ROUTES.filter(hasPublicRobots);
const excluded = PUBLIC_ROUTES.filter((r) => !hasPublicRobots(r));
console.log(
  `  ${allowed.length} allowed route(s), ${excluded.length} registered route(s) with publicRobots: false`,
);
for (const r of excluded) console.log(`  · excluded (publicRobots: false): ${r.path}`);
