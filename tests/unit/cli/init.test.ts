import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { cleanupTmpDir } from "#tests/helpers/fs.js";

// Mock expensive template-hashing operations — these tests cover directory structure,
// not version/hash logic. buildTemplateHashRegistry() hashes all templates synchronously
// and causes flaky timeouts when 150+ test workers compete for disk I/O.
vi.mock("#src/core/version/template-hash-registry.js", () => ({
  buildTemplateHashRegistry: vi.fn(() => ({
    cliVersion: "0.0.0",
    generatedAt: new Date().toISOString(),
    templates: {},
  })),
  getTemplateFingerprint: vi.fn(() => undefined),
  getAllFingerprints: vi.fn(() => []),
  _resetRegistryCache: vi.fn(),
}));
// Integration-level I/O under 150 parallel workers can exceed 10s.
vi.setConfig({ testTimeout: 30_000 });

import { initHandler } from "#src/cli/init.js";
import { Logger } from "#src/core/output/logger.js";
import { prefixedName, PROJECT_NAME, PROJECT_DIR, MANIFEST_FILENAME } from "#src/constants.js";

describe("init command handler", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `${PROJECT_NAME}-init-`));
    Logger.init({ level: "error", mode: "human", noColor: true });
  });

  afterEach(async () => {
    await cleanupTmpDir(tmpDir);
  });

  it(`creates ${PROJECT_DIR}/ directory structure`, async () => {
    const result = await initHandler(tmpDir, { json: true });

    expect(result.success).toBe(true);
    expect(result.data.configDir).toBe(path.join(tmpDir, PROJECT_DIR));

    const configDir = path.join(tmpDir, PROJECT_DIR);
    const stat = await fs.stat(configDir);
    expect(stat.isDirectory()).toBe(true);

    const manifest = await fs.readFile(path.join(configDir, MANIFEST_FILENAME), "utf-8");
    expect(manifest).toContain('version: "1"');

    const flags = await fs.readFile(path.join(configDir, "flags.yaml"), "utf-8");
    expect(flags).toContain("auto_commit:");

    const rulesDir = await fs.stat(path.join(configDir, "rules"));
    expect(rulesDir.isDirectory()).toBe(true);
  });

  it(`proceeds as update if ${PROJECT_DIR}/ already exists without --force`, async () => {
    // First init
    await initHandler(tmpDir, {
      json: true,
      preset: prefixedName("balanced"),
      agents: ["claude-code"],
    });

    // Second init (update) — should succeed, not reject
    const result = await initHandler(tmpDir, {
      json: true,
      preset: prefixedName("balanced"),
      agents: ["claude-code"],
    });
    expect(result.success).toBe(true);
    expect(result.data.rules.length).toBeGreaterThan(0);
  });

  it("reinitializes with --force", async () => {
    await fs.mkdir(path.join(tmpDir, PROJECT_DIR), { recursive: true });

    const result = await initHandler(tmpDir, { force: true, json: true });
    expect(result.success).toBe(true);
  });

  it("detects javascript stack when package.json exists", async () => {
    await fs.writeFile(path.join(tmpDir, "package.json"), "{}", "utf-8");

    const result = await initHandler(tmpDir, { json: true });
    expect(result.success).toBe(true);
    expect(result.data.stack).toContain("javascript");
  });

  it("detects python stack when pyproject.toml exists", async () => {
    await fs.writeFile(path.join(tmpDir, "pyproject.toml"), "[build-system]", "utf-8");

    const result = await initHandler(tmpDir, { json: true });
    expect(result.success).toBe(true);
    expect(result.data.stack).toContain("python");
  });

  it("detects multiple stacks simultaneously", async () => {
    await fs.writeFile(path.join(tmpDir, "package.json"), "{}", "utf-8");
    await fs.writeFile(path.join(tmpDir, "pyproject.toml"), "[build-system]", "utf-8");

    const result = await initHandler(tmpDir, { json: true });
    expect(result.success).toBe(true);
    expect(result.data.stack).toContain("javascript");
    expect(result.data.stack).toContain("python");
  });

  it("creates manifest with correct structure", async () => {
    const result = await initHandler(tmpDir, { json: true });
    expect(result.success).toBe(true);

    const manifest = await fs.readFile(path.join(tmpDir, PROJECT_DIR, MANIFEST_FILENAME), "utf-8");
    expect(manifest).toContain("name:");
    expect(manifest).toContain('version: "1"');
    expect(manifest).toContain("agents:");
  });

  it("creates flags.yaml with preset defaults", async () => {
    const result = await initHandler(tmpDir, { json: true });
    expect(result.success).toBe(true);

    const flagsContent = await fs.readFile(path.join(tmpDir, PROJECT_DIR, "flags.yaml"), "utf-8");
    expect(flagsContent).toContain("security_scan:");
  });

  it("rejects unknown preset names", async () => {
    const result = await initHandler(tmpDir, {
      json: true,
      preset: "nonexistent",
    });
    expect(result.success).toBe(false);
    expect(result.errors[0]!.code).toBe("E_CONFIG_INVALID");
    expect(result.errors[0]!.message).toContain("Unknown preset");
    expect(result.errors[0]!.message).toContain("nonexistent");
  });

  it("accepts known preset names", async () => {
    const result = await initHandler(tmpDir, {
      json: true,
      preset: prefixedName("strict"),
    });
    expect(result.success).toBe(true);
    expect(result.data.preset).toBe(prefixedName("strict"));
  });

  it("rejects unknown agent IDs", async () => {
    const result = await initHandler(tmpDir, {
      json: true,
      agents: ["nonexistent-agent"],
    });
    expect(result.success).toBe(false);
    expect(result.errors[0]!.message).toContain("Unknown agent");
  });

  it("accepts known agent IDs", async () => {
    const result = await initHandler(tmpDir, {
      json: true,
      agents: ["claude-code"],
    });
    expect(result.success).toBe(true);
    expect(result.data.agents).toContain("claude-code");
  });

  it("creates operations ledger", async () => {
    await initHandler(tmpDir, { json: true });

    const ledgerPath = path.join(tmpDir, PROJECT_DIR, "operations.json");
    const ledger = JSON.parse(await fs.readFile(ledgerPath, "utf-8"));
    expect(ledger.version).toBe("1");
    expect(ledger.initialized).toBeDefined();
    expect(ledger.initialized.timestamp).toBeDefined();
    expect(Array.isArray(ledger.initialized.stack)).toBe(true);
  });

  it("sanitizes uppercase directory names in manifest", async () => {
    const badDir = await fs.mkdtemp(path.join(os.tmpdir(), "MyProject-ABC-"));
    try {
      const result = await initHandler(badDir, { json: true });
      expect(result.success).toBe(true);

      const manifest = await fs.readFile(
        path.join(badDir, PROJECT_DIR, MANIFEST_FILENAME),
        "utf-8",
      );
      expect(manifest).toMatch(/name: [a-z0-9-]+/);
      expect(manifest).not.toMatch(/[A-Z]/);
    } finally {
      await cleanupTmpDir(badDir);
    }
  });

  it("scaffolds preset artifacts in non-interactive mode", async () => {
    const result = await initHandler(tmpDir, {
      json: true,
      preset: prefixedName("balanced"),
      agents: ["claude-code"],
    });
    expect(result.success).toBe(true);
    expect(result.data.rules.length).toBeGreaterThan(0);

    const rules = await fs.readdir(path.join(tmpDir, PROJECT_DIR, "rules"));
    expect(rules.filter((f) => f.endsWith(".md")).length).toBeGreaterThan(0);
  });

  it("writes preset-lock.json with sourceType builtin", async () => {
    await initHandler(tmpDir, {
      json: true,
      preset: prefixedName("balanced"),
      agents: ["claude-code"],
    });

    const lockPath = path.join(tmpDir, PROJECT_DIR, "preset-lock.json");
    const lock = JSON.parse(await fs.readFile(lockPath, "utf-8"));
    expect(lock.presets[prefixedName("balanced")]).toBeDefined();
    expect(lock.presets[prefixedName("balanced")]!.sourceType).toBe("builtin");
  });

  // Regression: an existing install + a re-init that adds a new agent must
  // refresh manifest.agents and produce the new agent's per-agent output.
  // Prior to the fix, createProjectStructure was gated on !isUpdate, so the
  // manifest kept the original agents list and generate() emitted nothing
  // for the newly-added agent.
  it("update mode persists newly-added agent in manifest and generates its output", async () => {
    await initHandler(tmpDir, {
      json: true,
      preset: prefixedName("balanced"),
      agents: ["claude-code"],
    });

    let manifest = await fs.readFile(path.join(tmpDir, PROJECT_DIR, MANIFEST_FILENAME), "utf-8");
    expect(manifest).toContain("claude-code");
    expect(manifest).not.toContain("codex");

    const result = await initHandler(tmpDir, {
      json: true,
      preset: prefixedName("balanced"),
      agents: ["claude-code", "codex"],
    });
    expect(result.success).toBe(true);
    expect(result.data.agents).toEqual(expect.arrayContaining(["claude-code", "codex"]));

    manifest = await fs.readFile(path.join(tmpDir, PROJECT_DIR, MANIFEST_FILENAME), "utf-8");
    expect(manifest).toContain("claude-code");
    expect(manifest).toContain("codex");

    // Codex's primary instruction file is AGENTS.md at the project root.
    const agentsMdExists = await fs
      .access(path.join(tmpDir, "AGENTS.md"))
      .then(() => true)
      .catch(() => false);
    expect(agentsMdExists).toBe(true);
  });

  // Regression: switching flag preset on update must rewrite flags.yaml.
  // Prior to the fix, persistFlags was only invoked on fresh install, so
  // a customize pass that picked a different preset was silently ignored.
  it("update mode rewrites flags.yaml when the flag preset changes", async () => {
    await initHandler(tmpDir, {
      json: true,
      preset: prefixedName("minimal"),
      agents: ["claude-code"],
    });
    const flagsBefore = await fs.readFile(path.join(tmpDir, PROJECT_DIR, "flags.yaml"), "utf-8");

    await initHandler(tmpDir, {
      json: true,
      preset: prefixedName("strict"),
      agents: ["claude-code"],
    });
    const flagsAfter = await fs.readFile(path.join(tmpDir, PROJECT_DIR, "flags.yaml"), "utf-8");

    expect(flagsAfter).not.toBe(flagsBefore);
  });

  // Regression: dropping an agent on a re-init must prune its per-agent output
  // dirs across every category (root instruction file, agent dir, skill dir).
  // Prior to the applyConfiguration façade, init.ts called generate() directly,
  // bypassing StateManager.detectOrphans/deleteOrphans entirely — so the
  // dropped agent's files (AGENTS.md, .codex/, .agents/skills/) were stranded.
  // We test via agent-drop because it is the only orphan-producing scenario
  // expressible in the non-interactive --agents/--preset path; the wizard's
  // artifact-deselect path produces orphans through the same code (apply.ts
  // unit tests cover the orphan-detection logic directly).
  it("update mode prunes a dropped agent's outputs across all its categories", async () => {
    await initHandler(tmpDir, {
      json: true,
      preset: prefixedName("balanced"),
      agents: ["claude-code", "codex"],
    });

    const codexInstructionFile = path.join(tmpDir, "AGENTS.md");
    const codexDir = path.join(tmpDir, ".codex");
    const codexSkillsDir = path.join(tmpDir, ".agents", "skills");

    expect(
      await fs
        .access(codexInstructionFile)
        .then(() => true)
        .catch(() => false),
    ).toBe(true);
    expect(
      await fs
        .access(codexDir)
        .then(() => true)
        .catch(() => false),
    ).toBe(true);
    const codexSkillsBefore = await fs.readdir(codexSkillsDir).catch(() => [] as string[]);
    expect(codexSkillsBefore.length).toBeGreaterThan(0);

    const result = await initHandler(tmpDir, {
      json: true,
      preset: prefixedName("balanced"),
      agents: ["claude-code"],
    });
    expect(result.success).toBe(true);
    expect(result.data.agents).toEqual(["claude-code"]);

    expect(
      await fs
        .access(codexInstructionFile)
        .then(() => false)
        .catch(() => true),
    ).toBe(true);
    const codexSkillsAfter = await fs.readdir(codexSkillsDir).catch(() => [] as string[]);
    expect(codexSkillsAfter.length).toBe(0);
  });

  // Regression complement: dropping the OTHER agent must prune its outputs
  // and leave the remaining agent's outputs intact. Catches per-agent path
  // confusion in the orphan logic — pruning must be targeted, not wholesale.
  it("update mode pruning is per-agent — keeps retained agent's outputs intact", async () => {
    await initHandler(tmpDir, {
      json: true,
      preset: prefixedName("balanced"),
      agents: ["claude-code", "codex"],
    });

    const claudeRulesDir = path.join(tmpDir, ".claude", "rules");
    const codexInstructionFile = path.join(tmpDir, "AGENTS.md");

    const claudeRulesBefore = await fs.readdir(claudeRulesDir).catch(() => [] as string[]);
    expect(claudeRulesBefore.length).toBeGreaterThan(0);

    // Drop claude-code; keep codex.
    const result = await initHandler(tmpDir, {
      json: true,
      preset: prefixedName("balanced"),
      agents: ["codex"],
    });
    expect(result.success).toBe(true);

    // claude's per-agent dir should be empty (or gone).
    const claudeRulesAfter = await fs.readdir(claudeRulesDir).catch(() => [] as string[]);
    expect(claudeRulesAfter.length).toBe(0);

    // codex's outputs should still be there.
    expect(
      await fs
        .access(codexInstructionFile)
        .then(() => true)
        .catch(() => false),
    ).toBe(true);
  });

  // Regression: read-merge-write semantics — user-set manifest fields
  // (description, presets, layers) must survive an update pass. The previous
  // implementation skipped the manifest write entirely on update; the fix
  // now rewrites the manifest, so it must not clobber unrelated fields.
  it("update mode preserves user-set manifest fields (description, presets, layers)", async () => {
    await initHandler(tmpDir, {
      json: true,
      preset: prefixedName("balanced"),
      agents: ["claude-code"],
    });

    const manifestPath = path.join(tmpDir, PROJECT_DIR, MANIFEST_FILENAME);
    const original = await fs.readFile(manifestPath, "utf-8");
    await fs.writeFile(
      manifestPath,
      `${original}description: hand-edited summary\nlayers:\n  rules: false\npresets:\n  - my-team-preset\n`,
      "utf-8",
    );

    await initHandler(tmpDir, {
      json: true,
      preset: prefixedName("balanced"),
      agents: ["claude-code", "codex"],
    });

    const merged = await fs.readFile(manifestPath, "utf-8");
    expect(merged).toContain("description: hand-edited summary");
    expect(merged).toContain("rules: false");
    expect(merged).toContain("my-team-preset");
    expect(merged).toContain("codex");
  });
});
