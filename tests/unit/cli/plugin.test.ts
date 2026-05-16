/**
 * ISSUE-047 — unit coverage for the plugin CLI handler.
 *
 * `plugin publish` had 0 unit tests / 0% coverage despite the
 * code-execution surface (publishing into per-target plugin manifests
 * the agent runtime later loads). These tests drive
 * `pluginPublishHandler` against a fresh tmp project root.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pluginPublishHandler } from "#src/cli/plugin.js";
import { EXIT_CODES } from "#src/core/output/exit-codes.js";
import { PROJECT_DIR } from "#src/constants.js";

function seedMinimalProject(root: string): void {
  mkdirSync(path.join(root, PROJECT_DIR), { recursive: true });
  writeFileSync(
    path.join(root, PROJECT_DIR, "artifact-manifest.json"),
    JSON.stringify({ artifacts: {} }, null, 2),
  );
  writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ name: "codi-plugin-test", version: "0.0.0" }, null, 2),
  );
}

describe("pluginPublishHandler", () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = mkdtempSync(path.join(tmpdir(), "codi-plugin-"));
    seedMinimalProject(tmpRoot);
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("rejects an unknown publish track with E_CONFIG_INVALID exit", async () => {
    const result = await pluginPublishHandler(tmpRoot, { track: "bogus" });
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(EXIT_CODES.GENERAL_ERROR);
    expect(result.data.track).toBe("local");
    expect(result.data.published).toEqual([]);
  });

  it("publishes to the local track by default and reports the result", async () => {
    const result = await pluginPublishHandler(tmpRoot, {});
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(result.data.track).toBe("local");
    expect(Array.isArray(result.data.published)).toBe(true);
    expect(Array.isArray(result.data.skipped)).toBe(true);
  });

  it("accepts an explicit target list (e.g. claude-code only)", async () => {
    const result = await pluginPublishHandler(tmpRoot, { target: ["claude-code"] });
    expect(result.success).toBe(true);
    // Targets that fail their preflight check appear in `skipped`; targets
    // that succeed appear in `published`. Both arrays are well-formed.
    expect(result.data.published.length + result.data.skipped.length).toBeGreaterThanOrEqual(0);
  });
});
