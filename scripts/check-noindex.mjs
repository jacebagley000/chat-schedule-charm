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
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { checkNoindex } from "./noindex-core.mjs";

const ROOT = process.cwd();
const routesDir = join(ROOT, "src/routes");
const registrySource = readFileSync(join(ROOT, "src/lib/public-routes.ts"), "utf8");

const { errors, routes } = checkNoindex({ routesDir, registrySource });

if (errors.length) {
  console.error("\n✗ noindex / robots allowlist contradictions:\n");
  errors.forEach((e, i) => console.error(`  ${i + 1}) ${e}\n`));
  console.error(`${errors.length} problem(s) found.\n`);
  process.exit(1);
}

console.log(`✓ noindex settings agree with robots/sitemap allowlist (${routes.length} routes)`);
