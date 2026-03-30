import type { NormalizedConfig } from "../../types/config.js";
import type { ProjectError } from "../output/types.js";
import { createError } from "../output/errors.js";
import { getAllAdapters } from "../generator/adapter-registry.js";
import { ALL_ADAPTERS } from "../../adapters/index.js";
import {
  MAX_ARTIFACT_CHARS,
  MAX_TOTAL_ARTIFACT_CHARS,
  MAX_SKILL_LINES,
  MAX_COMMAND_LINES,
  MAX_AGENT_LINES,
} from "#src/constants.js";

function getKnownAdapterIds(): string[] {
  const registered = getAllAdapters().map((a) => a.id);
  return registered.length > 0 ? registered : ALL_ADAPTERS.map((a) => a.id);
}

export function validateConfig(config: NormalizedConfig): ProjectError[] {
  const errors: ProjectError[] = [];

  errors.push(...validateAgents(config));
  errors.push(...validateRules(config));
  errors.push(...validateFlags(config));

  return errors;
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

  for (const command of config.commands) {
    const len = command.content.length;
    const lines = command.content.split("\n").length;
    totalChars += len;
    if (len > MAX_ARTIFACT_CHARS) {
      warnings.push(
        createError("W_CONTENT_SIZE", {
          message: `Command "${command.name}" is ${len.toLocaleString()} chars (limit: ${MAX_ARTIFACT_CHARS.toLocaleString()}).`,
        }),
      );
    }
    if (lines > MAX_COMMAND_LINES) {
      warnings.push(
        createError("W_CONTENT_SIZE", {
          message: `Command "${command.name}" is ${lines} lines (ACS recommendation: ≤${MAX_COMMAND_LINES}).`,
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
