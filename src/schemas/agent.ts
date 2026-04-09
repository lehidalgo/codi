import { z } from "zod";
import {
  MAX_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  NAME_PATTERN_STRICT,
  MANAGED_BY_VALUES,
} from "../constants.js";

/**
 * Validates the YAML frontmatter of a `.codi/agents/<name>.md` file.
 *
 * Agent definitions are sub-agents that can be invoked during skill execution.
 * Each agent has a system prompt (the Markdown body) and frontmatter that controls
 * its behavior, tool access, and model settings.
 */
export const AgentFrontmatterSchema = z.object({
  name: z
    .string()
    .regex(NAME_PATTERN_STRICT)
    .max(MAX_NAME_LENGTH)
    .describe(
      "Unique agent name in kebab-case, starting with a letter (e.g. 'codi-reviewer'). Must match the filename.",
    ),
  description: z
    .string()
    .max(MAX_DESCRIPTION_LENGTH)
    .default("")
    .describe("Human-readable description of what this agent does and when to invoke it."),
  version: z
    .number()
    .int()
    .positive()
    .default(1)
    .describe("Monotonically increasing schema version."),
  tools: z
    .array(z.string())
    .optional()
    .describe("Tool names this agent is explicitly allowed to use."),
  disallowedTools: z
    .array(z.string())
    .optional()
    .describe("Tool names this agent is explicitly forbidden from using."),
  model: z
    .string()
    .optional()
    .describe(
      "Model identifier override (e.g. 'claude-opus-4-5'). Omit to use the platform default.",
    ),
  maxTurns: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Maximum number of agentic turns before this agent stops automatically."),
  effort: z
    .enum(["low", "medium", "high", "max"])
    .optional()
    .describe(
      "Model effort tier: 'low' uses faster/cheaper models; 'max' uses highest capability.",
    ),
  managed_by: z
    .enum(MANAGED_BY_VALUES)
    .default("user")
    .describe("Ownership: 'codi' means preset-managed; 'user' means user-managed."),
  // Claude Code-specific agent fields
  permissionMode: z
    .enum(["unrestricted", "readonly", "limited"])
    .optional()
    .describe(
      "Claude Code tool access scope: 'unrestricted' allows all tools; 'readonly' allows only read operations; 'limited' allows a curated subset.",
    ),
  mcpServers: z
    .array(z.string())
    .optional()
    .describe("MCP server names to attach to this agent, referenced from the project's mcp.yaml."),
  skills: z
    .array(z.string())
    .optional()
    .describe("Skill names this agent has access to during its session."),
  memory: z
    .enum(["user", "project", "none"])
    .optional()
    .describe(
      "Memory scope: 'user' persists across projects; 'project' persists within this project; 'none' disables persistent memory.",
    ),
  background: z
    .boolean()
    .optional()
    .describe("When true, this agent runs as a background process without blocking the terminal."),
  isolation: z
    .string()
    .optional()
    .describe(
      "When set to 'worktree', the agent runs in an isolated git worktree copy of the project.",
    ),
  color: z
    .string()
    .optional()
    .describe("Color label displayed in the Claude Code UI for this agent (e.g. 'blue', 'red')."),
});

export type AgentFrontmatterInput = z.input<typeof AgentFrontmatterSchema>;
export type AgentFrontmatterOutput = z.output<typeof AgentFrontmatterSchema>;
