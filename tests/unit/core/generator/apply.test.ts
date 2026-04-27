import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { registerAdapter, clearAdapters } from "#src/core/generator/adapter-registry.js";
import { applyConfiguration } from "#src/core/generator/apply.js";
import { claudeCodeAdapter } from "#src/adapters/claude-code.js";
import { StateManager } from "#src/core/config/state.js";
import type { GeneratedFileState } from "#src/core/config/state.js";
import { hashContent } from "#src/utils/hash.js";
import { createMockConfig } from "#tests/unit/adapters/mock-config.js";
import { PROJECT_NAME } from "#src/constants.js";

describe("applyConfiguration", () => {
  let projectRoot: string;
  let configDir: string;

  beforeEach(async () => {
    clearAdapters();
    registerAdapter(claudeCodeAdapter);
    projectRoot = join(
      tmpdir(),
      `${PROJECT_NAME}-apply-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    configDir = join(projectRoot, ".codi");
    await mkdir(configDir, { recursive: true });
  });

  afterEach(async () => {
    clearAdapters();
    await rm(projectRoot, { recursive: true, force: true });
  });

  async function fileExists(p: string): Promise<boolean> {
    return access(p)
      .then(() => true)
      .catch(() => false);
  }

  async function seedOrphanInState(
    agentId: string,
    relPath: string,
    fileContent: string,
    opts: { drift?: boolean } = {},
  ): Promise<void> {
    const sm = new StateManager(configDir, projectRoot);
    const recordedContent = opts.drift ? "original-pre-edit" : fileContent;
    const orphan: GeneratedFileState = {
      path: relPath,
      sourceHash: hashContent("orphan-source"),
      generatedHash: hashContent(recordedContent),
      sources: ["orphan-source"],
      timestamp: new Date().toISOString(),
    };
    await sm.updateAgentsBatch({ [agentId]: [orphan] });
    await mkdir(dirname(join(projectRoot, relPath)), { recursive: true });
    await writeFile(join(projectRoot, relPath), fileContent, "utf-8");
  }

  it("dryRun: true skips reconcile and returns stateUpdated: false", async () => {
    const config = createMockConfig({
      manifest: { name: "t", version: "1", agents: ["claude-code"] },
    });
    await seedOrphanInState("claude-code", ".claude/rules/orphan.md", "x");

    const result = await applyConfiguration(config, projectRoot, { dryRun: true });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.reconciliation.stateUpdated).toBe(false);
    expect(result.data.reconciliation.pruned).toEqual([]);
    expect(await fileExists(join(projectRoot, ".claude/rules/orphan.md"))).toBe(true);
  });

  it("pure-additive run: pruned is empty, state is updated", async () => {
    const config = createMockConfig({
      manifest: { name: "t", version: "1", agents: ["claude-code"] },
    });

    const result = await applyConfiguration(config, projectRoot, {});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.reconciliation.pruned).toEqual([]);
    expect(result.data.reconciliation.preservedDrifted).toEqual([]);
    expect(result.data.reconciliation.stateUpdated).toBe(true);
  });

  it("deselect path: clean orphan is pruned and removed from disk", async () => {
    const config = createMockConfig({
      manifest: { name: "t", version: "1", agents: ["claude-code"] },
    });
    await seedOrphanInState("claude-code", ".claude/rules/orphan.md", "matching-content");

    const result = await applyConfiguration(config, projectRoot, {});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.reconciliation.pruned).toContain(".claude/rules/orphan.md");
    expect(await fileExists(join(projectRoot, ".claude/rules/orphan.md"))).toBe(false);
  });

  it("drifted orphan + forceDeleteDriftedOrphans:false → preserved", async () => {
    const config = createMockConfig({
      manifest: { name: "t", version: "1", agents: ["claude-code"] },
    });
    await seedOrphanInState("claude-code", ".claude/rules/edited.md", "user-edited-content", {
      drift: true,
    });

    const result = await applyConfiguration(config, projectRoot, {
      forceDeleteDriftedOrphans: false,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.reconciliation.preservedDrifted).toContain(".claude/rules/edited.md");
    expect(result.data.reconciliation.pruned).not.toContain(".claude/rules/edited.md");
    expect(await fileExists(join(projectRoot, ".claude/rules/edited.md"))).toBe(true);
  });

  it("drifted orphan + forceDeleteDriftedOrphans:true → pruned", async () => {
    const config = createMockConfig({
      manifest: { name: "t", version: "1", agents: ["claude-code"] },
    });
    await seedOrphanInState("claude-code", ".claude/rules/edited.md", "user-edited-content", {
      drift: true,
    });

    const result = await applyConfiguration(config, projectRoot, {
      forceDeleteDriftedOrphans: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.reconciliation.pruned).toContain(".claude/rules/edited.md");
    expect(await fileExists(join(projectRoot, ".claude/rules/edited.md"))).toBe(false);
  });

  it("generate() failure propagates and leaves state untouched", async () => {
    const config = createMockConfig({
      manifest: { name: "t", version: "1", agents: ["nonexistent-adapter"] },
    });
    await seedOrphanInState("claude-code", ".claude/rules/orphan.md", "x");

    const result = await applyConfiguration(config, projectRoot, {});

    expect(result.ok).toBe(false);
    expect(await fileExists(join(projectRoot, ".claude/rules/orphan.md"))).toBe(true);
  });
});
