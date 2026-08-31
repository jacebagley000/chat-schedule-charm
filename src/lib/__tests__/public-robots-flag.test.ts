import { describe, expect, it } from "vitest";
import {
  hasPublicRobots,
  isCrawlablePath,
  isPrivatePrefixPath,
  PRIVATE_PREFIXES,
  PUBLIC_ROUTES,
  renderRobotsTxt,
  renderSitemapXml,
  robotsPolicyFor,
  type PublicRoute,
} from "../public-routes";

describe("hasPublicRobots", () => {
  it("defaults to true and honours an explicit false", () => {
    expect(hasPublicRobots({ path: "/x" } as PublicRoute)).toBe(true);
    expect(hasPublicRobots({ path: "/x", publicRobots: true })).toBe(true);
    expect(hasPublicRobots({ path: "/x", publicRobots: false })).toBe(false);
  });
});

describe("private paths never inherit public robots rules", () => {
  it.each([
    "/dashboard",
    "/dashboard/settings",
    "/admin/leads",
    "/workspaces/123/calendar",
    "/checkout/start",
    "/api/public/webhook",
  ])("classifies %s as private-prefix", (path) => {
    const policy = robotsPolicyFor(path);
    expect(policy.crawlable).toBe(false);
    expect(policy.reason).toBe("private-prefix");
  });

  it("blocks private paths even with query strings and trailing slashes", () => {
    expect(isCrawlablePath("/dashboard/?tab=today")).toBe(false);
    expect(isCrawlablePath("/admin/leads/#top")).toBe(false);
  });

  it("does not treat lookalike public paths as private", () => {
    expect(isPrivatePrefixPath("/scheduler-info")).toBe(false);
    expect(isPrivatePrefixPath("/")).toBe(false);
  });

  it("never leaks a private prefix into robots Allow lines or the sitemap", () => {
    const robots = renderRobotsTxt();
    const sitemap = renderSitemapXml();
    for (const prefix of PRIVATE_PREFIXES) {
      expect(robots).toContain(`Disallow: ${prefix}`);
      expect(robots).not.toContain(`Allow: ${prefix}`);
      expect(sitemap).not.toContain(`<loc>${prefix}`);
    }
  });
});

describe("registered routes with publicRobots: false", () => {
  const disabled = PUBLIC_ROUTES.filter((r) => !hasPublicRobots(r));

  it("are excluded from robots Allow lines and the sitemap", () => {
    const robots = renderRobotsTxt();
    const sitemap = renderSitemapXml();
    for (const route of disabled) {
      expect(robots).not.toContain(`Allow: ${route.path}`);
      expect(robots).toContain(`Disallow: ${route.path}`);
      expect(sitemap).not.toContain(`${route.path}</loc>`);
      expect(robotsPolicyFor(route.path).reason).toBe("public-robots-disabled");
      expect(isCrawlablePath(route.path)).toBe(false);
    }
  });

  it("keeps opted-in routes crawlable", () => {
    for (const route of PUBLIC_ROUTES.filter(hasPublicRobots)) {
      expect(isCrawlablePath(route.path)).toBe(true);
      expect(robotsPolicyFor(route.path).reason).toBe("public-route");
    }
  });
});

describe("unregistered paths", () => {
  it.each(["/nope", "/comparison/unknown", "/login-extra"])(
    "%s is not registered and not crawlable",
    (path) => {
      const policy = robotsPolicyFor(path);
      expect(policy.crawlable).toBe(false);
      expect(policy.reason).toBe("not-registered");
    },
  );

  it("still allows crawlable files", () => {
    expect(robotsPolicyFor("/robots.txt").reason).toBe("crawlable-file");
    expect(robotsPolicyFor("/sitemap.xml").reason).toBe("crawlable-file");
  });
});
