import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @clack/prompts before importing the module
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
  note: vi.fn(),
  multiselect: vi.fn(),
  select: vi.fn(),
  text: vi.fn(),
  confirm: vi.fn(),
  isCancel: vi.fn().mockReturnValue(false),
  log: {
    message: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    step: vi.fn(),
    warn: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("#src/cli/group-multiselect.js", () => ({
  groupMultiselect: vi.fn(),
}));

vi.mock("#src/cli/wizard-prompts.js", () => ({
  wizardSelect: vi.fn(),
  wizardMultiselect: vi.fn(),
  wizardConfirm: vi.fn(),
}));

import * as p from "@clack/prompts";
import { groupMultiselect } from "#src/cli/group-multiselect.js";
import { wizardSelect, wizardMultiselect, wizardConfirm } from "#src/cli/wizard-prompts.js";
import { runInitWizard } from "#src/cli/init-wizard.js";
import { getBuiltinPresetDefinition } from "#src/templates/presets/index.js";
import { FLAG_CATALOG } from "#src/core/flags/flag-catalog.js";
import { prefixedName } from "#src/constants.js";

/**
 * Mock the flag editing prompts that editPresetFlags() makes:
 * 1 wizardMultiselect (booleans) + N wizardSelects (enums) + N texts (numbers)
 * Returns the default values so flags appear unchanged.
 */
function mockFlagEditing(presetName: string): void {
  const presetDef = getBuiltinPresetDefinition(presetName);
  const flags = presetDef?.flags ?? {};

  // Boolean multiselect: return keys where value is true and not locked
  const booleanTrueKeys = Object.keys(flags).filter(
    (k) => FLAG_CATALOG[k]?.type === "boolean" && !flags[k]?.locked && flags[k]?.value === true,
  );
  vi.mocked(wizardMultiselect).mockResolvedValueOnce(booleanTrueKeys as never);

  // Enum selects: return current value for each
  for (const [key, spec] of Object.entries(FLAG_CATALOG)) {
    if (spec.type !== "enum" || !spec.values || flags[key]?.locked || !flags[key]) continue;
    vi.mocked(wizardSelect).mockResolvedValueOnce(flags[key]!.value as never);
  }

  // Number texts: return current value as string
  for (const [key, spec] of Object.entries(FLAG_CATALOG)) {
    if (spec.type !== "number" || flags[key]?.locked || !flags[key]) continue;
    vi.mocked(p.text).mockResolvedValueOnce(String(flags[key]!.value) as never);
  }
}

describe("runInitWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(p.isCancel).mockReturnValue(false);
  });

  it("returns null when language selection is cancelled", async () => {
    vi.mocked(wizardMultiselect).mockResolvedValueOnce(Symbol("cancel") as never);

    const result = await runInitWizard([], [], ["claude-code", "cursor"]);
    expect(result).toBeNull();
    expect(p.cancel).toHaveBeenCalled();
  });

  it("returns null when no agents selected", async () => {
    vi.mocked(wizardMultiselect)
      .mockResolvedValueOnce(["typescript"] as never) // languages
      .mockResolvedValueOnce([] as never); // agents (empty)

    const result = await runInitWizard([], [], ["claude-code"]);
    expect(result).toBeNull();
  });

  it("returns zip config when zip mode selected", async () => {
    vi.mocked(wizardMultiselect)
      .mockResolvedValueOnce(["typescript"] as never) // languages
      .mockResolvedValueOnce(["claude-code"] as never); // agents
    vi.mocked(wizardSelect).mockResolvedValueOnce("zip" as never);
    vi.mocked(p.text).mockResolvedValueOnce("/path/to/preset.zip" as never);

    const result = await runInitWizard(["typescript"], ["claude-code"], ["claude-code", "cursor"]);

    expect(result).not.toBeNull();
    expect(result!.configMode).toBe("zip");
    expect(result!.importSource).toBe("/path/to/preset.zip");
    expect(result!.agents).toEqual(["claude-code"]);
    expect(result!.languages).toEqual(["typescript"]);
  });

  it("returns github config when github mode selected", async () => {
    vi.mocked(wizardMultiselect)
      .mockResolvedValueOnce([] as never) // languages (none)
      .mockResolvedValueOnce(["claude-code"] as never); // agents
    vi.mocked(wizardSelect).mockResolvedValueOnce("github" as never);
    vi.mocked(p.text).mockResolvedValueOnce("org/my-preset" as never);

    const result = await runInitWizard([], [], ["claude-code"]);

    expect(result).not.toBeNull();
    expect(result!.configMode).toBe("github");
    expect(result!.importSource).toBe("org/my-preset");
    expect(result!.languages).toEqual([]);
  });

  it("returns custom config with artifact selections", async () => {
    vi.mocked(wizardMultiselect)
      .mockResolvedValueOnce(["typescript"] as never) // languages
      .mockResolvedValueOnce(["claude-code"] as never); // agents
    vi.mocked(groupMultiselect)
      .mockResolvedValueOnce([prefixedName("security")] as never) // rules
      .mockResolvedValueOnce([prefixedName("code-review")] as never) // skills
      .mockResolvedValueOnce([]) // agent templates
      .mockResolvedValueOnce(["github"] as never); // MCP servers

    vi.mocked(wizardSelect).mockResolvedValueOnce("custom" as never); // config mode
    // flag preset is inside handleCustomPath — wizardSelect called inside it
    vi.mocked(wizardSelect).mockResolvedValueOnce(prefixedName("balanced") as never);

    vi.mocked(wizardConfirm)
      .mockResolvedValueOnce(false as never) // save as preset? no
      .mockResolvedValueOnce(true as never); // version pin? yes

    const result = await runInitWizard(["typescript"], [], ["claude-code"]);

    expect(result).not.toBeNull();
    expect(result!.configMode).toBe("custom");
    expect(result!.rules).toEqual([prefixedName("security")]);
    expect(result!.skills).toEqual([prefixedName("code-review")]);
    expect(result!.flagPreset).toBe(prefixedName("balanced"));
    expect(result!.versionPin).toBe(true);
  });

  it("returns preset config when preset mode selected without modifications", async () => {
    const presetDef = getBuiltinPresetDefinition(prefixedName("balanced"));
    const presetRules = presetDef?.rules ?? [];
    const presetSkills = presetDef?.skills ?? [];
    const presetAgents = presetDef?.agents ?? [];
    const presetMcpServers = presetDef?.mcpServers ?? [];

    // languages + agents
    vi.mocked(wizardMultiselect)
      .mockResolvedValueOnce([] as never) // languages
      .mockResolvedValueOnce(["claude-code"] as never); // agents

    // config mode + preset choice (both wizardSelect)
    vi.mocked(wizardSelect)
      .mockResolvedValueOnce("preset" as never)
      .mockResolvedValueOnce(prefixedName("balanced") as never);

    // flag editing (wizardMultiselect for booleans, wizardSelect for enums, p.text for numbers)
    mockFlagEditing(prefixedName("balanced"));

    // artifact editing (return same as preset — no changes)
    vi.mocked(groupMultiselect)
      .mockResolvedValueOnce(presetRules as never)
      .mockResolvedValueOnce(presetSkills as never)
      .mockResolvedValueOnce(presetAgents as never)
      .mockResolvedValueOnce(presetMcpServers as never);

    // version pin (wizardConfirm inside handlePresetPath)
    vi.mocked(wizardConfirm).mockResolvedValueOnce(false as never);

    const result = await runInitWizard([], [], ["claude-code"]);

    expect(result).not.toBeNull();
    expect(result!.configMode).toBe("preset");
    expect(result!.presetName).toBe(prefixedName("balanced"));
  });

  it("prompts save-as-preset when preset artifacts are modified", async () => {
    const presetDef = getBuiltinPresetDefinition(prefixedName("strict"));
    const presetRules = presetDef?.rules ?? [];
    const modifiedRules = presetRules.length > 0 ? presetRules.slice(1) : ["extra-rule"];

    // languages + agents
    vi.mocked(wizardMultiselect)
      .mockResolvedValueOnce([] as never) // languages
      .mockResolvedValueOnce(["claude-code"] as never); // agents

    // config mode + preset choice
    vi.mocked(wizardSelect)
      .mockResolvedValueOnce("preset" as never)
      .mockResolvedValueOnce(prefixedName("strict") as never);

    // flag editing
    mockFlagEditing(prefixedName("strict"));

    // artifacts (modified rules)
    vi.mocked(groupMultiselect)
      .mockResolvedValueOnce(modifiedRules as never)
      .mockResolvedValueOnce(presetDef?.skills ?? ([] as never))
      .mockResolvedValueOnce(presetDef?.agents ?? ([] as never))
      .mockResolvedValueOnce(presetDef?.commands ?? ([] as never))
      .mockResolvedValueOnce(presetDef?.mcpServers ?? ([] as never));

    // save-as-preset name (p.text inside handlePresetPath)
    vi.mocked(p.text).mockResolvedValueOnce("my-custom-preset" as never);

    // version pin (wizardConfirm inside handlePresetPath)
    vi.mocked(wizardConfirm).mockResolvedValueOnce(true as never);

    const result = await runInitWizard([], [], ["claude-code"]);

    expect(result).not.toBeNull();
    expect(result!.configMode).toBe("custom");
    expect(result!.saveAsPreset).toBe("my-custom-preset");
  });

  it("returns selected preset name directly (no base mapping)", async () => {
    const presetDef = getBuiltinPresetDefinition(prefixedName("fullstack"));
    const presetRules = presetDef?.rules ?? [];
    const presetSkills = presetDef?.skills ?? [];
    const presetAgents = presetDef?.agents ?? [];
    const presetCommands = presetDef?.commands ?? [];
    const presetMcpServers = presetDef?.mcpServers ?? [];

    vi.mocked(wizardMultiselect)
      .mockResolvedValueOnce(["typescript"] as never) // languages
      .mockResolvedValueOnce(["claude-code"] as never); // agents

    vi.mocked(wizardSelect)
      .mockResolvedValueOnce("preset" as never)
      .mockResolvedValueOnce(prefixedName("fullstack") as never);

    mockFlagEditing(prefixedName("fullstack"));

    vi.mocked(groupMultiselect)
      .mockResolvedValueOnce(presetRules as never)
      .mockResolvedValueOnce(presetSkills as never)
      .mockResolvedValueOnce(presetAgents as never)
      .mockResolvedValueOnce(presetCommands as never)
      .mockResolvedValueOnce(presetMcpServers as never);

    vi.mocked(wizardConfirm).mockResolvedValueOnce(false as never);

    const result = await runInitWizard([], [], ["claude-code"]);

    expect(result).not.toBeNull();
    expect(result!.preset).toBe(prefixedName("fullstack"));
  });

  it("goes back from agents to languages, then exits on cancel", async () => {
    // Flow: languages(ok) → agents(symbol → back to languages) → languages(symbol → exit)
    vi.mocked(wizardMultiselect)
      .mockResolvedValueOnce([] as never) // languages first pass (ok)
      .mockResolvedValueOnce(Symbol("back") as never) // agents → back to languages
      .mockResolvedValueOnce(Symbol("cancel") as never); // languages → exit (cancel)

    const result = await runInitWizard([], [], ["claude-code"]);
    expect(result).toBeNull();
    expect(p.cancel).toHaveBeenCalled();
  });

  it("lets the user choose modify current installation for existing installs", async () => {
    vi.mocked(wizardSelect)
      .mockResolvedValueOnce("modify" as never) // existing install action
      .mockResolvedValueOnce("custom" as never) // update source: customize current artifacts
      .mockResolvedValueOnce(prefixedName("balanced") as never); // flag preset inside handleCustomPath
    vi.mocked(wizardMultiselect)
      .mockResolvedValueOnce(["typescript"] as never) // languages
      .mockResolvedValueOnce(["claude-code"] as never); // agents
    vi.mocked(groupMultiselect)
      .mockResolvedValueOnce(["codi-security"] as never)
      .mockResolvedValueOnce(["codi-code-review"] as never)
      .mockResolvedValueOnce(["codi-code-reviewer"] as never)
      .mockResolvedValueOnce(["codi-commit"] as never)
      .mockResolvedValueOnce(["github"] as never);
    vi.mocked(wizardConfirm)
      .mockResolvedValueOnce(false as never) // save as preset? no
      .mockResolvedValueOnce(true as never); // version pin? yes

    const result = await runInitWizard(["typescript"], ["claude-code"], ["claude-code"], {
      selections: {
        preset: "current-install",
        rules: ["codi-security"],
        skills: ["codi-code-review"],
        agents: ["codi-code-reviewer"],
        commands: ["codi-commit"],
        mcpServers: ["github"],
      },
      inventory: [],
    });

    expect(result).not.toBeNull();
    expect(vi.mocked(wizardSelect).mock.calls[0]?.[0]?.message).toContain("already installed");
    // modify mode: 3 wizardSelect calls (existing-install action, update source, flag preset)
    expect(vi.mocked(wizardSelect).mock.calls).toHaveLength(3);
    // second prompt is the update-source selector with modify-aware wording
    expect(vi.mocked(wizardSelect).mock.calls[1]?.[0]?.message).toContain(
      "update your installation",
    );
  });

  it("returns null when existing-install choice is cancelled", async () => {
    vi.mocked(wizardSelect).mockResolvedValueOnce(Symbol("cancel") as never);

    const result = await runInitWizard([], [], ["claude-code"], {
      selections: {
        preset: "current-install",
        rules: [],
        skills: [],
        agents: [],
        commands: [],
        mcpServers: [],
      },
      inventory: [],
    });

    expect(result).toBeNull();
    expect(p.cancel).toHaveBeenCalled();
  });
});
