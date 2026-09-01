/**
 * Validation for the structured allowlist edited in /admin/allowlist.
 * Mirrors the invariants enforced by the directive-text editor.
 */
import {
  normalizePath,
  type PublicRoute,
  type RobotsRulesConfig,
} from "@/lib/public-routes";

const CHANGEFREQS = [
  "always",
  "hourly",
  "daily",
  "weekly",
  "monthly",
  "yearly",
  "never",
] as const;

export function validateRobotsConfig(config: RobotsRulesConfig): string[] {
  const errors: string[] = [];

  if (!/^https?:\/\/[^\s/]+/i.test(config.baseUrl)) {
    errors.push("Base URL must be an absolute http(s) URL");
  }

  if (!config.allow.length) errors.push("At least one allowed route is required");

  const seen = new Set<string>();
  config.allow.forEach((route: PublicRoute, i) => {
    const label = `Row ${i + 1}`;
    if (!route.path.startsWith("/")) {
      errors.push(`${label}: path must start with "/"`);
      return;
    }
    if (/\s/.test(route.path)) {
      errors.push(`${label}: path must not contain spaces`);
      return;
    }
    const path = normalizePath(route.path);
    if (seen.has(path)) errors.push(`${label}: duplicate route ${path}`);
    seen.add(path);

    if (!CHANGEFREQS.includes(route.changefreq as (typeof CHANGEFREQS)[number])) {
      errors.push(`${label}: invalid changefreq "${route.changefreq}"`);
    }
    const priority = Number(route.priority);
    if (!Number.isFinite(priority) || priority < 0 || priority > 1) {
      errors.push(`${label}: priority must be between 0.0 and 1.0`);
    }
  });

  config.disallow.forEach((prefix, i) => {
    const label = `Disallow ${i + 1}`;
    if (!prefix.startsWith("/")) {
      errors.push(`${label}: prefix must start with "/"`);
      return;
    }
    if (seen.has(normalizePath(prefix))) {
      errors.push(
        `${normalizePath(prefix)} is both allowed and disallowed — remove one of the rules`,
      );
    }
  });

  config.sitemaps.forEach((url, i) => {
    if (!/^https?:\/\//i.test(url)) {
      errors.push(`Sitemap ${i + 1}: must be an absolute http(s) URL`);
    }
  });

  return errors;
}

/** Strip empty rows and normalise values before validating or saving. */
export function cleanRobotsConfig(config: RobotsRulesConfig): RobotsRulesConfig {
  return {
    baseUrl: config.baseUrl.trim().replace(/\/+$/, ""),
    allow: config.allow
      .filter((r) => r.path.trim() !== "")
      .map((r) => ({
        path: r.path.trim(),
        changefreq: r.changefreq,
        priority: String(r.priority).trim(),
        ...(r.publicRobots === false ? { publicRobots: false as const } : {}),
      })),
    disallow: config.disallow.map((p) => p.trim()).filter(Boolean),
    sitemaps: config.sitemaps.map((s) => s.trim()).filter(Boolean),
  };
}
