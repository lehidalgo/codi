import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { cleanupTmpDir } from "../../../helpers/fs.js";
import { PROJECT_NAME, PROJECT_DIR } from "../../../../src/constants.js";
import {
  OperationsLedgerManager,
  type LedgerInitialization,
  type LedgerActivePreset,
  type LedgerGeneratedFile,
  type LedgerHookFile,
  type LedgerConfigFile,
  type LedgerOperation,
  type OperationsLedgerData,
} from "../../../../src/core/audit/operations-ledger.js";

let tmpDir: string;
let manager: OperationsLedgerManager;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `${PROJECT_NAME}-ledger-`));
  manager = new OperationsLedgerManager(tmpDir);
});

afterEach(async () => {
  await cleanupTmpDir(tmpDir);
});

// ── Helpers ──────────────────────────────────────────────────────────

function makeInit(
  overrides: Partial<LedgerInitialization> = {},
): LedgerInitialization {
  return {
    timestamp: "2026-01-01T00:00:00.000Z",
    preset: "standard",
    agents: ["claude-code"],
    stack: ["typescript"],
    codiVersion: "0.6.0",
    ...overrides,
  };
}

function makePreset(
  overrides: Partial<LedgerActivePreset> = {},
): LedgerActivePreset {
  return {
    name: "standard",
    installedAt: "2026-01-01T00:00:00.000Z",
    artifactSelection: {
      rules: ["architecture", "code-style"],
      skills: ["artifact-creator"],
      agents: ["code-reviewer"],
      commands: [],
    },
    ...overrides,
  };
}

function makeGeneratedFile(
  overrides: Partial<LedgerGeneratedFile> = {},
): LedgerGeneratedFile {
  return {
    path: ".claude/rules/architecture.md",
    agent: "claude-code",
    type: "rule",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeHookFile(overrides: Partial<LedgerHookFile> = {}): LedgerHookFile {
  return {
    path: ".husky/pre-commit",
    framework: "husky",
    type: "pre-commit",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeConfigFile(
  overrides: Partial<LedgerConfigFile> = {},
): LedgerConfigFile {
  return {
    path: `${PROJECT_DIR}/state.json`,
    type: "state",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeOperation(
  overrides: Partial<LedgerOperation> = {},
): LedgerOperation {
  return {
    type: "generate",
    timestamp: "2026-01-01T00:00:00.000Z",
    details: { files: 3 },
    ...overrides,
  };
}

// ── read() ───────────────────────────────────────────────────────────

describe("read", () => {
  it("reads empty ledger when operations.json does not exist", async () => {
    const result = await manager.read();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.version).toBe("1");
    expect(result.data.initialized).toBeNull();
    expect(result.data.activePreset).toBeNull();
    expect(result.data.files.generated).toEqual([]);
    expect(result.data.files.hooks).toEqual([]);
    expect(result.data.files.config).toEqual([]);
    expect(result.data.operations).toEqual([]);
  });

  it("reads and parses valid operations.json", async () => {
    const ledgerData: OperationsLedgerData = {
      version: "1",
      initialized: makeInit(),
      activePreset: makePreset(),
      files: {
        generated: [makeGeneratedFile()],
        hooks: [makeHookFile()],
        config: [makeConfigFile()],
      },
      operations: [makeOperation()],
    };
    await fs.writeFile(
      path.join(tmpDir, "operations.json"),
      JSON.stringify(ledgerData, null, 2),
      "utf8",
    );

    const result = await manager.read();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.initialized?.preset).toBe("standard");
    expect(result.data.activePreset?.name).toBe("standard");
    expect(result.data.files.generated).toHaveLength(1);
    expect(result.data.files.hooks).toHaveLength(1);
    expect(result.data.files.config).toHaveLength(1);
    expect(result.data.operations).toHaveLength(1);
  });

  it("returns error for corrupted JSON file", async () => {
    await fs.writeFile(
      path.join(tmpDir, "operations.json"),
      "{ broken json !!!",
      "utf8",
    );

    const result = await manager.read();

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe("E_CONFIG_PARSE_FAILED");
  });
});

// ── write() ──────────────────────────────────────────────────────────

describe("write", () => {
  it("writes data and reads it back correctly", async () => {
    const ledgerData: OperationsLedgerData = {
      version: "1",
      initialized: makeInit(),
      activePreset: makePreset(),
      files: {
        generated: [makeGeneratedFile()],
        hooks: [],
        config: [],
      },
      operations: [makeOperation()],
    };

    const writeResult = await manager.write(ledgerData);
    expect(writeResult.ok).toBe(true);

    const readResult = await manager.read();
    expect(readResult.ok).toBe(true);
    if (!readResult.ok) return;
    expect(readResult.data).toEqual(ledgerData);
  });

  it("creates parent directory if missing", async () => {
    const nestedDir = path.join(tmpDir, "nested", "deep", PROJECT_DIR);
    const nestedManager = new OperationsLedgerManager(nestedDir);

    const ledgerData: OperationsLedgerData = {
      version: "1",
      initialized: null,
      activePreset: null,
      files: { generated: [], hooks: [], config: [] },
      operations: [],
    };

    const result = await nestedManager.write(ledgerData);
    expect(result.ok).toBe(true);

    const stat = await fs.stat(path.join(nestedDir, "operations.json"));
    expect(stat.isFile()).toBe(true);
  });

  it("uses atomic write via temp file and rename", async () => {
    const ledgerData: OperationsLedgerData = {
      version: "1",
      initialized: null,
      activePreset: null,
      files: { generated: [], hooks: [], config: [] },
      operations: [],
    };

    await manager.write(ledgerData);

    // After successful write, no .tmp files should remain
    const files = await fs.readdir(tmpDir);
    const tmpFiles = files.filter((f) => f.includes(".tmp."));
    expect(tmpFiles).toHaveLength(0);

    // The final file should exist with correct content
    const content = await fs.readFile(
      path.join(tmpDir, "operations.json"),
      "utf8",
    );
    expect(JSON.parse(content)).toEqual(ledgerData);
  });
});

// ── setInitialization() ──────────────────────────────────────────────

describe("setInitialization", () => {
  it("sets initialized field with all properties", async () => {
    const init = makeInit({
      preset: "custom",
      agents: ["claude-code", "cursor"],
      stack: ["typescript", "react"],
      codiVersion: "0.7.0",
    });

    const result = await manager.setInitialization(init);
    expect(result.ok).toBe(true);

    const readResult = await manager.read();
    if (!readResult.ok) return;
    expect(readResult.data.initialized).toEqual(init);
  });

  it("appends init operation to operations array", async () => {
    const init = makeInit();

    await manager.setInitialization(init);

    const readResult = await manager.read();
    if (!readResult.ok) return;
    const ops = readResult.data.operations;
    expect(ops).toHaveLength(1);
    expect(ops[0].type).toBe("init");
    expect(ops[0].timestamp).toBe(init.timestamp);
    expect(ops[0].details).toEqual({
      preset: init.preset,
      agents: init.agents,
      stack: init.stack,
      codiVersion: init.codiVersion,
    });
  });

  it("preserves existing operations when setting initialization", async () => {
    const existingOp = makeOperation({
      type: "generate",
      timestamp: "2026-01-01T01:00:00.000Z",
    });
    await manager.logOperation(existingOp);

    const init = makeInit({ timestamp: "2026-01-01T02:00:00.000Z" });
    await manager.setInitialization(init);

    const readResult = await manager.read();
    if (!readResult.ok) return;
    expect(readResult.data.operations).toHaveLength(2);
    expect(readResult.data.operations[0].type).toBe("generate");
    expect(readResult.data.operations[1].type).toBe("init");
  });
});

// ── setActivePreset() ────────────────────────────────────────────────

describe("setActivePreset", () => {
  it("sets active preset with artifact selection", async () => {
    const preset = makePreset({
      name: "full",
      artifactSelection: {
        rules: ["architecture", "security", "testing"],
        skills: ["artifact-creator", "e2e-testing"],
        agents: ["code-reviewer", "security-analyzer"],
        commands: ["verify"],
      },
    });

    const result = await manager.setActivePreset(preset);
    expect(result.ok).toBe(true);

    const readResult = await manager.read();
    if (!readResult.ok) return;
    expect(readResult.data.activePreset).toEqual(preset);
    expect(readResult.data.activePreset?.artifactSelection.rules).toHaveLength(
      3,
    );
    expect(readResult.data.activePreset?.artifactSelection.skills).toHaveLength(
      2,
    );
  });

  it("replaces previous active preset", async () => {
    const first = makePreset({ name: "minimal" });
    const second = makePreset({
      name: "full",
      installedAt: "2026-01-02T00:00:00.000Z",
    });

    await manager.setActivePreset(first);
    await manager.setActivePreset(second);

    const readResult = await manager.read();
    if (!readResult.ok) return;
    expect(readResult.data.activePreset?.name).toBe("full");
    expect(readResult.data.activePreset?.installedAt).toBe(
      "2026-01-02T00:00:00.000Z",
    );
  });
});

// ── addGeneratedFiles() ──────────────────────────────────────────────

describe("addGeneratedFiles", () => {
  it("adds new files to generated array", async () => {
    const file1 = makeGeneratedFile({ path: ".claude/rules/arch.md" });
    const file2 = makeGeneratedFile({
      path: ".claude/rules/security.md",
      type: "rule",
    });

    await manager.addGeneratedFiles([file1, file2]);

    const readResult = await manager.read();
    if (!readResult.ok) return;
    expect(readResult.data.files.generated).toHaveLength(2);
    expect(readResult.data.files.generated[0].path).toBe(
      ".claude/rules/arch.md",
    );
    expect(readResult.data.files.generated[1].path).toBe(
      ".claude/rules/security.md",
    );
  });

  it("upserts existing file by path and updates updatedAt", async () => {
    const original = makeGeneratedFile({
      path: ".claude/rules/arch.md",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    await manager.addGeneratedFiles([original]);

    const updated = makeGeneratedFile({
      path: ".claude/rules/arch.md",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T12:00:00.000Z",
    });
    await manager.addGeneratedFiles([updated]);

    const readResult = await manager.read();
    if (!readResult.ok) return;
    expect(readResult.data.files.generated).toHaveLength(1);
    expect(readResult.data.files.generated[0].updatedAt).toBe(
      "2026-01-02T12:00:00.000Z",
    );
  });

  it("handles mix of new and existing files", async () => {
    const existing = makeGeneratedFile({ path: ".claude/rules/arch.md" });
    await manager.addGeneratedFiles([existing]);

    const updatedExisting = makeGeneratedFile({
      path: ".claude/rules/arch.md",
      updatedAt: "2026-01-03T00:00:00.000Z",
    });
    const brandNew = makeGeneratedFile({
      path: ".cursor/rules/security.md",
      agent: "cursor",
    });
    await manager.addGeneratedFiles([updatedExisting, brandNew]);

    const readResult = await manager.read();
    if (!readResult.ok) return;
    expect(readResult.data.files.generated).toHaveLength(2);
    expect(readResult.data.files.generated[0].updatedAt).toBe(
      "2026-01-03T00:00:00.000Z",
    );
    expect(readResult.data.files.generated[1].agent).toBe("cursor");
  });
});

// ── addHookFiles() ───────────────────────────────────────────────────

describe("addHookFiles", () => {
  it("adds hook files to hooks array", async () => {
    const hook1 = makeHookFile({ path: ".husky/pre-commit" });
    const hook2 = makeHookFile({
      path: ".husky/commit-msg",
      type: "commit-msg",
    });

    await manager.addHookFiles([hook1, hook2]);

    const readResult = await manager.read();
    if (!readResult.ok) return;
    expect(readResult.data.files.hooks).toHaveLength(2);
    expect(readResult.data.files.hooks[0].path).toBe(".husky/pre-commit");
    expect(readResult.data.files.hooks[1].path).toBe(".husky/commit-msg");
  });

  it("deduplicates by path and does not add duplicates", async () => {
    const hook = makeHookFile({ path: ".husky/pre-commit" });

    await manager.addHookFiles([hook]);
    await manager.addHookFiles([hook]);

    const readResult = await manager.read();
    if (!readResult.ok) return;
    expect(readResult.data.files.hooks).toHaveLength(1);
  });
});

// ── addConfigFiles() ─────────────────────────────────────────────────

describe("addConfigFiles", () => {
  it("adds config files to config array", async () => {
    const cfg1 = makeConfigFile({
      path: `${PROJECT_DIR}/state.json`,
      type: "state",
    });
    const cfg2 = makeConfigFile({
      path: `${PROJECT_DIR}/manifest.json`,
      type: "manifest",
    });

    await manager.addConfigFiles([cfg1, cfg2]);

    const readResult = await manager.read();
    if (!readResult.ok) return;
    expect(readResult.data.files.config).toHaveLength(2);
    expect(readResult.data.files.config[0].type).toBe("state");
    expect(readResult.data.files.config[1].type).toBe("manifest");
  });

  it("deduplicates by path", async () => {
    const cfg = makeConfigFile({ path: `${PROJECT_DIR}/state.json` });

    await manager.addConfigFiles([cfg]);
    await manager.addConfigFiles([cfg]);

    const readResult = await manager.read();
    if (!readResult.ok) return;
    expect(readResult.data.files.config).toHaveLength(1);
  });
});

// ── logOperation() ───────────────────────────────────────────────────

describe("logOperation", () => {
  it("appends operation to operations array", async () => {
    const op = makeOperation({ type: "generate", details: { files: 5 } });

    await manager.logOperation(op);

    const readResult = await manager.read();
    if (!readResult.ok) return;
    expect(readResult.data.operations).toHaveLength(1);
    expect(readResult.data.operations[0].type).toBe("generate");
    expect(readResult.data.operations[0].details).toEqual({ files: 5 });
  });

  it("preserves chronological order", async () => {
    const op1 = makeOperation({
      type: "generate",
      timestamp: "2026-01-01T01:00:00.000Z",
    });
    const op2 = makeOperation({
      type: "clean",
      timestamp: "2026-01-01T02:00:00.000Z",
    });
    const op3 = makeOperation({
      type: "update",
      timestamp: "2026-01-01T03:00:00.000Z",
    });

    await manager.logOperation(op1);
    await manager.logOperation(op2);
    await manager.logOperation(op3);

    const readResult = await manager.read();
    if (!readResult.ok) return;
    expect(readResult.data.operations).toHaveLength(3);
    expect(readResult.data.operations[0].type).toBe("generate");
    expect(readResult.data.operations[1].type).toBe("clean");
    expect(readResult.data.operations[2].type).toBe("update");
  });
});

// ── clearFiles() ─────────────────────────────────────────────────────

describe("clearFiles", () => {
  it("empties all file arrays but preserves operations and initialization", async () => {
    // Set up a fully populated ledger
    const init = makeInit();
    await manager.setInitialization(init);
    await manager.setActivePreset(makePreset());
    await manager.addGeneratedFiles([
      makeGeneratedFile({ path: ".claude/rules/arch.md" }),
      makeGeneratedFile({ path: ".claude/rules/security.md" }),
    ]);
    await manager.addHookFiles([makeHookFile()]);
    await manager.addConfigFiles([makeConfigFile()]);
    await manager.logOperation(makeOperation({ type: "generate" }));

    // Verify files are populated before clearing
    const beforeResult = await manager.read();
    if (!beforeResult.ok) return;
    expect(beforeResult.data.files.generated).toHaveLength(2);
    expect(beforeResult.data.files.hooks).toHaveLength(1);
    expect(beforeResult.data.files.config).toHaveLength(1);

    // Clear files
    const clearResult = await manager.clearFiles();
    expect(clearResult.ok).toBe(true);

    // Verify files are empty but operations and initialization are preserved
    const afterResult = await manager.read();
    if (!afterResult.ok) return;
    expect(afterResult.data.files.generated).toEqual([]);
    expect(afterResult.data.files.hooks).toEqual([]);
    expect(afterResult.data.files.config).toEqual([]);
    expect(afterResult.data.initialized).toEqual(init);
    expect(afterResult.data.activePreset).not.toBeNull();
    // 2 operations: 1 from setInitialization + 1 from logOperation
    expect(afterResult.data.operations).toHaveLength(2);
  });
});
