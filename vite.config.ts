// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { spawn } from "node:child_process";
import type { Plugin } from "vite";

/**
 * Runs the security-surface SQL regression suite once when the preview/dev
 * server starts. Prints a clear PASS/FAIL banner in the server logs and
 * aborts startup on failure so a regressed build never becomes reachable.
 *
 * Skips silently when PGHOST is missing (e.g. offline dev) — the suite has
 * no database to talk to, and the Vitest runner would skip too.
 */
function securitySurfaceGate(): Plugin {
  let ran = false;
  return {
    name: "frontdesk:security-surface-gate",
    apply: "serve",
    configureServer(server) {
      if (ran) return;
      ran = true;
      if (!process.env.PGHOST) {
        server.config.logger.info(
          "\n[security-surface] skipped — PGHOST not set (no database available)\n",
        );
        return;
      }
      server.config.logger.info(
        "\n[security-surface] running SQL regression suite before exposing preview…\n",
      );
      const started = Date.now();
      const child = spawn(
        "bunx",
        ["vitest", "run", "src/lib/security-surface.test.ts"],
        { stdio: ["ignore", "pipe", "pipe"], env: process.env },
      );
      let out = "";
      child.stdout?.on("data", (c) => (out += c.toString()));
      child.stderr?.on("data", (c) => (out += c.toString()));
      child.on("close", (code) => {
        const ms = Date.now() - started;
        if (code === 0) {
          server.config.logger.info(
            `\n[security-surface] ✓ PASSED in ${ms}ms — preview is safe to expose\n`,
          );
          return;
        }
        server.config.logger.error(
          [
            "",
            "========================================================",
            `[security-surface] ✗ FAILED (exit ${code}, ${ms}ms)`,
            "Preview startup aborted so regressions aren't exposed.",
            "========================================================",
            out.trim(),
            "========================================================",
            "",
          ].join("\n"),
        );
        // Exit non-zero so the supervisor records a failed startup and does
        // not silently keep serving the previous good build.
        process.exit(1);
      });
    },
  };
}

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: [securitySurfaceGate()],
  },
});
