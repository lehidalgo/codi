import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @clack/prompts before importing the module
vi.mock("@clack/prompts", () => ({
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

import * as p from "@clack/prompts";
import { runInitWizard } from "#src/cli/init-wizard.js";
import { getBuiltinPresetDefinition } from "#src/templates/presets/index.js";
import { FLAG_CATALOG } from "#src/core/flags/flag-catalog.js";
import { prefixedName } from "#src/constants.js";

/**
 * Mock the flag editing prompts that editPresetFlags() makes:
 * 1 multiselect (booleans) + N selects (enums) + N texts (numbers)
 * Returns the default values so flags appear unchanged.
 */
function mockFlagEditing(presetName: string): void {
  const presetDef = getBuiltinPresetDefinition(presetName);
  const flags = presetDef?.flags ?? {};

  // Boolean multiselect: return keys where value is true and not locked
  const booleanTrueKeys = Object.keys(flags).filter(
    (k) =>
      FLAG_CATALOG[k]?.type === "boolean" &&
      !flags[k]?.locked &&
      flags[k]?.value === true,
  );
  vi.mocked(p.multiselect).mockResolvedValueOnce(booleanTrueKeys as never);

  // Enum selects: return current value for each
  for (const [key, spec] of Object.entries(FLAG_CATALOG)) {
    if (
      spec.type !== "enum" ||
      !spec.values ||
      flags[key]?.locked ||
      !flags[key]
    )
      continue;
    vi.mocked(p.select).mockResolvedValueOnce(flags[key]!.value as never);
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
    vi.mocked(p.multiselect).mockResolvedValueOnce(Symbol("cancel") as never);
    vi.mocked(p.isCancel).mockReturnValueOnce(true);

    const result = await runInitWizard([], [], ["claude-code", "cursor"]);
    expect(result).toBeNull();
    expect(p.cancel).toHaveBeenCalled();
  });

  it("returns null when no agents selected", async () => {
    vi.mocked(p.multiselect)
      .mockResolvedValueOnce(["typescript"] as never) // languages
      .mockResolvedValueOnce([] as never); // agents (empty)

    const result = await runInitWizard([], [], ["claude-code"]);
    expect(result).toBeNull();
  });

  it("returns zip config when zip mode selected", async () => {
    vi.mocked(p.multiselect)
      .mockResolvedValueOnce(["typescript"] as never) // languages
      .mockResolvedValueOnce(["claude-code"] as never); // agents
    vi.mocked(p.select).mockResolvedValueOnce("zip" as never);
    vi.mocked(p.text).mockResolvedValueOnce("/path/to/preset.zip" as never);

    const result = await runInitWizard(
      ["typescript"],
      ["claude-code"],
      ["claude-code", "cursor"],
    );

    expect(result).not.toBeNull();
    expect(result!.configMode).toBe("zip");
    expect(result!.importSource).toBe("/path/to/preset.zip");
    expect(result!.agents).toEqual(["claude-code"]);
    expect(result!.languages).toEqual(["typescript"]);
  });

  it("returns github config when github mode selected", async () => {
    vi.mocked(p.multiselect)
      .mockResolvedValueOnce([] as never) // languages (none)
      .mockResolvedValueOnce(["claude-code"] as never); // agents
    vi.mocked(p.select).mockResolvedValueOnce("github" as never);
    vi.mocked(p.text).mockResolvedValueOnce("org/my-preset" as never);

    const result = await runInitWizard([], [], ["claude-code"]);

    expect(result).not.toBeNull();
    expect(result!.configMode).toBe("github");
    expect(result!.importSource).toBe("org/my-preset");
    expect(result!.languages).toEqual([]);
  });

  it("returns custom config with artifact selections", async () => {
    vi.mocked(p.multiselect)
      .mockResolvedValueOnce(["typescript"] as never) // languages
      .mockResolvedValueOnce(["claude-code"] as never) // agents
      .mockResolvedValueOnce([prefixedName("security")] as never) // rules
      .mockResolvedValueOnce([prefixedName("code-review")] as never) // skills
      .mockResolvedValueOnce([]) // agent templates
      .mockResolvedValueOnce([prefixedName("commit")] as never) // commands
      .mockResolvedValueOnce(["github"] as never); // MCP servers

    vi.mocked(p.select)
      .mockResolvedValueOnce("custom" as never) // config mode
      .mockResolvedValueOnce(prefixedName("balanced") as never); // flag preset

    vi.mocked(p.confirm)
      .mockResolvedValueOnce(false as never) // save as preset? no
      .mockResolvedValueOnce(true as never); // version pin? yes

    const result = await runInitWizard(["typescript"], [], ["claude-code"]);

    expect(result).not.toBeNull();
    expect(result!.configMode).toBe("custom");
    expect(result!.rules).toEqual([prefixedName("security")]);
    expect(result!.skills).toEqual([prefixedName("code-review")]);
    expect(result!.commandTemplates).toEqual([prefixedName("commit")]);
    expect(result!.preset).toBe(prefixedName("balanced"));
    expect(result!.versionPin).toBe(true);
  });

  it("returns preset config when preset mode selected without modifications", async () => {
    const presetDef = getBuiltinPresetDefinition(prefixedName("balanced"));
    const presetRules = presetDef?.rules ?? [];
    const presetSkills = presetDef?.skills ?? [];
    const presetAgents = presetDef?.agents ?? [];
    const presetCommands = presetDef?.commands ?? [];
    const presetMcpServers = presetDef?.mcpServers ?? [];

    // Step 0: language selection + Step 1: agent selection
    vi.mocked(p.multiselect)
      .mockResolvedValueOnce([] as never) // languages
      .mockResolvedValueOnce(["claude-code"] as never); // agents

    // Step 2: config mode + preset choice
    vi.mocked(p.select)
      .mockResolvedValueOnce("preset" as never)
      .mockResolvedValueOnce(prefixedName("balanced") as never);

    // Step 3: flag editing (return defaults — no changes)
    mockFlagEditing(prefixedName("balanced"));

    // Step 4: artifact editing (return same as preset — no changes)
    vi.mocked(p.multiselect)
      .mockResolvedValueOnce(presetRules as never)
      .mockResolvedValueOnce(presetSkills as never)
      .mockResolvedValueOnce(presetAgents as never)
      .mockResolvedValueOnce(presetCommands as never)
      .mockResolvedValueOnce(presetMcpServers as never);

    // Step 5: version pin
    vi.mocked(p.confirm).mockResolvedValueOnce(false as never);

    const result = await runInitWizard([], [], ["claude-code"]);

    expect(result).not.toBeNull();
    expect(result!.configMode).toBe("preset");
    expect(result!.presetName).toBe(prefixedName("balanced"));
  });

  it("prompts save-as-preset when preset artifacts are modified", async () => {
    const presetDef = getBuiltinPresetDefinition(prefixedName("strict"));
    const presetRules = presetDef?.rules ?? [];
    const modifiedRules =
      presetRules.length > 0 ? presetRules.slice(1) : ["extra-rule"];

    // Step 0: language selection + Step 1: agent selection
    vi.mocked(p.multiselect)
      .mockResolvedValueOnce([] as never) // languages
      .mockResolvedValueOnce(["claude-code"] as never); // agents

    // Step 2: config mode + preset choice
    vi.mocked(p.select)
      .mockResolvedValueOnce("preset" as never)
      .mockResolvedValueOnce(prefixedName("strict") as never);

    // Step 3: flag editing (return defaults)
    mockFlagEditing(prefixedName("strict"));

    // Step 4: artifacts (modified rules)
    vi.mocked(p.multiselect)
      .mockResolvedValueOnce(modifiedRules as never)
      .mockResolvedValueOnce(presetDef?.skills ?? ([] as never))
      .mockResolvedValueOnce(presetDef?.agents ?? ([] as never))
      .mockResolvedValueOnce(presetDef?.commands ?? ([] as never))
      .mockResolvedValueOnce(presetDef?.mcpServers ?? ([] as never));

    // Step 5: save-as-preset name
    vi.mocked(p.text).mockResolvedValueOnce("my-custom-preset" as never);

    // Step 6: version pin
    vi.mocked(p.confirm).mockResolvedValueOnce(true as never);

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

    vi.mocked(p.multiselect)
      .mockResolvedValueOnce(["typescript"] as never) // languages
      .mockResolvedValueOnce(["claude-code"] as never); // agents

    vi.mocked(p.select)
      .mockResolvedValueOnce("preset" as never)
      .mockResolvedValueOnce(prefixedName("fullstack") as never);

    mockFlagEditing(prefixedName("fullstack"));

    vi.mocked(p.multiselect)
      .mockResolvedValueOnce(presetRules as never)
      .mockResolvedValueOnce(presetSkills as never)
      .mockResolvedValueOnce(presetAgents as never)
      .mockResolvedValueOnce(presetCommands as never)
      .mockResolvedValueOnce(presetMcpServers as never);

    vi.mocked(p.confirm).mockResolvedValueOnce(false as never);

    const result = await runInitWizard([], [], ["claude-code"]);

    expect(result).not.toBeNull();
    expect(result!.preset).toBe(prefixedName("fullstack"));
  });

  it("goes back from agents to languages, then exits on cancel", async () => {
    // Flow: languages(ok) → agents(cancel) → languages(cancel) → exit
    vi.mocked(p.multiselect)
      .mockResolvedValueOnce([] as never) // languages (first pass, ok)
      .mockResolvedValueOnce(Symbol("cancel") as never) // agents (cancel → back to languages)
      .mockResolvedValueOnce(Symbol("cancel") as never); // languages (cancel → exit)
    vi.mocked(p.isCancel)
      .mockReturnValueOnce(false) // languages check (first pass, ok)
      .mockReturnValueOnce(true) // agents cancel → back to languages
      .mockReturnValueOnce(true); // languages cancel → exit

    const result = await runInitWizard([], [], ["claude-code"]);
    expect(result).toBeNull();
    expect(p.cancel).toHaveBeenCalled();
  });
});
