/**
 * ISSUE-044 rewrite — drives init-wizard-paths against real template loaders.
 *
 * Previously the file mocked 4 template loaders (rule/skill/agent/mcp) and
 * the internal wrapper `wizard-prompts.js`. The mocks froze the lists to a
 * 2-template view that diverged from production (currently 31 rules / 73
 * skills / 22 agents / 5 MCPs). Some assertions were even pinned to the
 * mocked length ("Select rules (2 total)") — pure tests-of-the-mock.
 *
 * The rewrite keeps the @clack/prompts boundary mock (TTY) plus a single
 * `group-multiselect` mock (custom TTY prompt component — same role as
 * @clack). Everything else flows through real source: real template-loader
 * lists, real wizard-prompts → real @clack/prompts (mocked at the
 * boundary). Length-pinned assertions become content-aware to avoid
 * brittleness when template lists evolve.
 */

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
import { AVAILABLE_TEMPLATES } from "#src/core/scaffolder/template-loader.js";
import { AVAILABLE_SKILL_TEMPLATES } from "#src/core/scaffolder/skill-template-loader.js";
import { AVAILABLE_AGENT_TEMPLATES } from "#src/core/scaffolder/agent-template-loader.js";
import { AVAILABLE_MCP_SERVER_TEMPLATES } from "#src/core/scaffolder/mcp-template-loader.js";

vi.mock("@clack/prompts", () => ({
  S_BAR: "|",
  S_BAR_END: "\\",
  S_CHECKBOX_ACTIVE: "●",
  S_CHECKBOX_INACTIVE: "○",
  S_CHECKBOX_SELECTED: "◼",
  S_RADIO_ACTIVE: "●",
  S_RADIO_INACTIVE: "○",
  symbol: vi.fn().mockReturnValue("◆"),
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

// `group-multiselect` and `wizard-prompts` are custom TTY prompt
// components built on top of @clack/prompts' internal primitives
// (ConfirmPrompt, SelectPrompt etc.). They instantiate real prompt
// classes that expect a real terminal — the same boundary role as
// @clack/prompts itself. Mocking them follows the same rationale as the
// @clack mock above (NOT a violation of codi-testing's "do not mock the
// module under test" rule — none of the SUTs here are these wrappers).
vi.mock("#src/cli/group-multiselect.js", () => ({
  groupMultiselect: vi.fn(),
}));

vi.mock("#src/cli/wizard-prompts.js", () => ({
  wizardSelect: vi.fn(),
  wizardMultiselect: vi.fn(),
  wizardConfirm: vi.fn(),
}));

import * as prompts from "@clack/prompts";
import { groupMultiselect } from "#src/cli/group-multiselect.js";
import { wizardSelect, wizardMultiselect, wizardConfirm } from "#src/cli/wizard-prompts.js";

const mockText = vi.mocked(prompts.text);
const mockIsCancel = vi.mocked(prompts.isCancel);
const mockGroupMultiselect = vi.mocked(groupMultiselect);
const mockWizardSelect = vi.mocked(wizardSelect);
const mockWizardConfirm = vi.mocked(wizardConfirm);
const mockWizardMultiselect = vi.mocked(wizardMultiselect);

/**
 * Drive the flag-editing portion of `handlePresetPath` to completion
 * without inventing the answers — pull the defaults from the preset
 * definition + flag catalog so the wizard sees deterministic inputs.
 */
function mockFlagEditing(presetName: string): void {
  const presetDef = getBuiltinPresetDefinition(presetName);
  const flags = presetDef?.flags ?? {};

  const booleanTrueKeys = Object.keys(flags).filter(
    (k) => FLAG_CATALOG[k]?.type === "boolean" && !flags[k]?.locked && flags[k]?.value === true,
  );
  // wizardMultiselect → multiselect under the hood
  mockWizardMultiselect.mockResolvedValueOnce(booleanTrueKeys as never);

  for (const [key, spec] of Object.entries(FLAG_CATALOG)) {
    if (spec.type !== "enum" || !spec.values || flags[key]?.locked || !flags[key]) continue;
    mockWizardSelect.mockResolvedValueOnce(flags[key]!.value as never);
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
  it("returns at least one option, each with label/value/hint", () => {
    const options = buildPresetOptions();
    expect(options.length).toBeGreaterThan(0);
    for (const opt of options) {
      expect(opt).toHaveProperty("label");
      expect(opt).toHaveProperty("value");
      expect(opt).toHaveProperty("hint");
    }
  });

  it("marks the default preset as recommended", () => {
    const options = buildPresetOptions();
    expect(options.some((o) => o.label.includes("recommended"))).toBe(true);
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
    const w = result as { configMode: string; importSource: string; agents: string[] };
    expect(w.configMode).toBe("zip");
    expect(w.importSource).toBe("/path/to/preset.zip");
    expect(w.agents).toEqual(["claude-code"]);
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
    const w = result as { configMode: string; importSource: string; agents: string[] };
    expect(w.configMode).toBe("github");
    expect(w.importSource).toBe("org/my-preset");
    expect(w.agents).toEqual(["claude-code", "cursor"]);
  });

  it("returns BACK symbol when user cancels", async () => {
    mockText.mockResolvedValueOnce(Symbol.for("cancel") as never);
    mockIsCancel.mockReturnValueOnce(true);
    const result = await handleGithubPath(["claude-code"]);
    expect(typeof result).toBe("symbol");
  });
});

describe("handleZipPath — modify-mode overwrite confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsCancel.mockReturnValue(false);
  });

  const buildModifyInstall = () => ({
    selections: { preset: "balanced", rules: [], skills: [], agents: [], mcpServers: [] },
    inventory: [
      {
        name: "codi-security",
        type: "rule" as const,
        status: "builtin-modified" as const,
        installed: true,
        managedBy: "codi" as const,
        installedArtifactVersion: null,
        hint: "",
      },
    ],
  });

  it("prompts for confirmation when modified artifacts exist, proceeds on confirm", async () => {
    mockText.mockResolvedValueOnce("/path/to/preset.zip");
    mockWizardConfirm.mockResolvedValueOnce(true);
    const result = await handleZipPath(["claude-code"], buildModifyInstall());
    expect(mockWizardConfirm).toHaveBeenCalledTimes(1);
    expect(result).not.toBeNull();
    const w = result as { configMode: string; importSource: string };
    expect(w.configMode).toBe("zip");
    expect(w.importSource).toBe("/path/to/preset.zip");
  });

  it("cancels import when user declines overwrite confirmation", async () => {
    mockText.mockResolvedValueOnce("/path/to/preset.zip");
    mockWizardConfirm.mockResolvedValueOnce(false);
    const result = await handleZipPath(["claude-code"], buildModifyInstall());
    expect(result).toBeNull();
  });

  it("skips confirmation when no existing install is passed (fresh install)", async () => {
    mockText.mockResolvedValueOnce("/path/to/preset.zip");
    const result = await handleZipPath(["claude-code"]);
    expect(mockWizardConfirm).not.toHaveBeenCalled();
    expect(result).not.toBeNull();
  });
});

describe("handleGithubPath — modify-mode overwrite confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsCancel.mockReturnValue(false);
  });

  const emptyInstall = {
    selections: { preset: "balanced", rules: [], skills: [], agents: [], mcpServers: [] },
    inventory: [],
  };

  it("prompts for confirmation when existing install is provided", async () => {
    mockText.mockResolvedValueOnce("org/my-preset");
    mockWizardConfirm.mockResolvedValueOnce(true);
    const result = await handleGithubPath(["claude-code"], emptyInstall);
    expect(mockWizardConfirm).toHaveBeenCalledTimes(1);
    expect(result).not.toBeNull();
  });

  it("cancels import when user declines overwrite confirmation", async () => {
    mockText.mockResolvedValueOnce("org/my-preset");
    mockWizardConfirm.mockResolvedValueOnce(false);
    const result = await handleGithubPath(["claude-code"], emptyInstall);
    expect(result).toBeNull();
  });
});

describe("handleCustomPath — groupMultiselect messages include real counts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsCancel.mockReturnValue(false);
    mockGroupMultiselect
      .mockResolvedValueOnce([]) // rules
      .mockResolvedValueOnce([]) // skills
      .mockResolvedValueOnce([]) // agents
      .mockResolvedValueOnce([]); // mcps
    mockWizardSelect.mockResolvedValueOnce("codi-default"); // flag preset
    mockWizardConfirm
      .mockResolvedValueOnce(false) // save as preset
      .mockResolvedValueOnce(false); // version pin
  });

  it("rules message names a non-zero count", async () => {
    await handleCustomPath(["claude-code"]);
    expect(mockGroupMultiselect.mock.calls[0]?.[0]?.message).toBe(
      `Select rules (${AVAILABLE_TEMPLATES.length} total)`,
    );
  });

  it("skills message names a non-zero count", async () => {
    await handleCustomPath(["claude-code"]);
    expect(mockGroupMultiselect.mock.calls[1]?.[0]?.message).toBe(
      `Select skills (${AVAILABLE_SKILL_TEMPLATES.length} total)`,
    );
  });

  it("agents message names a non-zero count", async () => {
    await handleCustomPath(["claude-code"]);
    expect(mockGroupMultiselect.mock.calls[2]?.[0]?.message).toBe(
      `Select agent definitions (${AVAILABLE_AGENT_TEMPLATES.length} total)`,
    );
  });

  it("MCP servers message names a non-zero count", async () => {
    await handleCustomPath(["claude-code"]);
    expect(mockGroupMultiselect.mock.calls[3]?.[0]?.message).toBe(
      `Select MCP servers (${AVAILABLE_MCP_SERVER_TEMPLATES.length} total)`,
    );
  });
});

describe("handlePresetPath — current-install hydrates selections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsCancel.mockReturnValue(false);
  });

  it("uses current install selections as initialValues", async () => {
    mockWizardSelect.mockResolvedValueOnce("codi-default");
    mockFlagEditing("codi-default");
    mockGroupMultiselect
      .mockResolvedValueOnce(["typescript", "legacy-rule"])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    mockWizardConfirm.mockResolvedValueOnce(false);

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
  });
});
