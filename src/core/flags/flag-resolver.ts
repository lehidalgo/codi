import type {
  FlagConditions,
  FlagDefinition,
  FlagSpec,
  ResolvedFlags,
} from "../../types/flags.js";
import { FLAG_CONDITION_KEYS } from "../../types/flags.js";
import type { Result } from "../../types/result.js";
import { ok, err } from "../../types/result.js";
import type { ProjectError } from "../output/types.js";
import { createError } from "../output/errors.js";
import { getDefaultFlags } from "./flag-catalog.js";

export interface FlagLayer {
  level: string;
  source: string;
  flags: Record<string, FlagDefinition>;
}

export interface ResolutionContext {
  languages: string[];
  frameworks: string[];
  agents: string[];
}

function conditionsMatch(
  conditions: FlagConditions,
  context: ResolutionContext,
): boolean {
  for (const [key, values] of Object.entries(conditions)) {
    if (!values || values.length === 0) continue;

    let contextValues: string[];
    switch (key) {
      case "lang":
        contextValues = context.languages;
        break;
      case "framework":
        contextValues = context.frameworks;
        break;
      case "agent":
        contextValues = context.agents;
        break;
      case "file_pattern":
        // file_pattern matching is deferred to runtime; treat as match for resolution
        continue;
      default:
        continue;
    }

    const hasOverlap = values.some((v: string) => contextValues.includes(v));
    if (!hasOverlap) return false;
  }
  return true;
}

function hasValidConditionKeys(conditions: FlagConditions): boolean {
  return Object.keys(conditions).every((key) => FLAG_CONDITION_KEYS.has(key));
}

export function resolveFlags(
  layers: FlagLayer[],
  context: ResolutionContext,
  catalog: Record<string, FlagSpec>,
): Result<ResolvedFlags> {
  const resolved = getDefaultFlags();
  const lockedFlags = new Map<string, string>(); // flag name → source that locked it
  const errors: ProjectError[] = [];

  for (const layer of layers) {
    for (const [flagName, definition] of Object.entries(layer.flags)) {
      const spec = catalog[flagName];
      if (!spec) {
        errors.push(
          createError("E_FLAG_UNKNOWN", {
            flag: flagName,
            source: layer.source,
          }),
        );
        continue;
      }

      // Check if flag is locked by a higher-priority level
      const lockSource = lockedFlags.get(flagName);
      if (lockSource) {
        errors.push(
          createError("E_FLAG_LOCKED", { flag: flagName, source: lockSource }),
        );
        continue;
      }

      const mode = definition.mode ?? "inherited";

      switch (mode) {
        case "inherited":
          // Skip — use parent value
          break;

        case "delegated_to_agent_default":
          // Use catalog default, continue to lower levels
          resolved[flagName] = {
            value: spec.default,
            mode: "delegated_to_agent_default",
            source: layer.source,
            locked: false,
          };
          break;

        case "conditional": {
          if (!definition.conditions) break;
          if (!hasValidConditionKeys(definition.conditions)) break;
          if (conditionsMatch(definition.conditions, context)) {
            resolved[flagName] = {
              value: definition.value ?? spec.default,
              mode: "conditional",
              source: layer.source,
              locked: false,
            };
          }
          break;
        }

        case "enforced":
        case "enabled":
        case "disabled": {
          const value =
            mode === "disabled"
              ? getDisabledValue(spec)
              : (definition.value ?? spec.default);

          resolved[flagName] = {
            value,
            mode,
            source: layer.source,
            locked: definition.locked ?? false,
          };

          if (definition.locked) {
            lockedFlags.set(flagName, layer.source);
          }
          break;
        }
      }
    }
  }

  if (errors.length > 0) {
    return err(errors);
  }

  return ok(resolved);
}

function getDisabledValue(spec: FlagSpec): unknown {
  switch (spec.type) {
    case "boolean":
      return false;
    case "number":
      return 0;
    case "enum":
      return "off";
    case "string[]":
      return [];
  }
}
