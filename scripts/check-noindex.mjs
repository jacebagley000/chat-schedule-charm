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

/**
 * Collect the actual robots signals a route emits, so error output can quote
 * them verbatim instead of just saying "noindex missing".
 */
function robotsSignals(source) {
  const signals = [];
  for (const m of source.matchAll(/noindex\s*:\s*(true|false)/g)) {
    signals.push({ kind: "pageMeta", value: `noindex: ${m[1]}`, noindex: m[1] === "true" });
  }
  for (const m of source.matchAll(
    /name:\s*["'`]robots["'`]\s*,\s*content:\s*["'`]([^"'`]*)["'`]/g,
  )) {
    signals.push({
      kind: 'meta name="robots"',
      value: m[1],
      noindex: /noindex/i.test(m[1]),
    });
  }
  for (const m of source.matchAll(/content:\s*["'`]([^"'`]*noindex[^"'`]*)["'`]/gi)) {
    if (signals.some((s) => s.value === m[1])) continue;
    signals.push({ kind: "meta content", value: m[1], noindex: true });
  }
  return signals;
}

function describeSignals(signals) {
  if (!signals.length) return "none (no robots meta and no `noindex` flag)";
  return signals.map((s) => `${s.kind} -> "${s.value}"`).join("; ");
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
  const signals = robotsSignals(source);
  const noindex = signals.some((s) => s.noindex);
  const isPublic = publicSet.has(url);
  const isPrivatePrefix = privatePrefixes.some((p) => url === p || url.startsWith(p));

  const report = (expected, why, fix) =>
    errors.push(
      [
        `route:      ${url}`,
        `file:       src/routes/${file}`,
        `allowlist:  ${isPublic ? "PUBLIC (in PUBLIC_ROUTES + sitemap.xml)" : "PRIVATE"}${
          !isPublic && isPrivatePrefix
            ? ` (matches PRIVATE_PREFIXES entry "${privatePrefixes.find((p) => url === p || url.startsWith(p))}")`
            : ""
        }`,
        `robots.txt: ${isPublic ? `Allow: ${url === "/" ? "/$" : url}` : "Disallow (catch-all or explicit prefix)"}`,
        `expected:   ${expected}`,
        `actual:     ${describeSignals(signals)}`,
        `x-robots:   ${isPublic ? "no X-Robots-Tag header" : "X-Robots-Tag: noindex, nofollow, noarchive"}`,
        `why:        ${why}`,
        `fix:        ${fix}`,
      ].join("\n    "),
    );

  if (isPublic && noindex) {
    report(
      "indexable (no `noindex` anywhere in the page metadata)",
      "the route is allowlisted in robots.txt and advertised in sitemap.xml, but the rendered page tells crawlers not to index it",
      "remove `noindex: true` from its pageMeta(), or drop the path from PUBLIC_ROUTES in src/lib/public-routes.ts",
    );
  }
  if (!isPublic && !noindex) {
    report(
      'noindex (pageMeta({ noindex: true }) -> <meta name="robots" content="noindex, nofollow">)',
      isPrivatePrefix
        ? "the route falls under a private prefix, so robots.txt disallows it, yet the rendered page carries no noindex signal"
        : "the route is not allowlisted, so robots.txt blocks it via the catch-all Disallow, yet the rendered page carries no noindex signal",
      "add `noindex: true` to its pageMeta(), or add the path to PUBLIC_ROUTES in src/lib/public-routes.ts",
    );
  }
}

for (const path of publicPaths) {
  if (!seen.has(path)) {
    errors.push(
      [
        `route:      ${path}`,
        `file:       (none — no route file resolves to this path)`,
        `allowlist:  PUBLIC (in PUBLIC_ROUTES + sitemap.xml)`,
        `expected:   a page route file rendering indexable metadata`,
        `actual:     404 — sitemap.xml advertises a URL the router does not serve`,
        `fix:        create the route, or remove "${path}" from PUBLIC_ROUTES in src/lib/public-routes.ts`,
      ].join("\n    "),
    );
  }
}

if (errors.length) {
  console.error("\n✗ noindex / robots allowlist contradictions:\n");
  errors.forEach((e, i) => console.error(`  ${i + 1}) ${e}\n`));
  console.error(`${errors.length} problem(s) found.\n`);
  process.exit(1);
}


console.log(`✓ noindex settings agree with robots/sitemap allowlist (${seen.size} routes)`);
