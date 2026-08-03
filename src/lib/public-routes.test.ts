import { describe, expect, it } from "vitest";
import {
  BASE_URL,
  PRIVATE_PREFIXES,
  PUBLIC_ROUTES,
  renderRobotsTxt,
  renderSitemapXml,
} from "@/lib/public-routes";
import { routeTree } from "@/routeTree.gen";

/** All URL paths the router can serve, excluding params/splats and internals. */
function routerPaths(): string[] {
  const out: string[] = [];
  const walk = (route: any) => {
    const full: string | undefined = route.fullPath;
    if (full) out.push(full);
    for (const child of route.children ?? []) walk(child);
  };
  walk(routeTree as any);
  return [...new Set(out)];
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
