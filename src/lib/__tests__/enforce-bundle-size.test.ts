import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const SCRIPT = resolve(__dirname, "../../../scripts/enforce-bundle-size.sh");

let workDir: string;
let summaryPath: string;

function makeFixture(name: string, bytes: number): string {
  const p = join(workDir, name);
  // Content doesn't matter — the guard only looks at file size.
  writeFileSync(p, Buffer.alloc(bytes, 0x50));
  return p;
}

function runGuard(env: Record<string, string>) {
  return spawnSync("bash", [SCRIPT], {
    env: { ...process.env, GITHUB_STEP_SUMMARY: summaryPath, ...env },
    encoding: "utf8",
  });
}

beforeAll(() => {
  workDir = mkdtempSync(join(tmpdir(), "bundle-guard-"));
  summaryPath = join(workDir, "summary.md");
  writeFileSync(summaryPath, "");
});
afterAll(() => rmSync(workDir, { recursive: true, force: true }));

describe("enforce-bundle-size.sh", () => {
  it("fails with exit code 1 when the fixture zip exceeds BUNDLE_MAX_BYTES", () => {
    const bundle = makeFixture("over.zip", 2048);
    const res = runGuard({
      BUNDLE_PATH: bundle,
      BUNDLE_NAME: "over.zip",
      BUNDLE_MAX_BYTES: "1024",
    });
    expect(res.status).toBe(1);
    expect(res.stdout).toContain("::error title=Bundle size budget exceeded");
    expect(res.stdout).toContain("over.zip");
  });

  it("passes cleanly when the bundle is under the soft (80%) limit", () => {
    const bundle = makeFixture("small.zip", 500);
    const res = runGuard({
      BUNDLE_PATH: bundle,
      BUNDLE_MAX_BYTES: "1000",
    });
    expect(res.status).toBe(0);
    expect(res.stdout).not.toContain("::error");
    expect(res.stdout).not.toContain("::warning");
  });

  it("emits a warning (but exits 0) when the bundle is between the soft and hard limits", () => {
    const bundle = makeFixture("warn.zip", 900);
    const res = runGuard({
      BUNDLE_PATH: bundle,
      BUNDLE_MAX_BYTES: "1000",
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("::warning title=Bundle size approaching budget");
  });

  it("rejects non-integer BUNDLE_MAX_BYTES with exit code 2", () => {
    const bundle = makeFixture("bad-max.zip", 10);
    const res = runGuard({
      BUNDLE_PATH: bundle,
      BUNDLE_MAX_BYTES: "not-a-number",
    });
    expect(res.status).toBe(2);
    expect(res.stderr).toContain("BUNDLE_MAX_BYTES must be a positive integer");
  });

  it("rejects a missing bundle path with exit code 2", () => {
    const res = runGuard({
      BUNDLE_PATH: join(workDir, "does-not-exist.zip"),
      BUNDLE_MAX_BYTES: "1024",
    });
    expect(res.status).toBe(2);
    expect(res.stderr).toContain("bundle not found");
  });
});
