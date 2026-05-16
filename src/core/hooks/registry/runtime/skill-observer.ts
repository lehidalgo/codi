import type { RuntimeHookArtifact, HookVerdict } from "#src/core/hooks/hook-artifact.js";
import { MANAGED_BY_FRAMEWORK } from "#src/constants.js";

const HOOK_NAME = "skill-observer";

export const SKILL_OBSERVER_HOOK: RuntimeHookArtifact = {
  bucket: "runtime",
  name: HOOK_NAME,
  description: "Scans transcripts for [CODI-OBSERVATION:] markers and persists to .codi/feedback/.",
  version: "1",
  managed_by: MANAGED_BY_FRAMEWORK,
  required: false,
  default: true,
  category: "observation",
  events: ["Stop"],
  evaluate: (): HookVerdict => ({
    hookName: HOOK_NAME,
    matched: false,
    severity: "info",
  }),
};
