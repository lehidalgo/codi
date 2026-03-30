/**
 * Zod schema → Markdown table renderers.
 * Generic introspection of Zod schemas to produce field documentation.
 */
import { z } from "zod";
import { RuleFrontmatterSchema } from "#src/schemas/rule.js";
import { SkillFrontmatterSchema } from "#src/schemas/skill.js";
import { AgentFrontmatterSchema } from "#src/schemas/agent.js";
import { CommandFrontmatterSchema } from "#src/schemas/command.js";
import { ProjectManifestSchema } from "#src/schemas/manifest.js";
import {
  PROJECT_NAME,
  PROJECT_NAME_DISPLAY,
  PROJECT_CLI,
} from "#src/constants.js";

// ---------------------------------------------------------------------------
// Generic Zod field introspection
// ---------------------------------------------------------------------------

interface ZodFieldInfo {
  typeName: string;
  isOptional: boolean;
  defaultValue: unknown | undefined;
}

/* eslint-disable @typescript-eslint/no-explicit-any --
   Zod _def is intentionally untyped; we cast through `any` for introspection.
   Zod v4 uses `_def.type` (string) instead of v3's `_def.typeName`. */

export function extractZodFieldInfo(field: z.ZodTypeAny): ZodFieldInfo {
  let current: any = field;
  let isOptional = false;
  let defaultValue: unknown | undefined = undefined;

  // Unwrap wrappers to get to the terminal type
  for (let depth = 0; depth < 10; depth++) {
    const defType = current._def?.type as string | undefined;
    // Also check v3-style typeName for compatibility
    const typeName = current._def?.typeName as string | undefined;
    const kind = defType ?? typeName;

    if (kind === "default" || kind === "ZodDefault") {
      // Zod v4: _def.defaultValue is a plain value
      // Zod v3: _def.defaultValue is a function
      const dv = current._def.defaultValue;
      defaultValue = typeof dv === "function" ? dv() : dv;
      current = current._def.innerType;
      continue;
    }
    if (kind === "optional" || kind === "ZodOptional") {
      isOptional = true;
      current = current._def.innerType;
      continue;
    }
    break;
  }

  return {
    typeName: resolveTypeName(current),
    isOptional,
    defaultValue,
  };
}

function resolveTypeName(field: any): string {
  const defType = field._def?.type as string | undefined;
  const typeName = field._def?.typeName as string | undefined;
  const kind = defType ?? typeName;

  switch (kind) {
    case "string":
    case "ZodString":
      return "string";
    case "boolean":
    case "ZodBoolean":
      return "boolean";
    case "number":
    case "ZodNumber":
      return "number";
    case "literal":
    case "ZodLiteral": {
      // Zod v4: _def.values is an array
      const vals = field._def.values ?? [field._def.value];
      return `\`"${String(vals[0])}"\``;
    }
    case "enum":
    case "ZodEnum": {
      // Zod v4: _def.entries is Record<string, string>
      // Zod v3: _def.values is string[]
      const entries = field._def.entries;
      const values = entries
        ? (Object.values(entries) as string[])
        : ((field._def.values as string[]) ?? []);
      return values.map((v) => `\`${v}\``).join(" \\| ");
    }
    case "array":
    case "ZodArray": {
      // Zod v4: field.element; Zod v3: field._def.type
      const element = field.element ?? field._def.type;
      const inner = element ? resolveTypeName(element) : "unknown";
      return `${inner}[]`;
    }
    case "record":
    case "ZodRecord":
      return "Record<string, string>";
    case "union":
    case "ZodUnion": {
      const options = (field._def.options as any[]) ?? [];
      return options.map(resolveTypeName).join(" \\| ");
    }
    case "object":
    case "ZodObject":
      return "object";
    default:
      return kind ?? "unknown";
  }
}

/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Generic schema → Markdown table
// ---------------------------------------------------------------------------

export function renderZodSchemaTable(
  schema: z.ZodObject<z.ZodRawShape>,
  descriptions: Record<string, string>,
): string {
  const shape = schema.shape;
  const rows = Object.entries(shape).map(([key, field]) => {
    const info = extractZodFieldInfo(field as z.ZodTypeAny);
    const desc = descriptions[key] ?? "";
    const req = info.isOptional ? "No" : "Yes";
    const def =
      info.defaultValue !== undefined
        ? `\`${formatDefault(info.defaultValue)}\``
        : "—";
    return `| \`${key}\` | ${info.typeName} | ${req} | ${def} | ${desc} |`;
  });

  return [
    "| Field | Type | Required | Default | Description |",
    "|-------|------|----------|---------|-------------|",
    ...rows,
  ].join("\n");
}

function formatDefault(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "boolean" || typeof value === "number")
    return String(value);
  if (Array.isArray(value)) {
    return value.length === 0 ? "[]" : JSON.stringify(value);
  }
  return JSON.stringify(value);
}

// ---------------------------------------------------------------------------
// Flatten nested ZodObject fields with dot notation
// ---------------------------------------------------------------------------

function renderFlatSchemaTable(
  schema: z.ZodObject<z.ZodRawShape>,
  descriptions: Record<string, string>,
): string {
  const rows: string[] = [];
  flattenShape("", schema.shape, descriptions, rows);

  return [
    "| Field | Type | Required | Default | Description |",
    "|-------|------|----------|---------|-------------|",
    ...rows,
  ].join("\n");
}

function flattenShape(
  prefix: string,
  shape: z.ZodRawShape,
  descriptions: Record<string, string>,
  rows: string[],
): void {
  for (const [key, field] of Object.entries(shape)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const info = extractZodFieldInfo(field as z.ZodTypeAny);

    // If terminal type is object, recurse into its shape
    const inner = unwrapToTerminal(field as z.ZodTypeAny);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Zod _def is untyped
    const innerDef = (inner as any)._def;
    const innerKind = (innerDef?.type ?? innerDef?.typeName) as
      | string
      | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Zod v4 shape access
    const nestedShape = (inner as any).shape ?? innerDef?.shape;
    if ((innerKind === "object" || innerKind === "ZodObject") && nestedShape) {
      const resolvedShape =
        typeof nestedShape === "function"
          ? (nestedShape() as z.ZodRawShape)
          : (nestedShape as z.ZodRawShape);
      const desc = descriptions[fullKey] ?? "";
      const req = info.isOptional ? "No" : "Yes";
      rows.push(`| \`${fullKey}\` | object | ${req} | — | ${desc} |`);
      flattenShape(fullKey, resolvedShape, descriptions, rows);
    } else {
      const desc = descriptions[fullKey] ?? "";
      const req = info.isOptional ? "No" : "Yes";
      const def =
        info.defaultValue !== undefined
          ? `\`${formatDefault(info.defaultValue)}\``
          : "—";
      rows.push(
        `| \`${fullKey}\` | ${info.typeName} | ${req} | ${def} | ${desc} |`,
      );
    }
  }
}

function unwrapToTerminal(field: z.ZodTypeAny): z.ZodTypeAny {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Zod _def chain walking
  let current: any = field;
  for (let depth = 0; depth < 10; depth++) {
    const defType = current._def?.type as string | undefined;
    const typeName = current._def?.typeName as string | undefined;
    const kind = defType ?? typeName;
    if (
      kind === "default" ||
      kind === "ZodDefault" ||
      kind === "optional" ||
      kind === "ZodOptional"
    ) {
      current = current._def.innerType;
      continue;
    }
    break;
  }
  return current as z.ZodTypeAny;
}

// ---------------------------------------------------------------------------
// Description maps
// ---------------------------------------------------------------------------

const RULE_DESCRIPTIONS: Record<string, string> = {
  name: "Rule name (alphanumeric + hyphens)",
  description: "One-line description",
  type: "Always `rule`",
  language: "Language this rule applies to",
  priority: "Resolution priority",
  scope: "File pattern restriction",
  alwaysApply: "Whether rule is always active",
  managed_by: "Who manages this artifact",
};

const SKILL_DESCRIPTIONS: Record<string, string> = {
  name: "Skill name (alphanumeric + hyphens)",
  description: "One-line description",
  type: "Always `skill`",
  compatibility: "Compatible agent IDs",
  tools: "Required MCP tools",
  model: "Preferred AI model",
  managed_by: "Who manages this artifact",
  disableModelInvocation: "Prevent model from auto-invoking",
  argumentHint: "Hint shown when invoking",
  allowedTools: "Tools this skill can use",
  category: "Skill category for grouping",
  license: "License identifier",
  metadata: "Arbitrary key-value metadata",
  effort: "Claude Code effort level",
  context: "Run in forked context",
  agent: "Delegate to specific agent",
  "user-invocable": "Can be invoked via slash command",
  paths: "File paths the skill operates on",
  shell: "Shell environment",
};

const AGENT_DESCRIPTIONS: Record<string, string> = {
  name: "Agent name (strict alphanumeric + hyphens)",
  description: "Agent description",
  tools: "Tools this agent can use",
  model: "AI model for this agent",
  managed_by: "Who manages this artifact",
};

const COMMAND_DESCRIPTIONS: Record<string, string> = {
  name: "Command name (strict alphanumeric + hyphens)",
  description: "One-line description",
  managed_by: "Who manages this artifact",
};

const MANIFEST_DESCRIPTIONS: Record<string, string> = {
  name: "Project name (alphanumeric + hyphens)",
  version: "Manifest version (always `1`)",
  description: "Project description",
  agents: "Agent IDs to generate for",
  layers: "Toggle content types",
  "layers.rules": "Include rules in generation",
  "layers.skills": "Include skills in generation",
  "layers.commands": "Include commands in generation",
  "layers.agents": "Include agents in generation",
  "layers.context": "Include context in generation",
  [PROJECT_NAME]: `${PROJECT_NAME_DISPLAY} CLI settings`,
  [`${PROJECT_NAME}.requiredVersion`]: `Minimum ${PROJECT_NAME_DISPLAY} version (semver range)`,
  team: "Team name for team-level config",
  source: `Remote repo for \`${PROJECT_CLI} update --from\``,
  "source.repo": "Repository identifier",
  "source.branch": "Branch to pull from",
  "source.paths": "Artifact paths to sync",
  marketplace: "Marketplace registry settings",
  "marketplace.registry": "Registry repository",
  "marketplace.branch": "Registry branch",
  presetRegistry: "Preset registry settings",
  "presetRegistry.url": "Registry URL",
  "presetRegistry.branch": "Registry branch",
  presets: "Presets to load (order matters)",
};

// ---------------------------------------------------------------------------
// Per-schema wrapper functions
// ---------------------------------------------------------------------------

export function renderRuleFields(): string {
  return renderZodSchemaTable(RuleFrontmatterSchema, RULE_DESCRIPTIONS);
}

export function renderSkillFields(): string {
  return renderZodSchemaTable(SkillFrontmatterSchema, SKILL_DESCRIPTIONS);
}

export function renderAgentFields(): string {
  return renderZodSchemaTable(AgentFrontmatterSchema, AGENT_DESCRIPTIONS);
}

export function renderCommandFields(): string {
  return renderZodSchemaTable(CommandFrontmatterSchema, COMMAND_DESCRIPTIONS);
}

export function renderManifestFields(): string {
  return renderFlatSchemaTable(ProjectManifestSchema, MANIFEST_DESCRIPTIONS);
}
