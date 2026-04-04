import type { FlagDefinition } from "#src/types/flags.js";

/**
 * Definition of a built-in preset that ships with the CLI npm package.
 * References rule/skill/agent template names rather than inline content.
 */
export interface BuiltinPresetDefinition {
  name: string;
  description: string;
  version: string;
  author: string;
  tags: string[];
  compatibility: {
    engine?: string;
    agents?: string[];
  };
  flags: Record<string, FlagDefinition>;
  /** Rule template names to include (from src/templates/rules/) */
  rules: string[];
  /** Skill template names to include (from src/templates/skills/) */
  skills: string[];
  /** Agent template names to include (from src/templates/agents/) */
  agents: string[];
  /** Brand names to include (user-defined, no built-in templates) */
  brands?: string[];
  /** MCP server template names to include (from src/templates/mcp-servers/) */
  mcpServers?: string[];
}
