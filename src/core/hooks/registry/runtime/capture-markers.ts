import type { RuntimeHookArtifact, HookVerdict } from "#src/core/hooks/hook-artifact.js";

const HOOK_NAME = "capture-markers";

export const CAPTURE_MARKERS_HOOK: RuntimeHookArtifact = {
  bucket: "runtime",
  name: HOOK_NAME,
  description: 'Captures |TYPE: "..."| markers from agent transcripts into the brain.',
  version: "1",
  managed_by: "codi",
  required: true,
  default: true,
  category: "observation",
  events: ["Stop"],
  evaluate: (): HookVerdict => ({
    hookName: HOOK_NAME,
    matched: false,
    severity: "info",
  }),
};
