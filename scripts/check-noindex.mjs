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
 * Run standalone: `node scripts/check-noindex.mjs`
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const ROUTES_DIR = join(ROOT, "src/routes");
const REGISTRY = join(ROOT, "src/lib/public-routes.ts");

/** Non-page routes that never render HTML metadata. */
const NON_PAGE = [/^\/api\//, /^\/sitemap\.xml$/, /^\/robots\.txt$/];

function parseRegistry() {
  const src = readFileSync(REGISTRY, "utf8");
  const section = (name) => {
    const m = src.match(new RegExp(`${name}[^=]*=\\s*\\[([\\s\\S]*?)\\n\\];`));
    if (!m) throw new Error(`could not parse ${name} from ${REGISTRY}`);
    return m[1];
  };
  const publicPaths = [...section("PUBLIC_ROUTES").matchAll(/path:\s*"([^"]+)"/g)].map(
    (m) => m[1],
  );
  const privatePrefixes = [...section("PRIVATE_PREFIXES").matchAll(/"([^"]+)"/g)].map(
    (m) => m[1],
  );
  if (!publicPaths.length) throw new Error("PUBLIC_ROUTES parsed empty");
  return { publicPaths, privatePrefixes };
}

/** src/routes/foo/bar.tsx -> /foo/bar (mirrors TanStack file-based routing). */
function filePathToUrl(file) {
  const stripped = file.replace(/\.tsx?$/, "").replace(/\[\.\]/g, ".");
  const path =
    "/" +
    stripped
      .split(/[/.]/)
      .filter((seg) => seg !== "index" && !seg.startsWith("_"))
      .join("/");
  return (path.replace(/\/(sitemap|robots)\/(xml|txt)$/, "/$1.$2") || "/").replace(
    /^\/$|^$/,
    "/",
  );
}

function routeFiles() {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) out.push(relative(ROUTES_DIR, full));
    }
  };
  walk(ROUTES_DIR);
  return out.filter((f) => !f.startsWith("__root"));
}

function hasNoindex(source) {
  return (
    /noindex\s*:\s*true/.test(source) ||
    /content:\s*["'`][^"'`]*noindex/i.test(source)
  );
}

const { publicPaths, privatePrefixes } = parseRegistry();
const publicSet = new Set(publicPaths);
const errors = [];
const seen = new Set();

for (const file of routeFiles()) {
  const url = filePathToUrl(file);
  if (NON_PAGE.some((re) => re.test(url))) continue;
  seen.add(url);

  const source = readFileSync(join(ROUTES_DIR, file), "utf8");
  const noindex = hasNoindex(source);
  const isPublic = publicSet.has(url);
  const isPrivatePrefix = privatePrefixes.some((p) => url === p || url.startsWith(p));

  if (isPublic && noindex) {
    errors.push(
      `${file}: route "${url}" is allowlisted in robots.txt and listed in sitemap.xml, ` +
        `but the page sets noindex. Remove noindex, or drop it from PUBLIC_ROUTES.`,
    );
  }
  if (!isPublic && !noindex) {
    const why = isPrivatePrefix
      ? `matches the private prefix it falls under`
      : `is not allowlisted, so robots.txt blocks it via the catch-all Disallow`;
    errors.push(
      `${file}: route "${url}" ${why}, but the page does not set noindex. ` +
        `Add \`noindex: true\` to its pageMeta(), or add it to PUBLIC_ROUTES.`,
    );
  }
}

for (const path of publicPaths) {
  if (!seen.has(path)) {
    errors.push(
      `PUBLIC_ROUTES lists "${path}" but no page route file resolves to it — ` +
        `sitemap.xml would advertise a URL the router does not serve.`,
    );
  }
}

if (errors.length) {
  console.error("\n✗ noindex / robots allowlist contradictions:\n");
  for (const e of errors) console.error(`  - ${e}`);
  console.error(`\n${errors.length} problem(s) found.\n`);
  process.exit(1);
}

console.log(`✓ noindex settings agree with robots/sitemap allowlist (${seen.size} routes)`);
