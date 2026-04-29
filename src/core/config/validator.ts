import type { NormalizedConfig } from "#src/types/config.js";
import type { ProjectError } from "../output/types.js";
import { createError } from "../output/errors.js";
import { getAllAdapters } from "../generator/adapter-registry.js";
import { ALL_ADAPTERS } from "#src/adapters/index.js";
import {
  MAX_ARTIFACT_CHARS,
  MAX_TOTAL_ARTIFACT_CHARS,
  MAX_SKILL_LINES,
  MAX_AGENT_LINES,
  ALL_SKILL_CATEGORIES,
  isKnownSkillCategory,
  SUPPORTED_PLATFORMS,
} from "#src/constants.js";
import { findConflictMarkers } from "#src/core/hooks/conflict-markers.js";

type SupportedPlatform = (typeof SUPPORTED_PLATFORMS)[number];

function getKnownAdapterIds(): string[] {
  const registered = getAllAdapters().map((a) => a.id);
  return registered.length > 0 ? registered : ALL_ADAPTERS.map((a) => a.id);
}

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
  const errors: ProjectError[] = [];

  errors.push(...validateAgents(config));
  errors.push(...validateRules(config));
  errors.push(...validateSkills(config));
  errors.push(...validateAgentArtifacts(config));
  errors.push(...validateFlags(config));
  errors.push(...validateMetadata(config));
  errors.push(...validateSkillPlatformCompatibility(config));
  errors.push(...validateNoConflictMarkers(config));

  return errors;
}

function validateNoConflictMarkers(config: NormalizedConfig): ProjectError[] {
  const errors: ProjectError[] = [];

  const scan = (kind: string, name: string, content: string): void => {
    const hits = findConflictMarkers(content);
    if (hits.length === 0) return;
    errors.push(
      createError("E_CONFLICT_MARKERS", {
        file: `${kind} "${name}"`,
        line: hits[0]!.line,
      }),
    );
  };

  for (const rule of config.rules) scan("rule", rule.name, rule.content);
  for (const skill of config.skills) scan("skill", skill.name, skill.content);
  for (const agent of config.agents) scan("agent", agent.name, agent.content);

  return errors;
}

function validateMetadata(config: NormalizedConfig): ProjectError[] {
  const warnings: ProjectError[] = [];
  for (const skill of config.skills) {
    if (skill.category && !isKnownSkillCategory(skill.category)) {
      warnings.push(
        createError("W_UNKNOWN_CATEGORY", {
          message: `Skill "${skill.name}" has unknown category "${skill.category}". Valid categories: ${ALL_SKILL_CATEGORIES.join(", ")}`,
        }),
      );
    }
  }
  return warnings;
}

export function validateContentSize(config: NormalizedConfig): ProjectError[] {
  const warnings: ProjectError[] = [];
  let totalChars = 0;

  for (const rule of config.rules) {
    const len = rule.content.length;
    totalChars += len;
    if (len > MAX_ARTIFACT_CHARS) {
      warnings.push(
        createError("W_CONTENT_SIZE", {
          message: `Rule "${rule.name}" is ${len.toLocaleString()} chars (limit: ${MAX_ARTIFACT_CHARS.toLocaleString()}). May exceed Windsurf/Claude Code per-rule limits.`,
        }),
      );
    }
  }

  for (const skill of config.skills) {
    const len = skill.content.length;
    const lines = skill.content.split("\n").length;
    totalChars += len;
    if (len > MAX_ARTIFACT_CHARS) {
      warnings.push(
        createError("W_CONTENT_SIZE", {
          message: `Skill "${skill.name}" is ${len.toLocaleString()} chars (limit: ${MAX_ARTIFACT_CHARS.toLocaleString()}). Consider splitting into smaller skills.`,
        }),
      );
    }
    if (lines > MAX_SKILL_LINES) {
      warnings.push(
        createError("W_CONTENT_SIZE", {
          message: `Skill "${skill.name}" is ${lines} lines (ACS recommendation: ≤${MAX_SKILL_LINES}). Consider splitting.`,
        }),
      );
    }
  }

  for (const agent of config.agents) {
    const len = agent.content.length;
    const lines = agent.content.split("\n").length;
    totalChars += len;
    if (len > MAX_ARTIFACT_CHARS) {
      warnings.push(
        createError("W_CONTENT_SIZE", {
          message: `Agent "${agent.name}" is ${len.toLocaleString()} chars (limit: ${MAX_ARTIFACT_CHARS.toLocaleString()}). Consider simplifying the system prompt.`,
        }),
      );
    }
    if (lines > MAX_AGENT_LINES) {
      warnings.push(
        createError("W_CONTENT_SIZE", {
          message: `Agent "${agent.name}" is ${lines} lines (ACS recommendation: ≤${MAX_AGENT_LINES}). Consider simplifying.`,
        }),
      );
    }
  }

  if (totalChars > MAX_TOTAL_ARTIFACT_CHARS) {
    warnings.push(
      createError("W_CONTENT_SIZE", {
        message: `Total artifact content is ${totalChars.toLocaleString()} chars (Windsurf limit: ${MAX_TOTAL_ARTIFACT_CHARS.toLocaleString()}). Agents with smaller context windows may not load all content.`,
      }),
    );
  }

  return warnings;
}

function validateAgents(config: NormalizedConfig): ProjectError[] {
  const errors: ProjectError[] = [];
  const agentIds = config.manifest.agents ?? [];

  for (const agentId of agentIds) {
    const known = getKnownAdapterIds();
    if (!known.includes(agentId)) {
      errors.push(
        createError("E_AGENT_NOT_FOUND", {
          agent: agentId,
          available: known.join(", "),
        }),
      );
    }
  }

  return errors;
}

function validateRules(config: NormalizedConfig): ProjectError[] {
  const errors: ProjectError[] = [];
  const names = new Set<string>();

  for (const rule of config.rules) {
    if (names.has(rule.name)) {
      errors.push(
        createError("E_CONFIG_INVALID", {
          message: `Duplicate rule name: "${rule.name}"`,
        }),
      );
    }
    names.add(rule.name);

    if (!rule.content.trim()) {
      errors.push(
        createError("E_CONFIG_INVALID", {
          message: `Rule "${rule.name}" has empty content`,
        }),
      );
    }
  }

  return errors;
}

function validateSkills(config: NormalizedConfig): ProjectError[] {
  const errors: ProjectError[] = [];
  const names = new Set<string>();
  const knownAgentNames = new Set(config.agents.map((a) => a.name));

  for (const skill of config.skills) {
    if (names.has(skill.name)) {
      errors.push(
        createError("E_CONFIG_INVALID", {
          message: `Duplicate skill name: "${skill.name}"`,
        }),
      );
    }
    names.add(skill.name);

    if (!skill.content.trim()) {
      errors.push(
        createError("E_CONFIG_INVALID", {
          message: `Skill "${skill.name}" has empty content`,
        }),
      );
    }

    if (skill.agent && !knownAgentNames.has(skill.agent)) {
      errors.push(
        createError("E_CONFIG_INVALID", {
          message: `Skill "${skill.name}" references unknown agent "${skill.agent}". Known agents: ${knownAgentNames.size > 0 ? [...knownAgentNames].join(", ") : "(none defined)"}`,
        }),
      );
    }
  }

  return errors;
}

function validateAgentArtifacts(config: NormalizedConfig): ProjectError[] {
  const errors: ProjectError[] = [];

  const agentNames = new Set<string>();
  for (const agent of config.agents) {
    if (agentNames.has(agent.name)) {
      errors.push(
        createError("E_CONFIG_INVALID", {
          message: `Duplicate agent name: "${agent.name}"`,
        }),
      );
    }
    agentNames.add(agent.name);

    if (!agent.content.trim()) {
      errors.push(
        createError("E_CONFIG_INVALID", {
          message: `Agent "${agent.name}" has empty content`,
        }),
      );
    }
  }

  return errors;
}

/**
 * Warn when a skill declares compatibility with non-CC platforms but uses
 * Claude Code-only fields that will be silently stripped on those platforms.
 */
function validateSkillPlatformCompatibility(config: NormalizedConfig): ProjectError[] {
  const warnings: ProjectError[] = [];
  const manifestAgents = new Set(config.manifest.agents ?? []);
  const nonCcPlatforms = (SUPPORTED_PLATFORMS as readonly SupportedPlatform[]).filter(
    (p) => p !== "claude-code",
  );

  for (const skill of config.skills) {
    const declaredCompat = skill.compatibility;

    // Determine effective target platforms:
    // explicit compatibility list > manifest agents > assume CC-only
    const targets: string[] =
      declaredCompat && declaredCompat.length > 0 ? declaredCompat : [...manifestAgents];

    const nonCcSet = new Set<string>(nonCcPlatforms);
    const hasNonCcTarget = targets.some((t) => nonCcSet.has(t));
    if (!hasNonCcTarget) continue;

    const strippedFields: string[] = [];
    if (skill.effort) strippedFields.push("effort");
    if (skill.context) strippedFields.push("context");
    if (skill.paths?.length) strippedFields.push("paths");
    if (skill.shell) strippedFields.push("shell");

    if (strippedFields.length > 0) {
      const nonCcTargets = targets.filter((t) => nonCcSet.has(t));
      warnings.push(
        createError("W_CONTENT_SIZE", {
          message: `Skill "${skill.name}" uses Claude Code-only fields (${strippedFields.join(", ")}) that will be stripped when generating for [${nonCcTargets.join(", ")}].`,
        }),
      );
    }
  }

  return warnings;
}

function validateFlags(config: NormalizedConfig): ProjectError[] {
  const errors: ProjectError[] = [];

  for (const [key, flag] of Object.entries(config.flags)) {
    if (flag.mode === "enforced" && flag.value === undefined) {
      errors.push(
        createError("E_CONFIG_INVALID", {
          message: `Flag "${key}" is enforced but has no value`,
        }),
      );
    }
  }

  return errors;
}
