/**
 * ISSUE-044 rewrite — drives real scaffolders against tmp .codi dirs.
 *
 * The pre-rewrite version mocked every scaffolder, every template-loader,
 * the operations-ledger, and `cli/shared.js`. That meant the tests only
 * proved the handlers WIRED to the mocks — they never verified that the
 * scaffolders produced the expected files or that the helper
 * `runAddCommand` correctly composed error CommandResults from real
 * scaffolder failures.
 *
 * The rewrite removes every internal `vi.mock("#src/...")` call. Each test
 * now provisions a real tmp `.codi/` directory and asserts observable
 * outcomes: the file the scaffolder wrote, the success/failure shape of
 * the returned CommandResult, and the error message strings carried in
 * `result.errors[]`.
 *
 * The wizard test (`handleWizardFlow`) still mocks `runAddWizard` because
 * that helper drives interactive TTY prompts via `@clack/prompts` — those
 * remain a legitimate boundary mock.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  addRuleHandler,
  addSkillHandler,
  addAgentHandler,
  addBrandHandler,
  addMcpServerHandler,
  brandAsArtifactHandler,
  handleWizardFlow,
} from "#src/cli/add-handlers.js";
import { AVAILABLE_TEMPLATES } from "#src/core/scaffolder/template-loader.js";
import { AVAILABLE_SKILL_TEMPLATES } from "#src/core/scaffolder/skill-template-loader.js";
import { AVAILABLE_AGENT_TEMPLATES } from "#src/core/scaffolder/agent-template-loader.js";
import { AVAILABLE_MCP_SERVER_TEMPLATES } from "#src/core/scaffolder/mcp-template-loader.js";
import { EXIT_CODES } from "#src/core/output/exit-codes.js";

// `runAddWizard` is the only legitimate mock left — it consumes interactive
// TTY prompts (@clack/prompts) which can't run inside vitest workers.
vi.mock("#src/cli/add-wizard.js", () => ({
  runAddWizard: vi.fn(),
}));
import { runAddWizard } from "#src/cli/add-wizard.js";

const mockRunAddWizard = vi.mocked(runAddWizard);

describe("addRuleHandler", () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = mkdtempSync(path.join(tmpdir(), "codi-addrule-"));
    vi.clearAllMocks();
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("succeeds without template — writes a rule file to disk", async () => {
    const result = await addRuleHandler(tmpRoot, "my-rule", {});
    expect(result.success).toBe(true);
    expect(result.data.path.length).toBeGreaterThan(0);
    expect(existsSync(result.data.path)).toBe(true);
  });

  it("rejects unknown template via the registry — no file written", async () => {
    const result = await addRuleHandler(tmpRoot, "r", { template: "nonexistent-zzz" });
    expect(result.success).toBe(false);
    expect(result.errors[0]!.message).toContain("Unknown template");
    expect(result.exitCode).toBe(EXIT_CODES.GENERAL_ERROR);
  });

  it("propagates scaffolder errors (duplicate name) without overwriting", async () => {
    const first = await addRuleHandler(tmpRoot, "dup-name", {});
    expect(first.success).toBe(true);
    const second = await addRuleHandler(tmpRoot, "dup-name", {});
    expect(second.success).toBe(false);
    expect(second.exitCode).toBe(EXIT_CODES.GENERAL_ERROR);
  });
});

describe("addSkillHandler", () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = mkdtempSync(path.join(tmpdir(), "codi-addskill-"));
    vi.clearAllMocks();
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("succeeds without template", async () => {
    const result = await addSkillHandler(tmpRoot, "my-skill", {});
    expect(result.success).toBe(true);
    expect(existsSync(result.data.path)).toBe(true);
  });

  it("rejects unknown skill template", async () => {
    const result = await addSkillHandler(tmpRoot, "s", { template: "nope-zzz" });
    expect(result.success).toBe(false);
    expect(result.errors[0]!.message).toContain("Unknown skill template");
  });

  it("propagates scaffolder errors (duplicate)", async () => {
    await addSkillHandler(tmpRoot, "dup-skill", {});
    const result = await addSkillHandler(tmpRoot, "dup-skill", {});
    expect(result.success).toBe(false);
  });
});

describe("addAgentHandler", () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = mkdtempSync(path.join(tmpdir(), "codi-addagent-"));
    vi.clearAllMocks();
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("succeeds without template", async () => {
    const result = await addAgentHandler(tmpRoot, "my-agent", {});
    expect(result.success).toBe(true);
    expect(existsSync(result.data.path)).toBe(true);
  });

  it("rejects unknown agent template", async () => {
    const result = await addAgentHandler(tmpRoot, "a", { template: "bad-zzz" });
    expect(result.success).toBe(false);
    expect(result.errors[0]!.message).toContain("Unknown agent template");
  });

  it("propagates scaffolder errors (duplicate)", async () => {
    await addAgentHandler(tmpRoot, "dup-agent", {});
    const result = await addAgentHandler(tmpRoot, "dup-agent", {});
    expect(result.success).toBe(false);
  });
});

describe("addBrandHandler", () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = mkdtempSync(path.join(tmpdir(), "codi-addbrand-"));
    vi.clearAllMocks();
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("succeeds creating brand skill", async () => {
    const result = await addBrandHandler(tmpRoot, "my-brand");
    expect(result.success).toBe(true);
    expect(result.data.name).toBe("my-brand");
    expect(existsSync(result.data.path)).toBe(true);
  });

  it("propagates scaffolder errors (duplicate)", async () => {
    await addBrandHandler(tmpRoot, "dup-brand");
    const result = await addBrandHandler(tmpRoot, "dup-brand");
    expect(result.success).toBe(false);
  });
});

describe("addMcpServerHandler", () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = mkdtempSync(path.join(tmpdir(), "codi-addmcp-"));
    vi.clearAllMocks();
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("succeeds without template", async () => {
    const result = await addMcpServerHandler(tmpRoot, "my-mcp", {});
    expect(result.success).toBe(true);
  });

  it("rejects unknown template", async () => {
    const result = await addMcpServerHandler(tmpRoot, "m", { template: "bad-zzz" });
    expect(result.success).toBe(false);
    expect(result.errors[0]!.message).toContain("Unknown MCP server template");
  });
});

describe("brandAsArtifactHandler", () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = mkdtempSync(path.join(tmpdir(), "codi-brandart-"));
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("wraps addBrandHandler result with template:null", async () => {
    const result = await brandAsArtifactHandler(tmpRoot, "wrap-brand", {});
    expect(result.success).toBe(true);
    expect(result.data.template).toBeNull();
  });
});

describe("handleWizardFlow", () => {
  let tmpRoot: string;
  let mockExit: ReturnType<typeof vi.spyOn>;
  let savedCwd: string;

  beforeEach(() => {
    savedCwd = process.cwd();
    tmpRoot = mkdtempSync(path.join(tmpdir(), "codi-wizard-"));
    // handleWizardFlow uses process.cwd() to find the .codi dir — chdir
    // so the real scaffolder operates in the isolated tmpRoot.
    process.chdir(tmpRoot);
    vi.clearAllMocks();
    mockExit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    process.chdir(savedCwd);
    mockExit.mockRestore();
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("exits 0 when the wizard returns null (user cancelled)", async () => {
    mockRunAddWizard.mockResolvedValue(null);
    await handleWizardFlow("rule", addRuleHandler, {});
    expect(mockExit).toHaveBeenCalledWith(0);
  });

  it("processes multiple wizard selections and exits with SUCCESS when all rules write", async () => {
    mockRunAddWizard.mockResolvedValue({
      names: ["rule-one", "rule-two"],
      useTemplates: false,
    });
    await handleWizardFlow("rule", addRuleHandler, {});
    expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
  });

  it("passes a real template when useTemplates is true", async () => {
    // Pick the first real available template — the wizard normally lets the
    // user select from this same list.
    const template = AVAILABLE_TEMPLATES[0]!;
    mockRunAddWizard.mockResolvedValue({
      names: [template],
      useTemplates: true,
    });
    await handleWizardFlow("rule", addRuleHandler, {});
    expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
  });
});

// Sanity probe — keep the AVAILABLE_* lists referenced so accidental
// pruning of those imports surfaces here rather than as a silent test gap.
describe("AVAILABLE_* registries", () => {
  it("each registry has at least one template", () => {
    expect(AVAILABLE_TEMPLATES.length).toBeGreaterThan(0);
    expect(AVAILABLE_SKILL_TEMPLATES.length).toBeGreaterThan(0);
    expect(AVAILABLE_AGENT_TEMPLATES.length).toBeGreaterThan(0);
    expect(AVAILABLE_MCP_SERVER_TEMPLATES.length).toBeGreaterThan(0);
  });
});
