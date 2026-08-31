import { describe, it, expect } from "vitest";
import {
  ROBOTS_RULES,
  renderRobotsTxt,
  renderSitemapXml,
  sitemapPaths,
  normalizePath,
} from "../public-routes";

function locPaths(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
    normalizePath(new URL(m[1]).pathname),
  );
}

function allowPaths(txt: string): string[] {
  return txt
    .split("\n")
    .filter((l) => l.startsWith("Allow: "))
    .map((l) => l.slice("Allow: ".length).replace(/\$$/, ""))
    .map((p) => normalizePath(p || "/"))
    .filter((p) => !p.endsWith(".xml"));
}

describe("robots.txt is generated from the sitemap URLs", () => {
  it("allows exactly the sitemap paths", () => {
    const sitemap = locPaths(renderSitemapXml());
    expect(allowPaths(renderRobotsTxt())).toEqual(sitemap);
    expect(sitemapPaths()).toEqual(sitemap);
  });

  it("stays in sync when the rules change", () => {
    const config = {
      ...ROBOTS_RULES,
      allow: [
        { path: "/", changefreq: "weekly" as const, priority: "1.0" },
        { path: "/new-landing" },
        { path: "/secret", publicRobots: false },
      ],
    };
    const sitemap = locPaths(renderSitemapXml(config));
    expect(sitemap).toEqual(["/", "/new-landing"]);
    expect(allowPaths(renderRobotsTxt(config))).toEqual(sitemap);
    expect(renderRobotsTxt(config)).toContain("Disallow: /secret");
  });
});
