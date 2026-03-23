import prompts from 'prompts';
import type { PresetName } from '../core/flags/flag-presets.js';
import { PRESET_DESCRIPTIONS } from '../core/flags/flag-presets.js';

export interface WizardResult {
  agents: string[];
  rules: string[];
  preset: PresetName;
  versionPin: boolean;
}

const AVAILABLE_RULES = [
  { value: 'security', title: 'Security', description: 'OWASP guidelines, secrets, input validation' },
  { value: 'code-style', title: 'Code style', description: 'Naming, small functions, self-documenting code' },
  { value: 'testing', title: 'Testing', description: '80% coverage, descriptive names, arrange-act-assert' },
  { value: 'architecture', title: 'Architecture', description: 'Design patterns, composition, file structure' },
];

export async function runInitWizard(
  detectedStack: string[],
  detectedAgents: string[],
  allAgents: string[],
): Promise<WizardResult | null> {
  const stackLabel = detectedStack.length > 0
    ? detectedStack.join(', ')
    : 'none detected';

  console.log(`\n  Detected stack: ${stackLabel}\n`);

  const agentChoices = allAgents.map((id) => ({
    title: id,
    value: id,
    selected: detectedAgents.includes(id),
  }));

  const response = await prompts([
    {
      type: 'multiselect',
      name: 'agents',
      message: 'Select agents to generate config for',
      choices: agentChoices,
      min: 1,
      hint: '- Space to select, Enter to confirm',
    },
    {
      type: 'multiselect',
      name: 'rules',
      message: 'Include rules',
      choices: AVAILABLE_RULES.map((r) => ({ ...r, selected: true })),
      hint: '- Space to toggle, Enter to confirm',
    },
    {
      type: 'select',
      name: 'preset',
      message: 'Choose flag preset',
      choices: [
        { title: 'Balanced (recommended)', value: 'balanced', description: PRESET_DESCRIPTIONS.balanced },
        { title: 'Minimal', value: 'minimal', description: PRESET_DESCRIPTIONS.minimal },
        { title: 'Strict', value: 'strict', description: PRESET_DESCRIPTIONS.strict },
      ],
      initial: 0,
    },
    {
      type: 'confirm',
      name: 'versionPin',
      message: 'Enable version pinning?',
      initial: true,
    },
  ], {
    onCancel: () => {
      return false;
    },
  });

  if (!response.agents || response.agents.length === 0) {
    return null;
  }

  return {
    agents: response.agents as string[],
    rules: (response.rules ?? []) as string[],
    preset: (response.preset ?? 'balanced') as PresetName,
    versionPin: response.versionPin ?? true,
  };
}
