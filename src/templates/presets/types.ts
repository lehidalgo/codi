import type { FlagDefinition } from '../../types/flags.js';

/**
 * Definition of a built-in preset that ships with the CODI npm package.
 * References rule/skill/agent template names rather than inline content.
 */
export interface BuiltinPresetDefinition {
  name: string;
  description: string;
  version: string;
  author: string;
  tags: string[];
  compatibility: {
    codi?: string;
    agents?: string[];
  };
  flags: Record<string, FlagDefinition>;
  /** Rule template names to include (from src/templates/rules/) */
  rules: string[];
  /** Skill template names to include (from src/templates/skills/) */
  skills: string[];
  /** Agent template names to include (from src/templates/agents/) */
  agents: string[];
  /** Command template names to include (from src/templates/commands/) */
  commands: string[];
}
