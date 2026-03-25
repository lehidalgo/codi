import { AVAILABLE_TEMPLATES } from '../scaffolder/template-loader.js';
import { AVAILABLE_SKILL_TEMPLATES } from '../scaffolder/skill-template-loader.js';
import { AVAILABLE_AGENT_TEMPLATES } from '../scaffolder/agent-template-loader.js';
import { AVAILABLE_COMMAND_TEMPLATES } from '../scaffolder/command-template-loader.js';
import { FLAG_CATALOG } from '../flags/flag-catalog.js';
import { ERROR_CATALOG } from '../output/error-catalog.js';
import { PRESET_NAMES } from '../../constants.js';

/** CLI commands registered in src/cli.ts — update when adding commands. */
export const CLI_COMMANDS = [
  'init', 'generate', 'validate', 'status', 'add', 'verify', 'doctor',
  'update', 'clean', 'compliance', 'ci', 'watch', 'revert',
  'marketplace', 'preset', 'docs-update', 'contribute',
] as const;

/** Supported agent adapters — update when adding adapters. */
export const ADAPTER_NAMES = [
  'claude-code', 'cursor', 'codex', 'windsurf', 'cline',
] as const;

export interface ProjectStats {
  rules: { count: number; names: string[] };
  skills: { count: number; names: string[] };
  agents: { count: number; names: string[] };
  commands: { count: number; names: string[] };
  flags: { count: number; names: string[] };
  presets: { count: number; names: string[] };
  errorCodes: number;
  cliCommands: number;
  adapters: number;
}

export function collectStats(): ProjectStats {
  return {
    rules: { count: AVAILABLE_TEMPLATES.length, names: [...AVAILABLE_TEMPLATES] },
    skills: { count: AVAILABLE_SKILL_TEMPLATES.length, names: [...AVAILABLE_SKILL_TEMPLATES] },
    agents: { count: AVAILABLE_AGENT_TEMPLATES.length, names: [...AVAILABLE_AGENT_TEMPLATES] },
    commands: { count: AVAILABLE_COMMAND_TEMPLATES.length, names: [...AVAILABLE_COMMAND_TEMPLATES] },
    flags: { count: Object.keys(FLAG_CATALOG).length, names: Object.keys(FLAG_CATALOG) },
    presets: { count: PRESET_NAMES.length, names: [...PRESET_NAMES] },
    errorCodes: Object.keys(ERROR_CATALOG).length,
    cliCommands: CLI_COMMANDS.length,
    adapters: ADAPTER_NAMES.length,
  };
}
