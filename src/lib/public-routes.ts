/**
 * Single source of truth for which routes are publicly crawlable.
 *
 * The rules themselves live in `src/config/robots-rules.json`, which is edited
 * from the admin robots.txt editor (/admin/robots). robots.txt, sitemap.xml,
 * the X-Robots-Tag middleware and the build-time noindex checker all read that
 * one file, so the allowlist can never drift apart.
 */

import rulesConfig from "@/config/robots-rules.json";

export type ChangeFreq =
  | "always"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "never";

export interface PublicRoute {
  /** URL path as served, e.g. "/comparison/polyai". */
  path: string;
  changefreq?: ChangeFreq;
  priority?: string;
  /**
   * Explicit robots policy for this route. `true` (the default) means the page
   * is crawlable and indexable. Set to `false` to keep a route registered here
   * — for links, reports and tests — while never emitting public robots rules
   * for it: it is excluded from robots.txt Allow lines and from sitemap.xml,
   * and it is served with the noindex header like any other private path.
   */
  publicRobots?: boolean;
}

export interface RobotsRulesConfig {
  baseUrl: string;
  allow: PublicRoute[];
  disallow: string[];
  sitemaps: string[];
}

/** Parsed contents of src/config/robots-rules.json. */
export const ROBOTS_RULES = rulesConfig as RobotsRulesConfig;

export const BASE_URL = ROBOTS_RULES.baseUrl;

/** A route is public only when it opts in explicitly (default true). */
export function hasPublicRobots(route: PublicRoute): boolean {
  return route.publicRobots !== false;
}

/** Public, indexable pages, from the editable rules file. */
export const PUBLIC_ROUTES: PublicRoute[] = ROBOTS_RULES.allow;

/**
 * Route prefixes that must never be crawled. Everything not in PUBLIC_ROUTES is
 * already blocked by the catch-all `Disallow: /`; these are listed explicitly so
 * the intent is readable in robots.txt.
 */
export const PRIVATE_PREFIXES: string[] = ROBOTS_RULES.disallow.filter(
  (p) => p.trim() !== "/",
);

/** Extra crawlable files that are not pages. */
const EXTRA_ALLOWED = ["/sitemap.xml"];

function allowDirective(path: string): string {
  // "/" must be anchored with $ so the catch-all Disallow still blocks subpaths.
  return `Allow: ${path === "/" ? "/$" : path}`;
}

export function renderRobotsTxt(config: RobotsRulesConfig = ROBOTS_RULES): string {
  const publicRoutes = config.allow.filter(hasPublicRobots);
  const privatePrefixes = config.disallow.filter((p) => p.trim() !== "/");
  const lines = [
    "# FrontDesk AI - robots.txt",
    "# Generated from src/config/robots-rules.json — edit at /admin/robots.",
    "# Explicit allowlist: only public marketing/auth pages are crawlable.",
    "",
    "User-agent: *",
    "",
    "# Public routes (matches sitemap.xml)",
    ...publicRoutes.map((r) => allowDirective(r.path)),
    ...EXTRA_ALLOWED.map((p) => `Allow: ${p}`),
    "",
    "# Authenticated / internal routes",
    ...privatePrefixes.map((p) => `Disallow: ${p}`),
    ...config.allow
      .filter((r) => !hasPublicRobots(r))
      .map((r) => `Disallow: ${normalizePath(r.path)}`),
    "",
    "# Catch-all: disallow everything else not explicitly allowed above",
    "Disallow: /",
    "",
    ...config.sitemaps.map((s) => `Sitemap: ${s}`),
    "",
  ];
  return lines.join("\n");
}

export function renderSitemapXml(config: RobotsRulesConfig = ROBOTS_RULES): string {
  const urls = config.allow.filter(hasPublicRobots).map((e) =>
    [
      `  <url>`,
      `    <loc>${config.baseUrl}${e.path}</loc>`,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      `  </url>`,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
  ].join("\n");
}

/** Non-page files that crawlers may fetch and index normally. */
const CRAWLABLE_FILES = new Set([...EXTRA_ALLOWED, "/robots.txt"]);

/**
 * Normalize a real-world URL path: drop query string, hash and trailing
 * slashes, collapse duplicate slashes. `/login/?utm_source=x#top` -> `/login`.
 */
export function normalizePath(pathname: string): string {
  if (!pathname) return "/";
  let path = pathname.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, "");
  path = path.split("#")[0].split("?")[0];
  if (!path.startsWith("/")) path = `/${path}`;
  path = path.replace(/\/{2,}/g, "/");
  if (path.length > 1) path = path.replace(/\/+$/, "");
  return path || "/";
}

/**
 * True when the given URL path is part of the public allowlist (or a crawlable
 * non-page file). Everything else is private and must be sent with a
 * `X-Robots-Tag: noindex` response header.
 */
export function isCrawlablePath(pathname: string): boolean {
  return robotsPolicyFor(pathname).crawlable;
}

/** True when the path sits under an explicitly private prefix. */
export function isPrivatePrefixPath(pathname: string): boolean {
  const path = normalizePath(pathname);
  return PRIVATE_PREFIXES.some((prefix) => {
    const base = normalizePath(prefix);
    return path === base || path.startsWith(`${base}/`);
  });
}

export interface RobotsPolicy {
  path: string;
  crawlable: boolean;
  reason:
    | "crawlable-file"
    | "private-prefix"
    | "public-robots-disabled"
    | "public-route"
    | "not-registered";
}

/**
 * Resolve the robots policy for a path. Private prefixes are evaluated BEFORE
 * the public allowlist, and a registered route with `publicRobots: false` is
 * always treated as private — so a private path can never inherit the robots
 * rules of a public route (or of a public parent path).
 */
export function robotsPolicyFor(pathname: string): RobotsPolicy {
  const path = normalizePath(pathname);
  if (CRAWLABLE_FILES.has(path)) {
    return { path, crawlable: true, reason: "crawlable-file" };
  }
  if (isPrivatePrefixPath(path)) {
    return { path, crawlable: false, reason: "private-prefix" };
  }
  const route = PUBLIC_ROUTES.find((r) => normalizePath(r.path) === path);
  if (!route) return { path, crawlable: false, reason: "not-registered" };
  if (!hasPublicRobots(route)) {
    return { path, crawlable: false, reason: "public-robots-disabled" };
  }
  return { path, crawlable: true, reason: "public-route" };
}

/** Value sent on every non-crawlable response. */
export const NOINDEX_HEADER = "noindex, nofollow, noarchive";
