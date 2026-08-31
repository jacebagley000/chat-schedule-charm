/**
 * Convert between the editable robots.txt directive text shown in
 * /admin/robots and the structured rules stored in
 * src/config/robots-rules.json.
 */
import {
  normalizePath,
  type PublicRoute,
  type RobotsRulesConfig,
} from "@/lib/public-routes";

/** Paths handled by the renderer itself, not user-editable rules. */
const IMPLICIT_ALLOW = new Set(["/sitemap.xml", "/robots.txt"]);

/** The directive text a user edits: Allow / Disallow / Sitemap lines. */
export function toRobotsEditorText(config: RobotsRulesConfig): string {
  return [
    ...config.allow.map(
      (r) => `Allow: ${r.path}${r.publicRobots === false ? "  # publicRobots: false" : ""}`,
    ),
    "",
    ...config.disallow.map((p) => `Disallow: ${p}`),
    "",
    ...config.sitemaps.map((s) => `Sitemap: ${s}`),
    "",
  ].join("\n");
}

export interface ParseResult {
  config: RobotsRulesConfig;
  errors: string[];
}

/**
 * Parse directive text back into rules, preserving sitemap metadata
 * (changefreq / priority / publicRobots) from the previous config by path.
 */
export function parseRobotsEditorText(
  text: string,
  previous: RobotsRulesConfig,
): ParseResult {
  const errors: string[] = [];
  const allow: PublicRoute[] = [];
  const disallow: string[] = [];
  const sitemaps: string[] = [];
  const prevByPath = new Map(previous.allow.map((r) => [normalizePath(r.path), r]));

  text.split("\n").forEach((raw, i) => {
    const line = raw.split("#")[0].trim();
    if (!line) return;
    const lineNo = i + 1;
    const match = line.match(/^(allow|disallow|sitemap|user-agent)\s*:\s*(.+)$/i);
    if (!match) {
      errors.push(`Line ${lineNo}: unrecognised directive "${line}"`);
      return;
    }
    const directive = match[1].toLowerCase();
    const value = match[2].trim();

    if (directive === "user-agent") return;

    if (directive === "sitemap") {
      if (!/^https?:\/\//i.test(value)) {
        errors.push(`Line ${lineNo}: Sitemap must be an absolute http(s) URL`);
        return;
      }
      sitemaps.push(value);
      return;
    }

    const path = normalizePath(value.replace(/\$$/, ""));
    if (!path.startsWith("/")) {
      errors.push(`Line ${lineNo}: path must start with "/"`);
      return;
    }

    if (directive === "allow") {
      if (IMPLICIT_ALLOW.has(path)) return; // always allowed by the renderer
      if (allow.some((r) => normalizePath(r.path) === path)) {
        errors.push(`Line ${lineNo}: duplicate Allow for ${path}`);
        return;
      }
      const prev = prevByPath.get(path);
      allow.push({
        path,
        changefreq: prev?.changefreq ?? "monthly",
        priority: prev?.priority ?? "0.5",
        ...(/publicRobots\s*:\s*false/i.test(raw) ? { publicRobots: false } : {}),
      });
    } else {
      const prefix = value.trim() === "/" ? "/" : value.trim();
      if (prefix === "/") return; // catch-all is always emitted
      if (!disallow.includes(prefix)) disallow.push(prefix);
    }
  });

  const allowPaths = new Set(allow.map((r) => normalizePath(r.path)));
  for (const prefix of disallow) {
    const base = normalizePath(prefix);
    if (allowPaths.has(base)) {
      errors.push(`${base} is both allowed and disallowed — remove one of the rules`);
    }
  }
  if (!allow.length) errors.push("At least one Allow rule is required");

  return {
    config: { baseUrl: previous.baseUrl, allow, disallow, sitemaps },
    errors,
  };
}
