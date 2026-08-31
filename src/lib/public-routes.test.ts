import { describe, expect, it } from "vitest";
import { isCrawlablePath, normalizePath, PUBLIC_ROUTES } from "./public-routes";

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
