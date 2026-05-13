import type { RuntimeHookArtifact } from "#src/core/hooks/hook-artifact.js";
import { evaluateSecurityReminder } from "#src/runtime/hooks/security-reminder/checker.js";
import { MANAGED_BY_FRAMEWORK } from "#src/constants.js";

export const SECURITY_REMINDER_HOOK: RuntimeHookArtifact = {
  bucket: "runtime",
  name: "security-reminder",
  description:
    "Advisory PreToolUse hook that flags risky code patterns (exec, eval, unsafe HTML, pickle, etc.) before the agent writes them.",
  version: "1",
  managed_by: MANAGED_BY_FRAMEWORK,
  required: false,
  default: true,
  category: "security",
  events: ["PreToolUse"],
  evaluate: (ctx) => evaluateSecurityReminder(ctx),
};
