import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  addRuleHandler,
  addSkillHandler,
  addAgentHandler,
  addBrandHandler,
  addMcpServerHandler,
  brandAsArtifactHandler,
  handleWizardFlow,
} from "#src/cli/add-handlers.js";
import { EXIT_CODES } from "#src/core/output/exit-codes.js";

vi.mock("#src/utils/paths.js", () => ({
  resolveProjectDir: vi.fn((root: string) => `${root}/.codi`),
}));

vi.mock("#src/core/output/logger.js", () => {
  const instance = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
  return { Logger: { getInstance: () => instance, init: vi.fn() } };
});

vi.mock("#src/core/scaffolder/rule-scaffolder.js", () => ({
  createRule: vi.fn(),
}));
vi.mock("#src/core/scaffolder/skill-scaffolder.js", () => ({
  createSkill: vi.fn(),
}));
vi.mock("#src/core/scaffolder/agent-scaffolder.js", () => ({
  createAgent: vi.fn(),
}));
vi.mock("#src/core/scaffolder/mcp-scaffolder.js", () => ({
  createMcpServer: vi.fn(),
}));

vi.mock("#src/core/scaffolder/template-loader.js", () => ({
  AVAILABLE_TEMPLATES: ["typescript", "python"],
}));
vi.mock("#src/core/scaffolder/agent-template-loader.js", () => ({
  AVAILABLE_AGENT_TEMPLATES: ["code-reviewer", "test-generator"],
}));
vi.mock("#src/core/scaffolder/skill-template-loader.js", () => ({
  AVAILABLE_SKILL_TEMPLATES: ["frontend-design", "pdf"],
}));
vi.mock("#src/core/scaffolder/mcp-template-loader.js", () => ({
  AVAILABLE_MCP_SERVER_TEMPLATES: ["memory", "filesystem"],
}));

vi.mock("#src/core/audit/operations-ledger.js", () => ({
  OperationsLedgerManager: vi.fn().mockImplementation(() => ({
    logOperation: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock("#src/cli/shared.js", () => ({
  initFromOptions: vi.fn(),
  handleOutput: vi.fn(),
  regenerateConfigs: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("#src/cli/add-wizard.js", () => ({
  runAddWizard: vi.fn(),
}));

import { createRule } from "#src/core/scaffolder/rule-scaffolder.js";
import { createSkill } from "#src/core/scaffolder/skill-scaffolder.js";
import { createAgent } from "#src/core/scaffolder/agent-scaffolder.js";
import { createMcpServer } from "#src/core/scaffolder/mcp-scaffolder.js";
import { runAddWizard } from "#src/cli/add-wizard.js";
import { regenerateConfigs } from "#src/cli/shared.js";

const mockCreateRule = vi.mocked(createRule);
const mockCreateSkill = vi.mocked(createSkill);
const mockCreateAgent = vi.mocked(createAgent);
const mockCreateMcpServer = vi.mocked(createMcpServer);
const mockRunAddWizard = vi.mocked(runAddWizard);

beforeEach(() => vi.clearAllMocks());

describe("addRuleHandler", () => {
  it("succeeds without template", async () => {
    mockCreateRule.mockResolvedValue({
      ok: true,
      data: "/tmp/.codi/rules/my-rule.md",
    });
    const result = await addRuleHandler("/tmp", "my-rule", {});
    expect(result.success).toBe(true);
    expect(result.data.path).toContain("my-rule");
  });

  it("rejects unknown template", async () => {
    const result = await addRuleHandler("/tmp", "r", {
      template: "nonexistent",
    });
    expect(result.success).toBe(false);
    expect(result.errors[0]!.message).toContain("Unknown template");
  });

  it("propagates scaffolder errors", async () => {
    mockCreateRule.mockResolvedValue({
      ok: false,
      errors: [
        {
          code: "E_DUP",
          message: "exists",
          hint: "",
          severity: "error",
          context: {},
        },
      ],
    });
    const result = await addRuleHandler("/tmp", "dup", {});
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(EXIT_CODES.GENERAL_ERROR);
  });
});

describe("addSkillHandler", () => {
  it("succeeds without template", async () => {
    mockCreateSkill.mockResolvedValue({
      ok: true,
      data: "/tmp/.codi/skills/s",
    });
    const result = await addSkillHandler("/tmp", "s", {});
    expect(result.success).toBe(true);
  });

  it("rejects unknown template", async () => {
    const result = await addSkillHandler("/tmp", "s", { template: "nope" });
    expect(result.success).toBe(false);
  });

  it("propagates scaffolder errors", async () => {
    mockCreateSkill.mockResolvedValue({
      ok: false,
      errors: [
        {
          code: "E",
          message: "fail",
          hint: "",
          severity: "error",
          context: {},
        },
      ],
    });
    const result = await addSkillHandler("/tmp", "s", {});
    expect(result.success).toBe(false);
  });
});

describe("addAgentHandler", () => {
  it("succeeds without template", async () => {
    mockCreateAgent.mockResolvedValue({
      ok: true,
      data: "/tmp/.codi/agents/a",
    });
    const result = await addAgentHandler("/tmp", "a", {});
    expect(result.success).toBe(true);
  });

  it("rejects unknown template", async () => {
    const result = await addAgentHandler("/tmp", "a", { template: "bad" });
    expect(result.success).toBe(false);
  });

  it("propagates scaffolder errors", async () => {
    mockCreateAgent.mockResolvedValue({
      ok: false,
      errors: [
        {
          code: "E",
          message: "fail",
          hint: "",
          severity: "error",
          context: {},
        },
      ],
    });
    const result = await addAgentHandler("/tmp", "a", {});
    expect(result.success).toBe(false);
  });
});

describe("addBrandHandler", () => {
  it("succeeds creating brand skill", async () => {
    mockCreateSkill.mockResolvedValue({
      ok: true,
      data: "/tmp/.codi/skills/brand",
    });
    const result = await addBrandHandler("/tmp", "my-brand");
    expect(result.success).toBe(true);
    expect(result.data.name).toBe("my-brand");
  });

  it("propagates scaffolder errors", async () => {
    mockCreateSkill.mockResolvedValue({
      ok: false,
      errors: [
        {
          code: "E",
          message: "fail",
          hint: "",
          severity: "error",
          context: {},
        },
      ],
    });
    const result = await addBrandHandler("/tmp", "my-brand");
    expect(result.success).toBe(false);
  });
});

describe("addMcpServerHandler", () => {
  it("succeeds without template", async () => {
    mockCreateMcpServer.mockResolvedValue({
      ok: true,
      data: "/tmp/.codi/mcp-servers/m",
    });
    const result = await addMcpServerHandler("/tmp", "m", {});
    expect(result.success).toBe(true);
  });

  it("rejects unknown template", async () => {
    const result = await addMcpServerHandler("/tmp", "m", { template: "bad" });
    expect(result.success).toBe(false);
    expect(result.errors[0]!.message).toContain("Unknown MCP server template");
  });

  it("propagates scaffolder errors", async () => {
    mockCreateMcpServer.mockResolvedValue({
      ok: false,
      errors: [
        {
          code: "E",
          message: "fail",
          hint: "",
          severity: "error",
          context: {},
        },
      ],
    });
    const result = await addMcpServerHandler("/tmp", "m", {});
    expect(result.success).toBe(false);
  });
});

describe("brandAsArtifactHandler", () => {
  it("wraps addBrandHandler result", async () => {
    mockCreateSkill.mockResolvedValue({
      ok: true,
      data: "/tmp/.codi/skills/b",
    });
    const result = await brandAsArtifactHandler("/tmp", "b", {});
    expect(result.success).toBe(true);
    expect(result.data.template).toBeNull();
  });
});

describe("handleWizardFlow", () => {
  const mockExit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

  it("exits when wizard returns null", async () => {
    mockRunAddWizard.mockResolvedValue(null);
    await handleWizardFlow("rule", addRuleHandler, {});
    expect(mockExit).toHaveBeenCalledWith(0);
  });

  it("processes wizard selections and regenerates configs", async () => {
    mockRunAddWizard.mockResolvedValue({
      names: ["rule-a", "rule-b"],
      useTemplates: false,
    });
    mockCreateRule.mockResolvedValue({ ok: true, data: "/tmp/path" });

    await handleWizardFlow("rule", addRuleHandler, {});

    expect(mockCreateRule).toHaveBeenCalledTimes(2);
    expect(regenerateConfigs).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
  });

  it("passes template when useTemplates is true", async () => {
    mockRunAddWizard.mockResolvedValue({
      names: ["typescript"],
      useTemplates: true,
    });
    mockCreateRule.mockResolvedValue({ ok: true, data: "/tmp/path" });

    await handleWizardFlow("rule", addRuleHandler, {});

    expect(mockCreateRule).toHaveBeenCalledWith(
      expect.objectContaining({ template: "typescript" }),
    );
  });
});
