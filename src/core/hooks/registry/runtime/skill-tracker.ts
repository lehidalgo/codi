import type { RuntimeHookArtifact, HookVerdict } from "#src/core/hooks/hook-artifact.js";

const HOOK_NAME = "skill-tracker";

export const SKILL_TRACKER_HOOK: RuntimeHookArtifact = {
  bucket: "runtime",
  name: HOOK_NAME,
  description: "Records active codi skills per session for self-improvement feedback.",
  version: "1",
  managed_by: "codi",
  required: false,
  default: true,
  category: "observation",
  events: ["InstructionsLoaded"],
  evaluate: (): HookVerdict => ({
    hookName: HOOK_NAME,
    matched: false,
    severity: "info",
  }),
};
