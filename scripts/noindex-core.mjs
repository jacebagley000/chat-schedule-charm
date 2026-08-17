/**
 * Pure core of the noindex / robots allowlist guard.
 *
 * Kept free of process.exit / console so it can be unit tested against small
 * fixture route trees (see scripts/noindex-core.test.mjs).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

/** Non-page routes that never render HTML metadata. */
export const NON_PAGE = [/^\/api\//, /^\/sitemap\.xml$/, /^\/robots\.txt$/];

/** Extract PUBLIC_ROUTES paths + PRIVATE_PREFIXES from the registry source. */
export function parseRegistry(src, label = "public-routes registry") {
  const section = (name) => {
    const m = src.match(new RegExp(`${name}[^=]*=\\s*\\[([\\s\\S]*?)\\n\\];`));
    if (!m) throw new Error(`could not parse ${name} from ${label}`);
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
export function filePathToUrl(file) {
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

/** All route files under a routes dir, relative to it, minus __root. */
export function routeFiles(routesDir) {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) out.push(relative(routesDir, full));
    }
  };
  walk(routesDir);
  return out.filter((f) => !f.startsWith("__root"));
}

/**
 * Collect the actual robots signals a route emits, so error output can quote
 * them verbatim instead of just saying "noindex missing".
 */
export function robotsSignals(source) {
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

export function describeSignals(signals) {
  if (!signals.length) return "none (no robots meta and no `noindex` flag)";
  return signals.map((s) => `${s.kind} -> "${s.value}"`).join("; ");
}

/**
 * Check a route tree against a registry.
 * @returns {{ errors: string[], problems: object[], routes: string[] }}
 */
export function checkNoindex({ routesDir, registrySource }) {
  const { publicPaths, privatePrefixes } = parseRegistry(registrySource);
  const publicSet = new Set(publicPaths);
  const errors = [];
  /** Machine-readable mirror of `errors`, for the JSON CI artifact. */
  const problems = [];
  const seen = new Set();

  for (const file of routeFiles(routesDir)) {
    const url = filePathToUrl(file);
    if (NON_PAGE.some((re) => re.test(url))) continue;
    seen.add(url);

    const source = readFileSync(join(routesDir, file), "utf8");
    const signals = robotsSignals(source);
    const noindex = signals.some((s) => s.noindex);
    const isPublic = publicSet.has(url);
    const isPrivatePrefix = privatePrefixes.some((p) => url === p || url.startsWith(p));

    const report = (expected, why, fix, kind) => {
      problems.push({
        kind,
        route: url,
        file: `src/routes/${file}`,
        allowlist: isPublic ? "public" : "private",
        privatePrefix:
          !isPublic && isPrivatePrefix
            ? (privatePrefixes.find((p) => url === p || url.startsWith(p)) ?? null)
            : null,
        robotsRule: isPublic
          ? `Allow: ${url === "/" ? "/$" : url}`
          : "Disallow (catch-all or explicit prefix)",
        inSitemap: isPublic,
        expected,
        actual: describeSignals(signals),
        signals,
        expectedXRobotsTag: isPublic ? null : "noindex, nofollow, noarchive",
        why,
        fix,
      });
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
    };

    if (isPublic && noindex) {
      report(
        "indexable (no `noindex` anywhere in the page metadata)",
        "the route is allowlisted in robots.txt and advertised in sitemap.xml, but the rendered page tells crawlers not to index it",
        "remove `noindex: true` from its pageMeta(), or drop the path from PUBLIC_ROUTES in src/lib/public-routes.ts",
        "public-route-noindexed",
      );
    }
    if (!isPublic && !noindex) {
      report(
        'noindex (pageMeta({ noindex: true }) -> <meta name="robots" content="noindex, nofollow">)',
        isPrivatePrefix
          ? "the route falls under a private prefix, so robots.txt disallows it, yet the rendered page carries no noindex signal"
          : "the route is not allowlisted, so robots.txt blocks it via the catch-all Disallow, yet the rendered page carries no noindex signal",
        "add `noindex: true` to its pageMeta(), or add the path to PUBLIC_ROUTES in src/lib/public-routes.ts",
        "private-route-indexable",
      );
    }
  }

  for (const path of publicPaths) {
    if (!seen.has(path)) {
      problems.push({
        kind: "sitemap-route-missing",
        route: path,
        file: null,
        allowlist: "public",
        privatePrefix: null,
        robotsRule: `Allow: ${path === "/" ? "/$" : path}`,
        inSitemap: true,
        expected: "a page route file rendering indexable metadata",
        actual: "404 — sitemap.xml advertises a URL the router does not serve",
        signals: [],
        expectedXRobotsTag: null,
        why: "sitemap.xml advertises a URL the router does not serve",
        fix: `create the route, or remove "${path}" from PUBLIC_ROUTES in src/lib/public-routes.ts`,
      });
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

  return { errors, problems, routes: [...seen] };
}
