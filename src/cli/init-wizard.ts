import * as p from '@clack/prompts';
import type { PresetName } from '../core/flags/flag-presets.js';
import { PRESET_DESCRIPTIONS, getPresetNames } from '../core/flags/flag-presets.js';
import { DEFAULT_PRESET } from '../constants.js';
import { getBuiltinPresetDefinition, BUILTIN_PRESETS } from '../templates/presets/index.js';
import { AVAILABLE_TEMPLATES } from '../core/scaffolder/template-loader.js';
import { AVAILABLE_SKILL_TEMPLATES } from '../core/scaffolder/skill-template-loader.js';
import { AVAILABLE_AGENT_TEMPLATES } from '../core/scaffolder/agent-template-loader.js';
import { AVAILABLE_COMMAND_TEMPLATES } from '../core/scaffolder/command-template-loader.js';

export interface WizardResult {
  agents: string[];
  configMode: 'preset' | 'custom' | 'zip' | 'github';
  presetName?: string;
  selectedPresetName?: string;
  importSource?: string;
  saveAsPreset?: string;
  rules: string[];
  skills: string[];
  agentTemplates: string[];
  commandTemplates: string[];
  preset: PresetName;
  versionPin: boolean;
}

function getReservedPresetNames(): Set<string> {
  const basePresets = Object.keys(PRESET_DESCRIPTIONS);
  const extendedPresets = Object.keys(BUILTIN_PRESETS);
  return new Set([...basePresets, ...extendedPresets]);
}

function formatLabel(name: string): string {
  return name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function buildPresetOptions(): Array<{ label: string; value: string; hint: string }> {
  // Base presets from flag system (minimal, balanced, strict)
  const baseOptions = Object.entries(PRESET_DESCRIPTIONS).map(([name, desc]) => ({
    label: name === DEFAULT_PRESET ? `${formatLabel(name)} (recommended)` : formatLabel(name),
    value: name,
    hint: desc,
  }));

  // Extended presets from template bundles (python-web, typescript-fullstack, etc.)
  const extendedOptions = Object.entries(BUILTIN_PRESETS).map(([name, def]) => ({
    label: formatLabel(name),
    value: name,
    hint: def.description,
  }));

  return [...baseOptions, ...extendedOptions];
}

export async function runInitWizard(
  detectedStack: string[],
  detectedAgents: string[],
  allAgents: string[],
): Promise<WizardResult | null> {
  p.intro('codi — Project Setup');

  p.note(
    [
      'space        toggle selection',
      'a            select / deselect all',
      'arrow keys   move up / down',
      'enter        confirm',
      'ctrl+c       cancel',
    ].join('\n'),
    'Keyboard shortcuts',
  );

  const stackLabel = detectedStack.length > 0 ? detectedStack.join(', ') : 'none detected';
  p.log.step(`Detected stack: ${stackLabel}`);

  // Step 1: Select IDE agents
  p.log.step('Agents');
  const agents = await p.multiselect({
    message: 'Select agents to generate config for',
    options: allAgents.map((id) => ({ label: id, value: id })),
    initialValues: detectedAgents,
    required: true,
  });

  if (p.isCancel(agents)) {
    p.cancel('Operation cancelled.');
    return null;
  }

  if (agents.length === 0) return null;

  // Step 2: Choose configuration mode
  p.log.step('Configuration');
  const configMode = await p.select({
    message: 'How do you want to configure?',
    options: [
      { label: 'Use a built-in preset', value: 'preset' as const, hint: 'Curated configuration bundles' },
      { label: 'Import from ZIP file', value: 'zip' as const, hint: 'Load a preset from a .zip package' },
      { label: 'Import from GitHub', value: 'github' as const, hint: 'Load a preset from a GitHub repository' },
      { label: 'Custom selection', value: 'custom' as const, hint: 'Pick individual artifacts (searchable)' },
    ],
  });

  if (p.isCancel(configMode)) {
    p.cancel('Operation cancelled.');
    return null;
  }

  // Step 3: Import from ZIP
  if (configMode === 'zip') {
    const zipPath = await p.text({
      message: 'Path to preset ZIP file',
      validate: (v) => {
        if (!v || !v.endsWith('.zip')) return 'Must be a .zip file';
      },
    });

    if (p.isCancel(zipPath)) {
      p.cancel('Operation cancelled.');
      return null;
    }

    p.outro('Importing preset from ZIP.');
    return {
      agents,
      configMode: 'zip' as const,
      importSource: zipPath,
      rules: [], skills: [], agentTemplates: [], commandTemplates: [],
      preset: DEFAULT_PRESET as PresetName,
      versionPin: true,
    };
  }

  // Step 3: Import from GitHub
  if (configMode === 'github') {
    const repo = await p.text({
      message: 'GitHub repo (e.g., org/preset-name or github:org/repo@v1.0)',
    });

    if (p.isCancel(repo)) {
      p.cancel('Operation cancelled.');
      return null;
    }

    p.outro('Importing preset from GitHub.');
    return {
      agents,
      configMode: 'github' as const,
      importSource: repo,
      rules: [], skills: [], agentTemplates: [], commandTemplates: [],
      preset: DEFAULT_PRESET as PresetName,
      versionPin: true,
    };
  }

  // Step 3a: Built-in preset path — show artifacts, editable
  if (configMode === 'preset') {
    return handlePresetPath(agents);
  }

  // Step 3b: Custom selection path
  return handleCustomPath(agents);
}

async function handlePresetPath(agents: string[]): Promise<WizardResult | null> {
  const presetName = await p.select({
    message: 'Choose a preset',
    options: buildPresetOptions(),
  });

  if (p.isCancel(presetName)) {
    p.cancel('Operation cancelled.');
    return null;
  }

  const selectedPreset = presetName as string;
  const flagPreset = getBasePreset(selectedPreset);
  const presetDef = getBuiltinPresetDefinition(selectedPreset);

  // Pre-select the preset's artifacts so user can see and modify
  const presetRules = new Set(presetDef?.rules ?? []);
  const presetSkills = new Set(presetDef?.skills ?? []);
  const presetAgents = new Set(presetDef?.agents ?? []);
  const presetCommands = new Set(presetDef?.commands ?? []);

  p.log.step(`Artifacts in "${selectedPreset}" (modify to customize)`);

  const userRules = await p.multiselect({
    message: 'Rules',
    options: AVAILABLE_TEMPLATES.map(t => ({ label: t, value: t })),
    initialValues: AVAILABLE_TEMPLATES.filter(t => presetRules.has(t)),
    required: false,
  });
  if (p.isCancel(userRules)) { p.cancel('Operation cancelled.'); return null; }

  const userSkills = await p.multiselect({
    message: 'Skills',
    options: AVAILABLE_SKILL_TEMPLATES.map(t => ({ label: t, value: t })),
    initialValues: AVAILABLE_SKILL_TEMPLATES.filter(t => presetSkills.has(t)),
    required: false,
  });
  if (p.isCancel(userSkills)) { p.cancel('Operation cancelled.'); return null; }

  const userAgentTemplates = await p.multiselect({
    message: 'Agents',
    options: AVAILABLE_AGENT_TEMPLATES.map(t => ({ label: t, value: t })),
    initialValues: AVAILABLE_AGENT_TEMPLATES.filter(t => presetAgents.has(t)),
    required: false,
  });
  if (p.isCancel(userAgentTemplates)) { p.cancel('Operation cancelled.'); return null; }

  const userCommands = await p.multiselect({
    message: 'Commands',
    options: AVAILABLE_COMMAND_TEMPLATES.map(t => ({ label: t, value: t })),
    initialValues: AVAILABLE_COMMAND_TEMPLATES.filter(t => presetCommands.has(t)),
    required: false,
  });
  if (p.isCancel(userCommands)) { p.cancel('Operation cancelled.'); return null; }

  // Check if user modified the preset
  const changed = !sameArrays(userRules, [...presetRules])
    || !sameArrays(userSkills, [...presetSkills])
    || !sameArrays(userAgentTemplates, [...presetAgents])
    || !sameArrays(userCommands, [...presetCommands]);

  let saveAsPreset: string | undefined;
  if (changed) {
    p.log.step('Custom Preset');
    const customName = await p.text({
      message: 'You modified the preset. Save as custom preset (name)',
      initialValue: `${selectedPreset}-custom`,
      placeholder: `${selectedPreset}-custom`,
      validate: (v) => {
        if (!v || !/^[a-z][a-z0-9-]*$/.test(v)) return 'Must be kebab-case (lowercase letters, numbers, hyphens)';
        if (getReservedPresetNames().has(v)) return `"${v}" is a built-in preset name — choose a different name`;
      },
    });
    if (p.isCancel(customName)) { p.cancel('Operation cancelled.'); return null; }
    saveAsPreset = customName;
  }

  const versionPin = await p.confirm({
    message: 'Enable version pinning?',
  });
  if (p.isCancel(versionPin)) { p.cancel('Operation cancelled.'); return null; }

  p.outro('Configuration complete.');
  return {
    agents,
    configMode: changed ? 'custom' : 'preset',
    presetName: changed ? undefined : selectedPreset,
    selectedPresetName: selectedPreset,
    saveAsPreset,
    rules: userRules,
    skills: userSkills,
    agentTemplates: userAgentTemplates,
    commandTemplates: userCommands,
    preset: flagPreset,
    versionPin,
  };
}

async function handleCustomPath(agents: string[]): Promise<WizardResult | null> {
  p.log.step('Artifacts');

  const rules = await p.multiselect({
    message: 'Select rules',
    options: AVAILABLE_TEMPLATES.map(t => ({ label: t, value: t })),
    initialValues: [...AVAILABLE_TEMPLATES],
    required: false,
  });
  if (p.isCancel(rules)) { p.cancel('Operation cancelled.'); return null; }

  const skills = await p.multiselect({
    message: 'Select skills',
    options: AVAILABLE_SKILL_TEMPLATES.map(t => ({ label: t, value: t })),
    required: false,
  });
  if (p.isCancel(skills)) { p.cancel('Operation cancelled.'); return null; }

  const agentTemplates = await p.multiselect({
    message: 'Select agent definitions',
    options: AVAILABLE_AGENT_TEMPLATES.map(t => ({ label: t, value: t })),
    initialValues: [...AVAILABLE_AGENT_TEMPLATES],
    required: false,
  });
  if (p.isCancel(agentTemplates)) { p.cancel('Operation cancelled.'); return null; }

  const commandTemplates = await p.multiselect({
    message: 'Select commands',
    options: AVAILABLE_COMMAND_TEMPLATES.map(t => ({ label: t, value: t })),
    initialValues: [...AVAILABLE_COMMAND_TEMPLATES],
    required: false,
  });
  if (p.isCancel(commandTemplates)) { p.cancel('Operation cancelled.'); return null; }

  const preset = await p.select({
    message: 'Choose flag preset',
    options: [
      { label: 'Balanced (recommended)', value: 'balanced' as const, hint: PRESET_DESCRIPTIONS.balanced },
      { label: 'Minimal', value: 'minimal' as const, hint: PRESET_DESCRIPTIONS.minimal },
      { label: 'Strict', value: 'strict' as const, hint: PRESET_DESCRIPTIONS.strict },
    ],
  });
  if (p.isCancel(preset)) { p.cancel('Operation cancelled.'); return null; }

  // Save as preset?
  const save = await p.confirm({
    message: 'Save this selection as a named preset for reuse?',
    initialValue: false,
  });
  if (p.isCancel(save)) { p.cancel('Operation cancelled.'); return null; }

  let saveAsPreset: string | undefined;
  if (save) {
    const presetNameInput = await p.text({
      message: 'Preset name (kebab-case)',
      placeholder: 'my-team-preset',
      validate: (v) => {
        if (!v || !/^[a-z][a-z0-9-]*$/.test(v)) return 'Must be kebab-case (lowercase letters, numbers, hyphens)';
        if (getReservedPresetNames().has(v)) return `"${v}" is a built-in preset name — choose a different name`;
      },
    });
    if (p.isCancel(presetNameInput)) { p.cancel('Operation cancelled.'); return null; }
    saveAsPreset = presetNameInput;
  }

  const versionPin = await p.confirm({
    message: 'Enable version pinning?',
  });
  if (p.isCancel(versionPin)) { p.cancel('Operation cancelled.'); return null; }

  p.outro('Configuration complete.');
  return {
    agents,
    configMode: 'custom',
    saveAsPreset,
    rules,
    skills,
    agentTemplates,
    commandTemplates,
    preset: (preset ?? DEFAULT_PRESET) as PresetName,
    versionPin,
  };
}

/**
 * Maps full preset names to their base flag preset.
 * python-web extends balanced, security-hardened extends strict, etc.
 */
function sameArrays(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  return b.every(item => setA.has(item));
}

function getBasePreset(name: string): PresetName {
  const baseNames = getPresetNames();
  if (baseNames.includes(name as PresetName)) return name as PresetName;

  const def = getBuiltinPresetDefinition(name);
  if (def?.extends) {
    const parent = def.extends as PresetName;
    if (baseNames.includes(parent)) return parent;
  }

  return DEFAULT_PRESET as PresetName;
}
