# JSDoc Enrichment — TypeDoc API Reference Implementation Plan

> **For agentic workers:** Use `codi-subagent-dev` (recommended) or `codi-plan-executor` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add JSDoc annotations and Zod `.describe()` calls to all public symbols across 5 modules so the TypeDoc-generated API reference becomes fully readable.

**Architecture:** Pure documentation additions — no behavioral changes. Each task enriches one module, regenerates TypeDoc, and verifies the output markdown gained description text. The "test" is a before/after grep on the generated markdown.

**Tech Stack:** TypeScript JSDoc, Zod `.describe()`, TypeDoc + typedoc-plugin-zod, `npx typedoc --skipErrorChecking`

---

## File Structure

| File | Change |
|---|---|
| `typedoc.json` | Add `src/constants.ts` as 5th entry point |
| `src/constants.ts` | JSDoc on every exported constant and function |
| `src/types/result.ts` | JSDoc on `Result<T,E>` and 4 helper functions |
| `src/types/config.ts` | JSDoc on all 7 interfaces + `ManagedBy` type |
| `src/types/flags.ts` | JSDoc on all 6 types/interfaces |
| `src/types/agent.ts` | JSDoc on all 7 interfaces/types |
| `src/schemas/manifest.ts` | JSDoc + `.describe()` on `ProjectManifestSchema` |
| `src/schemas/rule.ts` | JSDoc + `.describe()` on `RuleFrontmatterSchema` |
| `src/schemas/skill.ts` | JSDoc + `.describe()` on `SkillFrontmatterSchema` |
| `src/schemas/agent.ts` | JSDoc + `.describe()` on `AgentFrontmatterSchema` |
| `src/schemas/flag.ts` | JSDoc + `.describe()` on `FlagDefinitionSchema` |
| `src/schemas/mcp.ts` | JSDoc + `.describe()` on `McpConfigSchema` |
| `src/schemas/hooks.ts` | JSDoc + `.describe()` on `HooksConfigSchema` |
| `src/schemas/evals.ts` | JSDoc + `.describe()` on `EvalsDataSchema` / `EvalCaseSchema` |
| `src/schemas/feedback.ts` | JSDoc on `FeedbackIssueSchema` and related constants |
| `src/adapters/claude-code.ts` | JSDoc on `claudeCodeAdapter` constant |
| `src/adapters/cursor.ts` | JSDoc on `cursorAdapter` constant |
| `src/adapters/codex.ts` | JSDoc on `codexAdapter` constant |
| `src/adapters/windsurf.ts` | JSDoc on `windsurfAdapter` constant |
| `src/adapters/cline.ts` | JSDoc on `clineAdapter` constant |
| `src/adapters/index.ts` | JSDoc on `ALL_ADAPTERS` and `registerAllAdapters()` |
| `src/core/config/resolver.ts` | Enrich `resolveConfig()` JSDoc |
| `src/core/config/composer.ts` | Enrich `flagsFromDefinitions()` JSDoc |
| `src/core/config/validator.ts` | JSDoc on `validateConfig()` |
| `src/core/config/parser.ts` | JSDoc on `ParsedProjectDir`, `scanProjectDir()`, `parseManifest()` |
| `src/core/config/state.ts` | JSDoc on `StateManager` class and all public methods + state interfaces |

---

### Task 1: Add `src/constants.ts` as TypeDoc entry point and document constants

**Files**: `typedoc.json`, `src/constants.ts`
**Est**: 5 minutes

**Steps**:
- [ ] 1. Verify baseline — confirm constants module is absent from generated docs:
   ```bash
   ls docs/src/content/docs/api/
   # Expected: README.md  adapters.md  core/  schemas.md  types.md
   # No constants.md file exists
   ```
- [ ] 2. Update `typedoc.json` to add constants as 5th entry point:
   ```json
   {
     "entryPoints": [
       "./src/types/index.ts",
       "./src/schemas/index.ts",
       "./src/adapters/index.ts",
       "./src/core/config/index.ts",
       "./src/constants.ts"
     ],
     "entryPointStrategy": "resolve",
     "tsconfig": "./tsconfig.json",
     "out": "./docs/src/content/docs/api",
     "plugin": ["typedoc-plugin-markdown", "typedoc-plugin-zod"],
     "excludePrivate": true,
     "excludeInternal": true,
     "outputFileStrategy": "modules",
     "parametersFormat": "htmlTable",
     "propertyMembersFormat": "htmlTable",
     "useCodeBlocks": true,
     "skipErrorChecking": true,
     "readme": "none"
   }
   ```
- [ ] 3. Add JSDoc to `src/constants.ts`. Replace the entire file with the following (all logic unchanged, only comments added):
   ```typescript
   // Centralized constants — single source of truth for all tunable values.
   // Change a value here and it propagates to schemas, validators, scaffolders, and CLI.

   // --- Project identity ---
   /** The internal project identifier and CLI binary name (lowercase). */
   export const PROJECT_NAME = "codi";
   /** Display-friendly title-case project name for use in prose. */
   export const PROJECT_NAME_DISPLAY = "Codi";
   /** CLI binary name — identical to `PROJECT_NAME`. */
   export const PROJECT_CLI = PROJECT_NAME;
   /** The hidden config directory name (`.codi`). */
   export const PROJECT_DIR = `.${PROJECT_NAME}`;
   /** GitHub repository path in `owner/repo` format. */
   export const PROJECT_REPO = "lehidalgo/codi";
   /** Full GitHub URL for the project. */
   export const PROJECT_URL = `https://github.com/${PROJECT_REPO}`;
   /** The default remote branch used for contributions and preset sync. */
   export const PROJECT_TARGET_BRANCH = "develop";
   /** One-line project tagline used in CLI output and documentation. */
   export const PROJECT_TAGLINE = "Unified AI agent configuration";

   // --- Artifact naming ---
   /**
    * Prefix a base artifact name with the project name.
    *
    * @param base - The unprefixed artifact name (e.g. `"strict"`)
    * @returns The prefixed name (e.g. `"codi-strict"`)
    *
    * @example
    * ```ts
    * prefixedName("balanced"); // "codi-balanced"
    * ```
    */
   export function prefixedName(base: string): string {
     return `${PROJECT_NAME}-${base}`;
   }

   /**
    * Build the name for a project-development variant of an artifact.
    *
    * @param base - The base artifact name
    * @returns The dev artifact name (e.g. `"codi-brainstorming-dev"`)
    */
   export function devArtifactName(base: string): string {
     return `${PROJECT_NAME}-${base}-dev`;
   }

   /**
    * Resolve an artifact name, accepting both short and prefixed forms.
    *
    * Allows users to type `"strict"` or `"codi-strict"` interchangeably.
    *
    * @param input - The user-supplied artifact name
    * @param validNames - The list of canonical full names to match against
    * @returns The canonical name if found, or `undefined` if no match
    *
    * @example
    * ```ts
    * resolveArtifactName("strict", ["codi-strict", "codi-balanced"]); // "codi-strict"
    * resolveArtifactName("codi-strict", ["codi-strict"]);              // "codi-strict"
    * resolveArtifactName("unknown", ["codi-strict"]);                  // undefined
    * ```
    */
   export function resolveArtifactName(
     input: string,
     validNames: readonly string[],
   ): string | undefined {
     if (validNames.includes(input)) return input;
     const prefixed = prefixedName(input);
     if (validNames.includes(prefixed)) return prefixed;
     return undefined;
   }

   // --- Artifact size limits ---
   /** Maximum character length for artifact names. */
   export const MAX_NAME_LENGTH = 64;
   /** Maximum character length for artifact description fields. */
   export const MAX_DESCRIPTION_LENGTH = 512;
   /** Maximum character length for skill description fields (longer than rule descriptions). */
   export const MAX_SKILL_DESCRIPTION_LENGTH = 1024;
   /** Maximum character count for a single generated artifact file. */
   export const MAX_ARTIFACT_CHARS = 6_000;
   /** Maximum total character count across all generated artifact files per agent. */
   export const MAX_TOTAL_ARTIFACT_CHARS = 12_000;

   // --- Name validation patterns ---
   /** Regex that artifact names must match: lowercase letters, digits, and hyphens only. */
   export const NAME_PATTERN = /^[a-z0-9-]+$/;
   /** Stricter variant of `NAME_PATTERN` — name must start with a lowercase letter. */
   export const NAME_PATTERN_STRICT = /^[a-z][a-z0-9-]*$/;

   // --- Verification token ---
   /** Length of the hex suffix in a generated verification token. */
   export const TOKEN_HASH_LENGTH = 12;
   /** Prefix used in verification tokens (e.g. `"codi-a1b2c3d4e5f6"`). */
   export const TOKEN_PREFIX = PROJECT_NAME;

   // --- Watch ---
   /** Debounce delay in milliseconds for the `codi watch` file watcher. */
   export const WATCH_DEBOUNCE_MS = 500;

   // --- Backup ---
   /** Maximum number of backup snapshots retained per project. Oldest are pruned first. */
   export const MAX_BACKUPS = 5;

   // --- Managed by ---
   /**
    * Valid values for the `managed_by` frontmatter field.
    *
    * - `"codi"` — the artifact is owned by a preset; manual edits will be overwritten on update.
    * - `"user"` — the artifact is user-owned and will never be overwritten by Codi.
    */
   export const MANAGED_BY_VALUES = [PROJECT_NAME, "user"] as const;

   // --- Presets ---
   /** The default preset identifier applied when no preset is specified during `codi init`. */
   export const DEFAULT_PRESET = prefixedName("balanced");

   // --- Preset source types ---
   /**
    * The supported preset source types for `codi preset install`.
    *
    * - `"builtin"` — a preset shipped with the Codi CLI
    * - `"zip"` — a local `.zip` archive
    * - `"github"` — a GitHub repository (`owner/repo` or `owner/repo/path`)
    * - `"local"` — a local directory path
    */
   export const PRESET_SOURCE_TYPES = ["builtin", "zip", "github", "local"] as const;
   export type PresetSourceType = (typeof PRESET_SOURCE_TYPES)[number];

   // --- Preset size limits ---
   /** Warn when a preset zip exceeds this size (1 MB). */
   export const MAX_PRESET_ZIP_WARN_BYTES = 1_048_576;
   /** Reject preset zips larger than this size (10 MB). */
   export const MAX_PRESET_ZIP_ERROR_BYTES = 10_485_760;

   // --- Config filenames ---
   /** Filename of the project manifest inside `.codi/`. */
   export const MANIFEST_FILENAME = `${PROJECT_NAME}.yaml`;
   /** Filename of the flags configuration file inside `.codi/`. */
   export const FLAGS_FILENAME = "flags.yaml";
   /** Filename of the MCP server configuration file inside `.codi/`. */
   export const MCP_FILENAME = "mcp.yaml";
   /** Filename of the generator state file inside `.codi/`. */
   export const STATE_FILENAME = "state.json";
   /** Filename of the audit log inside `.codi/`. */
   export const AUDIT_FILENAME = "audit.jsonl";
   /** Output filename for compiled skill files. */
   export const SKILL_OUTPUT_FILENAME = "SKILL.md";
   ```
   *(Continue the rest of the constants file unchanged — only the sections above need updating. The remaining constants: `SUPPORTED_PLATFORMS`, `ALL_SKILL_CATEGORIES`, `BRAND_CATEGORY`, `CONTEXT_TOKENS_SMALL/LARGE`, `CLI_COMMANDS`, `GIT_CLONE_DEPTH`, `DEFAULT_MAX_FILE_LINES`, line limits, `GIT_COMMIT_FIRST_LINE_LIMIT`, doc management, feedback, code quality, and context injection markers — add one-line JSDoc each following the same pattern.)*

   > **Note for implementer:** Read `src/constants.ts` in full, then add one JSDoc line per exported constant following the patterns shown above. Every exported symbol in the file needs a `/** ... */` comment. Do not change any values.

- [ ] 4. Regenerate TypeDoc: `npx typedoc --skipErrorChecking`
- [ ] 5. Verify constants module appears in output:
   ```bash
   ls docs/src/content/docs/api/
   # Expected: README.md  adapters.md  constants.md  core/  schemas.md  types.md
   grep "PROJECT_NAME\|Unified AI" docs/src/content/docs/api/constants.md | head -5
   # Expected: lines showing the constant name and its description
   ```
- [ ] 6. Commit: `git add typedoc.json src/constants.ts && git commit -m "docs(constants): add JSDoc and expose as TypeDoc entry point"`

**Verification**: `npx typedoc --skipErrorChecking` — expected: `docs/src/content/docs/api/constants.md` exists with description text

---

### Task 2: Document `src/types/result.ts`

**Files**: `src/types/result.ts`
**Est**: 3 minutes

**Steps**:
- [ ] 1. Verify baseline thin output:
   ```bash
   grep -A3 "### ok" docs/src/content/docs/api/types.md | head -8
   # Expected: just a function signature, no description paragraph
   ```
- [ ] 2. Replace `src/types/result.ts` with the documented version:
   ```typescript
   import type { ProjectError } from "../core/output/types.js";

   /**
    * A discriminated union representing either a successful value (`ok: true`) or a
    * list of errors (`ok: false`).
    *
    * Use `ok()` and `err()` to construct results. Use `isOk()` and `isErr()` as
    * type guards to narrow the union safely.
    *
    * @example
    * ```ts
    * import { ok, err, isOk } from 'codi-cli';
    *
    * const result: Result<string> = someOperation();
    * if (isOk(result)) {
    *   console.log(result.data); // typed as string
    * } else {
    *   result.errors.forEach(e => console.error(e.message));
    * }
    * ```
    */
   export type Result<T, E = ProjectError[]> =
     | { ok: true; data: T }
     | { ok: false; errors: E };

   /**
    * Wraps a value in a successful `Result`.
    *
    * @param data - The success value to wrap
    * @returns A `Result` with `ok: true` and the given data
    *
    * @example
    * ```ts
    * return ok({ name: 'my-rule', content: '...' });
    * ```
    */
   export function ok<T>(data: T): Result<T> {
     return { ok: true, data };
   }

   /**
    * Wraps one or more errors in a failed `Result`.
    *
    * @param errors - The error payload to wrap
    * @returns A `Result` with `ok: false` and the given errors
    *
    * @example
    * ```ts
    * return err([createError('E_CONFIG_NOT_FOUND', { path })]);
    * ```
    */
   export function err<E = ProjectError[]>(errors: E): Result<never, E> {
     return { ok: false, errors };
   }

   /**
    * Type guard that narrows a `Result` to its success variant.
    *
    * @param result - The result to check
    * @returns `true` if the result is successful; narrows type to `{ ok: true; data: T }`
    */
   export function isOk<T, E>(
     result: Result<T, E>,
   ): result is { ok: true; data: T } {
     return result.ok === true;
   }

   /**
    * Type guard that narrows a `Result` to its failure variant.
    *
    * @param result - The result to check
    * @returns `true` if the result failed; narrows type to `{ ok: false; errors: E }`
    */
   export function isErr<T, E>(
     result: Result<T, E>,
   ): result is { ok: false; errors: E } {
     return result.ok === false;
   }
   ```
- [ ] 3. Regenerate: `npx typedoc --skipErrorChecking`
- [ ] 4. Verify description appears:
   ```bash
   grep -A5 "### ok" docs/src/content/docs/api/types.md | head -10
   # Expected: description paragraph "Wraps a value in a successful Result."
   grep "discriminated union" docs/src/content/docs/api/types.md
   # Expected: 1 match
   ```
- [ ] 5. Commit: `git add src/types/result.ts && git commit -m "docs(types): add JSDoc to Result type and helpers"`

**Verification**: `npx typedoc --skipErrorChecking` — expected: `Result`, `ok`, `err`, `isOk`, `isErr` each have description paragraphs in `types.md`

---

### Task 3: Document `src/types/config.ts`

**Files**: `src/types/config.ts`
**Est**: 5 minutes

**Steps**:
- [ ] 1. Verify baseline thin:
   ```bash
   grep -A2 "ProjectManifest" docs/src/content/docs/api/types.md | head -6
   # Expected: interface header but no description paragraph
   ```
- [ ] 2. Replace `src/types/config.ts` with the documented version:
   ```typescript
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
     /** Allowed tool names the skill may use (passed through to the agent's tool allowlist). */
     tools?: string[];
     /** When `true`, the skill runs as a pure tool execution with no LLM call. */
     disableModelInvocation?: boolean;
     /** Hint shown to users when invoking: `/skill-name <hint>`. */
     argumentHint?: string;
     /** Tool names that are explicitly allowed for this skill (agent-level enforcement). */
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
     /** Hook configuration for this skill (passed through to the agent verbatim). */
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
   ```
- [ ] 3. Regenerate: `npx typedoc --skipErrorChecking`
- [ ] 4. Verify:
   ```bash
   grep "preset-managed\|user-managed\|single object" docs/src/content/docs/api/types.md | head -5
   # Expected: 3+ matches — confirms property descriptions are rendering
   ```
- [ ] 5. Commit: `git add src/types/config.ts && git commit -m "docs(types): add JSDoc to all config interfaces"`

**Verification**: `npx typedoc --skipErrorChecking` — expected: every interface in `types.md` has a description paragraph

---

### Task 4: Document `src/types/flags.ts`

**Files**: `src/types/flags.ts`
**Est**: 3 minutes

**Steps**:
- [ ] 1. Verify baseline thin:
   ```bash
   grep -A2 "FlagMode" docs/src/content/docs/api/types.md | head -6
   # Expected: type alias with no description
   ```
- [ ] 2. Replace `src/types/flags.ts` with the documented version:
   ```typescript
   /**
    * Controls how Codi manages a flag's value for a given agent.
    *
    * - `"enforced"` — value is fixed; agents cannot override it
    * - `"enabled"` — feature is on; agents may override
    * - `"disabled"` — feature is off; agents may override
    * - `"inherited"` — Codi does not set a value; the agent uses its own default
    * - `"delegated_to_agent_default"` — explicitly opt out of Codi management for this flag
    * - `"conditional"` — value depends on the `conditions` field (agent id or file pattern)
    */
   export type FlagMode =
     | "enforced"
     | "enabled"
     | "disabled"
     | "inherited"
     | "delegated_to_agent_default"
     | "conditional";

   /**
    * A single flag entry as stored in `.codi/flags.yaml`.
    *
    * Flags control feature toggles and configuration values that are passed to
    * agent instruction files during generation.
    */
   export interface FlagDefinition {
     /** How Codi manages this flag's value. */
     mode: FlagMode;
     /** The flag's value (boolean, number, string, or string array). Only used when `mode` is `"enforced"` or `"enabled"`. */
     value?: unknown;
     /** When `true`, this flag cannot be modified by `codi flags set` — only direct file edits. */
     locked?: boolean;
     /** Conditions that determine when a `"conditional"` mode flag applies. */
     conditions?: FlagConditions;
   }

   /**
    * Conditions that gate a `"conditional"` flag.
    *
    * At least one field must be set. Multiple fields are evaluated with AND logic.
    */
   export interface FlagConditions {
     /** Agent ids this condition applies to (e.g. `["claude-code", "cursor"]`). */
     agent?: string[];
     /** File glob patterns this condition applies to (e.g. `["**/*.test.ts"]`). */
     file_pattern?: string[];
   }

   /** Runtime-accessible keys of FlagConditions — kept in sync with the interface above. */
   export const FLAG_CONDITION_KEYS: ReadonlySet<string> = new Set<string>([
     "agent",
     "file_pattern",
   ]);

   /**
    * The resolved flags map produced by `resolveConfig()`.
    *
    * Keys are flag names; values are `ResolvedFlag` objects with source tracking.
    */
   export interface ResolvedFlags {
     [key: string]: ResolvedFlag;
   }

   /**
    * A single resolved flag with runtime metadata.
    *
    * Produced by `flagsFromDefinitions()` during config resolution.
    */
   export interface ResolvedFlag {
     /** The flag's effective value. */
     value: unknown;
     /** The resolved mode. */
     mode: FlagMode;
     /** Absolute path to the `flags.yaml` file this flag was read from. */
     source: string;
     /** Whether this flag is locked against `codi flags set` modifications. */
     locked: boolean;
   }

   /**
    * The static specification for a built-in Codi flag.
    *
    * Defines the type, default value, allowed values, and display metadata for
    * flags that appear in the flag catalog (`codi flags list`).
    */
   export interface FlagSpec {
     /** The flag's value type. */
     type: "boolean" | "number" | "enum" | "string[]";
     /** Default value used when the flag is not set. */
     default: unknown;
     /** Allowed string values for `"enum"` type flags. */
     values?: string[];
     /** Minimum value for `"number"` type flags. */
     min?: number;
     /** Name of the hook triggered when this flag's value changes. */
     hook?: string | null;
     /** Human-readable description of what this flag controls. */
     description: string;
     /** Short usage hint shown in CLI output. */
     hint?: string;
     /** Descriptions for each allowed enum value. */
     valueHints?: Record<string, string>;
   }
   ```
- [ ] 3. Regenerate: `npx typedoc --skipErrorChecking`
- [ ] 4. Verify:
   ```bash
   grep "enforced.*fixed\|conditional.*conditions" docs/src/content/docs/api/types.md | head -3
   # Expected: 2+ matches
   ```
- [ ] 5. Commit: `git add src/types/flags.ts && git commit -m "docs(types): add JSDoc to flag types"`

**Verification**: `npx typedoc --skipErrorChecking` — expected: `FlagMode`, `FlagDefinition`, `ResolvedFlag`, `FlagSpec` all have descriptions in `types.md`

---

### Task 5: Document `src/types/agent.ts`

**Files**: `src/types/agent.ts`
**Est**: 3 minutes

**Steps**:
- [ ] 1. Verify baseline thin:
   ```bash
   grep -B1 -A2 "AgentAdapter" docs/src/content/docs/api/types.md | head -10
   # Expected: interface header with no description paragraph
   ```
- [ ] 2. Replace `src/types/agent.ts` with the documented version:
   ```typescript
   import type { NormalizedConfig } from "./config.js";

   /**
    * File path configuration for a specific agent adapter.
    *
    * Defines where Codi writes configuration files for a given agent/tool.
    */
   export interface AgentPaths {
     /** Relative path to the agent's root config directory (e.g. `".claude"`). */
     configRoot: string;
     /** Relative path to the directory where rules are written. */
     rules: string;
     /** Relative path to the skills directory, or `null` if not supported. */
     skills: string | null;
     /** Relative path to the agents directory, or `null` if not supported. */
     agents: string | null;
     /** Relative path to the primary instruction file (e.g. `"CLAUDE.md"`). */
     instructionFile: string;
     /** Relative path to the MCP config file, or `null` if not supported. */
     mcpConfig: string | null;
   }

   /**
    * Feature support matrix for a specific agent adapter.
    *
    * Used by the generator and CLI to determine which features are available
    * for a given agent platform.
    */
   export interface AgentCapabilities {
     /** Whether this agent supports rule injection. */
     rules: boolean;
     /** Whether this agent supports skill files. */
     skills: boolean;
     /** Whether this agent supports MCP server configuration. */
     mcp: boolean;
     /** Whether this agent's rule files support YAML frontmatter. */
     frontmatter: boolean;
     /** Whether this agent progressively loads rules (lazy evaluation). */
     progressiveLoading: boolean;
     /** Whether this agent supports sub-agent definitions. */
     agents: boolean;
     /** Maximum context window size in tokens for this agent. */
     maxContextTokens: number;
   }

   /**
    * A single file produced by an adapter's `generate()` method.
    */
   export interface GeneratedFile {
     /** Relative path where this file should be written (relative to project root). */
     path: string;
     /** Full text content to write to the file. */
     content: string;
     /** Names of the source artifacts (rules, skills) that contributed to this file. */
     sources: string[];
     /** SHA-256 hash of `content`, used for drift detection. */
     hash: string;
     /** Absolute source path for binary files that must be copied as-is (not text-written). */
     binarySrc?: string;
   }

   /**
    * Options passed to `generate()` operations, sourced from CLI flags.
    */
   export interface GenerateOptions {
     /** Subset of agent ids to generate for. Omit to generate for all detected agents. */
     agents?: string[];
     /** When `true`, print what would be written without actually writing files. */
     dryRun?: boolean;
     /** When `true`, overwrite existing files without prompting. */
     force?: boolean;
     /** Non-interactive mode: skip all conflicting files without prompting. */
     json?: boolean;
     /** Override for the project root directory. Defaults to `process.cwd()`. */
     projectRoot?: string;
   }

   /**
    * The outcome of writing a single generated file to disk.
    *
    * - `"created"` — file did not exist and was created
    * - `"updated"` — file existed and content changed
    * - `"unchanged"` — file existed and content is identical (no write performed)
    * - `"deleted"` — file was removed (e.g. artifact was removed from config)
    * - `"error"` — write failed
    */
   export type FileStatus = "created" | "updated" | "unchanged" | "deleted" | "error";

   /**
    * Write status for a single file within an agent's generation result.
    */
   export interface AgentFileStatus {
     /** Relative path of the file. */
     path: string;
     /** The outcome of the write operation. */
     status: FileStatus;
     /** Content hash after writing. Absent when `status` is `"error"` or `"deleted"`. */
     hash?: string;
   }

   /**
    * The complete generation result for a single agent.
    */
   export interface AgentStatus {
     /** The agent's id (e.g. `"claude-code"`). */
     agentId: string;
     /** The agent's display name (e.g. `"Claude Code"`). */
     agentName: string;
     /** Per-file write outcomes. */
     files: AgentFileStatus[];
   }

   /**
    * A Codi agent adapter — the plugin interface for supporting a new AI coding tool.
    *
    * Each supported agent (Claude Code, Cursor, Codex, Windsurf, Cline) is implemented
    * as an `AgentAdapter`. Adapters are registered via `registerAllAdapters()` and
    * retrieved from the adapter registry at generation time.
    *
    * @example
    * ```ts
    * import { claudeCodeAdapter } from 'codi-cli';
    *
    * const detected = await claudeCodeAdapter.detect(process.cwd());
    * if (detected) {
    *   const files = await claudeCodeAdapter.generate(config, {});
    * }
    * ```
    */
   export interface AgentAdapter {
     /** Unique kebab-case identifier for this agent (e.g. `"claude-code"`). */
     id: string;
     /** Human-readable display name (e.g. `"Claude Code"`). */
     name: string;
     /**
      * Detects whether this agent is active in the given project.
      *
      * Checks for agent-specific files or directories. Used by `codi generate`
      * to auto-select the target agents.
      *
      * @param projectRoot - Absolute path to the project root
      * @returns `true` if this agent's configuration is present
      */
     detect(projectRoot: string): Promise<boolean>;
     /** File path configuration for this agent. */
     paths: AgentPaths;
     /** Feature support matrix for this agent. */
     capabilities: AgentCapabilities;
     /**
      * Generates all configuration files for this agent from the resolved config.
      *
      * @param config - The fully resolved project configuration
      * @param options - Generation options (dry run, force, agent filter, etc.)
      * @returns Array of files to write to disk
      */
     generate(config: NormalizedConfig, options: GenerateOptions): Promise<GeneratedFile[]>;
   }
   ```
- [ ] 3. Regenerate: `npx typedoc --skipErrorChecking`
- [ ] 4. Verify:
   ```bash
   grep "plugin interface\|auto-select\|drift detection" docs/src/content/docs/api/types.md | head -5
   # Expected: 3 matches
   ```
- [ ] 5. Commit: `git add src/types/agent.ts && git commit -m "docs(types): add JSDoc to agent adapter interfaces"`

**Verification**: `npx typedoc --skipErrorChecking` — expected: `AgentAdapter`, `AgentCapabilities`, `AgentPaths`, `GeneratedFile` all have descriptions in `types.md`

---

### Task 6: Document `src/schemas/manifest.ts` and `src/schemas/rule.ts`

**Files**: `src/schemas/manifest.ts`, `src/schemas/rule.ts`
**Est**: 4 minutes

**Steps**:
- [ ] 1. Verify baseline thin:
   ```bash
   grep -A3 "ProjectManifestSchema" docs/src/content/docs/api/schemas.md | head -6
   # Expected: schema variable declaration with no description paragraph
   ```
- [ ] 2. Replace `src/schemas/manifest.ts`:
   ```typescript
   import { z } from "zod";
   import { MAX_NAME_LENGTH, MAX_DESCRIPTION_LENGTH, NAME_PATTERN } from "../constants.js";

   /**
    * Validates the contents of a project's `codi.yaml` manifest file.
    *
    * The manifest is the primary project configuration document at `.codi/codi.yaml`.
    * It declares the project name, which agents to target, and which presets are installed.
    */
   export const ProjectManifestSchema = z.object({
     name: z.string().regex(NAME_PATTERN).max(MAX_NAME_LENGTH)
       .describe("The project name used as the base for generated artifact names. Must be lowercase kebab-case."),
     version: z.enum(["1"])
       .describe("Schema version. Always '1'."),
     description: z.string().max(MAX_DESCRIPTION_LENGTH).optional()
       .describe("Optional human-readable description of the project."),
     agents: z.array(z.string()).optional()
       .describe("Subset of agent ids to generate configuration for. Omit to generate for all detected agents."),
     layers: z
       .object({
         rules: z.boolean().default(true).describe("Whether to generate rule files. Defaults to true."),
         skills: z.boolean().default(true).describe("Whether to generate skill files. Defaults to true."),
         agents: z.boolean().default(true).describe("Whether to generate agent files. Defaults to true."),
         context: z.boolean().default(true).describe("Whether to inject project context. Defaults to true."),
       })
       .optional()
       .describe("Controls which artifact layers Codi generates. All layers default to enabled."),
     engine: z
       .object({
         requiredVersion: z.string().optional()
           .describe("Minimum Codi version required (semver range, e.g. '>=2.0.0')."),
       })
       .optional()
       .describe("Engine version constraints for this configuration."),
     presetRegistry: z
       .object({
         url: z.string().describe("GitHub repository URL for the custom preset registry."),
         branch: z.string().default("main").describe("Branch to read preset metadata from."),
       })
       .optional()
       .describe("Custom preset registry for 'codi preset install'. When set, overrides the default upstream registry."),
     presets: z.array(z.string()).optional()
       .describe("Names of presets currently installed. Populated automatically by 'codi preset install'."),
   });

   export type ProjectManifestInput = z.input<typeof ProjectManifestSchema>;
   export type ProjectManifestOutput = z.output<typeof ProjectManifestSchema>;
   ```
- [ ] 3. Replace `src/schemas/rule.ts`:
   ```typescript
   import { z } from "zod";
   import {
     MAX_NAME_LENGTH,
     MAX_DESCRIPTION_LENGTH,
     NAME_PATTERN,
     MANAGED_BY_VALUES,
   } from "../constants.js";

   /**
    * Validates the YAML frontmatter of a `.codi/rules/<name>.md` file.
    *
    * Rules are Markdown documents with frontmatter that define coding standards,
    * conventions, and guidelines injected into agent instruction files.
    */
   export const RuleFrontmatterSchema = z.object({
     name: z.string().regex(NAME_PATTERN).max(MAX_NAME_LENGTH)
       .describe("Unique rule name in kebab-case (e.g. 'codi-typescript'). Must match the filename."),
     description: z.string().max(MAX_DESCRIPTION_LENGTH)
       .describe("One-sentence description of what this rule enforces."),
     version: z.number().int().positive().default(1)
       .describe("Monotonically increasing version number. Increment when making breaking changes."),
     type: z.literal("rule").default("rule")
       .describe("Artifact type discriminator. Always 'rule'."),
     language: z.string().optional()
       .describe("Optional language hint (e.g. 'typescript', 'python'). Adapters may use this to scope the rule to matching files only."),
     priority: z.enum(["high", "medium", "low"]).default("medium")
       .describe("Injection priority: 'high' rules appear first in the generated instruction file, 'low' rules appear last."),
     scope: z.array(z.string()).optional()
       .describe("File glob patterns that restrict this rule to matching files only. When set, the rule is only injected for files matching these patterns."),
     alwaysApply: z.boolean().default(true)
       .describe("When true, the rule is injected unconditionally. When false, the rule is only applied when the agent deems it relevant."),
     managed_by: z.enum(MANAGED_BY_VALUES).default("user")
       .describe("Ownership: 'codi' means preset-managed (do not edit manually); 'user' means user-managed."),
   });

   export type RuleFrontmatterInput = z.input<typeof RuleFrontmatterSchema>;
   export type RuleFrontmatterOutput = z.output<typeof RuleFrontmatterSchema>;
   ```
- [ ] 4. Regenerate: `npx typedoc --skipErrorChecking`
- [ ] 5. Verify:
   ```bash
   grep "preset-managed\|injection priority\|Validates the YAML" docs/src/content/docs/api/schemas.md | head -5
   # Expected: 3+ matches
   ```
- [ ] 6. Commit: `git add src/schemas/manifest.ts src/schemas/rule.ts && git commit -m "docs(schemas): add JSDoc and describe() to manifest and rule schemas"`

**Verification**: `npx typedoc --skipErrorChecking` — expected: `ProjectManifestSchema` and `RuleFrontmatterSchema` property tables have description columns in `schemas.md`

---

### Task 7: Document `src/schemas/skill.ts`

**Files**: `src/schemas/skill.ts`
**Est**: 5 minutes

**Steps**:
- [ ] 1. Verify baseline thin:
   ```bash
   grep -A3 "SkillFrontmatterSchema" docs/src/content/docs/api/schemas.md | head -6
   # Expected: schema variable with no description
   ```
- [ ] 2. Replace `src/schemas/skill.ts`:
   ```typescript
   import { z } from "zod";
   import {
     MAX_NAME_LENGTH,
     MAX_SKILL_DESCRIPTION_LENGTH,
     NAME_PATTERN,
     MANAGED_BY_VALUES,
     ALL_SKILL_CATEGORIES,
     SUPPORTED_PLATFORMS,
   } from "../constants.js";

   const HookConfigSchema = z.record(z.string(), z.union([z.string(), z.array(z.string())]));

   /**
    * Validates the YAML frontmatter of a `.codi/skills/<name>/SKILL.md` file.
    *
    * Skills are reusable agent workflows with structured frontmatter that controls
    * how they are invoked, which platforms they target, and how they run.
    */
   export const SkillFrontmatterSchema = z.object({
     name: z.string().regex(NAME_PATTERN).max(MAX_NAME_LENGTH)
       .describe("Unique skill name in kebab-case (e.g. 'codi-brainstorming'). Must match the directory name."),
     description: z.string().max(MAX_SKILL_DESCRIPTION_LENGTH)
       .describe("Human-readable description used in skill routing tables and discovery. Should describe the skill's purpose and when to activate it."),
     version: z.number().int().positive().default(1)
       .describe("Monotonically increasing schema version. Increment on breaking changes."),
     type: z.literal("skill").default("skill")
       .describe("Artifact type discriminator. Always 'skill'."),
     compatibility: z.array(z.enum(SUPPORTED_PLATFORMS)).optional()
       .describe("Agent platform ids this skill targets (e.g. ['claude-code']). Omit to support all platforms."),
     tools: z.array(z.string()).optional()
       .describe("Tool names the skill is allowed to use. Passed to the agent's tool allowlist."),
     model: z.string().optional()
       .describe("Model identifier override (e.g. 'claude-opus-4-5'). Omit to use the agent's default model."),
     managed_by: z.enum(MANAGED_BY_VALUES).default("user")
       .describe("Ownership: 'codi' means preset-managed (do not edit manually); 'user' means user-managed."),
     disableModelInvocation: z.boolean().optional()
       .describe("When true, the skill runs as a pure tool execution with no LLM call. Useful for deterministic script-type skills."),
     argumentHint: z.string().optional()
       .describe("Short hint shown to users when invoking: '/skill-name <hint>'. Example: '<feature-description>'."),
     allowedTools: z.array(z.string()).optional()
       .describe("Tool names explicitly allowed at the agent level. More restrictive than 'tools'."),
     category: z.enum([...ALL_SKILL_CATEGORIES] as [string, ...string[]]).optional()
       .describe("Skill category for routing and discovery (e.g. 'engineering', 'content', 'quality')."),
     license: z.string().optional()
       .describe("SPDX license identifier for contributed skills (e.g. 'MIT')."),
     metadata: z.record(z.string(), z.string()).optional()
       .describe("Arbitrary key-value metadata attached to this skill for tooling and discovery."),
     effort: z.enum(["low", "medium", "high", "max"]).optional()
       .describe("Model effort tier. 'low' uses faster/cheaper models; 'max' uses the highest capability model available."),
     context: z.literal("fork").optional()
       .describe("When set to 'fork', the skill runs in an isolated Claude Code subagent context with its own session."),
     agent: z.string().optional()
       .describe("Name of a registered Codi agent to run this skill as. The agent's system prompt and tools are applied."),
     "user-invocable": z.boolean().optional()
       .describe("When true, users can invoke this skill via the '/skill-name' slash command in Claude Code."),
     paths: z.union([z.array(z.string()), z.string()]).optional()
       .describe("File glob patterns the skill is allowed to read or write. Restricts file access for safety."),
     shell: z.enum(["bash", "powershell"]).optional()
       .describe("Shell interpreter for script-type skills. Defaults to the system shell."),
     hooks: HookConfigSchema.optional()
       .describe("Hook configuration passed verbatim to the agent's hook system."),
   });

   export type SkillFrontmatterInput = z.input<typeof SkillFrontmatterSchema>;
   export type SkillFrontmatterOutput = z.output<typeof SkillFrontmatterSchema>;
   ```
- [ ] 3. Regenerate: `npx typedoc --skipErrorChecking`
- [ ] 4. Verify:
   ```bash
   grep "effort tier\|slash command\|subagent context" docs/src/content/docs/api/schemas.md | head -5
   # Expected: 3 matches
   ```
- [ ] 5. Commit: `git add src/schemas/skill.ts && git commit -m "docs(schemas): add JSDoc and describe() to skill schema"`

**Verification**: `npx typedoc --skipErrorChecking` — expected: `SkillFrontmatterSchema` property table has description text for every field in `schemas.md`

---

### Task 8: Document `src/schemas/agent.ts`

**Files**: `src/schemas/agent.ts`
**Est**: 4 minutes

**Steps**:
- [ ] 1. Verify baseline thin:
   ```bash
   grep -A3 "AgentFrontmatterSchema" docs/src/content/docs/api/schemas.md | head -6
   # Expected: schema variable with no description
   ```
- [ ] 2. Replace `src/schemas/agent.ts`:
   ```typescript
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
     name: z.string().regex(NAME_PATTERN_STRICT).max(MAX_NAME_LENGTH)
       .describe("Unique agent name in kebab-case, starting with a letter (e.g. 'codi-reviewer'). Must match the filename."),
     description: z.string().max(MAX_DESCRIPTION_LENGTH).default("")
       .describe("Human-readable description of what this agent does and when to invoke it."),
     version: z.number().int().positive().default(1)
       .describe("Monotonically increasing schema version."),
     tools: z.array(z.string()).optional()
       .describe("Tool names this agent is explicitly allowed to use."),
     disallowedTools: z.array(z.string()).optional()
       .describe("Tool names this agent is explicitly forbidden from using."),
     model: z.string().optional()
       .describe("Model identifier override (e.g. 'claude-opus-4-5'). Omit to use the platform default."),
     maxTurns: z.number().int().positive().optional()
       .describe("Maximum number of agentic turns before this agent stops automatically."),
     effort: z.enum(["low", "medium", "high", "max"]).optional()
       .describe("Model effort tier: 'low' uses faster/cheaper models; 'max' uses highest capability."),
     managed_by: z.enum(MANAGED_BY_VALUES).default("user")
       .describe("Ownership: 'codi' means preset-managed; 'user' means user-managed."),
     permissionMode: z.enum(["unrestricted", "readonly", "limited"]).optional()
       .describe("Claude Code tool access scope: 'unrestricted' allows all tools; 'readonly' allows only read operations; 'limited' allows a curated subset."),
     mcpServers: z.array(z.string()).optional()
       .describe("MCP server names to attach to this agent, referenced from the project's mcp.yaml."),
     skills: z.array(z.string()).optional()
       .describe("Skill names this agent has access to during its session."),
     memory: z.enum(["user", "project", "none"]).optional()
       .describe("Memory scope: 'user' persists across projects; 'project' persists within this project; 'none' disables persistent memory."),
     background: z.boolean().optional()
       .describe("When true, this agent runs as a background process without blocking the terminal."),
     isolation: z.string().optional()
       .describe("When set to 'worktree', the agent runs in an isolated git worktree copy of the project."),
     color: z.string().optional()
       .describe("Color label displayed in the Claude Code UI for this agent (e.g. 'blue', 'red')."),
   });

   export type AgentFrontmatterInput = z.input<typeof AgentFrontmatterSchema>;
   export type AgentFrontmatterOutput = z.output<typeof AgentFrontmatterSchema>;
   ```
- [ ] 3. Regenerate: `npx typedoc --skipErrorChecking`
- [ ] 4. Verify:
   ```bash
   grep "tool access scope\|git worktree\|background process" docs/src/content/docs/api/schemas.md | head -5
   # Expected: 3 matches
   ```
- [ ] 5. Commit: `git add src/schemas/agent.ts && git commit -m "docs(schemas): add JSDoc and describe() to agent schema"`

**Verification**: `npx typedoc --skipErrorChecking` — expected: `AgentFrontmatterSchema` property table has description text for every field in `schemas.md`

---

### Task 9: Document `src/schemas/flag.ts`

**Files**: `src/schemas/flag.ts`
**Est**: 3 minutes

**Steps**:
- [ ] 1. Verify baseline thin:
   ```bash
   grep -A3 "FlagDefinitionSchema" docs/src/content/docs/api/schemas.md | head -6
   # Expected: schema variable with no description
   ```
- [ ] 2. Replace `src/schemas/flag.ts`:
   ```typescript
   import { z } from 'zod';

   /**
    * Valid values for the `mode` field in a flag definition.
    *
    * Controls how Codi manages the flag's value in generated agent instruction files.
    */
   export const FlagModeSchema = z.enum([
     'enforced',
     'enabled',
     'disabled',
     'inherited',
     'delegated_to_agent_default',
     'conditional',
   ]).describe(
     "Flag management mode: 'enforced' (fixed, not overridable), 'enabled' (on, overridable), 'disabled' (off, overridable), 'inherited' (use agent default), 'delegated_to_agent_default' (opt out of Codi management), 'conditional' (depends on conditions field)"
   );

   /**
    * Conditions that gate a `"conditional"` mode flag.
    *
    * At least one field must be present. When multiple fields are set, all must match.
    */
   export const FlagConditionsSchema = z.object({
     lang: z.array(z.string()).optional()
       .describe("Programming languages this condition applies to (e.g. ['typescript', 'python'])."),
     framework: z.array(z.string()).optional()
       .describe("Framework names this condition applies to (e.g. ['react', 'nextjs'])."),
     agent: z.array(z.string()).optional()
       .describe("Agent ids this condition applies to (e.g. ['claude-code', 'cursor'])."),
     file_pattern: z.array(z.string()).optional()
       .describe("File glob patterns this condition applies to (e.g. ['**/*.test.ts'])."),
   }).refine(
     (data) =>
       data.lang !== undefined ||
       data.framework !== undefined ||
       data.agent !== undefined ||
       data.file_pattern !== undefined,
     { message: 'At least one condition field is required' },
   );

   /**
    * The valid value types for a flag.
    */
   export const FlagValueSchema = z.union([
     z.boolean(),
     z.number().int().positive(),
     z.string(),
     z.array(z.string()),
   ]).describe("Flag value: boolean, positive integer, string, or string array.");

   /**
    * Validates a single flag entry in `.codi/flags.yaml`.
    *
    * Flags control feature toggles and configuration values that are injected
    * into agent instruction files during generation.
    */
   export const FlagDefinitionSchema = z.object({
     mode: FlagModeSchema,
     value: FlagValueSchema.optional()
       .describe("The flag's value. Only used when mode is 'enforced' or 'enabled'."),
     locked: z.boolean().default(false)
       .describe("When true, this flag cannot be modified via 'codi flags set'. Only direct file edits are allowed."),
     conditions: FlagConditionsSchema.optional()
       .describe("Conditions that determine when a 'conditional' mode flag applies. Required when mode is 'conditional'."),
   }).refine(
     (data) => {
       if (data.mode === 'conditional' && !data.conditions) {
         return false;
       }
       return true;
     },
     { message: 'Conditional mode requires conditions' },
   ).refine(
     (data) => {
       if (data.mode === 'enforced' && data.conditions) {
         return false;
       }
       return true;
     },
     { message: 'Enforced mode cannot have conditions' },
   );

   export type FlagModeOutput = z.output<typeof FlagModeSchema>;
   export type FlagConditionsOutput = z.output<typeof FlagConditionsSchema>;
   export type FlagDefinitionOutput = z.output<typeof FlagDefinitionSchema>;
   ```
- [ ] 3. Regenerate: `npx typedoc --skipErrorChecking`
- [ ] 4. Verify:
   ```bash
   grep "not overridable\|opt out of Codi\|direct file edits" docs/src/content/docs/api/schemas.md | head -3
   # Expected: 3 matches
   ```
- [ ] 5. Commit: `git add src/schemas/flag.ts && git commit -m "docs(schemas): add JSDoc and describe() to flag schema"`

**Verification**: `npx typedoc --skipErrorChecking` — expected: `FlagDefinitionSchema` and `FlagModeSchema` have description text in `schemas.md`

---

### Task 10: Document `src/schemas/mcp.ts`, `hooks.ts`, `evals.ts`, `feedback.ts`

**Files**: `src/schemas/mcp.ts`, `src/schemas/hooks.ts`, `src/schemas/evals.ts`, `src/schemas/feedback.ts`
**Est**: 5 minutes

**Steps**:
- [ ] 1. Replace `src/schemas/mcp.ts`:
   ```typescript
   import { z } from 'zod';

   const McpServerSchema = z.object({
     type: z.enum(['stdio', 'http']).optional()
       .describe("Transport type: 'stdio' launches a local process; 'http' connects to a remote URL."),
     command: z.string().optional()
       .describe("Command to execute for stdio servers (e.g. 'npx', 'node')."),
     args: z.array(z.string()).optional()
       .describe("Arguments passed to the command for stdio servers."),
     env: z.record(z.string(), z.string()).optional()
       .describe("Environment variables injected into the server process for stdio servers."),
     url: z.string().optional()
       .describe("HTTP endpoint URL for http servers."),
     headers: z.record(z.string(), z.string()).optional()
       .describe("HTTP headers sent with each request to an http server."),
     enabled: z.boolean().optional()
       .describe("When false, this server is excluded from generation. Defaults to true."),
   });

   /**
    * Validates the contents of `.codi/mcp.yaml`.
    *
    * Defines MCP (Model Context Protocol) servers available to agents in this project.
    * Server names defined here can be referenced in agent frontmatter via `mcpServers`.
    */
   export const McpConfigSchema = z.object({
     servers: z.record(z.string(), McpServerSchema).default({})
       .describe("Map of server name to server configuration. Keys are referenced in agent frontmatter mcpServers fields."),
   });

   export type McpConfigInput = z.input<typeof McpConfigSchema>;
   export type McpConfigOutput = z.output<typeof McpConfigSchema>;
   ```
- [ ] 2. Replace `src/schemas/hooks.ts` (preserve all existing logic, add JSDoc/describe):
   ```typescript
   import { z } from "zod";
   import { NAME_PATTERN, PROJECT_NAME } from "../constants.js";

   /**
    * Validates a single hook definition entry in a hooks configuration file.
    */
   export const HookDefinitionSchema = z.object({
     name: z.string().regex(NAME_PATTERN)
       .describe("Unique hook name in kebab-case."),
     command: z.string()
       .describe("Shell command to execute when this hook fires."),
     condition: z.string()
       .describe("Condition expression that determines when this hook runs."),
     staged_filter: z.string().optional()
       .describe("File pattern filter applied to staged files before running this hook."),
   });

   /**
    * Validates the generated `.codi/hooks.yaml` configuration file.
    *
    * This file is produced by `codi generate` (not hand-authored) and describes
    * how hooks are installed and managed across supported hook runners.
    */
   export const HooksConfigSchema = z.object({
     version: z.literal("1")
       .describe("Schema version. Always '1'."),
     runner: z.enum([PROJECT_NAME, "husky", "pre-commit", "none"])
       .describe("Which hook manager owns the hook files: 'codi' (direct git hooks), 'husky', 'pre-commit', or 'none' (manual)."),
     install_method: z.enum([
       "git-hooks",
       "husky-append",
       "pre-commit-append",
       "manual",
     ]).describe("How hooks are written to disk: 'git-hooks' writes directly to .git/hooks; 'husky-append'/'pre-commit-append' integrate with existing runners; 'manual' outputs instructions only."),
     hooks: z.record(
       z.string(),
       z.record(z.string(), z.array(HookDefinitionSchema)),
     ).describe("Hook definitions organized by lifecycle event and hook name."),
     custom: z.record(z.string(), z.array(HookDefinitionSchema)).default({})
       .describe("User-defined custom hooks added outside of Codi's built-in hook set."),
   });

   export type HookDefinitionOutput = z.output<typeof HookDefinitionSchema>;
   export type HooksConfigOutput = z.output<typeof HooksConfigSchema>;
   ```
- [ ] 3. Replace `src/schemas/evals.ts`:
   ```typescript
   import { z } from "zod";

   /**
    * Validates a single evaluation test case for a skill.
    *
    * Eval cases define prompts and expected behaviors used to assess skill quality
    * during development and evolution.
    */
   export const EvalCaseSchema = z.object({
     id: z.string()
       .describe("Unique identifier for this eval case."),
     description: z.string()
       .describe("Human-readable description of what this case tests."),
     prompt: z.string()
       .describe("The input prompt sent to the skill during evaluation."),
     expectations: z.array(z.string()).default([])
       .describe("Natural language expectations the skill output must satisfy."),
     files: z.array(z.string()).default([])
       .describe("Relative paths to fixture files available during this eval."),
     passed: z.boolean().optional()
       .describe("Result of the last evaluation run. Absent if never run."),
     lastRunAt: z.string().datetime().optional()
       .describe("ISO 8601 timestamp of the last evaluation run."),
     passRate: z.number().optional()
       .describe("Rolling pass rate between 0 and 1 across recent runs."),
   });

   /**
    * Validates the `evals.json` file for a skill.
    *
    * Each skill can have an `evals.json` file in its directory containing test
    * cases used to evaluate the skill's behavior and guide evolution.
    */
   export const EvalsDataSchema = z.object({
     skillName: z.string()
       .describe("The name of the skill these evals belong to."),
     cases: z.array(EvalCaseSchema).default([])
       .describe("All eval cases for this skill."),
     lastUpdated: z.string().datetime().optional()
       .describe("ISO 8601 timestamp of the last time any case was updated."),
   });

   export type EvalCase = z.infer<typeof EvalCaseSchema>;
   export type EvalsData = z.infer<typeof EvalsDataSchema>;
   ```
- [ ] 4. Add JSDoc to `src/schemas/feedback.ts` — add the following comments before the relevant exports (do not change any logic):
   ```typescript
   // Add before FEEDBACK_AGENTS:
   /** Agent ids that can be the source of skill feedback entries. */

   // Add before FEEDBACK_OUTCOMES:
   /** Possible outcomes of a skill execution: 'success', 'partial', or 'failure'. */

   // Add before ISSUE_CATEGORIES:
   /** Categories for classifying issues found during skill feedback collection. */

   // Add before ISSUE_SEVERITIES:
   /** Severity levels for skill feedback issues. */

   // Add before FeedbackIssueSchema:
   /**
    * Validates a single issue reported in skill feedback.
    *
    * Issues are structured observations about problems encountered during skill execution,
    * used to drive skill evolution and improvement.
    */

   // Add before FeedbackEntrySchema:
   /**
    * Validates a complete skill feedback entry stored in `.codi/feedback/`.
    *
    * Each entry records a single skill execution outcome with optional issues and
    * improvement suggestions. Entries are used by `codi skill evolve` to propose
    * targeted skill improvements.
    */

   // Add before RULE_OBSERVATION_CATEGORIES:
   /** Categories for rule observation feedback entries. */

   // Add before RULE_OBSERVATION_SOURCES:
   /** Sources that can generate rule observation feedback. */

   // Add before RuleObservationSchema:
   /**
    * Validates a rule observation stored in `.codi/feedback/rules/`.
    *
    * Rule observations record patterns, corrections, or outdated practices noticed
    * during coding sessions. They are reviewed by `codi refine-rules` to propose
    * targeted rule improvements with human approval.
    */
   ```
- [ ] 5. Regenerate: `npx typedoc --skipErrorChecking`
- [ ] 6. Verify:
   ```bash
   grep "Model Context Protocol\|hook manager\|pass rate\|skill evolution" docs/src/content/docs/api/schemas.md | head -6
   # Expected: 4 matches
   ```
- [ ] 7. Commit: `git add src/schemas/mcp.ts src/schemas/hooks.ts src/schemas/evals.ts src/schemas/feedback.ts && git commit -m "docs(schemas): add JSDoc and describe() to mcp, hooks, evals, feedback schemas"`

**Verification**: `npx typedoc --skipErrorChecking` — expected: all 4 schemas have description paragraphs in `schemas.md`

---

### Task 11: Document adapter constants (`claude-code`, `cursor`, `codex`, `windsurf`, `cline`)

**Files**: `src/adapters/claude-code.ts`, `src/adapters/cursor.ts`, `src/adapters/codex.ts`, `src/adapters/windsurf.ts`, `src/adapters/cline.ts`
**Est**: 4 minutes

**Steps**:
- [ ] 1. Verify baseline thin:
   ```bash
   grep -A3 "claudeCodeAdapter" docs/src/content/docs/api/adapters.md | head -6
   # Expected: variable declaration with no description
   ```
- [ ] 2. Add JSDoc before `export const claudeCodeAdapter` in `src/adapters/claude-code.ts`:
   ```typescript
   /**
    * Adapter for [Claude Code](https://claude.ai/code) — Anthropic's official CLI.
    *
    * Detects presence of `CLAUDE.md` or a `.claude/` directory.
    * Generates `CLAUDE.md` (primary instruction file), `.claude/rules/`, `.claude/skills/`,
    * `.claude/agents/`, and `.mcp.json` (MCP server config).
    */
   export const claudeCodeAdapter: AgentAdapter = {
   ```
- [ ] 3. Add JSDoc before `export const cursorAdapter` in `src/adapters/cursor.ts`:
   ```typescript
   /**
    * Adapter for [Cursor](https://cursor.sh) — AI-powered code editor.
    *
    * Detects presence of `.cursor/` directory or `.cursorrules` file.
    * Generates `.cursorrules` (primary instruction file), `.cursor/rules/*.mdc`,
    * and `.cursor/mcp.json` (MCP server config).
    */
   export const cursorAdapter: AgentAdapter = {
   ```
- [ ] 4. Add JSDoc before `export const codexAdapter` in `src/adapters/codex.ts`:
   ```typescript
   /**
    * Adapter for [Codex](https://openai.com/codex) — OpenAI's coding agent.
    *
    * Detects presence of `AGENTS.md` or a `.agents/` directory.
    * Generates `AGENTS.md` (primary instruction file), `.codex/agents/`,
    * and `.agents/skills/`.
    */
   export const codexAdapter: AgentAdapter = {
   ```
- [ ] 5. Add JSDoc before `export const windsurfAdapter` in `src/adapters/windsurf.ts`:
   ```typescript
   /**
    * Adapter for [Windsurf](https://codeium.com/windsurf) — Codeium's AI editor.
    *
    * Detects presence of `.windsurfrules` file.
    * Generates `.windsurfrules` (primary instruction file) and `.windsurf/skills/`.
    * Does not support MCP server configuration.
    */
   export const windsurfAdapter: AgentAdapter = {
   ```
- [ ] 6. Add JSDoc before `export const clineAdapter` in `src/adapters/cline.ts`:
   ```typescript
   /**
    * Adapter for [Cline](https://github.com/cline/cline) — VS Code AI coding extension.
    *
    * Detects presence of `.clinerules` file or `.cline/` directory.
    * Generates `.clinerules` (primary instruction file) and `.cline/skills/`.
    * Does not support MCP server configuration.
    */
   export const clineAdapter: AgentAdapter = {
   ```
- [ ] 7. Regenerate: `npx typedoc --skipErrorChecking`
- [ ] 8. Verify:
   ```bash
   grep "Anthropic's official CLI\|Codeium's AI editor\|OpenAI's coding agent" docs/src/content/docs/api/adapters.md | head -5
   # Expected: 3 matches
   ```
- [ ] 9. Commit: `git add src/adapters/claude-code.ts src/adapters/cursor.ts src/adapters/codex.ts src/adapters/windsurf.ts src/adapters/cline.ts && git commit -m "docs(adapters): add JSDoc to all adapter constants"`

**Verification**: `npx typedoc --skipErrorChecking` — expected: all 5 adapter constants have description paragraphs in `adapters.md`

---

### Task 12: Document `src/adapters/index.ts`

**Files**: `src/adapters/index.ts`
**Est**: 2 minutes

**Steps**:
- [ ] 1. Read `src/adapters/index.ts` and add JSDoc:
   - Before `export const ALL_ADAPTERS`, update the existing 1-line comment to a full JSDoc block:
   ```typescript
   /**
    * The canonical registry of all supported agent adapters.
    *
    * This array is the single source of truth for which agents Codi supports.
    * Order determines auto-detection priority: earlier entries are checked first
    * when `codi generate` scans the project for active agents.
    *
    * @example
    * ```ts
    * import { ALL_ADAPTERS } from 'codi-cli';
    * const ids = ALL_ADAPTERS.map(a => a.id);
    * // ["claude-code", "cursor", "codex", "windsurf", "cline"]
    * ```
    */
   export const ALL_ADAPTERS: AgentAdapter[] = [
   ```
   - Before `export function registerAllAdapters()`, add:
   ```typescript
   /**
    * Registers all built-in adapters into the global adapter registry.
    *
    * Must be called once before any generator operations. The CLI calls this
    * automatically during startup. Library consumers must call it explicitly
    * before using `resolveConfig()` or `generate()`.
    *
    * @example
    * ```ts
    * import { registerAllAdapters } from 'codi-cli';
    * registerAllAdapters();
    * ```
    */
   export function registerAllAdapters(): void {
   ```
- [ ] 2. Regenerate: `npx typedoc --skipErrorChecking`
- [ ] 3. Verify:
   ```bash
   grep "single source of truth\|global adapter registry" docs/src/content/docs/api/adapters.md | head -3
   # Expected: 2 matches
   ```
- [ ] 4. Commit: `git add src/adapters/index.ts && git commit -m "docs(adapters): add JSDoc to ALL_ADAPTERS and registerAllAdapters"`

**Verification**: `npx typedoc --skipErrorChecking` — expected: `ALL_ADAPTERS` and `registerAllAdapters()` have description paragraphs in `adapters.md`

---

### Task 13: Document `src/core/config/resolver.ts`, `composer.ts`, `validator.ts`, `parser.ts`

**Files**: `src/core/config/resolver.ts`, `src/core/config/composer.ts`, `src/core/config/validator.ts`, `src/core/config/parser.ts`
**Est**: 5 minutes

**Steps**:
- [ ] 1. Verify baseline thin:
   ```bash
   grep -A3 "### resolveConfig" docs/src/content/docs/api/core/config.md | head -8
   # Expected: function signature but incomplete JSDoc (no @param, @returns, @example)
   ```
- [ ] 2. Replace the JSDoc on `resolveConfig` in `src/core/config/resolver.ts` (preserve all other code):
   ```typescript
   /**
    * Resolves the full project configuration by reading `.codi/` as the single source of truth.
    *
    * Reads the manifest, flags, rules, skills, agents, and MCP config from the `.codi/`
    * directory, validates them, and returns a `NormalizedConfig` ready for generation.
    * Presets are consumed at install time and are not re-read during resolution.
    *
    * @param projectRoot - Absolute path to the project root directory
    * @returns A `Result` wrapping the resolved config on success, or validation errors on failure
    *
    * @example
    * ```ts
    * import { resolveConfig, isOk } from 'codi-cli';
    *
    * const result = await resolveConfig(process.cwd());
    * if (isOk(result)) {
    *   console.log(`${result.data.rules.length} rules loaded`);
    * } else {
    *   result.errors.forEach(e => console.error(e.message));
    * }
    * ```
    */
   export async function resolveConfig(projectRoot: string): Promise<Result<NormalizedConfig>> {
   ```
- [ ] 3. Replace the JSDoc on `flagsFromDefinitions` in `src/core/config/composer.ts`:
   ```typescript
   /**
    * Converts raw flag definitions (as stored in `flags.yaml`) into resolved flags
    * with source tracking.
    *
    * Each resolved flag records the path of the `flags.yaml` file it came from,
    * enabling drift detection and audit logging.
    *
    * @param defs - Raw flag definitions keyed by flag name
    * @param source - Absolute path to the `flags.yaml` file these definitions were read from
    * @returns A `ResolvedFlags` map ready for use in `NormalizedConfig`
    *
    * @example
    * ```ts
    * const resolved = flagsFromDefinitions(
    *   { 'max-file-lines': { mode: 'enforced', value: 700, locked: false } },
    *   '/path/to/.codi/flags.yaml'
    * );
    * ```
    */
   export function flagsFromDefinitions(
   ```
- [ ] 4. Add JSDoc before `export function validateConfig` in `src/core/config/validator.ts`:
   ```typescript
   /**
    * Validates a `NormalizedConfig` and returns a list of errors.
    *
    * Checks agent ids against the registered adapter list, validates rule and skill
    * names and sizes, enforces flag references, and checks platform compatibility
    * for skills. Returns an empty array if the config is valid.
    *
    * @param config - The normalized config to validate
    * @returns An array of `ProjectError` objects. Empty array means valid.
    *
    * @example
    * ```ts
    * const errors = validateConfig(config);
    * if (errors.length > 0) {
    *   errors.forEach(e => console.error(e.message));
    * }
    * ```
    */
   export function validateConfig(config: NormalizedConfig): ProjectError[] {
   ```
- [ ] 5. Add JSDoc to `src/core/config/parser.ts` — before `ParsedProjectDir` and `scanProjectDir`:
   ```typescript
   /**
    * The raw parsed contents of a `.codi/` project directory, before validation.
    *
    * Produced by `scanProjectDir()` and consumed by `resolveConfig()`.
    */
   export interface ParsedProjectDir {
     /** The parsed project manifest from `codi.yaml`. */
     manifest: ProjectManifest;
     /** Raw flag definitions from `flags.yaml`, keyed by flag name. */
     flags: Record<string, FlagDefinition>;
     /** Normalized rules parsed from `.codi/rules/`. */
     rules: NormalizedRule[];
     /** Normalized skills parsed from `.codi/skills/`. */
     skills: NormalizedSkill[];
     /** Normalized agent definitions parsed from `.codi/agents/`. */
     agents: NormalizedAgent[];
     /** Parsed MCP server configuration from `mcp.yaml`. */
     mcp: McpConfig;
   }
   ```
   And before `export async function scanProjectDir`:
   ```typescript
   /**
    * Reads and parses all artifacts from a `.codi/` project directory.
    *
    * Reads the manifest, flags, rules, skills, agents, and MCP config in parallel.
    * Returns a `ParsedProjectDir` containing normalized but unvalidated data.
    *
    * @param projectRoot - Absolute path to the project root directory
    * @returns A `Result` wrapping the parsed directory contents, or errors if any file is invalid
    */
   export async function scanProjectDir(projectRoot: string): Promise<Result<ParsedProjectDir>> {
   ```
   And before `export async function parseManifest`:
   ```typescript
   /**
    * Reads and validates the `codi.yaml` manifest file from a config directory.
    *
    * @param configDir - Absolute path to the `.codi/` directory
    * @returns A `Result` wrapping the parsed manifest, or errors if the file is missing or invalid
    */
   export async function parseManifest(configDir: string): Promise<Result<ProjectManifest>> {
   ```
- [ ] 6. Regenerate: `npx typedoc --skipErrorChecking`
- [ ] 7. Verify:
   ```bash
   grep "single source of truth\|drift detection\|Checks agent ids" docs/src/content/docs/api/core/config.md | head -5
   # Expected: 3 matches
   ```
- [ ] 8. Commit: `git add src/core/config/resolver.ts src/core/config/composer.ts src/core/config/validator.ts src/core/config/parser.ts && git commit -m "docs(core/config): add JSDoc to resolver, composer, validator, parser"`

**Verification**: `npx typedoc --skipErrorChecking` — expected: `resolveConfig`, `validateConfig`, `flagsFromDefinitions`, `scanProjectDir`, `ParsedProjectDir` all have description paragraphs in `core/config.md`

---

### Task 14: Document `src/core/config/state.ts`

**Files**: `src/core/config/state.ts`
**Est**: 5 minutes

**Steps**:
- [ ] 1. Verify baseline thin:
   ```bash
   grep -A3 "StateManager" docs/src/content/docs/api/core/config.md | head -8
   # Expected: class header with no description paragraph
   ```
- [ ] 2. Add JSDoc to `src/core/config/state.ts`. Add comments before each interface and method (preserve all code, add documentation only):

   Before `export interface GeneratedFileState`:
   ```typescript
   /**
    * State record for a single file generated by a Codi adapter.
    *
    * Stored in `state.json` and used for drift detection: the `generatedHash`
    * is compared against the current on-disk hash to detect user edits.
    */
   export interface GeneratedFileState {
     /** Relative path of the generated file (relative to project root). */
     path: string;
     /** Hash of the source artifacts that produced this file. */
     sourceHash: string;
     /** Hash of the file content at generation time. Changes indicate user edits (drift). */
     generatedHash: string;
     /** Names of the source artifacts (rules, skills) that contributed to this file. */
     sources: string[];
     /** ISO 8601 timestamp of when this file was last generated. */
     timestamp: string;
   }
   ```

   Before `export interface ArtifactFileState`:
   ```typescript
   /**
    * State record for a single file installed from a preset.
    *
    * Tracks which preset each installed file came from, enabling targeted cleanup
    * when a preset is removed.
    */
   export interface ArtifactFileState {
     /** Relative path of the installed artifact file. */
     path: string;
     /** Content hash at installation time. */
     hash: string;
     /** Name of the preset this artifact came from. */
     preset: string;
     /** ISO 8601 timestamp of when this file was installed. */
     timestamp: string;
   }
   ```

   Before `export interface StateData`:
   ```typescript
   /**
    * The complete state stored in `.codi/state.json`.
    *
    * Tracks all generated files and their hashes to enable drift detection,
    * incremental generation, and preset artifact cleanup.
    */
   export interface StateData {
     /** Schema version. Always `"1"`. */
     version: "1";
     /** ISO 8601 timestamp of the most recent `codi generate` run. */
     lastGenerated: string;
     /** Generated file records keyed by agent id. */
     agents: Record<string, GeneratedFileState[]>;
     /** Generated hook file records. */
     hooks: GeneratedFileState[];
     /** Files installed from presets, used for cleanup on preset removal. */
     presetArtifacts?: ArtifactFileState[];
   }
   ```

   Before `export interface DriftFile`:
   ```typescript
   /**
    * Drift status for a single generated file.
    *
    * Produced by `StateManager.detectDrift()` by comparing the stored hash
    * against the current on-disk file content.
    */
   export interface DriftFile {
     /** Relative path of the file. */
     path: string;
     /**
      * Current drift status:
      * - `"synced"` — file matches the generated hash
      * - `"drifted"` — file has been modified since generation
      * - `"missing"` — file no longer exists on disk
      */
     status: "synced" | "drifted" | "missing";
     /** The expected hash from `state.json`. Present when `status` is `"drifted"`. */
     expectedHash?: string;
     /** The current on-disk hash. Present when `status` is `"drifted"`. */
     currentHash?: string;
   }
   ```

   Before `export interface DriftReport`:
   ```typescript
   /**
    * Drift report for all files belonging to a single agent.
    *
    * Returned by `StateManager.detectDrift()`.
    */
   export interface DriftReport {
     /** The agent id (e.g. `"claude-code"`). */
     agentId: string;
     /** Per-file drift status. */
     files: DriftFile[];
   }
   ```

   Before `export class StateManager`:
   ```typescript
   /**
    * Manages the Codi state file at `.codi/state.json`.
    *
    * The state file tracks all generated files and their hashes, enabling:
    * - **Drift detection**: identify files modified by the user since last generation
    * - **Incremental generation**: skip unchanged files
    * - **Preset cleanup**: remove only files installed by a specific preset
    *
    * @example
    * ```ts
    * const manager = new StateManager('/path/to/.codi', '/path/to/project');
    * const report = await manager.detectDrift('claude-code');
    * if (isOk(report)) {
    *   const drifted = report.data.files.filter(f => f.status === 'drifted');
    *   console.log(`${drifted.length} files modified since last generation`);
    * }
    * ```
    */
   export class StateManager {
   ```

   Add JSDoc to each public method inside `StateManager`:
   ```typescript
   /** Reads the state file. Returns an empty state if the file does not exist. */
   async read(): Promise<Result<StateData>> {

   /** Writes the state file atomically using a temp file + rename. */
   async write(state: StateData): Promise<Result<void>> {

   /** Updates the generated file records for a single agent. */
   async updateAgent(agentId: string, files: GeneratedFileState[]): Promise<Result<void>> {

   /** Updates the generated file records for multiple agents in a single write. */
   async updateAgentsBatch(updates: Record<string, GeneratedFileState[]>): Promise<Result<void>> {

   /** Updates the generated hook file records. */
   async updateHooks(files: GeneratedFileState[]): Promise<Result<void>> {

   /** Returns the generated file records for a single agent. */
   async getAgentFiles(agentId: string): Promise<Result<GeneratedFileState[]>> {

   /**
    * Compares the current on-disk files for an agent against their stored hashes.
    *
    * @param agentId - The agent id to check (e.g. `"claude-code"`)
    * @returns A `DriftReport` listing `synced`, `drifted`, and `missing` files
    */
   async detectDrift(agentId: string): Promise<Result<DriftReport>> {

   /** Merges new preset artifact records into the state, updating existing entries by path. */
   async updatePresetArtifacts(files: ArtifactFileState[]): Promise<Result<void>> {
   ```

- [ ] 3. Regenerate: `npx typedoc --skipErrorChecking`
- [ ] 4. Verify:
   ```bash
   grep "Drift detection\|atomically\|on-disk hash" docs/src/content/docs/api/core/config.md | head -5
   # Expected: 3+ matches
   ```
- [ ] 5. Commit: `git add src/core/config/state.ts && git commit -m "docs(core/config): add JSDoc to StateManager and state interfaces"`

**Verification**: `npx typedoc --skipErrorChecking` — expected: `StateManager`, `StateData`, `DriftReport`, `DriftFile`, and all public methods have description paragraphs in `core/config.md`

---

### Task 15: Full docs build and final verification

**Files**: none (verification only)
**Est**: 3 minutes

**Steps**:
- [ ] 1. Run the full docs build:
   ```bash
   npm run docs:build
   # Expected: "9 page(s) built" (or more if constants adds a page) with 0 errors
   ```
- [ ] 2. Verify the docs site has rich content — spot-check 3 generated files:
   ```bash
   # Check constants module was generated
   ls docs/src/content/docs/api/constants.md
   # Expected: file exists

   # Check schemas have field descriptions
   grep -c "effort tier\|preset-managed\|slash command\|git worktree" docs/src/content/docs/api/schemas.md
   # Expected: 4+

   # Check types have descriptions
   grep -c "discriminated union\|auto-select\|drift detection\|Injection priority" docs/src/content/docs/api/types.md
   # Expected: 3+

   # Check constants have descriptions
   grep -c "CLI binary\|source of truth\|kebab-case" docs/src/content/docs/api/constants.md
   # Expected: 3+
   ```
- [ ] 3. Confirm no TypeScript errors were introduced:
   ```bash
   npm run lint
   # Expected: 0 errors
   ```
- [ ] 4. Confirm no test regressions:
   ```bash
   npm test
   # Expected: all tests passing
   ```
- [ ] 5. Commit: `git add docs/src/content/docs/api/ && git commit -m "chore(docs): rebuild API reference with full JSDoc coverage"`

**Verification**: `npm run docs:build && npm run lint && npm test` — all passing

---

## Summary

| Task | Module | Symbols documented |
|---|---|---|
| 1 | `constants.ts` | ~40 constants + 3 functions |
| 2 | `types/result.ts` | 1 type + 4 functions |
| 3 | `types/config.ts` | 7 interfaces + 1 type |
| 4 | `types/flags.ts` | 6 types/interfaces + 1 const |
| 5 | `types/agent.ts` | 7 interfaces/types |
| 6 | `schemas/manifest.ts` + `rule.ts` | 2 Zod schemas |
| 7 | `schemas/skill.ts` | 1 Zod schema (14 fields described) |
| 8 | `schemas/agent.ts` | 1 Zod schema (14 fields described) |
| 9 | `schemas/flag.ts` | 3 Zod schemas |
| 10 | `schemas/mcp.ts` + `hooks.ts` + `evals.ts` + `feedback.ts` | 5 Zod schemas |
| 11 | `adapters/` (5 files) | 5 adapter constants |
| 12 | `adapters/index.ts` | 1 constant + 1 function |
| 13 | `core/config/` (4 files) | 4 functions + 1 interface |
| 14 | `core/config/state.ts` | 1 class + 8 methods + 5 interfaces |
| 15 | Final build | verification only |

**Total: ~95 symbols documented across 24 source files.**
