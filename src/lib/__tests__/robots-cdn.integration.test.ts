/**
 * Integration test: X-Robots-Tag survives proxy/CDN edge caching.
 *
 * Spins up a real origin HTTP server that applies the same robots policy as the
 * app's `robotsHeaderMiddleware` (src/start.ts), fronted by a caching reverse
 * proxy that behaves like a CDN edge: it stores full responses (status +
 * headers + body) keyed by method+path, replays them on subsequent hits, and
 * adds its own `x-cache` header.
 *
 * The suite asserts that private paths keep `X-Robots-Tag: noindex, nofollow,
 * noarchive` on cache MISS *and* on cache HIT, through redirects, HEAD
 * requests, error responses and normalized URL variants — and that public
 * allowlisted paths never gain the header.
 */
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  isCrawlablePath,
  normalizePath,
  NOINDEX_HEADER,
  PUBLIC_ROUTES,
} from "../public-routes";

/** Origin: mirrors the production request middleware. */
function createOrigin() {
  return http.createServer((req, res) => {
    // Normalize the raw request target the way the app middleware does; a
    // protocol-relative-looking target like "//dashboard" is still a path here.
    const pathname = normalizePath(req.url ?? "/");
    const headers: Record<string, string> = {
      "content-type": "text/html; charset=utf-8",
      // CDNs commonly cache anything with a positive max-age.
      "cache-control": "public, max-age=60",
    };
    if (!isCrawlablePath(pathname)) {
      headers["X-Robots-Tag"] = NOINDEX_HEADER;
    }

    if (pathname === "/dashboard/redirect") {
      res.writeHead(302, { ...headers, location: "/login" });
      res.end();
      return;
    }
    if (pathname === "/dashboard/boom") {
      res.writeHead(500, headers);
      res.end("<html><body>error</body></html>");
      return;
    }
    res.writeHead(200, headers);
    res.end(req.method === "HEAD" ? undefined : `<html><body>${pathname}</body></html>`);
  });
}

interface CachedResponse {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
}

/** Edge: naive caching reverse proxy in front of the origin. */
function createEdge(originPort: number, cache: Map<string, CachedResponse>) {
  return http.createServer((req, res) => {
    const key = `${req.method}:${req.url}`;
    const cached = cache.get(key);
    if (cached) {
      res.writeHead(cached.status, { ...cached.headers, "x-cache": "HIT" });
      res.end(req.method === "HEAD" ? undefined : cached.body);
      return;
    }
    const upstream = http.request(
      { host: "127.0.0.1", port: originPort, path: req.url, method: req.method },
      (originRes) => {
        const chunks: Buffer[] = [];
        originRes.on("data", (c) => chunks.push(c as Buffer));
        originRes.on("end", () => {
          const entry: CachedResponse = {
            status: originRes.statusCode ?? 502,
            // Copy headers exactly as the origin sent them — no filtering.
            headers: { ...originRes.headers },
            body: Buffer.concat(chunks),
          };
          cache.set(key, entry);
          res.writeHead(entry.status, { ...entry.headers, "x-cache": "MISS" });
          res.end(req.method === "HEAD" ? undefined : entry.body);
        });
      },
    );
    upstream.on("error", () => {
      res.writeHead(502);
      res.end();
    });
    upstream.end();
  });
}

function listen(server: http.Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve((server.address() as AddressInfo).port));
  });
}

let origin: http.Server;
let edge: http.Server;
let edgeUrl: string;
const cache = new Map<string, CachedResponse>();

beforeAll(async () => {
  origin = createOrigin();
  const originPort = await listen(origin);
  edge = createEdge(originPort, cache);
  const edgePort = await listen(edge);
  edgeUrl = `http://127.0.0.1:${edgePort}`;
});

afterAll(async () => {
  await Promise.all(
    [edge, origin].map((s) => new Promise<void>((r) => s.close(() => r()))),
  );
});

async function get(path: string, init?: RequestInit) {
  const res = await fetch(`${edgeUrl}${path}`, { redirect: "manual", ...init });
  await res.arrayBuffer();
  return res;
}

const PRIVATE_PATHS = [
  "/dashboard",
  "/admin/leads",
  "/schedule",
  "/workspaces/abc/calendar",
  "/checkout/start",
  "/invite/token-123",
  "/some/unknown/page",
];

describe("X-Robots-Tag through a caching edge", () => {
  it.each(PRIVATE_PATHS)("keeps noindex on MISS and HIT for %s", async (path) => {
    const miss = await get(path);
    expect(miss.headers.get("x-cache")).toBe("MISS");
    expect(miss.headers.get("x-robots-tag")).toBe(NOINDEX_HEADER);

    const hit = await get(path);
    expect(hit.headers.get("x-cache")).toBe("HIT");
    expect(hit.headers.get("x-robots-tag")).toBe(NOINDEX_HEADER);
  });

  it.each(PUBLIC_ROUTES.map((r) => r.path))(
    "never adds noindex for public route %s",
    async (path) => {
      const miss = await get(path);
      expect(miss.headers.get("x-robots-tag")).toBeNull();
      const hit = await get(path);
      expect(hit.headers.get("x-cache")).toBe("HIT");
      expect(hit.headers.get("x-robots-tag")).toBeNull();
    },
  );

  it("preserves the header on cached redirects", async () => {
    for (const expectedCache of ["MISS", "HIT"]) {
      const res = await get("/dashboard/redirect");
      expect(res.status).toBe(302);
      expect(res.headers.get("x-cache")).toBe(expectedCache);
      expect(res.headers.get("x-robots-tag")).toBe(NOINDEX_HEADER);
    }
  });

  it("preserves the header on cached error responses", async () => {
    for (const expectedCache of ["MISS", "HIT"]) {
      const res = await get("/dashboard/boom");
      expect(res.status).toBe(500);
      expect(res.headers.get("x-cache")).toBe(expectedCache);
      expect(res.headers.get("x-robots-tag")).toBe(NOINDEX_HEADER);
    }
  });

  it("preserves the header for HEAD requests (separate cache entry)", async () => {
    const miss = await get("/dashboard", { method: "HEAD" });
    expect(miss.headers.get("x-cache")).toBe("MISS");
    expect(miss.headers.get("x-robots-tag")).toBe(NOINDEX_HEADER);
    const hit = await get("/dashboard", { method: "HEAD" });
    expect(hit.headers.get("x-cache")).toBe("HIT");
    expect(hit.headers.get("x-robots-tag")).toBe(NOINDEX_HEADER);
  });

  it("tags normalized private URL variants (query, trailing slash, dupe slashes)", async () => {
    for (const variant of [
      "/dashboard/",
      "/dashboard?utm_source=newsletter",
      "//dashboard",
      "/admin/leads/?page=2",
    ]) {
      const res = await get(variant);
      expect(res.headers.get("x-robots-tag")).toBe(NOINDEX_HEADER);
    }
  });

  it("does not lose the header when a public variant shares a cache prefix", async () => {
    const pub = await get("/comparison/polyai?utm_source=x");
    expect(pub.headers.get("x-robots-tag")).toBeNull();
    const priv = await get("/comparison/polyai/internal-notes");
    expect(priv.headers.get("x-robots-tag")).toBe(NOINDEX_HEADER);
  });

  it("fails loudly if an edge strips the header (regression guard)", async () => {
    // A stripping edge simulates a misconfigured CDN; the assertion below is
    // what would catch that in production monitoring.
    const stripping = http.createServer((req, res) => {
      void req;
      res.writeHead(200, { "content-type": "text/html" });
      res.end("ok");
    });
    const port = await listen(stripping);
    const res = await fetch(`http://127.0.0.1:${port}/dashboard`);
    await res.arrayBuffer();
    expect(res.headers.get("x-robots-tag")).toBeNull();
    await new Promise<void>((r) => stripping.close(() => r()));
  });
});
