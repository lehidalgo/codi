/**
 * CORE-002 — apply pipeline atomic state commit.
 *
 * Verifies that the previously two-step state mutation
 * (`removeAgents` + `updateAgentsBatch`) is now a single transaction
 * via `StateManager.atomicMutate`. Tests focus on observable behavior:
 *   - removed + added agents land atomically (no half-state),
 *   - parallel `applyConfiguration` runs serialize through the lock,
 *   - the convergent-recovery contract (orphan delete failure → ENOENT
 *     branch self-heals next run) is preserved.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { registerAdapter, clearAdapters } from "#src/core/generator/adapter-registry.js";
import { applyConfiguration } from "#src/core/generator/apply.js";
import { claudeCodeAdapter } from "#src/adapters/claude-code.js";
import { StateManager } from "#src/core/config/state.js";
import type { GeneratedFileState } from "#src/core/config/state.js";
import { hashContent } from "#src/utils/hash.js";
import { createMockConfig } from "#tests/unit/adapters/mock-config.js";
import { PROJECT_NAME } from "#src/constants.js";

describe("applyConfiguration — atomic state commit (CORE-002)", () => {
  let projectRoot: string;
  let configDir: string;

  beforeEach(async () => {
    clearAdapters();
    registerAdapter(claudeCodeAdapter);
    projectRoot = join(
      tmpdir(),
      `${PROJECT_NAME}-apply-atomic-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    configDir = join(projectRoot, ".codi");
    await mkdir(configDir, { recursive: true });
  });

  afterEach(async () => {
    clearAdapters();
    await rm(projectRoot, { recursive: true, force: true });
  });

  it("commits removed + added agents in a single atomic mutation", async () => {
    // Pre-seed state with an agent that will be removed and one that
    // will get its files replaced.
    const sm = new StateManager(configDir, projectRoot);
    const seedFile: GeneratedFileState = {
      path: "cursor/old-file.md",
      sourceHash: hashContent("x"),
      generatedHash: hashContent("y"),
      sources: ["x"],
      timestamp: new Date().toISOString(),
    };
    await sm.updateAgentsBatch({
      cursor: [seedFile], // will be removed (config uses only claude-code)
      "claude-code": [seedFile], // will be replaced with new content
    });

    const config = createMockConfig({
      manifest: { name: "t", version: "1", agents: ["claude-code"] },
    });
    const result = await applyConfiguration(config, projectRoot);
    expect(result.ok).toBe(true);

    // After apply: cursor removed, claude-code rewritten.
    const after = await sm.read();
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(after.data.agents["cursor"]).toBeUndefined();
    expect(after.data.agents["claude-code"]).toBeDefined();
    // The new claude-code entries must NOT include the old seed-file path
    // (proves the mutation replaced rather than merged).
    const paths = after.data.agents["claude-code"]!.map((f) => f.path);
    expect(paths).not.toContain("cursor/old-file.md");
  });

  it("two parallel applyConfiguration runs on same project: both observe a consistent state", async () => {
    // The cross-process lock from CORE-002 serializes the state mutations.
    // Even though both runs operate on the same project, neither half-writes
    // state.json — every observable run produces a valid, complete state.
    const config = createMockConfig({
      manifest: { name: "t", version: "1", agents: ["claude-code"] },
    });

    const [r1, r2] = await Promise.all([
      applyConfiguration(config, projectRoot),
      applyConfiguration(config, projectRoot),
    ]);
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);

    // State.json after both runs is valid JSON with the expected agent map.
    const sm = new StateManager(configDir, projectRoot);
    const after = await sm.read();
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(after.data.version).toBe("1");
    expect(after.data.agents["claude-code"]).toBeDefined();
  });

  it("preserves ENOENT-recovery: state mentioning a missing file self-heals", async () => {
    // Seed state with a file that's tracked but NOT on disk (simulates
    // a crashed run where delete-orphans succeeded but state was never
    // updated). Next applyConfiguration should re-detect via the ENOENT
    // branch in detectOrphans and produce a clean state.
    const sm = new StateManager(configDir, projectRoot);
    const phantom: GeneratedFileState = {
      path: ".claude/agents/phantom.md",
      sourceHash: hashContent("missing"),
      generatedHash: hashContent("missing"),
      sources: ["missing"],
      timestamp: new Date().toISOString(),
    };
    // Track a file that doesn't exist on disk.
    await sm.updateAgentsBatch({
      "claude-code": [phantom],
    });

    const config = createMockConfig({
      manifest: { name: "t", version: "1", agents: ["claude-code"] },
    });
    const result = await applyConfiguration(config, projectRoot);
    expect(result.ok).toBe(true);

    // After apply: phantom path is no longer in state (self-healed via
    // ENOENT branch in state.detectOrphans + the fresh agent updates).
    const after = await sm.read();
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    const paths = (after.data.agents["claude-code"] ?? []).map((f) => f.path);
    expect(paths).not.toContain(".claude/agents/phantom.md");
  });

  it("crash between orphan delete and state commit converges on next run", async () => {
    // Simulate the crash window: pre-seed state to list an orphan, delete
    // the file from disk manually (mimicking a successful delete), then
    // call applyConfiguration. The expected behavior is convergent:
    // state's stale entry is reconciled away via the ENOENT branch.
    const sm = new StateManager(configDir, projectRoot);
    const orphan: GeneratedFileState = {
      path: ".claude/orphan-file.md",
      sourceHash: hashContent("stale"),
      generatedHash: hashContent("stale"),
      sources: ["stale"],
      timestamp: new Date().toISOString(),
    };
    await sm.updateAgentsBatch({
      "claude-code": [orphan],
    });
    // File does NOT exist on disk — simulates post-crash state.

    const config = createMockConfig({
      manifest: { name: "t", version: "1", agents: ["claude-code"] },
    });
    const result = await applyConfiguration(config, projectRoot);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // pruned should include the orphan (ENOENT branch counts it as clean)
    expect(result.data.reconciliation.pruned).toContain(".claude/orphan-file.md");

    // State no longer mentions the orphan path.
    const after = await sm.read();
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    const paths = (after.data.agents["claude-code"] ?? []).map((f) => f.path);
    expect(paths).not.toContain(".claude/orphan-file.md");
  });
});
