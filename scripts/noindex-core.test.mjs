import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { checkNoindex, filePathToUrl, parseRegistry, robotsSignals } from "./noindex-core.mjs";

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
    expect(robotsSignals(NOINDEX)).toEqual([
      { kind: "pageMeta", value: "noindex: true", noindex: true },
    ]);
  });

  it("detects raw robots meta tags", () => {
    const signals = robotsSignals(`{ name: "robots", content: "noindex, nofollow" }`);
    expect(signals).toEqual([
      { kind: 'meta name="robots"', value: "noindex, nofollow", noindex: true },
    ]);
  });

  it("treats `noindex: false` as indexable", () => {
    expect(robotsSignals(`pageMeta({ noindex: false })`)[0].noindex).toBe(false);
  });

  it("returns no signals for a plain indexable route", () => {
    expect(robotsSignals(INDEXABLE)).toEqual([]);
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
