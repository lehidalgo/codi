import fs from "node:fs/promises";
import path from "node:path";
import * as p from "@clack/prompts";
import { stringify as stringifyYaml } from "yaml";
import { resolveProjectDir } from "../utils/paths.js";
import { Logger } from "../core/output/logger.js";
import {
  PRESET_MANIFEST_FILENAME,
  NAME_PATTERN_STRICT,
  MAX_NAME_LENGTH,
  PROJECT_CLI,
  PROJECT_DIR,
} from "../constants.js";
import { AVAILABLE_TEMPLATES } from "../core/scaffolder/template-loader.js";
import { AVAILABLE_SKILL_TEMPLATES } from "../core/scaffolder/skill-template-loader.js";
import { AVAILABLE_AGENT_TEMPLATES } from "../core/scaffolder/agent-template-loader.js";
import { getBuiltinPresetNames } from "../templates/presets/index.js";
import { createPresetZip } from "../core/preset/preset-zip.js";

export interface PresetWizardResult {
  name: string;
  description: string;
  version: string;
  extends?: string;
  tags: string[];
  rules: string[];
  skills: string[];
  agents: string[];
  outputFormat: "dir" | "zip" | "github";
}

/**
 * Interactive preset creation wizard.
 * Guides the user through defining and packaging a preset.
 */
export async function runPresetWizard(projectRoot: string): Promise<PresetWizardResult | null> {
  p.intro(`${PROJECT_CLI} — Preset Creator`);

  // Step 1: Identity
  const name = await p.text({
    message: "Preset name (kebab-case)",
    validate: (v) => {
      if (!v) return "Name is required";
      if (v.length > MAX_NAME_LENGTH) return `Max ${MAX_NAME_LENGTH} characters`;
      if (!NAME_PATTERN_STRICT.test(v)) return "Must be kebab-case, start with a letter";
    },
  });
  if (p.isCancel(name)) {
    p.cancel("Operation cancelled.");
    return null;
  }

  const description = await p.text({
    message: "Description",
  });
  if (p.isCancel(description)) {
    p.cancel("Operation cancelled.");
    return null;
  }

  const version = await p.text({
    message: "Version",
    defaultValue: "1.0.0",
  });
  if (p.isCancel(version)) {
    p.cancel("Operation cancelled.");
    return null;
  }

  const tags = await p.text({
    message: "Tags (comma-separated)",
    defaultValue: "",
  });
  if (p.isCancel(tags)) {
    p.cancel("Operation cancelled.");
    return null;
  }

  // Step 2: Base preset
  const allPresets = getBuiltinPresetNames();
  const uniquePresets = [...new Set(allPresets)];

  const extendsPreset = await p.select({
    message: "Extend a base preset?",
    options: [
      { label: "(none)", value: "" as const },
      ...uniquePresets.map((pr) => ({ label: pr, value: pr })),
    ],
  });
  if (p.isCancel(extendsPreset)) {
    p.cancel("Operation cancelled.");
    return null;
  }

  // Step 3: Select rules
  const rules = await p.multiselect({
    message: "Select rules",
    options: AVAILABLE_TEMPLATES.map((t) => ({ label: t, value: t })),
    required: false,
  });
  if (p.isCancel(rules)) {
    p.cancel("Operation cancelled.");
    return null;
  }

  const skills = await p.multiselect({
    message: "Select skills",
    options: AVAILABLE_SKILL_TEMPLATES.map((t) => ({ label: t, value: t })),
    required: false,
  });
  if (p.isCancel(skills)) {
    p.cancel("Operation cancelled.");
    return null;
  }

  const agents = await p.multiselect({
    message: "Select agents",
    options: AVAILABLE_AGENT_TEMPLATES.map((t) => ({ label: t, value: t })),
    required: false,
  });
  if (p.isCancel(agents)) {
    p.cancel("Operation cancelled.");
    return null;
  }

  // Step 6: Output format
  const format = await p.select({
    message: "Output format",
    options: [
      {
        label: `Local directory (${PROJECT_DIR}/presets/)`,
        value: "dir" as const,
      },
      { label: "ZIP package", value: "zip" as const },
      { label: "GitHub repository scaffold", value: "github" as const },
    ],
  });
  if (p.isCancel(format)) {
    p.cancel("Operation cancelled.");
    return null;
  }

  const result: PresetWizardResult = {
    name,
    description: description ?? "",
    version: version ?? "1.0.0",
    extends: extendsPreset || undefined,
    tags: (tags ?? "")
      .split(",")
      .map((t: string) => t.trim())
      .filter(Boolean),
    rules,
    skills,
    agents,
    outputFormat: format,
  };

  // Create the preset
  await scaffoldPreset(projectRoot, result);

  p.outro("Preset created successfully.");
  return result;
}

async function scaffoldPreset(projectRoot: string, config: PresetWizardResult): Promise<void> {
  const log = Logger.getInstance();
  const configDir = resolveProjectDir(projectRoot);
  const presetDir = path.join(configDir, "presets", config.name);

  // Create preset directory (no subdirs — artifacts are references)
  await fs.mkdir(presetDir, { recursive: true });

  // Write manifest with artifacts as references
  const manifest: Record<string, unknown> = {
    name: config.name,
    description: config.description,
    version: config.version,
    artifacts: {
      rules: config.rules,
      skills: config.skills,
      agents: config.agents,
    },
  };
  if (config.extends) manifest["extends"] = config.extends;
  if (config.tags.length > 0) manifest["tags"] = config.tags;

  await fs.writeFile(
    path.join(presetDir, PRESET_MANIFEST_FILENAME),
    stringifyYaml(manifest),
    "utf8",
  );

  log.info(`Created preset scaffold at ${PROJECT_DIR}/presets/${config.name}/`);
  log.info(
    `  Rules: ${config.rules.length}, Skills: ${config.skills.length}, Agents: ${config.agents.length}`,
  );

  // Handle output format
  if (config.outputFormat === "zip") {
    const zipResult = await createPresetZip(presetDir, ".");
    if (zipResult.ok) {
      log.info(`Exported to ${zipResult.data.outputPath}`);
    } else {
      log.info(`Failed to create ZIP. You can export later with: ${PROJECT_CLI} preset export`);
    }
  } else if (config.outputFormat === "github") {
    log.info("");
    log.info("To create a GitHub repository:");
    log.info(`  1. Copy ${PROJECT_DIR}/presets/${config.name}/ to a new directory`);
    log.info('  2. Run: git init && git add . && git commit -m "Initial preset"');
    log.info("  3. Push to GitHub");
    log.info(`  4. Others install with: ${PROJECT_CLI} preset install github:org/${config.name}`);
  }

  log.info("");
  log.info(`Validate with: ${PROJECT_CLI} preset validate ${config.name}`);
}
