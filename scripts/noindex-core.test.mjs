import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  checkNoindex,
  classifyUrl,
  normalizePath,
  evidenceLines,
  filePathToUrl,
  metadataAnchors,
  parseRegistry,
  robotsSignals,
} from "./noindex-core.mjs";

/** Minimal registry source shaped like src/lib/public-routes.ts. */
function registry(publicPaths, privatePrefixes = ["/dashboard", "/admin"]) {
  return `export const PUBLIC_ROUTES = [
${publicPaths.map((p) => `  { path: "${p}", changefreq: "weekly" },`).join("\n")}
];

export const PRIVATE_PREFIXES = [
${privatePrefixes.map((p) => `  "${p}",`).join("\n")}
];
`;
}

const INDEXABLE = `import { pageMeta } from "@/lib/seo";
export const Route = createFileRoute("/x")({ head: () => pageMeta({ title: "X", description: "x" }) });
`;
const NOINDEX = `import { pageMeta } from "@/lib/seo";
export const Route = createFileRoute("/x")({ head: () => pageMeta({ title: "X", description: "x", noindex: true }) });
`;

let dir;
function writeRoutes(files) {
  for (const [rel, contents] of Object.entries(files)) {
    const full = join(dir, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, contents);
  }
  return dir;
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "noindex-fixtures-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("filePathToUrl", () => {
  it.each([
    ["index.tsx", "/"],
    ["login.tsx", "/login"],
    ["comparison/ai-vs-live-chat.tsx", "/comparison/ai-vs-live-chat"],
    ["_authenticated/dashboard.tsx", "/dashboard"],
    ["_authenticated/admin/leads.tsx", "/admin/leads"],
    ["api/public/webhook.ts", "/api/public/webhook"],
    ["sitemap[.]xml.tsx", "/sitemap.xml"],
  ])("maps %s -> %s", (file, url) => {
    expect(filePathToUrl(file)).toBe(url);
  });
});

describe("parseRegistry", () => {
  it("extracts public paths and private prefixes", () => {
    expect(parseRegistry(registry(["/", "/login"]))).toEqual({
      publicPaths: ["/", "/login"],
      privatePrefixes: ["/dashboard", "/admin"],
    });
  });

  it("throws when PUBLIC_ROUTES is empty or missing", () => {
    expect(() => parseRegistry(registry([]))).toThrow(/PUBLIC_ROUTES/);
    expect(() => parseRegistry("export const PRIVATE_PREFIXES = [\n];")).toThrow(
      /could not parse PUBLIC_ROUTES/,
    );
  });
});

describe("robotsSignals", () => {
  it("detects pageMeta noindex flags", () => {
    expect(robotsSignals(NOINDEX)).toMatchObject([
      { kind: "pageMeta", value: "noindex: true", noindex: true },
    ]);
  });

  it("detects raw robots meta tags", () => {
    const signals = robotsSignals(`{ name: "robots", content: "noindex, nofollow" }`);
    expect(signals).toMatchObject([
      { kind: 'meta name="robots"', value: "noindex, nofollow", noindex: true, line: 1 },
    ]);
    expect(signals[0].snippet).toContain("robots");
    expect(signals[0].snippet).toContain("»");
  });

  it("treats `noindex: false` as indexable", () => {
    expect(robotsSignals(`pageMeta({ noindex: false })`)[0].noindex).toBe(false);
  });

  it("returns no signals for a plain indexable route", () => {
    expect(robotsSignals(INDEXABLE)).toEqual([]);
  });
});

describe("robots source fragments", () => {
  it("reports file:line and the surrounding fragment for a signal", () => {
    const signals = robotsSignals(`line one\nexport const Route = pageMeta({ noindex: true });`);
    expect(signals[0].line).toBe(2);
    expect(signals[0].snippet).toMatch(/pageMeta.*»noindex: true«/);
  });

  it("falls back to metadata anchors when no robots signal exists", () => {
    const anchors = metadataAnchors(`\nexport const meta = pageMeta({ title: "x" });`);
    expect(anchors[0]).toMatchObject({ kind: "pageMeta()", line: 2 });
    expect(evidenceLines("src/routes/a.tsx", [], anchors)[0]).toContain("src/routes/a.tsx:2");
  });

  it("says so when there is no metadata block at all", () => {
    expect(evidenceLines("src/routes/a.tsx", [], [])[0]).toContain("no pageMeta()");
  });
});

describe("checkNoindex", () => {
  it("passes when public routes are indexable and private routes are noindex", () => {
    const routesDir = writeRoutes({
      "index.tsx": INDEXABLE,
      "login.tsx": INDEXABLE,
      "_authenticated/dashboard.tsx": NOINDEX,
      "api/public/webhook.ts": "export const Route = {};",
      "__root.tsx": "export const Route = {};",
    });
    const { errors, routes } = checkNoindex({
      routesDir,
      registrySource: registry(["/", "/login"]),
    });
    expect(errors).toEqual([]);
    expect(routes.sort()).toEqual(["/", "/dashboard", "/login"]);
  });

  it("fails when an allowlisted route emits noindex", () => {
    const routesDir = writeRoutes({ "index.tsx": INDEXABLE, "login.tsx": NOINDEX });
    const { errors } = checkNoindex({
      routesDir,
      registrySource: registry(["/", "/login"]),
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("route:      /login");
    expect(errors[0]).toContain("allowlist:  PUBLIC");
    expect(errors[0]).toContain('actual:     pageMeta -> "noindex: true"');
    expect(errors[0]).toContain("expected:   indexable");
  });

  it("fails when a private-prefix route is missing noindex", () => {
    const routesDir = writeRoutes({
      "index.tsx": INDEXABLE,
      "_authenticated/dashboard.tsx": INDEXABLE,
    });
    const { errors } = checkNoindex({ routesDir, registrySource: registry(["/"]) });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("route:      /dashboard");
    expect(errors[0]).toContain('matches PRIVATE_PREFIXES entry "/dashboard"');
    expect(errors[0]).toContain("actual:     none");
  });

  it("fails when a non-allowlisted route outside any prefix is missing noindex", () => {
    const routesDir = writeRoutes({ "index.tsx": INDEXABLE, "secret.tsx": INDEXABLE });
    const { errors } = checkNoindex({ routesDir, registrySource: registry(["/"]) });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("route:      /secret");
    expect(errors[0]).toContain("catch-all Disallow");
  });

  it("fails when PUBLIC_ROUTES advertises a path with no route file", () => {
    const routesDir = writeRoutes({ "index.tsx": INDEXABLE });
    const { errors } = checkNoindex({
      routesDir,
      registrySource: registry(["/", "/pricing"]),
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("route:      /pricing");
    expect(errors[0]).toContain("404 — sitemap.xml advertises a URL the router does not serve");
  });

  it("reports every contradiction, not just the first", () => {
    const routesDir = writeRoutes({
      "index.tsx": NOINDEX,
      "secret.tsx": INDEXABLE,
      "_authenticated/dashboard.tsx": INDEXABLE,
    });
    const { errors } = checkNoindex({ routesDir, registrySource: registry(["/"]) });
    expect(errors).toHaveLength(3);
  });

  it("ignores api and sitemap/robots routes", () => {
    const routesDir = writeRoutes({
      "index.tsx": INDEXABLE,
      "api/public/webhook.ts": "export const Route = {};",
      "sitemap[.]xml.tsx": "export const Route = {};",
      "robots[.]txt.tsx": "export const Route = {};",
    });
    const { errors, routes } = checkNoindex({ routesDir, registrySource: registry(["/"]) });
    expect(errors).toEqual([]);
    expect(routes).toEqual(["/"]);
  });
});

describe("normalizePath (real-world URL variants)", () => {
  it.each([
    ["/", "/"],
    ["", "/"],
    ["/login", "/login"],
    ["/login/", "/login"],
    ["/login//", "/login"],
    ["//login", "/login"],
    ["/login?utm_source=google&gclid=abc", "/login"],
    ["/login/?utm_source=google", "/login"],
    ["/login#top", "/login"],
    ["/login/?ref=x#pricing", "/login"],
    ["/comparison/polyai/", "/comparison/polyai"],
    ["/comparison//polyai", "/comparison/polyai"],
    ["https://example.com/comparison/polyai/?a=1", "/comparison/polyai"],
    ["/?utm_campaign=launch", "/"],
    ["/#hero", "/"],
    ["login", "/login"],
  ])("normalizes %s -> %s", (input, expected) => {
    expect(normalizePath(input)).toBe(expected);
  });
});

describe("classifyUrl (query params, trailing slashes, unknown routes)", () => {
  const reg = { publicPaths: ["/", "/login", "/comparison/polyai"], privatePrefixes: ["/dashboard", "/admin/"] };

  it.each([
    "/login",
    "/login/",
    "/login?utm_source=newsletter",
    "/login/?utm_source=newsletter#form",
    "//login",
  ])("treats public variant %s as public", (url) => {
    expect(classifyUrl(url, reg)).toMatchObject({ path: "/login", allowlist: "public" });
  });

  it.each(["/dashboard", "/dashboard/", "/dashboard?tab=today", "/dashboard/settings/"])(
    "treats private variant %s as private",
    (url) => {
      expect(classifyUrl(url, reg).allowlist).toBe("private");
    },
  );

  it("matches trailing-slash private prefixes without swallowing siblings", () => {
    expect(classifyUrl("/admin/leads?status=new", reg)).toMatchObject({
      allowlist: "private",
      privatePrefix: "/admin/",
    });
    // "/administration" must NOT match the "/admin/" prefix.
    expect(classifyUrl("/administration", reg).allowlist).toBe("unknown");
  });

  it.each([
    "/pricing",
    "/login-extra",
    "/comparison/polyai-vs-someone",
    "/comparison/polyai/deep/unknown",
    "/comparison/polyai/?x=1/../secret",
  ])("treats unknown route %s as catch-all blocked", (url) => {
    expect(classifyUrl(url, reg).allowlist).toBe("unknown");
  });

  it("keeps the root path public across query/hash variants", () => {
    for (const url of ["/", "/?utm=1", "/#hero", "//"]) {
      expect(classifyUrl(url, reg)).toMatchObject({ path: "/", allowlist: "public" });
    }
  });
});

describe("checkNoindex with real-world registry variants", () => {
  it("matches registry entries written with a trailing slash", () => {
    const routesDir = writeRoutes({
      "index.tsx": INDEXABLE,
      "comparison/polyai.tsx": INDEXABLE,
    });
    const { errors } = checkNoindex({
      routesDir,
      registrySource: registry(["/", "/comparison/polyai/"]),
    });
    expect(errors).toEqual([]);
  });

  it("still flags a trailing-slash registry entry whose route emits noindex", () => {
    const routesDir = writeRoutes({
      "index.tsx": INDEXABLE,
      "comparison/polyai.tsx": NOINDEX,
    });
    const { errors } = checkNoindex({
      routesDir,
      registrySource: registry(["/", "/comparison/polyai/"]),
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("route:      /comparison/polyai");
    expect(errors[0]).toContain("allowlist:  PUBLIC");
  });

  it("flags a registry entry that only differs by a query string as unserved", () => {
    const routesDir = writeRoutes({ "index.tsx": INDEXABLE, "login.tsx": INDEXABLE });
    const { errors, problems } = checkNoindex({
      routesDir,
      registrySource: registry(["/", "/login", "/signup?plan=pro"]),
    });
    expect(errors).toHaveLength(1);
    expect(problems[0]).toMatchObject({ kind: "sitemap-route-missing", route: "/signup" });
  });

  it("treats unknown sibling routes of a public path as private", () => {
    const routesDir = writeRoutes({
      "index.tsx": INDEXABLE,
      "comparison/polyai.tsx": INDEXABLE,
      "comparison/draft-competitor.tsx": INDEXABLE,
    });
    const { errors } = checkNoindex({
      routesDir,
      registrySource: registry(["/", "/comparison/polyai"]),
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("route:      /comparison/draft-competitor");
    expect(errors[0]).toContain("catch-all Disallow");
  });

  it("matches private prefixes written with a trailing slash", () => {
    const routesDir = writeRoutes({
      "index.tsx": INDEXABLE,
      "_authenticated/admin/leads.tsx": INDEXABLE,
      "administration.tsx": INDEXABLE,
    });
    const { errors } = checkNoindex({
      routesDir,
      registrySource: registry(["/"], ["/admin/"]),
    });
    expect(errors).toHaveLength(2);
    const leads = errors.find((e) => e.includes("route:      /admin/leads"));
    expect(leads).toContain('matches PRIVATE_PREFIXES entry "/admin/"');
    // sibling name must fall through to the catch-all, not the /admin/ prefix
    const sibling = errors.find((e) => e.includes("route:      /administration"));
    expect(sibling).toContain("catch-all Disallow");
  });
});
