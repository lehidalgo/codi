/**
 * ISSUE-067 — preventive split of hook-installer.ts (was 668 LOC).
 *
 * This module owns the "compile a template constant into the final script
 * string" helpers. They are pure functions: template string + parameters →
 * shell or node script. hook-installer.ts orchestrates the file writes and
 * keeps the heavier installation / settings.json merging logic.
 */

import type { HookEntry } from "./hook-registry.js";
import { RUNNER_TEMPLATE } from "./runner-template.js";
import {
  SECRET_SCAN_TEMPLATE,
  FILE_SIZE_CHECK_TEMPLATE,
  TEMPLATE_WIRING_CHECK_TEMPLATE,
  ARTIFACT_VALIDATE_TEMPLATE,
  STAGED_JUNK_CHECK_TEMPLATE,
} from "./hook-templates.js";
import { VERSION_BUMP_TEMPLATE } from "./version-bump-template.js";
import { buildVendoredDirsTemplatePatterns } from "./exclusions.js";

/**
 * Compose the pre-commit runner script from RUNNER_TEMPLATE + the
 * pre-filtered HookEntry list. Hooks ship as a JSON blob inlined into the
 * script so the runner is self-contained (no FS lookups at fire time).
 */
export function buildRunnerScript(hooks: HookEntry[]): string {
  const preCommitHooks = hooks.filter((h) => h.stages.includes("pre-commit"));
  const hooksJson = JSON.stringify(preCommitHooks, null, 2);
  return RUNNER_TEMPLATE.replace("{{HOOKS_JSON}}", hooksJson);
}

export function buildSecretScanScript(): string {
  return SECRET_SCAN_TEMPLATE;
}

export function buildFileSizeScript(maxLines: number): string {
  return FILE_SIZE_CHECK_TEMPLATE.replace("{{MAX_LINES}}", String(maxLines)).replace(
    "{{VENDORED_DIRS_PATTERNS}}",
    buildVendoredDirsTemplatePatterns(),
  );
}

export function buildTemplateWiringScript(): string {
  return TEMPLATE_WIRING_CHECK_TEMPLATE;
}

export function buildArtifactValidateScript(): string {
  return ARTIFACT_VALIDATE_TEMPLATE;
}

export function buildVersionBumpScript(): string {
  return VERSION_BUMP_TEMPLATE;
}

export function buildStagedJunkCheckScript(): string {
  return STAGED_JUNK_CHECK_TEMPLATE;
}
