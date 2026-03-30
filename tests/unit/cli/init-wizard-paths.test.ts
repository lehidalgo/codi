import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  formatLabel,
  buildPresetOptions,
  handleZipPath,
  handleGithubPath,
} from "#src/cli/init-wizard-paths.js";

vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  cancel: vi.fn(),
  select: vi.fn(),
  multiselect: vi.fn(),
  text: vi.fn(),
  confirm: vi.fn(),
  isCancel: vi.fn().mockReturnValue(false),
  log: { info: vi.fn(), step: vi.fn(), warn: vi.fn() },
}));

vi.mock("#src/core/scaffolder/template-loader.js", () => ({
  AVAILABLE_TEMPLATES: ["typescript", "python"],
  loadTemplate: vi
    .fn()
    .mockReturnValue({ ok: true, data: "description: test" }),
}));
vi.mock("#src/core/scaffolder/skill-template-loader.js", () => ({
  AVAILABLE_SKILL_TEMPLATES: ["pdf", "frontend-design"],
  loadSkillTemplateContent: vi
    .fn()
    .mockReturnValue({ ok: true, data: "description: test" }),
}));
vi.mock("#src/core/scaffolder/agent-template-loader.js", () => ({
  AVAILABLE_AGENT_TEMPLATES: ["code-reviewer"],
  loadAgentTemplate: vi
    .fn()
    .mockReturnValue({ ok: true, data: "description: test" }),
}));
vi.mock("#src/core/scaffolder/command-template-loader.js", () => ({
  AVAILABLE_COMMAND_TEMPLATES: ["commit"],
  loadCommandTemplate: vi
    .fn()
    .mockReturnValue({ ok: true, data: "description: test" }),
}));
vi.mock("#src/core/scaffolder/mcp-template-loader.js", () => ({
  AVAILABLE_MCP_SERVER_TEMPLATES: ["memory"],
  loadMcpServerTemplate: vi
    .fn()
    .mockReturnValue({ ok: true, data: { description: "test" } }),
}));

import * as prompts from "@clack/prompts";

const mockText = vi.mocked(prompts.text);
const mockIsCancel = vi.mocked(prompts.isCancel);

describe("formatLabel", () => {
  it("capitalizes single word", () => {
    expect(formatLabel("typescript")).toBe("Typescript");
  });

  it("capitalizes hyphenated words", () => {
    expect(formatLabel("frontend-design")).toBe("Frontend Design");
  });

  it("handles single character segments", () => {
    expect(formatLabel("a-b-c")).toBe("A B C");
  });
});

describe("buildPresetOptions", () => {
  it("returns array of preset options", () => {
    const options = buildPresetOptions();
    expect(options.length).toBeGreaterThan(0);
    for (const opt of options) {
      expect(opt).toHaveProperty("label");
      expect(opt).toHaveProperty("value");
      expect(opt).toHaveProperty("hint");
    }
  });

  it("marks default preset as recommended", () => {
    const options = buildPresetOptions();
    const hasRecommended = options.some((o) => o.label.includes("recommended"));
    expect(hasRecommended).toBe(true);
  });
});

describe("handleZipPath", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsCancel.mockReturnValue(false);
  });

  it("returns wizard result for valid zip path", async () => {
    mockText.mockResolvedValueOnce("/path/to/preset.zip");

    const result = await handleZipPath(["claude-code"]);

    expect(result).not.toBeNull();
    expect(typeof result).toBe("object");
    const wizardResult = result as {
      configMode: string;
      importSource: string;
      agents: string[];
    };
    expect(wizardResult.configMode).toBe("zip");
    expect(wizardResult.importSource).toBe("/path/to/preset.zip");
    expect(wizardResult.agents).toEqual(["claude-code"]);
  });

  it("returns BACK symbol when user cancels", async () => {
    mockText.mockResolvedValueOnce(Symbol.for("cancel") as never);
    mockIsCancel.mockReturnValueOnce(true);

    const result = await handleZipPath(["claude-code"]);

    expect(typeof result).toBe("symbol");
  });
});

describe("handleGithubPath", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsCancel.mockReturnValue(false);
  });

  it("returns wizard result for valid github repo", async () => {
    mockText.mockResolvedValueOnce("org/my-preset");

    const result = await handleGithubPath(["claude-code", "cursor"]);

    expect(result).not.toBeNull();
    expect(typeof result).toBe("object");
    const wizardResult = result as {
      configMode: string;
      importSource: string;
      agents: string[];
    };
    expect(wizardResult.configMode).toBe("github");
    expect(wizardResult.importSource).toBe("org/my-preset");
    expect(wizardResult.agents).toEqual(["claude-code", "cursor"]);
  });

  it("returns BACK symbol when user cancels", async () => {
    mockText.mockResolvedValueOnce(Symbol.for("cancel") as never);
    mockIsCancel.mockReturnValueOnce(true);

    const result = await handleGithubPath(["claude-code"]);

    expect(typeof result).toBe("symbol");
  });
});
