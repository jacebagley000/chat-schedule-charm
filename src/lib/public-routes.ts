/**
 * Single source of truth for which routes are publicly crawlable.
 *
 * Both /sitemap.xml and /robots.txt are generated from this registry, so the
 * allowlist and the sitemap can never drift apart. When you add a public page,
 * add it here — nothing else to update.
 */

export const BASE_URL = "https://chat-schedule-charm.lovable.app";

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
}

/** Public, indexable pages. Keep in sync with src/routes/**. */
export const PUBLIC_ROUTES: PublicRoute[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/login", changefreq: "yearly", priority: "0.3" },
  { path: "/signup", changefreq: "yearly", priority: "0.6" },
  { path: "/comparison/polyai", changefreq: "monthly", priority: "0.7" },
  { path: "/comparison/answering-service", changefreq: "monthly", priority: "0.7" },
  {
    path: "/comparison/ai-receptionist-vs-live-chat",
    changefreq: "monthly",
    priority: "0.7",
  },
];

/**
 * Route prefixes that must never be crawled. Everything not in PUBLIC_ROUTES is
 * already blocked by the catch-all `Disallow: /`; these are listed explicitly so
 * the intent is readable in robots.txt.
 */
export const PRIVATE_PREFIXES: string[] = [
  "/dashboard",
  "/schedule",
  "/workspaces/",
  "/checkout/",
  "/invite/",
  "/api/",
  "/_authenticated/",
];

/** Extra crawlable files that are not pages. */
const EXTRA_ALLOWED = ["/sitemap.xml"];

function allowDirective(path: string): string {
  // "/" must be anchored with $ so the catch-all Disallow still blocks subpaths.
  return `Allow: ${path === "/" ? "/$" : path}`;
}

export function renderRobotsTxt(): string {
  const lines = [
    "# FrontDesk AI - robots.txt",
    "# Generated from src/lib/public-routes.ts — do not edit by hand.",
    "# Explicit allowlist: only public marketing/auth pages are crawlable.",
    "",
    "User-agent: *",
    "",
    "# Public routes (matches sitemap.xml)",
    ...PUBLIC_ROUTES.map((r) => allowDirective(r.path)),
    ...EXTRA_ALLOWED.map((p) => `Allow: ${p}`),
    "",
    "# Authenticated / internal routes",
    ...PRIVATE_PREFIXES.map((p) => `Disallow: ${p}`),
    "",
    "# Catch-all: disallow everything else not explicitly allowed above",
    "Disallow: /",
    "",
    `Sitemap: ${BASE_URL}/sitemap.xml`,
    "",
  ];
  return lines.join("\n");
}

export function renderSitemapXml(): string {
  const urls = PUBLIC_ROUTES.map((e) =>
    [
      `  <url>`,
      `    <loc>${BASE_URL}${e.path}</loc>`,
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
