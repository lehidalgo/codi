import type { RuntimeHookArtifact, HookVerdict } from "#src/core/hooks/hook-artifact.js";
import { MANAGED_BY_FRAMEWORK } from "#src/constants.js";

const HOOK_NAME = "iron-laws-enforcer";

/**
 * Adapter: registers the existing iron-laws-enforcer logic as a first-class
 * runtime hook artifact. Actual enforcement still runs inside
 * `cli/agent-hooks.ts` via the existing call sites; this artifact exists so
 * that the unified registry can surface the hook in `codi list hooks` and
 * the onboarding wizard.
 */
export const IRON_LAWS_HOOK: RuntimeHookArtifact = {
  bucket: "runtime",
  name: HOOK_NAME,
  description: "Enforces Iron Laws 4-8 (gates, pull-before-patch, git approval, output mode).",
  version: "1",
  managed_by: MANAGED_BY_FRAMEWORK,
  required: true,
  default: true,
  category: "enforcement",
  events: ["UserPromptSubmit", "PreToolUse"],
  evaluate: (): HookVerdict => ({
    hookName: HOOK_NAME,
    matched: false,
    severity: "info",
  }),
};
