import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { cleanupTmpDir } from "#tests/helpers/fs.js";
import { StateManager } from "#src/core/config/state.js";
import { EMPTY_INPUT_SHA256 } from "#src/utils/hash.js";
import { PROJECT_NAME } from "#src/constants.js";

/**
 * Migration regression for the binary-asset drift bug.
 *
 * Older codi versions stored EMPTY_INPUT_SHA256 in state.json as the
 * placeholder hash for binary skill assets (fonts, PDFs, archives) because
 * the generator skipped reading their bytes. After upgrading to a codi
 * release that computes real binary hashes, an existing state.json from
 * the old install would still carry the placeholder — and on the very
 * next `codi status` every binary asset got reported as drifted forever.
 *
 * The fix: drift detection treats a stored EMPTY_INPUT_SHA256 as a
 * sentinel meaning "this entry was never properly hashed", and reports
 * `synced` so the user is not flooded with false positives until a fresh
 * `codi generate` refreshes the state with real hashes.
 */

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `${PROJECT_NAME}-state-binsentinel-`));
});

afterEach(async () => {
  await cleanupTmpDir(tmpDir);
});

describe("StateManager — EMPTY_INPUT_SHA256 sentinel migration", () => {
  it("detectDrift reports binary entries with sentinel hash as synced (no false drift)", async () => {
    const filePath = path.join(tmpDir, ".claude/skills/fonts/Test-Regular.ttf");
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    // Real bytes whose actual hash will differ from EMPTY_INPUT_SHA256.
    await fs.writeFile(filePath, Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe]));

    const mgr = new StateManager(tmpDir);
    await mgr.updateAgent("claude-code", [
      {
        path: filePath,
        sourceHash: "src",
        generatedHash: EMPTY_INPUT_SHA256,
        sources: ["skill-asset"],
        timestamp: new Date().toISOString(),
      },
    ]);

    const driftResult = await mgr.detectDrift("claude-code");
    expect(driftResult.ok).toBe(true);
    if (!driftResult.ok) return;
    expect(driftResult.data.files[0]!.status).toBe("synced");
  });

  it("detectPresetArtifactDrift reports binary entries with sentinel hash as synced", async () => {
    const filePath = path.join(tmpDir, ".claude/skills/canvas/canvas-fonts/X-Bold.ttf");
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, Buffer.from([0xab, 0xcd, 0xef, 0x12, 0x34]));

    const mgr = new StateManager(tmpDir);
    await mgr.updatePresetArtifacts([
      {
        path: filePath,
        sourceHash: "preset-src",
        hash: EMPTY_INPUT_SHA256,
        timestamp: new Date().toISOString(),
        artifactType: "skill",
        artifactName: "canvas-design",
      },
    ]);

    const driftResult = await mgr.detectPresetArtifactDrift();
    expect(driftResult.ok).toBe(true);
    if (!driftResult.ok) return;
    expect(driftResult.data[0]!.status).toBe("synced");
  });

  it("detectHookDrift reports hook entries with sentinel hash as synced", async () => {
    const filePath = path.join(tmpDir, ".codi/hooks/some-binary-asset.bin");
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, Buffer.from([0x55, 0xaa, 0x55, 0xaa]));

    const mgr = new StateManager(tmpDir);
    await mgr.updateHooks([
      {
        path: filePath,
        sourceHash: "hook-src",
        generatedHash: EMPTY_INPUT_SHA256,
        sources: ["hooks"],
        timestamp: new Date().toISOString(),
      },
    ]);

    const driftResult = await mgr.detectHookDrift();
    expect(driftResult.ok).toBe(true);
    if (!driftResult.ok) return;
    expect(driftResult.data[0]!.status).toBe("synced");
  });

  it("detectDrift still reports real drift when the stored hash is a real hash", async () => {
    // Sanity check: the sentinel guard must not collapse all drift detection.
    const filePath = path.join(tmpDir, ".claude/rules/some-rule.md");
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, "edited content", "utf8");

    const mgr = new StateManager(tmpDir);
    await mgr.updateAgent("claude-code", [
      {
        path: filePath,
        sourceHash: "src",
        // Some real-looking but mismatching hash (NOT the sentinel)
        generatedHash: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        sources: ["rule.md"],
        timestamp: new Date().toISOString(),
      },
    ]);

    const driftResult = await mgr.detectDrift("claude-code");
    expect(driftResult.ok).toBe(true);
    if (!driftResult.ok) return;
    expect(driftResult.data.files[0]!.status).toBe("drifted");
  });
});
