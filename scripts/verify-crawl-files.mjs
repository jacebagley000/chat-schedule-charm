#!/usr/bin/env node
/**
 * Deploy-time guard: /robots.txt and /sitemap.xml must always be generated
 * from the allowlist in src/config/robots-rules.json.
 *
 * Runs on every build (see the "build" / "build:dev" npm scripts), so a
 * deploy can never ship stale or shadowed crawl files.
 *
 * Checks:
 *   1. The dynamic server routes exist and render via the shared helpers
 *      (renderRobotsTxt / renderSitemapXml) rather than hardcoded strings.
 *   2. No static public/robots.txt or public/sitemap.xml exists — a static
 *      file would shadow the route and immediately go stale.
 *   3. vite.config.ts does not enable the tanstackStart sitemap plugin,
 *      which would prerender a competing static sitemap.
 *   4. The allowlist itself is valid: absolute baseUrl, normalized unique
 *      paths, and a real route file behind every allowlisted path.
 *
 * Run standalone: `node scripts/verify-crawl-files.mjs`
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = process.cwd();
const errors = [];
const notes = [];

const read = (rel) => {
  const path = resolve(ROOT, rel);
  return existsSync(path) ? readFileSync(path, "utf8") : null;
};

/* 1. Dynamic routes render from the shared helpers ---------------------- */
const routeChecks = [
  {
    file: "src/routes/robots[.]txt.ts",
    helper: "renderRobotsTxt",
    label: "/robots.txt",
  },
  {
    file: "src/routes/sitemap[.]xml.ts",
    helper: "renderSitemapXml",
    label: "/sitemap.xml",
  },
];

for (const { file, helper, label } of routeChecks) {
  const source = read(file);
  if (source === null) {
    errors.push(`${label} has no server route (${file} is missing) — it would 404 in production.`);
    continue;
  }
  if (!source.includes(helper)) {
    errors.push(
      `${label} (${file}) does not call ${helper}() from @/lib/public-routes, ` +
        `so its output can drift from the allowlist. Render it from the helper.`,
    );
  }
  if (!source.includes("@/lib/public-routes")) {
    errors.push(`${label} (${file}) must import its content from @/lib/public-routes.`);
  }
}

/* 2. No static shadow files -------------------------------------------- */
for (const shadow of ["public/robots.txt", "public/sitemap.xml"]) {
  if (existsSync(resolve(ROOT, shadow))) {
    errors.push(
      `${shadow} exists and would be served instead of the generated route, ` +
        `going stale as soon as the allowlist changes. Delete it.`,
    );
  }
}

/* 3. No competing sitemap plugin --------------------------------------- */
const viteConfig = read("vite.config.ts") ?? "";
if (/tanstackStart\s*\(\s*\{[^}]*\bsitemap\b/s.test(viteConfig)) {
  errors.push(
    "vite.config.ts enables the tanstackStart sitemap plugin, which prerenders a " +
      "static sitemap that shadows src/routes/sitemap[.]xml.ts. Remove that option.",
  );
}

/* 4. Allowlist sanity + route files exist ------------------------------- */
const rulesPath = "src/config/robots-rules.json";
let rules = null;
try {
  rules = JSON.parse(read(rulesPath) ?? "");
} catch (error) {
  errors.push(`${rulesPath} is not valid JSON: ${(error && error.message) || error}`);
}

/** Route files that can serve a given public path. */
function routeFileCandidates(path) {
  const clean = path === "/" ? "index" : path.replace(/^\//, "");
  return [
    `src/routes/${clean}.tsx`,
    `src/routes/${clean}.ts`,
    `src/routes/${clean}/index.tsx`,
    `src/routes/${clean.split("/").join(".")}.tsx`,
  ];
}

/** Fallback: a dynamic segment ($param) route that could match the path. */
function hasDynamicMatch(path) {
  const segments = path.replace(/^\//, "").split("/").filter(Boolean);
  if (segments.length === 0) return false;
  const dir = join(ROOT, "src/routes", ...segments.slice(0, -1));
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return false;
  return readdirSync(dir).some((entry) => entry.startsWith("$"));
}

if (rules) {
  if (!/^https?:\/\/[^/]+$/.test(String(rules.baseUrl ?? ""))) {
    errors.push(
      `${rulesPath}: baseUrl must be an absolute origin with no trailing slash (got ${JSON.stringify(rules.baseUrl)}).`,
    );
  }

  const seen = new Set();
  for (const entry of rules.allow ?? []) {
    const path = entry?.path;
    if (typeof path !== "string" || !path.startsWith("/")) {
      errors.push(`${rulesPath}: allowlist path must start with "/" (got ${JSON.stringify(path)}).`);
      continue;
    }
    if (path !== "/" && path.endsWith("/")) {
      errors.push(`${rulesPath}: allowlist path "${path}" must not have a trailing slash.`);
    }
    if (seen.has(path)) {
      errors.push(`${rulesPath}: allowlist path "${path}" is listed more than once.`);
    }
    seen.add(path);

    if (entry.publicRobots === false) continue;
    const candidates = routeFileCandidates(path);
    if (!candidates.some((c) => existsSync(resolve(ROOT, c))) && !hasDynamicMatch(path)) {
      errors.push(
        `${rulesPath}: allowlisted path "${path}" has no route file — the sitemap would ` +
          `advertise a 404. Expected one of: ${candidates.join(", ")}`,
      );
    }
  }

  const disallow = rules.disallow ?? [];
  for (const prefix of disallow) {
    if (typeof prefix !== "string" || !prefix.startsWith("/")) {
      errors.push(`${rulesPath}: disallow entry must start with "/" (got ${JSON.stringify(prefix)}).`);
      continue;
    }
    const clash = [...seen].find((p) => p === prefix || p.startsWith(prefix));
    if (clash) {
      errors.push(
        `${rulesPath}: "${clash}" is both allowlisted and blocked by the disallow prefix "${prefix}".`,
      );
    }
  }

  notes.push(
    `${seen.size} allowlisted route(s), ${disallow.length} disallowed prefix(es), base ${rules.baseUrl}`,
  );
}

/* Report ---------------------------------------------------------------- */
if (errors.length > 0) {
  console.error("\n✗ Crawl file generation check failed:\n");
  for (const message of errors) console.error(`  · ${message}`);
  console.error(
    "\n  /robots.txt and /sitemap.xml are generated per request from " +
      "src/config/robots-rules.json. Fix the issues above so the deployed files " +
      "stay in sync with the allowlist.\n",
  );
  process.exit(1);
}

console.log("✓ robots.txt and sitemap.xml are generated from the allowlist on every request");
for (const note of notes) console.log(`  ${note}`);
