/**
 * Audit of allowlisted routes that are nonetheless kept out of robots.txt /
 * sitemap.xml (i.e. effectively noindexed), and the minimal config edits that
 * flip them back to indexable. Used by /admin/noindex.
 */
import {
  hasPublicRobots,
  normalizePath,
  type PublicRoute,
  type RobotsRulesConfig,
} from "@/lib/public-routes";

export type NoindexReason =
  | "indexable"
  | "public-robots-disabled"
  | "blocked-by-disallow";

export interface NoindexRouteStatus {
  path: string;
  /** Normalised path used for matching. */
  normalized: string;
  indexable: boolean;
  reason: NoindexReason;
  /** Disallow prefixes in robots.txt that block this route. */
  blockingPrefixes: string[];
  /** Human explanation shown in the admin table. */
  explanation: string;
}

/** Disallow prefixes (ignoring the catch-all) that cover a given path. */
export function blockingPrefixesFor(
  path: string,
  disallow: string[],
): string[] {
  const target = normalizePath(path);
  return disallow
    .filter((p) => p.trim() !== "" && p.trim() !== "/")
    .filter((prefix) => {
      const base = normalizePath(prefix);
      return target === base || target.startsWith(`${base}/`);
    });
}

export function auditNoindexRoutes(
  config: RobotsRulesConfig,
): NoindexRouteStatus[] {
  return config.allow.map((route: PublicRoute) => {
    const normalized = normalizePath(route.path);
    const blockingPrefixes = blockingPrefixesFor(normalized, config.disallow);

    if (!hasPublicRobots(route)) {
      return {
        path: route.path,
        normalized,
        indexable: false,
        reason: "public-robots-disabled",
        blockingPrefixes,
        explanation:
          "Public robots is switched off, so the route is left out of sitemap.xml and served with a noindex header.",
      };
    }
    if (blockingPrefixes.length) {
      return {
        path: route.path,
        normalized,
        indexable: false,
        reason: "blocked-by-disallow",
        blockingPrefixes,
        explanation: `robots.txt disallows ${blockingPrefixes.join(", ")}, which covers this route.`,
      };
    }
    return {
      path: route.path,
      normalized,
      indexable: true,
      reason: "indexable",
      blockingPrefixes: [],
      explanation: "Allowed in robots.txt and listed in sitemap.xml.",
    };
  });
}

/**
 * Return a config where the given route is crawlable: public robots switched
 * back on and every Disallow prefix that covered it removed.
 */
export function allowRouteInConfig(
  config: RobotsRulesConfig,
  path: string,
): RobotsRulesConfig {
  const target = normalizePath(path);
  const blocking = new Set(blockingPrefixesFor(target, config.disallow));
  return {
    ...config,
    allow: config.allow.map((route) => {
      if (normalizePath(route.path) !== target) return route;
      const { publicRobots: _drop, ...rest } = route;
      return { ...rest, publicRobots: true };
    }),
    disallow: config.disallow.filter((prefix) => !blocking.has(prefix)),
  };
}

/** Return a config where the given route is excluded from robots/sitemap. */
export function noindexRouteInConfig(
  config: RobotsRulesConfig,
  path: string,
): RobotsRulesConfig {
  const target = normalizePath(path);
  return {
    ...config,
    allow: config.allow.map((route) =>
      normalizePath(route.path) === target
        ? { ...route, publicRobots: false }
        : route,
    ),
  };
}
