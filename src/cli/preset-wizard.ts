import fs from 'node:fs/promises';
import path from 'node:path';
import prompts from 'prompts';
import { stringify as stringifyYaml } from 'yaml';
import { resolveCodiDir } from '../utils/paths.js';
import { Logger } from '../core/output/logger.js';
import { PRESET_MANIFEST_FILENAME, ARTIFACT_TYPES, NAME_PATTERN_STRICT, MAX_NAME_LENGTH } from '../constants.js';
import { AVAILABLE_TEMPLATES } from '../core/scaffolder/template-loader.js';
import { AVAILABLE_SKILL_TEMPLATES } from '../core/scaffolder/skill-template-loader.js';
import { AVAILABLE_AGENT_TEMPLATES } from '../core/scaffolder/agent-template-loader.js';
import { getPresetNames } from '../core/flags/flag-presets.js';
import { getBuiltinPresetNames } from '../templates/presets/index.js';
import { createPresetZip } from '../core/preset/preset-zip.js';

export interface PresetWizardResult {
  name: string;
  description: string;
  version: string;
  extends?: string;
  tags: string[];
  rules: string[];
  skills: string[];
  agents: string[];
  outputFormat: 'dir' | 'zip' | 'github';
}

/**
 * Interactive preset creation wizard.
 * Guides the user through defining and packaging a preset.
 */
export async function runPresetWizard(projectRoot: string): Promise<PresetWizardResult | null> {
  const log = Logger.getInstance();
  log.info('Preset Creation Wizard');
  log.info('');

  // Step 1: Identity
  const identity = await prompts([
    {
      type: 'text',
      name: 'name',
      message: 'Preset name (kebab-case)',
      validate: (v: string) => {
        if (!v) return 'Name is required';
        if (v.length > MAX_NAME_LENGTH) return `Max ${MAX_NAME_LENGTH} characters`;
        if (!NAME_PATTERN_STRICT.test(v)) return 'Must be kebab-case, start with a letter';
        return true;
      },
    },
    {
      type: 'text',
      name: 'description',
      message: 'Description',
    },
    {
      type: 'text',
      name: 'version',
      message: 'Version',
      initial: '1.0.0',
    },
    {
      type: 'text',
      name: 'tags',
      message: 'Tags (comma-separated)',
      initial: '',
    },
  ]);

  if (!identity.name) return null;

  // Step 2: Base preset
  const allPresets = [...getPresetNames(), ...getBuiltinPresetNames()];
  const uniquePresets = [...new Set(allPresets)];

  const baseChoice = await prompts({
    type: 'select',
    name: 'extends',
    message: 'Extend a base preset?',
    choices: [
      { title: '(none)', value: '' },
      ...uniquePresets.map(p => ({ title: p, value: p })),
    ],
  });

  // Step 3: Select rules
  const ruleChoices = AVAILABLE_TEMPLATES.map(t => ({ title: t, value: t }));
  const ruleSelection = await prompts({
    type: 'multiselect',
    name: 'rules',
    message: 'Select rule templates to include',
    choices: ruleChoices,
    hint: 'Space to toggle, Enter to confirm',
  });

  // Step 4: Select skills
  const skillChoices = AVAILABLE_SKILL_TEMPLATES.map(t => ({ title: t, value: t }));
  const skillSelection = await prompts({
    type: 'multiselect',
    name: 'skills',
    message: 'Select skill templates to include',
    choices: skillChoices,
    hint: 'Space to toggle, Enter to confirm',
  });

  // Step 5: Select agents
  const agentChoices = AVAILABLE_AGENT_TEMPLATES.map(t => ({ title: t, value: t }));
  const agentSelection = await prompts({
    type: 'multiselect',
    name: 'agents',
    message: 'Select agent templates to include',
    choices: agentChoices,
    hint: 'Space to toggle, Enter to confirm',
  });

  // Step 6: Output format
  const formatChoice = await prompts({
    type: 'select',
    name: 'format',
    message: 'Output format',
    choices: [
      { title: 'Local directory (.codi/presets/)', value: 'dir' },
      { title: 'ZIP package', value: 'zip' },
      { title: 'GitHub repository scaffold', value: 'github' },
    ],
  });

  const result: PresetWizardResult = {
    name: identity.name as string,
    description: (identity.description as string) ?? '',
    version: (identity.version as string) ?? '1.0.0',
    extends: baseChoice.extends || undefined,
    tags: ((identity.tags as string) ?? '').split(',').map((t: string) => t.trim()).filter(Boolean),
    rules: (ruleSelection.rules as string[]) ?? [],
    skills: (skillSelection.skills as string[]) ?? [],
    agents: (agentSelection.agents as string[]) ?? [],
    outputFormat: (formatChoice.format as 'dir' | 'zip' | 'github') ?? 'dir',
  };

  // Create the preset
  await scaffoldPreset(projectRoot, result);

  return result;
}

async function scaffoldPreset(projectRoot: string, config: PresetWizardResult): Promise<void> {
  const log = Logger.getInstance();
  const codiDir = resolveCodiDir(projectRoot);
  const presetDir = path.join(codiDir, 'presets', config.name);

  // Create directory structure
  await fs.mkdir(presetDir, { recursive: true });
  for (const sub of ARTIFACT_TYPES) {
    await fs.mkdir(path.join(presetDir, sub), { recursive: true });
  }

  // Write manifest
  const manifest: Record<string, unknown> = {
    name: config.name,
    description: config.description,
    version: config.version,
  };
  if (config.extends) manifest['extends'] = config.extends;
  if (config.tags.length > 0) manifest['tags'] = config.tags;

  await fs.writeFile(
    path.join(presetDir, PRESET_MANIFEST_FILENAME),
    stringifyYaml(manifest),
    'utf8',
  );

  log.info(`Created preset scaffold at .codi/presets/${config.name}/`);
  log.info(`  Rules: ${config.rules.length}, Skills: ${config.skills.length}, Agents: ${config.agents.length}`);

  // Handle output format
  if (config.outputFormat === 'zip') {
    const zipResult = await createPresetZip(presetDir, '.');
    if (zipResult.ok) {
      log.info(`Exported to ${zipResult.data.outputPath}`);
    } else {
      log.info('Failed to create ZIP. You can export later with: codi preset export');
    }
  } else if (config.outputFormat === 'github') {
    log.info('');
    log.info('To create a GitHub repository:');
    log.info(`  1. Copy .codi/presets/${config.name}/ to a new directory`);
    log.info('  2. Run: git init && git add . && git commit -m "Initial preset"');
    log.info('  3. Push to GitHub');
    log.info(`  4. Others install with: codi preset install github:org/${config.name}`);
  }

  log.info('');
  log.info(`Validate with: codi preset validate ${config.name}`);
}
