/**
 * Q7 — interactive adaptive intake for the bug-fix workflow. Asks the dev
 * 7 questions sequentially via @clack/prompts, builds a complete
 * `BugFixAdaptation`, and returns it ready for `runWorkflow`.
 *
 * Used only on the `--interactive` flag of `codi workflow run bug-fix`.
 * The agent path uses the same questions inside the skill body without
 * needing this module — Claude/Codex conducts the Q&A in chat.
 */

import * as p from "@clack/prompts";
import type {
  BugFixAdaptation,
  BugFixExecuteMode,
  BugFixProfile,
  BugFixScope,
  BugFixSeverity,
} from "./types.js";

interface MaybeCancelled<T> {
  readonly value: T | null;
  readonly cancelled: boolean;
}

function cancelGuard<T>(raw: T | symbol): MaybeCancelled<T> {
  if (p.isCancel(raw)) return { value: null, cancelled: true };
  return { value: raw as T, cancelled: false };
}

export interface InteractiveResult {
  readonly cancelled: boolean;
  readonly adaptation: BugFixAdaptation | null;
}

/**
 * Run the interactive Q&A. Returns `{ cancelled: true, adaptation: null }`
 * when the dev hits Ctrl-C at any prompt; the caller should abort.
 */
export async function runBugFixInteractiveIntake(): Promise<InteractiveResult> {
  p.intro("bug-fix adaptive intake — answer 7 questions, the workflow compresses to fit");

  const sevRaw = await p.select({
    message: "Q1 — Severity?",
    options: [
      { value: "P0" as BugFixSeverity, label: "P0 — production down" },
      { value: "P1" as BugFixSeverity, label: "P1 — broken feature" },
      { value: "P2" as BugFixSeverity, label: "P2 — degraded UX (recommended)" },
      { value: "P3" as BugFixSeverity, label: "P3 — cosmetic" },
    ],
    initialValue: "P2" as BugFixSeverity,
  });
  const sev = cancelGuard<BugFixSeverity>(sevRaw);
  if (sev.cancelled) return { cancelled: true, adaptation: null };

  const reproRaw = await p.confirm({
    message: "Q2 — Is a reproducer already available?",
    initialValue: false,
  });
  const repro = cancelGuard<boolean>(reproRaw);
  if (repro.cancelled) return { cancelled: true, adaptation: null };

  const rootRaw = await p.confirm({
    message: "Q3 — Is the root cause already known?",
    initialValue: false,
  });
  const root = cancelGuard<boolean>(rootRaw);
  if (root.cancelled) return { cancelled: true, adaptation: null };

  const scopeRaw = await p.select({
    message: "Q4 — Scope: single file or multi-file?",
    options: [
      { value: "single" as BugFixScope, label: "single — one file" },
      { value: "multi" as BugFixScope, label: "multi — multiple files (recommended)" },
    ],
    initialValue: "multi" as BugFixScope,
  });
  const scope = cancelGuard<BugFixScope>(scopeRaw);
  if (scope.cancelled) return { cancelled: true, adaptation: null };

  const typeRaw = await p.select({
    message: "Q5 — Is this actually a bug, or feature/refactor in disguise?",
    options: [
      { value: "bug", label: "bug — keep this workflow (recommended)" },
      { value: "feature", label: "feature — convert via --carryover-from" },
      { value: "refactor", label: "refactor — convert via --carryover-from" },
    ],
    initialValue: "bug",
  });
  const type = cancelGuard<string>(typeRaw);
  if (type.cancelled) return { cancelled: true, adaptation: null };
  if (type.value !== "bug") {
    p.note(
      `Detected reclassification to '${type.value}'. After this run aborts, retry with:\n` +
        `  codi workflow run ${type.value} "<task>" --carryover-from <this-workflow-id>`,
      "Cross-workflow conversion",
    );
    p.outro("Aborting bug-fix intake — re-run with the right workflow type.");
    return { cancelled: true, adaptation: null };
  }

  const defaultExec: BugFixExecuteMode = scope.value === "single" ? "inline" : "subagent";
  const execRaw = await p.select({
    message: "Q6 — Execute mode?",
    options: [
      { value: "inline" as BugFixExecuteMode, label: "INLINE — primary agent ejecuta secuencial" },
      {
        value: "subagent" as BugFixExecuteMode,
        label: "SUBAGENT — fresh subagent per task with two-stage review",
      },
    ],
    initialValue: defaultExec,
  });
  const exec = cancelGuard<BugFixExecuteMode>(execRaw);
  if (exec.cancelled) return { cancelled: true, adaptation: null };

  const grillRaw = await p.confirm({
    message: "Q7 — Grill at intent? (failure mode ambiguous)",
    initialValue: false,
  });
  const grill = cancelGuard<boolean>(grillRaw);
  if (grill.cancelled) return { cancelled: true, adaptation: null };

  // Synthesize a profile name based on the answers — best-effort label.
  const profile: BugFixProfile = inferProfile({
    severity: sev.value!,
    reproducerExists: repro.value!,
    rootCauseKnown: root.value!,
    scope: scope.value!,
    executeMode: exec.value!,
    grill: grill.value!,
  });

  const adaptation: BugFixAdaptation = {
    profile,
    severity: sev.value!,
    reproducerExists: repro.value!,
    rootCauseKnown: root.value!,
    scope: scope.value!,
    executeMode: exec.value!,
    grill: grill.value!,
    interactive: true,
  };

  p.note(
    `Inferred profile: ${profile}\n` +
      `Severity: ${adaptation.severity}\n` +
      `Reproducer: ${adaptation.reproducerExists} | Root cause: ${adaptation.rootCauseKnown}\n` +
      `Scope: ${adaptation.scope} | Exec mode: ${adaptation.executeMode}\n` +
      `Grill: ${adaptation.grill}`,
    "Adaptation summary",
  );

  p.outro("Intake complete — starting bug-fix workflow.");
  return { cancelled: false, adaptation };
}

function inferProfile(
  input: Required<Omit<BugFixAdaptation, "profile" | "interactive">>,
): BugFixProfile {
  if (input.severity === "P0") return "incident";
  if (input.reproducerExists && input.rootCauseKnown && input.scope === "single") return "quick";
  if (input.executeMode === "subagent" && input.grill) return "deep";
  return "standard";
}
