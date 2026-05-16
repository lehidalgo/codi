/**
 * CORE-010 — Zod schema for the on-disk YAML hook registry.
 *
 * Validates every `src/core/hooks/registry/yaml/<lang>.yaml` at load
 * time. A typo in a key, a missing required field, or a wrong type
 * stops the loader with a clear error pointing at the offending file
 * and JSON path — the only safety net we had pre-CORE-010 was the TS
 * compiler, which a YAML source obviously loses. Without this schema,
 * the regression class "silently dropped hook" would be invisible
 * until a downstream test caught it.
 *
 * The shape mirrors `GitHookArtifact` in `../hook-artifact.ts` exactly.
 * On any change to that interface, update this schema and re-run the
 * registry tests — the loader returns `z.infer<typeof gitHookArtifact>`
 * so the two stay aligned at the type level.
 */
import { z } from "zod";
import { MANAGED_BY_VALUES } from "#src/constants.js";

const HOOK_LANGUAGES = [
  "typescript",
  "javascript",
  "python",
  "go",
  "rust",
  "java",
  "kotlin",
  "swift",
  "csharp",
  "cpp",
  "php",
  "ruby",
  "dart",
  "shell",
  "global",
] as const;

const HOOK_CATEGORIES = [
  "format",
  "lint",
  "type-check",
  "security",
  "test",
  "meta",
  "enforcement",
  "observation",
] as const;

const HOOK_STAGES = ["pre-commit", "pre-push", "commit-msg", "manual"] as const;

const installHintSchema = z.object({
  command: z.string(),
  url: z.string().optional(),
});

const shellEmissionSchema = z.object({
  command: z.string(),
  passFiles: z.boolean(),
  modifiesFiles: z.boolean(),
  toolBinary: z.string(),
});

const preCommitUpstreamSchema = z.object({
  kind: z.literal("upstream"),
  repo: z.string(),
  rev: z.string(),
  id: z.string(),
  args: z.array(z.string()).optional(),
  additionalDependencies: z.array(z.string()).optional(),
  passFilenames: z.boolean().optional(),
  alias: z.string().optional(),
});

const preCommitLocalSchema = z.object({
  kind: z.literal("local"),
  entry: z.string(),
  language: z.enum(["system", "node", "python"]),
  additionalDependencies: z.array(z.string()).optional(),
  passFilenames: z.boolean().optional(),
});

const preCommitEmissionSchema = z.discriminatedUnion("kind", [
  preCommitUpstreamSchema,
  preCommitLocalSchema,
]);

export const gitHookArtifactSchema = z.object({
  bucket: z.literal("git"),
  name: z.string().min(1),
  description: z.string(),
  version: z.string(),
  managed_by: z.enum(MANAGED_BY_VALUES),
  required: z.boolean(),
  default: z.boolean(),
  category: z.enum(HOOK_CATEGORIES),
  language: z.enum(HOOK_LANGUAGES),
  files: z.string(),
  exclude: z.string().optional(),
  stages: z.array(z.enum(HOOK_STAGES)).min(1),
  shell: shellEmissionSchema,
  preCommit: preCommitEmissionSchema,
  installHint: installHintSchema,
  phaseFilter: z.array(z.string()).optional(),
  dispatchSkill: z.string().optional(),
});

export const yamlRegistryFileSchema = z.object({
  schema_version: z.literal(1),
  hooks: z.array(gitHookArtifactSchema),
});

export type YamlRegistryFile = z.infer<typeof yamlRegistryFileSchema>;
