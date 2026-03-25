import prompts from 'prompts';
import type { PresetName } from '../core/flags/flag-presets.js';
import { PRESET_DESCRIPTIONS } from '../core/flags/flag-presets.js';
import { Logger } from '../core/output/logger.js';
import { DEFAULT_PRESET } from '../constants.js';
import { AVAILABLE_TEMPLATES } from '../core/scaffolder/template-loader.js';
import { AVAILABLE_SKILL_TEMPLATES } from '../core/scaffolder/skill-template-loader.js';
import { AVAILABLE_AGENT_TEMPLATES } from '../core/scaffolder/agent-template-loader.js';
import { AVAILABLE_COMMAND_TEMPLATES } from '../core/scaffolder/command-template-loader.js';

export interface WizardResult {
  agents: string[];
  configMode: 'preset' | 'custom';
  presetName?: string;
  rules: string[];
  skills: string[];
  agentTemplates: string[];
  commandTemplates: string[];
  preset: PresetName;
  versionPin: boolean;
}

const BUILTIN_PRESET_CHOICES = [
  { title: 'Balanced (recommended)', value: 'balanced', description: PRESET_DESCRIPTIONS.balanced },
  { title: 'Minimal', value: 'minimal', description: PRESET_DESCRIPTIONS.minimal },
  { title: 'Strict', value: 'strict', description: PRESET_DESCRIPTIONS.strict },
  { title: 'Python Web', value: 'python-web', description: 'Python web dev with Django/FastAPI, security, testing' },
  { title: 'TypeScript Fullstack', value: 'typescript-fullstack', description: 'TypeScript + React/Next.js, strict typing, CI' },
  { title: 'Security Hardened', value: 'security-hardened', description: 'Maximum security, locked flags, restricted ops' },
];

function buildSearchableChoices(templates: readonly string[], selectedByDefault: boolean) {
  return templates.map((t) => ({ title: t, value: t, selected: selectedByDefault }));
}

export async function runInitWizard(
  detectedStack: string[],
  detectedAgents: string[],
  allAgents: string[],
): Promise<WizardResult | null> {
  const log = Logger.getInstance();
  const stackLabel = detectedStack.length > 0 ? detectedStack.join(', ') : 'none detected';
  log.info(`Detected stack: ${stackLabel}`);

  // Step 1: Select IDE agents
  const agentResponse = await prompts({
    type: 'multiselect',
    name: 'agents',
    message: 'Select agents to generate config for',
    choices: allAgents.map((id) => ({
      title: id,
      value: id,
      selected: detectedAgents.includes(id),
    })),
    min: 1,
    hint: '- Space to select, Enter to confirm',
  }, { onCancel: () => false });

  if (!agentResponse.agents || agentResponse.agents.length === 0) return null;

  // Step 2: Choose configuration mode
  const modeResponse = await prompts({
    type: 'select',
    name: 'configMode',
    message: 'How do you want to configure?',
    choices: [
      { title: 'Use a built-in preset', value: 'preset', description: 'Curated configuration bundles' },
      { title: 'Custom selection', value: 'custom', description: 'Pick individual artifacts (searchable)' },
    ],
    initial: 0,
  }, { onCancel: () => false });

  if (!modeResponse.configMode) return null;

  // Step 3a: Built-in preset path
  if (modeResponse.configMode === 'preset') {
    const presetResponse = await prompts({
      type: 'select',
      name: 'presetName',
      message: 'Choose a preset',
      choices: BUILTIN_PRESET_CHOICES,
      initial: 0,
    }, { onCancel: () => false });

    if (!presetResponse.presetName) return null;

    const flagPreset = getBasePreset(presetResponse.presetName as string);

    const pinResponse = await prompts({
      type: 'confirm',
      name: 'versionPin',
      message: 'Enable version pinning?',
      initial: true,
    }, { onCancel: () => false });

    return {
      agents: agentResponse.agents as string[],
      configMode: 'preset',
      presetName: presetResponse.presetName as string,
      rules: [],
      skills: [],
      agentTemplates: [],
      commandTemplates: [],
      preset: flagPreset,
      versionPin: pinResponse.versionPin ?? true,
    };
  }

  // Step 3b: Custom selection path (searchable)
  const ruleResponse = await prompts({
    type: 'autocompleteMultiselect',
    name: 'rules',
    message: 'Select rules (type to search)',
    choices: buildSearchableChoices(AVAILABLE_TEMPLATES, true),
    hint: '- Type to filter, Space to toggle, Enter to confirm',
  }, { onCancel: () => false });

  const skillResponse = await prompts({
    type: 'autocompleteMultiselect',
    name: 'skills',
    message: 'Select skills (type to search)',
    choices: buildSearchableChoices(AVAILABLE_SKILL_TEMPLATES, false),
    hint: '- Type to filter, Space to toggle, Enter to confirm',
  }, { onCancel: () => false });

  const agentDefResponse = await prompts({
    type: 'autocompleteMultiselect',
    name: 'agentTemplates',
    message: 'Select agent definitions (type to search)',
    choices: buildSearchableChoices(AVAILABLE_AGENT_TEMPLATES, true),
    hint: '- Type to filter, Space to toggle, Enter to confirm',
  }, { onCancel: () => false });

  const cmdResponse = await prompts({
    type: 'autocompleteMultiselect',
    name: 'commandTemplates',
    message: 'Select commands (type to search)',
    choices: buildSearchableChoices(AVAILABLE_COMMAND_TEMPLATES, true),
    hint: '- Type to filter, Space to toggle, Enter to confirm',
  }, { onCancel: () => false });

  const flagResponse = await prompts({
    type: 'select',
    name: 'preset',
    message: 'Choose flag preset',
    choices: [
      { title: 'Balanced (recommended)', value: 'balanced', description: PRESET_DESCRIPTIONS.balanced },
      { title: 'Minimal', value: 'minimal', description: PRESET_DESCRIPTIONS.minimal },
      { title: 'Strict', value: 'strict', description: PRESET_DESCRIPTIONS.strict },
    ],
    initial: 0,
  }, { onCancel: () => false });

  const pinResponse = await prompts({
    type: 'confirm',
    name: 'versionPin',
    message: 'Enable version pinning?',
    initial: true,
  }, { onCancel: () => false });

  return {
    agents: agentResponse.agents as string[],
    configMode: 'custom',
    rules: (ruleResponse.rules ?? []) as string[],
    skills: (skillResponse.skills ?? []) as string[],
    agentTemplates: (agentDefResponse.agentTemplates ?? []) as string[],
    commandTemplates: (cmdResponse.commandTemplates ?? []) as string[],
    preset: (flagResponse.preset ?? DEFAULT_PRESET) as PresetName,
    versionPin: pinResponse.versionPin ?? true,
  };
}

/**
 * Maps full preset names to their base flag preset.
 * python-web extends balanced, security-hardened extends strict, etc.
 */
function getBasePreset(name: string): PresetName {
  switch (name) {
    case 'minimal':
    case 'balanced':
    case 'strict':
      return name;
    case 'python-web':
    case 'typescript-fullstack':
      return 'balanced';
    case 'security-hardened':
      return 'strict';
    default:
      return 'balanced';
  }
}
