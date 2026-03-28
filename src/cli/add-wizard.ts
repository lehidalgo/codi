import * as p from "@clack/prompts";
import { AVAILABLE_TEMPLATES } from "../core/scaffolder/template-loader.js";
import { AVAILABLE_SKILL_TEMPLATES } from "../core/scaffolder/skill-template-loader.js";
import { AVAILABLE_AGENT_TEMPLATES } from "../core/scaffolder/agent-template-loader.js";
import { AVAILABLE_COMMAND_TEMPLATES } from "../core/scaffolder/command-template-loader.js";
import { NAME_PATTERN_STRICT, MAX_NAME_LENGTH } from "../constants.js";

export type ArtifactType = "rule" | "skill" | "agent" | "command" | "brand";

export interface AddWizardResult {
  names: string[];
  useTemplates: boolean;
}

/** When user runs `codi add` with no subcommand. */
export async function selectArtifactType(): Promise<ArtifactType | null> {
  p.intro("codi — Add Artifact");

  const type = await p.select({
    message: "What do you want to create?",
    options: [
      {
        label: "Rule",
        value: "rule" as const,
        hint: "Enforce a coding standard or convention",
      },
      {
        label: "Skill",
        value: "skill" as const,
        hint: "Define a reusable workflow",
      },
      {
        label: "Agent",
        value: "agent" as const,
        hint: "Create a specialized subagent",
      },
      {
        label: "Command",
        value: "command" as const,
        hint: "Add a slash command",
      },
      {
        label: "Brand",
        value: "brand" as const,
        hint: "Define a brand identity",
      },
    ],
  });

  if (p.isCancel(type)) {
    p.cancel("Operation cancelled.");
    return null;
  }

  return type;
}

/** When user runs `codi add <type>` with no name. */
export async function runAddWizard(
  type: ArtifactType,
): Promise<AddWizardResult | null> {
  const templateMap: Record<ArtifactType, readonly string[]> = {
    rule: AVAILABLE_TEMPLATES,
    skill: AVAILABLE_SKILL_TEMPLATES,
    agent: AVAILABLE_AGENT_TEMPLATES,
    command: AVAILABLE_COMMAND_TEMPLATES,
    brand: [],
  };
  const templates = templateMap[type];

  // Step 1: Choose mode
  const mode = await p.select({
    message: `How do you want to create ${type}(s)?`,
    options: [
      {
        label: "From templates",
        value: "templates" as const,
        hint: `Choose from ${templates.length} available templates`,
      },
      {
        label: "Blank (custom)",
        value: "blank" as const,
        hint: "Start with an empty skeleton",
      },
    ],
  });

  if (p.isCancel(mode)) {
    p.cancel("Operation cancelled.");
    return null;
  }

  if (mode === "templates") {
    // Step 2a: Select templates (multiselect)
    const selected = await p.multiselect({
      message: `Select ${type} templates`,
      options: templates.map((t) => ({ label: t, value: t })),
      required: false,
    });

    if (p.isCancel(selected)) {
      p.cancel("Operation cancelled.");
      return null;
    }

    if (selected.length === 0) return null;

    // Step 3a: Confirm
    const confirmed = await p.confirm({
      message: `Create ${selected.length} ${type}(s)? (${selected.join(", ")})`,
    });

    if (p.isCancel(confirmed) || !confirmed) return null;

    p.outro(`Creating ${selected.length} ${type}(s).`);
    return { names: selected, useTemplates: true };
  }

  // Step 2b: Enter custom name
  const name = await p.text({
    message: `${type} name (kebab-case)`,
    validate: (value) => {
      if (!value) return "Name is required";
      if (value.length > MAX_NAME_LENGTH)
        return `Max ${MAX_NAME_LENGTH} characters`;
      if (!NAME_PATTERN_STRICT.test(value))
        return "Use lowercase letters, numbers, and hyphens (must start with letter)";
    },
  });

  if (p.isCancel(name)) {
    p.cancel("Operation cancelled.");
    return null;
  }

  p.outro(`Creating ${type} "${name}".`);
  return { names: [name], useTemplates: false };
}
