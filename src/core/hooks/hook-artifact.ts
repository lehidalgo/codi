/**
 * Unified hook artifact schema.
 *
 * Hooks are first-class artifacts on equal footing with rules, skills, and
 * agents. Two clean buckets cover every hook in the system:
 *
 *   - `git`     — pre-commit / pre-push / commit-msg events
 *   - `runtime` — agent runtime events (UserPromptSubmit, PreToolUse, ...)
 *
 * The discriminated union keeps both buckets type-safe under one registry
 * while leaving room for opt-in workflow integration via `phaseFilter` and
 * `dispatchSkill`.
 */

import type {
  HookCategory,
  HookLanguage,
  HookStage,
  InstallHint,
  PreCommitEmission,
  ShellEmission,
} from "./hook-spec.js";

export type { HookCategory } from "./hook-spec.js";

export type HookBucket = "git" | "runtime";

export type RuntimeEvent =
  | "UserPromptSubmit"
  | "PreToolUse"
  | "PostToolUse"
  | "Stop"
  | "SessionStart"
  | "InstructionsLoaded";

export type Severity = "info" | "warn" | "block";

export interface HookContext {
  bucket: HookBucket;
  event?: RuntimeEvent;
  toolName?: string;
  filePath?: string;
  content?: string;
  sessionId: string;
  cwd: string;
  workflowPhase?: string;
}

export interface HookVerdict {
  hookName: string;
  matched: boolean;
  severity: Severity;
  ruleId?: string;
  message?: string;
  suggestedAction?: string;
}

export interface BaseHookArtifact {
  name: string;
  description: string;
  version: string;
  managed_by: "codi" | "user";
  required: boolean;
  default: boolean;
  category: HookCategory;
  /** Optional workflow phase gate. Undefined = run in all phases. */
  phaseFilter?: string[];
  /** Optional skill delegation. When set, the hook is informational and the
   *  named skill performs the actual check (future gate-runner integration). */
  dispatchSkill?: string;
}

export interface GitHookArtifact extends BaseHookArtifact {
  bucket: "git";
  language: HookLanguage;
  stages: HookStage[];
  files: string;
  exclude?: string;
  preCommit: PreCommitEmission;
  shell: ShellEmission;
  installHint: InstallHint;
}

export interface RuntimeHookArtifact extends BaseHookArtifact {
  bucket: "runtime";
  events: RuntimeEvent[];
  evaluate: (ctx: HookContext) => HookVerdict | Promise<HookVerdict>;
}

export type HookArtifact = GitHookArtifact | RuntimeHookArtifact;

export function isGitHook(h: HookArtifact): h is GitHookArtifact {
  return h.bucket === "git";
}

export function isRuntimeHook(h: HookArtifact): h is RuntimeHookArtifact {
  return h.bucket === "runtime";
}
