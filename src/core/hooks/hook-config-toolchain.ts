/**
 * ISSUE-067 — preventive split of hook-config-generator.ts (was 666 LOC).
 *
 * This module owns the "toolchain decision" helpers: given the user's
 * resolved flags (python_type_checker, js_format_lint, commit_type_check),
 * resolve which hook variants survive the filter. Pure functions only —
 * no FS access, no side effects, no logging.
 *
 * The companion `assertAutoResolved` lives here so the toolchain decisions
 * fail fast at the boundary where the unresolved 'auto' is observed.
 */

import type { ResolvedFlags } from "#src/types/flags.js";
import type { HookSpec } from "./hook-spec.js";

export function assertAutoResolved(flagName: string): never {
  throw new Error(
    `Flag '${flagName}' has unresolved 'auto' value — call resolveAutoFlags(projectRoot, flags) before generateHooksConfig (see src/core/hooks/auto-detection.ts).`,
  );
}

/** Resolve the python_type_checker flag value. Throws on unresolved 'auto'. */
export function selectedPythonTypeChecker(
  flags: ResolvedFlags,
): "mypy" | "basedpyright" | "pyright" | "off" {
  const f = flags["python_type_checker"];
  if (!f || f.mode === "disabled") return "basedpyright";
  if (f.value === "auto") assertAutoResolved("python_type_checker");
  return f.value as "mypy" | "basedpyright" | "pyright" | "off";
}

/** Resolve the js_format_lint flag value. Throws on unresolved 'auto'. */
export function selectedJsFormatLint(flags: ResolvedFlags): "eslint-prettier" | "biome" | "off" {
  const f = flags["js_format_lint"];
  if (!f || f.mode === "disabled") return "eslint-prettier";
  if (f.value === "auto") assertAutoResolved("js_format_lint");
  return f.value as "eslint-prettier" | "biome" | "off";
}

/** Resolve the commit_type_check flag value. Throws on unresolved 'auto'. */
export function selectedCommitTypeCheck(flags: ResolvedFlags): "on" | "off" {
  const f = flags["commit_type_check"];
  if (!f || f.mode === "disabled") return "off";
  if (f.value === "auto") assertAutoResolved("commit_type_check");
  return f.value as "on" | "off";
}

/**
 * Filter Python type checker hooks by the user's python_type_checker flag.
 * Only the selected checker survives; the others are dropped from the spec
 * list. Non-Python hooks pass through unchanged.
 */
export function isPythonTypeCheckerSelected(
  hookName: string,
  selected: "mypy" | "basedpyright" | "pyright" | "off",
): boolean {
  const isPyChecker = hookName === "mypy" || hookName === "basedpyright" || hookName === "pyright";
  if (!isPyChecker) return true;
  if (selected === "off") return false;
  return hookName === selected;
}

/**
 * Filter JS/TS lint+format hooks by the user's js_format_lint flag.
 * - 'eslint-prettier' keeps eslint + prettier, drops biome.
 * - 'biome' keeps biome, drops eslint + prettier.
 * - 'off' drops all three.
 * Hooks outside the JS/TS lint+format set (tsc, etc.) pass through unchanged.
 */
export function isJsToolchainSelected(
  hook: HookSpec,
  selected: "eslint-prettier" | "biome" | "off",
): boolean {
  const isEslintPrettier =
    (hook.language === "typescript" || hook.language === "javascript") &&
    (hook.name === "eslint" || hook.name === "prettier");
  const isBiome =
    (hook.language === "typescript" || hook.language === "javascript") && hook.name === "biome";
  if (!isEslintPrettier && !isBiome) return true;
  if (selected === "off") return false;
  if (selected === "biome") return isBiome;
  return isEslintPrettier; // 'eslint-prettier'
}
