import type { FlagSpec, ResolvedFlags } from "../../types/flags.js";
import type { ProjectError } from "../output/types.js";
import { createError } from "../output/errors.js";
import type { FlagLayer } from "./flag-resolver.js";

import { FLAG_CONDITION_KEYS } from "../../types/flags.js";
const LOCKABLE_LEVELS = new Set(["org", "team", "repo"]);

/**
 * Validates flags against 13 rules. MVP implements rules 1-4, 7-9, 11.
 * Rules 5-6 do not apply to MVP flags.
 * Rules 10, 12 are behaviors in the resolver.
 * Rule 13 requires hooks config (optional parameter).
 */
export function validateFlags(
  layers: FlagLayer[],
  _resolvedFlags: ResolvedFlags,
  catalog: Record<string, FlagSpec>,
  hooksConfig?: Record<string, boolean>,
): ProjectError[] {
  const errors: ProjectError[] = [];
  const lockedFlags = new Map<string, string>();

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

      const mode = definition.mode ?? "inherited";

      // Rule 1: Locked fields cannot be overridden by lower levels
      const lockSource = lockedFlags.get(flagName);
      if (lockSource) {
        errors.push(
          createError("E_FLAG_LOCKED", { flag: flagName, source: lockSource }),
        );
        continue;
      }

      // Rule 11: Only org, team, and repo levels can use locked:true
      if (definition.locked && !LOCKABLE_LEVELS.has(layer.level)) {
        errors.push(
          createError("E_FLAG_LOCKED_LEVEL", {
            flag: flagName,
            level: layer.level,
          }),
        );
      }

      // Rule 2: enforced mode cannot have conditions
      if (mode === "enforced" && definition.conditions) {
        errors.push(
          createError("E_FLAG_INVALID_MODE", {
            flag: flagName,
            reason: "enforced mode cannot have conditions",
          }),
        );
      }

      // Rule 3: conditional mode requires non-empty conditions
      if (mode === "conditional") {
        if (
          !definition.conditions ||
          Object.keys(definition.conditions).length === 0
        ) {
          errors.push(
            createError("E_FLAG_INVALID_MODE", {
              flag: flagName,
              reason: "conditional mode requires non-empty conditions",
            }),
          );
        }
      }

      // Rule 4: conditions only accept keys: lang, framework, agent, file_pattern
      if (definition.conditions) {
        for (const key of Object.keys(definition.conditions)) {
          if (!FLAG_CONDITION_KEYS.has(key)) {
            errors.push(
              createError("E_FLAG_INVALID_CONDITION", {
                flag: flagName,
                key,
              }),
            );
          }
        }
      }

      // Value type validation (Rules 7-9)
      if (definition.value !== undefined && mode !== "inherited") {
        const valueErrors = validateFlagValue(flagName, definition.value, spec);
        errors.push(...valueErrors);
      }

      // Track locks for subsequent layers
      if (definition.locked && mode === "enforced") {
        lockedFlags.set(flagName, layer.source);
      }

      // Rule 13: enforced flag's hook cannot be disabled in hooks config
      if (mode === "enforced" && spec.hook && hooksConfig) {
        const hookEnabled = hooksConfig[spec.hook];
        if (hookEnabled === false) {
          errors.push(
            createError("E_FLAG_INVALID_MODE", {
              flag: flagName,
              reason: `enforced flag's hook "${spec.hook}" is disabled in hooks config`,
            }),
          );
        }
      }
    }
  }

  return errors;
}

function validateFlagValue(
  flagName: string,
  value: unknown,
  spec: FlagSpec,
): ProjectError[] {
  const errors: ProjectError[] = [];

  switch (spec.type) {
    // Rule 7: Boolean flags accept only true/false
    case "boolean":
      if (typeof value !== "boolean") {
        errors.push(
          createError("E_FLAG_INVALID_VALUE", {
            flag: flagName,
            reason: `expected boolean, got ${typeof value}`,
          }),
        );
      }
      break;

    // Rule 8: Number flags must be positive integers > 0
    case "number":
      if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
        errors.push(
          createError("E_FLAG_INVALID_VALUE", {
            flag: flagName,
            reason: "expected positive integer > 0",
          }),
        );
      }
      break;

    // Rule 9: Enum flags must use defined values
    case "enum":
      if (!spec.values || !spec.values.includes(value as string)) {
        errors.push(
          createError("E_FLAG_INVALID_VALUE", {
            flag: flagName,
            reason: `expected one of [${spec.values?.join(", ")}], got "${String(value)}"`,
          }),
        );
      }
      break;

    // String array flags must be arrays of strings
    case "string[]":
      if (
        !Array.isArray(value) ||
        !value.every((v: unknown) => typeof v === "string")
      ) {
        errors.push(
          createError("E_FLAG_INVALID_VALUE", {
            flag: flagName,
            reason: "expected array of strings",
          }),
        );
      }
      break;
  }

  return errors;
}
