import { describe, expect, it } from "vitest";
import {
  allowRouteInConfig,
  auditNoindexRoutes,
  blockingPrefixesFor,
  noindexRouteInConfig,
} from "@/lib/noindex-audit";
import type { RobotsRulesConfig } from "@/lib/public-routes";

const config: RobotsRulesConfig = {
  baseUrl: "https://example.com",
  allow: [
    { path: "/", changefreq: "weekly", priority: "1.0" },
    { path: "/pricing", changefreq: "monthly", priority: "0.7", publicRobots: false },
    { path: "/admin/reports", changefreq: "monthly", priority: "0.5" },
  ],
  disallow: ["/admin/", "/api/"],
  sitemaps: ["https://example.com/sitemap.xml"],
};

describe("auditNoindexRoutes", () => {
  it("classifies each allowlisted route", () => {
    const rows = auditNoindexRoutes(config);
    expect(rows.map((r) => r.reason)).toEqual([
      "indexable",
      "public-robots-disabled",
      "blocked-by-disallow",
    ]);
    expect(rows[2].blockingPrefixes).toEqual(["/admin/"]);
  });

  it("ignores the catch-all disallow", () => {
    expect(blockingPrefixesFor("/pricing", ["/"])).toEqual([]);
  });
});

describe("allowRouteInConfig", () => {
  it("re-enables public robots", () => {
    const next = allowRouteInConfig(config, "/pricing");
    expect(auditNoindexRoutes(next)[1].indexable).toBe(true);
  });

  it("removes the disallow prefix that blocked the route", () => {
    const next = allowRouteInConfig(config, "/admin/reports");
    expect(next.disallow).toEqual(["/api/"]);
    expect(auditNoindexRoutes(next)[2].indexable).toBe(true);
  });

  it("leaves other routes untouched", () => {
    const next = allowRouteInConfig(config, "/pricing");
    expect(next.allow[0]).toEqual(config.allow[0]);
  });
});

describe("noindexRouteInConfig", () => {
  it("switches a route back off", () => {
    const next = noindexRouteInConfig(config, "/");
    expect(auditNoindexRoutes(next)[0].reason).toBe("public-robots-disabled");
  });
});
