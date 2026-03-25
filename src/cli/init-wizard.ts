import prompts from 'prompts';
import type { PresetName } from '../core/flags/flag-presets.js';
import { PRESET_DESCRIPTIONS } from '../core/flags/flag-presets.js';
import { Logger } from '../core/output/logger.js';
import { DEFAULT_PRESET } from '../constants.js';
import { AVAILABLE_AGENT_TEMPLATES } from '../core/scaffolder/agent-template-loader.js';
import { AVAILABLE_COMMAND_TEMPLATES } from '../core/scaffolder/command-template-loader.js';

export interface WizardResult {
  agents: string[];
  rules: string[];
  skills: string[];
  agentTemplates: string[];
  commandTemplates: string[];
  preset: PresetName;
  versionPin: boolean;
}

const AVAILABLE_RULES = [
  { value: 'security', title: 'Security', description: 'Secret management, input validation, OWASP, dependencies' },
  { value: 'code-style', title: 'Code style', description: 'Naming conventions, function size, file organization' },
  { value: 'testing', title: 'Testing', description: 'TDD workflow, 80% coverage, AAA pattern, mocking guidelines' },
  { value: 'architecture', title: 'Architecture', description: 'Module design, dependency direction, SOLID principles' },
  { value: 'git-workflow', title: 'Git workflow', description: 'Conventional commits, atomic commits, branch strategy' },
  { value: 'error-handling', title: 'Error handling', description: 'Typed errors, logging, resilience, cleanup' },
  { value: 'performance', title: 'Performance', description: 'N+1 prevention, caching, async patterns, pagination' },
  { value: 'documentation', title: 'Documentation', description: 'API docs, README maintenance, ADRs, code comments' },
  { value: 'api-design', title: 'API design', description: 'REST conventions, versioning, pagination, rate limiting' },
];

const AVAILABLE_SKILLS = [
  { value: 'mcp', title: 'MCP', description: 'Model Context Protocol integration skill' },
  { value: 'code-review', title: 'Code review', description: 'Automated code review and feedback' },
  { value: 'documentation', title: 'Documentation', description: 'Documentation generation and maintenance' },
  { value: 'codi-operations', title: 'Codi operations', description: 'Manage all codi artifacts, configuration, verification, and troubleshooting' },
  { value: 'e2e-testing', title: 'E2E testing', description: 'Testing guide for validating codi installation' },
];

export async function runInitWizard(
  detectedStack: string[],
  detectedAgents: string[],
  allAgents: string[],
): Promise<WizardResult | null> {
  const stackLabel = detectedStack.length > 0
    ? detectedStack.join(', ')
    : 'none detected';

  Logger.getInstance().info(`Detected stack: ${stackLabel}`);

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
      type: 'multiselect',
      name: 'skills',
      message: 'Include skills',
      choices: AVAILABLE_SKILLS.map((s) => ({ ...s, selected: false })),
      hint: '- Space to toggle, Enter to confirm',
    },
    {
      type: 'multiselect',
      name: 'agentTemplates',
      message: 'Include agent definitions (sub-agents for specialized tasks)',
      choices: AVAILABLE_AGENT_TEMPLATES.map((t) => ({
        title: t,
        value: t,
        selected: true,
      })),
      hint: '- Space to toggle, Enter to confirm',
    },
    {
      type: 'multiselect',
      name: 'commandTemplates',
      message: 'Include commands (slash-command triggers)',
      choices: AVAILABLE_COMMAND_TEMPLATES.map((t) => ({
        title: t,
        value: t,
        selected: true,
      })),
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
    skills: (response.skills ?? []) as string[],
    agentTemplates: (response.agentTemplates ?? []) as string[],
    commandTemplates: (response.commandTemplates ?? []) as string[],
    preset: (response.preset ?? DEFAULT_PRESET) as PresetName,
    versionPin: response.versionPin ?? true,
  };
}
