import type { MANAGED_BY_VALUES } from "../constants.js";
import type { ResolvedFlags } from "./flags.js";

/**
 * Whether this artifact is managed by Codi (from a preset) or by the user directly.
 *
 * - `"codi"` — preset-managed; manual edits will be overwritten on `codi update`.
 * - `"user"` — user-managed; Codi will never overwrite this artifact.
 */
export type ManagedBy = (typeof MANAGED_BY_VALUES)[number];

/**
 * The parsed contents of a project's `codi.yaml` manifest file.
 *
 * This is the primary project configuration document. It lives at `.codi/codi.yaml`
 * and controls which agents are targeted, which layers are active, and which presets
 * are installed.
 */
export interface ProjectManifest {
  /** The project name used as the base for generated artifact names. */
  name: string;
  /** Schema version — always `"1"`. Reserved for future migrations. */
  version: "1";
  /** Optional human-readable description of this project. */
  description?: string;
  /** Free-form markdown injected verbatim into the AI instruction file. */
  project_context?: string;
  /**
   * Subset of agent ids to generate configuration for.
   * Omit to generate for all agents detected in the project.
   *
   * @example `["claude-code", "cursor"]`
   */
  agents?: string[];
  /**
   * Controls which artifact layers Codi generates.
   * All layers default to enabled when omitted.
   */
  layers?: {
    /** Whether to generate rule files. Defaults to `true`. */
    rules?: boolean;
    /** Whether to generate skill files. Defaults to `true`. */
    skills?: boolean;
    /** Whether to generate agent files. Defaults to `true`. */
    agents?: boolean;
    /** Whether to generate context files. Defaults to `true`. */
    context?: boolean;
  };
  /** Minimum Codi engine version required to use this configuration. */
  engine?: {
    /** Semver range string (e.g. `">=2.0.0"`). */
    requiredVersion?: string;
  };
  /**
   * Custom preset registry for `codi preset install`.
   * When set, Codi fetches preset metadata from this GitHub repository instead of
   * the default upstream registry.
   */
  presetRegistry?: {
    /** GitHub repository URL for the custom registry. */
    url: string;
    /** Branch to read preset metadata from. Defaults to `"main"`. */
    branch: string;
  };
  /**
   * Names of presets currently installed in this project.
   * Populated automatically by `codi preset install`.
   */
  presets?: string[];
}

/**
 * A fully normalized rule, ready for generation by any adapter.
 *
 * Produced by the config parser after reading a `.codi/rules/<name>.md` file
 * and validating its frontmatter.
 */
export interface NormalizedRule {
  /** Unique kebab-case rule identifier (e.g. `"codi-typescript"`). */
  name: string;
  /** Human-readable description of what this rule enforces. */
  description: string;
  /** Monotonically increasing schema version number. */
  version: number;
  /** The full Markdown body of the rule (content after frontmatter). */
  content: string;
  /**
   * Optional language hint (e.g. `"typescript"`, `"python"`).
   * Adapters may use this to produce path-scoped rules.
   */
  language?: string;
  /** Injection priority: `"high"` rules appear first, `"low"` rules appear last. */
  priority: "high" | "medium" | "low";
  /**
   * File glob patterns that restrict this rule to matching files only.
   * When set, the rule is not injected for files that don't match.
   */
  scope?: string[];
  /** When `true`, the rule is injected unconditionally into every agent context. */
  alwaysApply: boolean;
  /** Ownership: `"codi"` means preset-managed; `"user"` means user-managed. */
  managedBy: ManagedBy;
}

/**
 * A fully normalized skill, ready for generation by any adapter.
 *
 * Produced by the config parser after reading a `.codi/skills/<name>/SKILL.md` file.
 */
export interface NormalizedSkill {
  /** Unique kebab-case skill identifier. */
  name: string;
  /** Human-readable description shown in skill routing tables. */
  description: string;
  /** Monotonically increasing schema version number. */
  version: number;
  /** The full Markdown body of the skill. */
  content: string;
  /** Agent platform ids this skill targets (e.g. `["claude-code"]`). Omit for all platforms. */
  compatibility?: string[];
  /** Allowed tool names the skill may use. */
  tools?: string[];
  /** When `true`, the skill runs as a pure tool execution with no LLM call. */
  disableModelInvocation?: boolean;
  /** Hint shown to users when invoking: `/skill-name <hint>`. */
  argumentHint?: string;
  /** Tool names that are explicitly allowed for this skill. */
  allowedTools?: string[];
  /** Skill category for routing and discovery (e.g. `"engineering"`, `"content"`). */
  category?: string;
  /** SPDX license identifier for this skill (e.g. `"MIT"`). */
  license?: string;
  /** Arbitrary key-value metadata attached to this skill. */
  metadata?: Record<string, string>;
  /** Ownership: `"codi"` means preset-managed; `"user"` means user-managed. */
  managedBy?: ManagedBy;
  /** Model identifier override (e.g. `"claude-opus-4-5"`). Omit to use the agent default. */
  model?: string;
  /** Model effort tier. `"low"` uses faster/cheaper models; `"max"` uses highest capability. */
  effort?: "low" | "medium" | "high" | "max";
  /**
   * When set to `"fork"`, the skill runs in an isolated Claude Code subagent context.
   * The subagent inherits the project context but runs in its own session.
   */
  context?: "fork";
  /** Name of a registered Codi agent to run this skill as. */
  agent?: string;
  /** When `true`, users can invoke this skill via the `/skill-name` slash command. */
  userInvocable?: boolean;
  /** File glob patterns the skill is allowed to read or write. */
  paths?: string[];
  /** Shell interpreter for script-type skills. */
  shell?: "bash" | "powershell";
  /** Hook configuration for this skill. */
  hooks?: unknown;
}

/**
 * A fully normalized agent definition, ready for generation.
 *
 * Produced by the config parser after reading a `.codi/agents/<name>.md` file.
 */
export interface NormalizedAgent {
  /** Unique kebab-case agent identifier. */
  name: string;
  /** Human-readable description of what this agent does. */
  description: string;
  /** Monotonically increasing schema version number. */
  version: number;
  /** The full Markdown body (system prompt) of the agent. */
  content: string;
  /** Allowed tool names for this agent. */
  tools?: string[];
  /** Tool names explicitly disallowed for this agent. */
  disallowedTools?: string[];
  /** Model identifier override. Omit to use the platform default. */
  model?: string;
  /** Maximum number of agentic turns before the agent stops. */
  maxTurns?: number;
  /** Model effort tier. */
  effort?: "low" | "medium" | "high" | "max";
  /** Ownership. */
  managedBy?: ManagedBy;
  // Claude Code-specific agent fields
  /**
   * Claude Code tool access scope.
   * - `"unrestricted"` — all tools allowed
   * - `"readonly"` — only read operations
   * - `"limited"` — a curated subset of tools
   */
  permissionMode?: "unrestricted" | "readonly" | "limited";
  /** MCP server names to attach from the project's `mcp.yaml`. */
  mcpServers?: string[];
  /** Skill names this agent has access to. */
  skills?: string[];
  /**
   * Memory scope for this agent.
   * - `"user"` — user-level memory persists across projects
   * - `"project"` — project-level memory persists within this project
   * - `"none"` — no persistent memory
   */
  memory?: "user" | "project" | "none";
  /** When `true`, this agent runs as a background process. */
  background?: boolean;
  /** Run this agent in an isolated git worktree copy when set to `"worktree"`. */
  isolation?: string;
  /** Color label shown in the Claude Code UI for this agent. */
  color?: string;
}

/**
 * The parsed MCP server configuration from `.codi/mcp.yaml`.
 */
export interface McpConfig {
  /**
   * Map of server name to server configuration.
   * Keys are the MCP server identifiers referenced in agent frontmatter `mcpServers`.
   */
  servers: Record<
    string,
    {
      /** Transport type. `"stdio"` launches a local process; `"http"` connects to a URL. */
      type?: "stdio" | "http";
      /** Command to execute for `stdio` servers (e.g. `"npx"`). */
      command?: string;
      /** Arguments passed to the command for `stdio` servers. */
      args?: string[];
      /** Environment variables injected into the server process for `stdio` servers. */
      env?: Record<string, string>;
      /** HTTP endpoint URL for `http` servers. */
      url?: string;
      /** HTTP headers sent with each request to an `http` server. */
      headers?: Record<string, string>;
      /** When `false`, this server is excluded from generation. Defaults to `true`. */
      enabled?: boolean;
    }
  >;
}

/**
 * The fully resolved project configuration, produced by `resolveConfig()`.
 *
 * This is the single object passed to every adapter's `generate()` method.
 */
export interface NormalizedConfig {
  /** Parsed project manifest. */
  manifest: ProjectManifest;
  /** All active rules in priority order. */
  rules: NormalizedRule[];
  /** All active skills. */
  skills: NormalizedSkill[];
  /** All active agent definitions. */
  agents: NormalizedAgent[];
  /** Resolved flag values with source tracking. */
  flags: ResolvedFlags;
  /** Parsed MCP server configuration. */
  mcp: McpConfig;
}
