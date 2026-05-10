import type { RuntimeHookArtifact } from "#src/core/hooks/hook-artifact.js";
import { IRON_LAWS_HOOK } from "./iron-laws-enforcer.js";
import { WORKFLOW_CLASSIFIER_HOOK } from "./workflow-classifier.js";
import { CAPTURE_MARKERS_HOOK } from "./capture-markers.js";
import { SKILL_TRACKER_HOOK } from "./skill-tracker.js";
import { SKILL_OBSERVER_HOOK } from "./skill-observer.js";
import { SECURITY_REMINDER_HOOK } from "./security-reminder.js";

/** All built-in runtime hook artifacts. */
export const RUNTIME_HOOKS: RuntimeHookArtifact[] = [
  IRON_LAWS_HOOK,
  WORKFLOW_CLASSIFIER_HOOK,
  CAPTURE_MARKERS_HOOK,
  SKILL_TRACKER_HOOK,
  SKILL_OBSERVER_HOOK,
  SECURITY_REMINDER_HOOK,
];
