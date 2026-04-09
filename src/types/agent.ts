import type { NormalizedConfig } from "./config.js";

/**
 * File system paths that an adapter writes generated files to.
 *
 * Each path is relative to the project root.
 */
export interface AgentPaths {
  /** Root directory where the agent stores its configuration files. */
  configRoot: string;
  /** Directory where rule files are written. */
  rules: string;
  /** Directory where skill files are written, or null if the agent does not support skills. */
  skills: string | null;
  /** Directory where agent definition files are written, or null if not supported. */
  agents: string | null;
  /** Path to the primary instruction file consumed by the agent (e.g. CLAUDE.md). */
  instructionFile: string;
  /** Path to the MCP server configuration file, or null if MCP is not supported. */
  mcpConfig: string | null;
}

/**
 * Feature flags indicating which generation features an adapter supports.
 */
export interface AgentCapabilities {
  /** Whether the adapter can generate rule files. */
  rules: boolean;
  /** Whether the adapter can generate skill files. */
  skills: boolean;
  /** Whether the adapter supports MCP server configuration. */
  mcp: boolean;
  /** Whether generated files include YAML frontmatter headers. */
  frontmatter: boolean;
  /** Whether the adapter supports progressive/lazy loading of rules. */
  progressiveLoading: boolean;
  /** Whether the adapter can generate agent definition files. */
  agents: boolean;
  /** Maximum number of context tokens the agent supports; used for size budgeting. */
  maxContextTokens: number;
}

/**
 * A single file produced by an adapter's generate() call.
 */
export interface GeneratedFile {
  /** Destination path of the file, relative to the project root. */
  path: string;
  /** Text content to write to the file. */
  content: string;
  /** List of source artifact identifiers (rules, skills, etc.) that contributed to this file. */
  sources: string[];
  /** SHA-256 hash of the file content, used for change detection. */
  hash: string;
  /** Absolute source path for binary files that must be copied as-is (not text-written). */
  binarySrc?: string;
}

/**
 * Options passed to an adapter's generate() method.
 */
export interface GenerateOptions {
  /** Subset of agent IDs to generate for; when omitted all detected agents are targeted. */
  agents?: string[];
  /** When true, compute and return files without writing them to disk. */
  dryRun?: boolean;
  /** When true, overwrite existing files even if their content is unchanged. */
  force?: boolean;
  /** Non-interactive mode: skip all conflicting files without prompting. */
  json?: boolean;
  /** Absolute path to the project root; defaults to the current working directory. */
  projectRoot?: string;
}

/**
 * The outcome of writing a single generated file.
 *
 * - "created" - file was newly created
 * - "updated" - file existed and was overwritten
 * - "unchanged" - file content was identical; no write needed
 * - "deleted" - file was removed during generation
 * - "error" - an error occurred while writing the file
 */
export type FileStatus = "created" | "updated" | "unchanged" | "deleted" | "error";

/**
 * Status report for a single generated file after a generate() call.
 */
export interface AgentFileStatus {
  /** Path of the file, relative to the project root. */
  path: string;
  /** The outcome of the write operation for this file. */
  status: FileStatus;
  /** SHA-256 hash of the file content after the operation, if available. */
  hash?: string;
}

/**
 * Summary of a completed adapter generate() call, including file counts and errors.
 */
export interface AgentStatus {
  /** Identifier of the adapter that produced this status. */
  agentId: string;
  /** Human-readable display name of the adapter. */
  agentName: string;
  /** Per-file status entries for every file touched during the generate() call. */
  files: AgentFileStatus[];
}

/**
 * The contract every adapter must implement to participate in Codi's generation pipeline.
 *
 * An adapter is responsible for translating Codi's normalized configuration into the
 * agent-specific file format and directory layout that a particular AI tool expects.
 */
export interface AgentAdapter {
  /** Unique, stable identifier for the adapter (e.g. "claude", "cursor", "windsurf"). */
  id: string;
  /** Human-readable display name for the adapter. */
  name: string;
  /**
   * Detects whether the adapter's target agent is present in the given project.
   *
   * @param projectRoot - Absolute path to the project root directory.
   * @returns A promise that resolves to true when the agent is detected.
   */
  detect(projectRoot: string): Promise<boolean>;
  /** File system paths this adapter writes generated files to. */
  paths: AgentPaths;
  /** Feature flags describing what this adapter can generate. */
  capabilities: AgentCapabilities;
  /**
   * Generates the full set of files for this adapter from the normalized configuration.
   *
   * @param config - The normalized Codi configuration for the project.
   * @param options - Generation options controlling dry-run, force-write, and scope.
   * @returns A promise resolving to the list of files that should be written to disk.
   */
  generate(config: NormalizedConfig, options: GenerateOptions): Promise<GeneratedFile[]>;
}
