import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  formatLabel,
  buildPresetOptions,
  handleZipPath,
  handleGithubPath,
  handleCustomPath,
  handlePresetPath,
} from "#src/cli/init-wizard-paths.js";
import { getBuiltinPresetDefinition } from "#src/templates/presets/index.js";
import { FLAG_CATALOG } from "#src/core/flags/flag-catalog.js";

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

vi.mock("#src/cli/group-multiselect.js", () => ({
  groupMultiselect: vi.fn(),
}));

vi.mock("#src/core/scaffolder/template-loader.js", () => ({
  AVAILABLE_TEMPLATES: ["typescript", "python"],
  loadTemplate: vi.fn().mockReturnValue({ ok: true, data: "description: test" }),
}));
vi.mock("#src/core/scaffolder/skill-template-loader.js", () => ({
  AVAILABLE_SKILL_TEMPLATES: ["pdf", "frontend-design"],
  loadSkillTemplateContent: vi.fn().mockReturnValue({ ok: true, data: "description: test" }),
}));
vi.mock("#src/core/scaffolder/agent-template-loader.js", () => ({
  AVAILABLE_AGENT_TEMPLATES: ["code-reviewer"],
  loadAgentTemplate: vi.fn().mockReturnValue({ ok: true, data: "description: test" }),
}));
vi.mock("#src/core/scaffolder/command-template-loader.js", () => ({
  AVAILABLE_COMMAND_TEMPLATES: ["commit"],
  loadCommandTemplate: vi.fn().mockReturnValue({ ok: true, data: "description: test" }),
}));
vi.mock("#src/core/scaffolder/mcp-template-loader.js", () => ({
  AVAILABLE_MCP_SERVER_TEMPLATES: ["memory"],
  loadMcpServerTemplate: vi.fn().mockReturnValue({ ok: true, data: { description: "test" } }),
}));

import * as prompts from "@clack/prompts";
import { groupMultiselect } from "#src/cli/group-multiselect.js";

const mockText = vi.mocked(prompts.text);
const mockIsCancel = vi.mocked(prompts.isCancel);
const mockGroupMultiselect = vi.mocked(groupMultiselect);
const mockSelect = vi.mocked(prompts.select);
const mockConfirm = vi.mocked(prompts.confirm);

function mockFlagEditing(presetName: string): void {
  const presetDef = getBuiltinPresetDefinition(presetName);
  const flags = presetDef?.flags ?? {};

  const booleanTrueKeys = Object.keys(flags).filter(
    (k) => FLAG_CATALOG[k]?.type === "boolean" && !flags[k]?.locked && flags[k]?.value === true,
  );
  vi.mocked(prompts.multiselect).mockResolvedValueOnce(booleanTrueKeys as never);

  for (const [key, spec] of Object.entries(FLAG_CATALOG)) {
    if (spec.type !== "enum" || !spec.values || flags[key]?.locked || !flags[key]) {
      continue;
    }
    mockSelect.mockResolvedValueOnce(flags[key]!.value as never);
  }

  for (const [key, spec] of Object.entries(FLAG_CATALOG)) {
    if (spec.type !== "number" || flags[key]?.locked || !flags[key]) continue;
    mockText.mockResolvedValueOnce(String(flags[key]!.value) as never);
  }
}

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

describe("handleCustomPath — groupMultiselect messages include counts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsCancel.mockReturnValue(false);
    mockGroupMultiselect
      .mockResolvedValueOnce([]) // rules
      .mockResolvedValueOnce([]) // skills
      .mockResolvedValueOnce([]) // agents
      .mockResolvedValueOnce([]); // mcps
    mockSelect.mockResolvedValueOnce("codi-balanced"); // flag preset
    mockConfirm
      .mockResolvedValueOnce(false) // save as preset
      .mockResolvedValueOnce(false); // version pin
  });

  it("shows rules count in message", async () => {
    await handleCustomPath(["claude-code"]);
    expect(mockGroupMultiselect.mock.calls[0]?.[0]?.message).toBe("Select rules (2 total)");
  });

  it("shows skills count in message", async () => {
    await handleCustomPath(["claude-code"]);
    expect(mockGroupMultiselect.mock.calls[1]?.[0]?.message).toBe("Select skills (2 total)");
  });

  it("shows agents count in message", async () => {
    await handleCustomPath(["claude-code"]);
    expect(mockGroupMultiselect.mock.calls[2]?.[0]?.message).toBe(
      "Select agent definitions (1 total)",
    );
  });

  it("shows MCP servers count in message", async () => {
    await handleCustomPath(["claude-code"]);
    expect(mockGroupMultiselect.mock.calls[3]?.[0]?.message).toBe("Select MCP servers (1 total)");
  });

  it("uses existing install selections and inventory counts in modify mode", async () => {
    await handleCustomPath(["claude-code"], {
      selections: {
        preset: "current-install",
        rules: ["typescript", "legacy-rule"],
        skills: ["pdf"],
        agents: ["code-reviewer"],
        commands: ["commit"],
        mcpServers: ["memory"],
      },
      inventory: [
        {
          name: "typescript",
          type: "rule",
          status: "builtin-original",
          installed: true,
          managedBy: "codi",
          installedArtifactVersion: 1,
          hint: "TypeScript",
        },
        {
          name: "legacy-rule",
          type: "rule",
          status: "builtin-removed",
          installed: true,
          managedBy: "codi",
          installedArtifactVersion: 1,
          hint: "Legacy",
        },
      ],
    });

    expect(mockGroupMultiselect.mock.calls[0]?.[0]?.message).toBe("Select rules (2 total)");
    expect(mockGroupMultiselect.mock.calls[0]?.[0]?.initialValues).toEqual([
      "typescript",
      "legacy-rule",
    ]);
  });
});

describe("handlePresetPath", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsCancel.mockReturnValue(false);
  });

  it("uses current installation selections when modifying an existing install", async () => {
    mockSelect.mockResolvedValueOnce("codi-balanced");
    mockFlagEditing("codi-balanced");
    mockGroupMultiselect
      .mockResolvedValueOnce(["typescript", "legacy-rule"])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    mockConfirm.mockResolvedValueOnce(false);

    await handlePresetPath(["claude-code"], {
      selections: {
        preset: "current-install",
        rules: ["typescript", "legacy-rule"],
        skills: [],
        agents: [],
        commands: [],
        mcpServers: [],
      },
      inventory: [
        {
          name: "typescript",
          type: "rule",
          status: "builtin-original",
          installed: true,
          managedBy: "codi",
          installedArtifactVersion: 1,
          hint: "TypeScript",
        },
        {
          name: "legacy-rule",
          type: "rule",
          status: "builtin-removed",
          installed: true,
          managedBy: "codi",
          installedArtifactVersion: 1,
          hint: "Legacy",
        },
      ],
    });

    expect(mockGroupMultiselect.mock.calls[0]?.[0]?.initialValues).toEqual([
      "typescript",
      "legacy-rule",
    ]);
    expect(mockGroupMultiselect.mock.calls[0]?.[0]?.message).toBe("Rules (2 total)");
  });
});
