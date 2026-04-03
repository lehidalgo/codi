import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("#src/core/scaffolder/template-loader.js", () => ({
  AVAILABLE_TEMPLATES: ["codi-security", "codi-typescript"],
  loadTemplate: vi.fn(),
}));
vi.mock("#src/core/scaffolder/skill-template-loader.js", () => ({
  AVAILABLE_SKILL_TEMPLATES: ["codi-pdf"],
  loadSkillTemplateContent: vi.fn(),
}));
vi.mock("#src/core/scaffolder/agent-template-loader.js", () => ({
  AVAILABLE_AGENT_TEMPLATES: ["codi-code-reviewer"],
  loadAgentTemplate: vi.fn(),
}));
vi.mock("#src/core/scaffolder/command-template-loader.js", () => ({
  AVAILABLE_COMMAND_TEMPLATES: ["codi-commit"],
  loadCommandTemplate: vi.fn(),
}));
vi.mock("#src/core/scaffolder/mcp-template-loader.js", () => ({
  AVAILABLE_MCP_SERVER_TEMPLATES: ["github"],
  loadMcpServerTemplate: vi.fn(),
}));
vi.mock("#src/core/version/template-hash-registry.js", () => ({
  buildTemplateHashRegistry: vi.fn(() => ({
    cliVersion: "2.1.0",
    generatedAt: new Date().toISOString(),
    templates: {},
  })),
}));
vi.mock("#src/core/version/artifact-version-baseline.js", () => ({
  checkArtifactVersionBaseline: vi.fn(() => []),
}));

import { loadTemplate } from "#src/core/scaffolder/template-loader.js";
import { loadSkillTemplateContent } from "#src/core/scaffolder/skill-template-loader.js";
import { loadAgentTemplate } from "#src/core/scaffolder/agent-template-loader.js";
import { loadCommandTemplate } from "#src/core/scaffolder/command-template-loader.js";
import { loadMcpServerTemplate } from "#src/core/scaffolder/mcp-template-loader.js";

const mockLoadTemplate = vi.mocked(loadTemplate);
const mockLoadSkill = vi.mocked(loadSkillTemplateContent);
const mockLoadAgent = vi.mocked(loadAgentTemplate);
const mockLoadCommand = vi.mocked(loadCommandTemplate);
const mockLoadMcp = vi.mocked(loadMcpServerTemplate);

function allOk() {
  mockLoadTemplate.mockReturnValue({ ok: true, data: "# rule content" });
  mockLoadSkill.mockReturnValue({ ok: true, data: "# skill content" });
  mockLoadAgent.mockReturnValue({ ok: true, data: "# agent content" });
  mockLoadCommand.mockReturnValue({ ok: true, data: "# command content" });
  mockLoadMcp.mockReturnValue({
    ok: true,
    data: {
      name: "github",
      description: "GitHub MCP",
      version: 1,
      command: "npx",
      args: [],
    },
  });
}

describe("checkTemplateRegistry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when all templates load successfully", async () => {
    allOk();
    const { checkTemplateRegistry } =
      await import("#src/core/scaffolder/template-registry-check.js");
    expect(checkTemplateRegistry()).toEqual([]);
  });

  it("returns error when a rule template fails to load", async () => {
    allOk();
    mockLoadTemplate.mockReturnValueOnce({
      ok: false,
      errors: [
        {
          code: "E_CONFIG_NOT_FOUND",
          message: "not found",
          severity: "error",
          hint: "",
        },
      ],
    });
    const { checkTemplateRegistry } =
      await import("#src/core/scaffolder/template-registry-check.js");
    const errors = checkTemplateRegistry();
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/rule.*codi-security/);
  });

  it("returns error when a rule template has empty content", async () => {
    allOk();
    mockLoadTemplate.mockReturnValueOnce({ ok: true, data: "   " });
    const { checkTemplateRegistry } =
      await import("#src/core/scaffolder/template-registry-check.js");
    const errors = checkTemplateRegistry();
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/rule.*codi-security/);
  });

  it("returns error when a skill template fails to load", async () => {
    allOk();
    mockLoadSkill.mockReturnValueOnce({
      ok: false,
      errors: [
        {
          code: "E_CONFIG_NOT_FOUND",
          message: "not found",
          severity: "error",
          hint: "",
        },
      ],
    });
    const { checkTemplateRegistry } =
      await import("#src/core/scaffolder/template-registry-check.js");
    const errors = checkTemplateRegistry();
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/skill.*codi-pdf/);
  });

  it("returns error when an agent template fails to load", async () => {
    allOk();
    mockLoadAgent.mockReturnValueOnce({
      ok: false,
      errors: [
        {
          code: "E_CONFIG_NOT_FOUND",
          message: "not found",
          severity: "error",
          hint: "",
        },
      ],
    });
    const { checkTemplateRegistry } =
      await import("#src/core/scaffolder/template-registry-check.js");
    const errors = checkTemplateRegistry();
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/agent.*codi-code-reviewer/);
  });

  it("returns error when a command template fails to load", async () => {
    allOk();
    mockLoadCommand.mockReturnValueOnce({
      ok: false,
      errors: [
        {
          code: "E_CONFIG_NOT_FOUND",
          message: "not found",
          severity: "error",
          hint: "",
        },
      ],
    });
    const { checkTemplateRegistry } =
      await import("#src/core/scaffolder/template-registry-check.js");
    const errors = checkTemplateRegistry();
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/command.*codi-commit/);
  });

  it("returns error when an MCP template fails to load", async () => {
    allOk();
    mockLoadMcp.mockReturnValueOnce({
      ok: false,
      errors: [
        {
          code: "E_CONFIG_NOT_FOUND",
          message: "not found",
          severity: "error",
          hint: "",
        },
      ],
    });
    const { checkTemplateRegistry } =
      await import("#src/core/scaffolder/template-registry-check.js");
    const errors = checkTemplateRegistry();
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/mcp.*github/);
  });

  it("collects all errors across all types", async () => {
    mockLoadTemplate.mockReturnValue({ ok: true, data: "" }); // both rules fail (empty)
    mockLoadSkill.mockReturnValue({ ok: true, data: "# ok" });
    mockLoadAgent.mockReturnValue({
      ok: false,
      errors: [
        {
          code: "E_CONFIG_NOT_FOUND",
          message: "not found",
          severity: "error",
          hint: "",
        },
      ],
    });
    mockLoadCommand.mockReturnValue({ ok: true, data: "# ok" });
    mockLoadMcp.mockReturnValue({
      ok: true,
      data: { name: "github", description: "", version: 1, command: "npx", args: [] },
    });
    const { checkTemplateRegistry } =
      await import("#src/core/scaffolder/template-registry-check.js");
    const errors = checkTemplateRegistry();
    // 2 rules (empty) + 1 agent (load failure)
    expect(errors).toHaveLength(3);
  });
});
