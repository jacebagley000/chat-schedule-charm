import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BASE_URL,
  NOINDEX_HEADER,
  PRIVATE_PREFIXES,
  PUBLIC_ROUTES,
  isCrawlablePath,
  renderRobotsTxt,
  renderSitemapXml,
} from "@/lib/public-routes";


const ROUTES_DIR = join(process.cwd(), "src/routes");

/** All URL paths the file-based router serves, derived from src/routes/**. */
function routerPaths(): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) files.push(relative(ROUTES_DIR, full));
    }
  };
  walk(ROUTES_DIR);

  return [
    ...new Set(
      files
        .map((f) => f.replace(/\.tsx?$/, ""))
        .filter((f) => !f.startsWith("__root"))
        .map((f) =>
          "/" +
          f
            .replace(/\[\.\]/g, ".")
            .split(/[/.]/)
            .filter((seg) => seg !== "index" && !seg.startsWith("_"))
            .join("/"),
        )
        // sitemap.xml / robots.txt lose their dot above; restore file-like leaves
        .map((p) => p.replace(/\/(sitemap|robots)\/(xml|txt)$/, "/$1.$2"))
        .map((p) => (p === "" ? "/" : p)),
    ),
  ];
}

describe("public route registry", () => {
  it("keeps robots.txt and sitemap.xml in sync", () => {
    const robots = renderRobotsTxt();
    const sitemap = renderSitemapXml();
    for (const { path } of PUBLIC_ROUTES) {
      expect(robots).toContain(`Allow: ${path === "/" ? "/$" : path}`);
      expect(sitemap).toContain(`<loc>${BASE_URL}${path}</loc>`);
    }
    expect(robots).toContain(`Sitemap: ${BASE_URL}/sitemap.xml`);
    expect(robots.trimEnd().endsWith(`Sitemap: ${BASE_URL}/sitemap.xml`)).toBe(true);
  });

  it("only lists routes the router actually serves", () => {
    const paths = routerPaths();
    for (const { path } of PUBLIC_ROUTES) {
      expect(paths, `missing route for ${path}`).toContain(path);
    }
  });

  it("never marks a private route as public", () => {
    for (const { path } of PUBLIC_ROUTES) {
      for (const prefix of PRIVATE_PREFIXES) {
        expect(path.startsWith(prefix)).toBe(false);
      }
    }
  });

  it("flags new crawlable page routes that are missing from the registry", () => {
    const known = new Set(PUBLIC_ROUTES.map((r) => r.path));
    const ignored = ["/sitemap.xml", "/robots.txt"];
    const missing = routerPaths().filter(
      (p) =>
        p.startsWith("/") &&
        !p.includes("$") &&
        !p.includes("*") &&
        !ignored.includes(p) &&
        !known.has(p) &&
        !PRIVATE_PREFIXES.some((prefix) => p === prefix || p.startsWith(prefix)),
    );
    expect(missing, `add these to PUBLIC_ROUTES or PRIVATE_PREFIXES: ${missing.join(", ")}`).toEqual(
      [],
    );
  });
});
