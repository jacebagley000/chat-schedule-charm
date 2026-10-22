import { describe, expect, it } from "vitest";
import { isCrawlablePath, normalizePath, PUBLIC_ROUTES, ROBOTS_RULES, renderSitemapXml, renderRobotsTxt, sitemapUrls } from "./public-routes";

describe("public search origin", () => {
  it("uses businessbuddyconnect.app for every sitemap page", () => {
    expect(ROBOTS_RULES.baseUrl).toBe("https://businessbuddyconnect.app");
    const urls = sitemapUrls();
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) expect(new URL(url).origin).toBe("https://businessbuddyconnect.app");
  });

  it("advertises the current domain's sitemap", () => {
    expect(renderRobotsTxt()).toContain("Sitemap: https://businessbuddyconnect.app/sitemap.xml");
    expect(renderRobotsTxt()).not.toContain("frontdeskai.com");
  });

  it("omits fabricated modification dates and private pages", () => {
    const xml = renderSitemapXml();
    expect(xml).not.toContain("<lastmod>");
    for (const path of ["/admin/", "/dashboard", "/checkout/", "/workspaces/"]) {
      expect(xml).not.toContain(`https://businessbuddyconnect.app${path}`);
    }
  });
});

describe("normalizePath", () => {
  it.each([
    ["/", "/"],
    ["", "/"],
    ["/login/", "/login"],
    ["//login//", "/login"],
    ["/login?utm_source=x", "/login"],
    ["/login/?utm_source=x#form", "/login"],
    ["/comparison/polyai/", "/comparison/polyai"],
    ["https://example.com/comparison/polyai/?a=1", "/comparison/polyai"],
  ])("normalizes %s -> %s", (input, expected) => {
    expect(normalizePath(input)).toBe(expected);
  });
});

describe("isCrawlablePath", () => {
  it("allows every public route, including trailing-slash and query variants", () => {
    for (const { path } of PUBLIC_ROUTES) {
      expect(isCrawlablePath(path)).toBe(true);
      expect(isCrawlablePath(path === "/" ? "/" : `${path}/`)).toBe(true);
      expect(isCrawlablePath(`${path}?utm_source=newsletter`)).toBe(true);
      expect(isCrawlablePath(`${path}#section`)).toBe(true);
    }
  });

  it("allows robots.txt and sitemap.xml", () => {
    expect(isCrawlablePath("/robots.txt")).toBe(true);
    expect(isCrawlablePath("/sitemap.xml")).toBe(true);
  });

  it.each([
    "/dashboard",
    "/dashboard/",
    "/dashboard?tab=today",
    "/admin/leads",
    "/schedule/abc",
    "/login-extra",
    "/comparison/unknown-competitor",
    "/comparison/polyai/extra",
  ])("blocks %s", (path) => {
    expect(isCrawlablePath(path)).toBe(false);
  });
});
