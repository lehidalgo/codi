import type { RuntimeHookArtifact, HookVerdict } from "#src/core/hooks/hook-artifact.js";

const HOOK_NAME = "workflow-classifier";

export const WORKFLOW_CLASSIFIER_HOOK: RuntimeHookArtifact = {
  bucket: "runtime",
  name: HOOK_NAME,
  description: "Phase-aware file edit classifier and Bash command rules.",
  version: "1",
  managed_by: "codi",
  required: true,
  default: true,
  category: "enforcement",
  events: ["PreToolUse"],
  evaluate: (): HookVerdict => ({
    hookName: HOOK_NAME,
    matched: false,
    severity: "info",
  }),
};
