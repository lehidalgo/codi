/**
 * Pure logic for the pre-tool-use hook. Separated from the CLI script so
 * it is unit-testable.
 *
 * The hook is the guardrail layer of the enforcement model. It does not
 * make policy decisions on its own — it consults the classifier (for
 * file edits) and pattern rules (for shell commands), then maps the
 * verdict to an allow / block decision with a structured feedback
 * message for the agent.
 */

import { classifyChange, type ClassifyResult } from "./classifier.js";
import { reduce } from "./reducer.js";
import { EventLog } from "./event-log.js";
import type { ManifestEvent, Phase, ReducedState } from "./types.js";
import { readFileSafe } from "./fs-utils.js";

export type HookDecision =
  | { allow: true; reason?: string; auto_event?: ManifestEvent }
  | { allow: false; reason: string; suggested_action: string };

export interface HookContext {
  cwd: string;
  state: ReducedState | null;
}

export interface ToolCall {
  tool_name: string;
  tool_input: Record<string, unknown>;
}

// ─── Bash pattern rules per phase ─────────────────────────────────────

interface BashRule {
  pattern: RegExp;
  blocked_in_phases: Phase[] | "all";
  reason: string;
  suggested_action: string;
}

const BASH_RULES: BashRule[] = [
  {
    pattern: /^\s*git\s+push\b/,
    blocked_in_phases: ["intent", "plan", "decompose", "execute"],
    reason: "git push is not allowed before phase verify. Push happens after validation passes.",
    suggested_action:
      "Complete the current phase, transition to verify, then push when validation is green.",
  },
  {
    pattern: /^\s*gh\s+pr\s+create\b/,
    blocked_in_phases: ["intent", "plan", "decompose", "execute", "verify"],
    reason: "PR creation is only allowed in phase done. Verify gates must pass first.",
    suggested_action: "Reach phase done by passing the verify gate, then create the PR.",
  },
  {
    pattern: /^\s*rm\s+-rf?\s+\//,
    blocked_in_phases: "all",
    reason: "rm -rf at root is destructive and never authorized by devloop.",
    suggested_action: "If you need to delete files, name them explicitly.",
  },
  {
    pattern: /^\s*git\s+reset\s+--hard\b/,
    blocked_in_phases: "all",
    reason: "git reset --hard discards uncommitted work and breaks the audit trail.",
    suggested_action:
      "Use `devloop abandon --reason '<text>'` to end the workflow cleanly, or fix the issue without resetting.",
  },
  {
    pattern: /^\s*git\s+push\s+--force\b/,
    blocked_in_phases: "all",
    reason:
      "Force-push is gated by archive-preservation checks (M5). Even then it must be done explicitly.",
    suggested_action:
      "If a rebase is needed, do it without force-pushing, or coordinate with maintainer.",
  },
];

// ─── Public entry: evaluate a tool call ──────────────────────────────

export function evaluateToolCall(call: ToolCall, ctx: HookContext): HookDecision {
  // No active workflow → no enforcement.
  if (ctx.state === null) {
    return { allow: true, reason: "No active workflow; hook is pass-through." };
  }
  // Workflow not active or paused → block destructive Bash; allow Read.
  if (ctx.state.status === "completed" || ctx.state.status === "abandoned") {
    return {
      allow: true,
      reason: `Workflow is ${ctx.state.status}; hook is advisory only.`,
    };
  }

  switch (call.tool_name) {
    case "Edit":
    case "Write":
    case "NotebookEdit":
      return evaluateFileEdit(call, ctx);
    case "Bash":
      return evaluateBashCommand(call, ctx);
    default:
      return { allow: true };
  }
}

// ─── Workflow artifact paths ─────────────────────────────────────────

/**
 * Identifies files that are workflow-produced artifacts (not source code).
 * These are always permitted in their relevant phases, no scope expansion
 * required. The workflow IS supposed to produce them.
 *
 * Returns the artifact kind ("CONTEXT" | "ADR" | "PLAN" | "categorized-doc")
 * if the path matches a workflow artifact in the current phase, or null if
 * not an artifact (or wrong phase for that artifact kind).
 */
function classifyWorkflowArtifact(filePath: string, phase: Phase): string | null {
  // Normalize to forward-slash for cross-platform matching
  const normalized = filePath.replace(/\\/g, "/");

  // devloop state files — project config, queues, drafts, etc. Allowed any phase.
  // These are workflow-managed artifacts (not source code), produced by
  // project-workflow.intent (.devloop/project.json), sheets-sync
  // (.devloop/sheets-queue.jsonl), and discover/decompose drafts
  // (.devloop/draft/*.json). Match any json/jsonl inside .devloop/ at any depth.
  if (/(^|\/)\.devloop\/(.+\/)?[^/]+\.(json|jsonl)$/i.test(normalized)) {
    return "devloop-state";
  }

  // .gitignore — workflow-config artifact, allowed any phase. Agents need to
  // add .workflow/ + similar transient runtime dirs to gitignore.
  if (/(^|\/)\.gitignore$/i.test(normalized)) {
    return "gitignore";
  }

  // CONTEXT.md — knowledge base, updated inline during ANY phase
  if (/(^|\/)docs\/CONTEXT\.md$/i.test(normalized)) {
    return "CONTEXT";
  }

  // ADRs — architectural decisions, written during plan or decompose
  if (/(^|\/)docs\/adr\/[^/]+\.md$/i.test(normalized)) {
    if (["plan", "decompose"].includes(phase)) return "ADR";
    return null;
  }

  // [PLAN] markdown — plan artifact, written during plan phase
  if (/(^|\/)docs\/\d{8}_\d{6}_\[PLAN\]_[^/]+\.md$/i.test(normalized)) {
    if (phase === "plan") return "PLAN";
    return null;
  }

  // Other categorized docs — research, architecture, etc., written during
  // intent or plan phases
  if (
    /(^|\/)docs\/\d{8}_\d{6}_\[(ARCHITECTURE|RESEARCH|TECH|GUIDE|REPORT|AUDIT|TESTING|BUSINESS|SECURITY|ROADMAP)\]_[^/]+\.md$/i.test(
      normalized,
    )
  ) {
    if (["intent", "plan"].includes(phase)) return "categorized-doc";
    return null;
  }

  return null;
}

// ─── File edits ──────────────────────────────────────────────────────

function evaluateFileEdit(call: ToolCall, ctx: HookContext): HookDecision {
  const filePath = (call.tool_input["file_path"] ?? call.tool_input["path"]) as string | undefined;
  if (typeof filePath !== "string") {
    return { allow: true, reason: "Tool call missing file_path; cannot evaluate." };
  }

  const state = ctx.state;
  if (!state) return { allow: true };

  // Workflow artifact files — always allowed in their relevant phases. These
  // are produced BY the workflow itself (plan markdown, ADRs, knowledge base
  // updates) and would otherwise be blocked by the phase rule below.
  const artifactKind = classifyWorkflowArtifact(filePath, state.current_phase);
  if (artifactKind !== null) {
    return {
      allow: true,
      reason: `Workflow artifact (${artifactKind}) — permitted in phase ${state.current_phase}.`,
    };
  }

  // In-scope files: always permitted, no event needed.
  if (state.scope.files_in_plan.includes(filePath)) {
    return { allow: true };
  }

  // Pre-execute phases: edits to source files outside scope are not allowed.
  const sourcePhases: Phase[] = ["intent", "plan", "decompose"];
  if (sourcePhases.includes(state.current_phase)) {
    return {
      allow: false,
      reason: `File edits to source files are not appropriate in phase ${state.current_phase}. The phase is for understanding and planning, not coding. (Workflow artifacts like docs/[PLAN]_*.md, docs/CONTEXT.md, docs/adr/*.md ARE allowed.)`,
      suggested_action: `If you need to write a plan markdown, use docs/YYYYMMDD_HHMMSS_[PLAN]_<slug>.md naming. To edit source code, transition to execute first via \`devloop transition --to execute\`.`,
    };
  }

  // Execute / verify / data-validation: classify the change.
  const oldContent = readFileSafe(filePath, ctx.cwd);
  // For Write tool: tool_input.content is the new content
  // For Edit tool: we don't have the new content yet (Claude has not written),
  //   so we conservatively classify the file as if any change is structural.
  const newContent =
    typeof call.tool_input["content"] === "string"
      ? (call.tool_input["content"] as string)
      : oldContent + "\n[edit pending]";

  const result: ClassifyResult = classifyChange({
    file_path: filePath,
    old_content: oldContent,
    new_content: newContent,
    files_in_plan: state.scope.files_in_plan,
  });

  if (result.category === "incidental") {
    return {
      allow: true,
      reason: `Classifier verdict: ${result.reason}`,
      // The hook does NOT auto-write the incidental_change_recorded event
      // here — that is done in the post-tool-use flow (M2-T02 second half)
      // because we need the actual final content after the edit completes.
    };
  }

  // scope-expansion → block
  const elevationHint = result.suggested_elevation
    ? `\nThe classifier suggests elevation to a child workflow of type '${result.suggested_elevation.workflow_type}' (trigger: ${result.suggested_elevation.trigger}). If you agree, propose elevation instead of expansion.`
    : "";

  return {
    allow: false,
    reason: `Scope violation: file '${filePath}' is not in the plan. ${result.reason}`,
    suggested_action: `Run \`devloop scope propose-expansion --file '${filePath}' --reason "<why>"\` and wait for human approval.${elevationHint}`,
  };
}

// ─── Bash commands ───────────────────────────────────────────────────

function evaluateBashCommand(call: ToolCall, ctx: HookContext): HookDecision {
  const command = call.tool_input["command"] as string | undefined;
  if (typeof command !== "string") return { allow: true };

  const state = ctx.state;
  if (!state) return { allow: true };

  for (const rule of BASH_RULES) {
    if (!rule.pattern.test(command)) continue;
    const blocked =
      rule.blocked_in_phases === "all" || rule.blocked_in_phases.includes(state.current_phase);
    if (blocked) {
      return {
        allow: false,
        reason: rule.reason,
        suggested_action: rule.suggested_action,
      };
    }
  }

  return { allow: true };
}

// ─── Convenience: build context from filesystem ──────────────────────

export function buildContext(cwd: string): HookContext {
  const log = EventLog.fromCwd(cwd);
  const id = log.getActiveWorkflowId();
  if (!id) return { cwd, state: null };
  const events = log.loadEvents(id);
  if (events.length === 0) return { cwd, state: null };
  return { cwd, state: reduce(events) };
}

// ─── Post-tool-use: record incidental changes ───────────────────────

export interface PostToolCall extends ToolCall {
  tool_response?: {
    success?: boolean;
    [k: string]: unknown;
  };
}

export interface PostToolDecision {
  recorded: boolean;
  reason: string;
  details?: {
    file_path: string;
    lines_changed: number;
    classifier_reason: string;
  };
}

/**
 * Evaluate a successful tool call and decide whether to record an
 * incidental_change_recorded event. The post-tool-use hook calls this
 * after Claude has executed an Edit/Write/NotebookEdit; the actual
 * post-edit content of the file is now on disk and can be compared
 * against the pre-edit content provided in tool_input.
 *
 * The function is decision-only: actually appending the event happens
 * in the hook script via recordIncidentalChange in cli-handlers.
 */
export function evaluatePostToolCall(
  call: PostToolCall,
  ctx: HookContext,
  postContent: string,
): PostToolDecision {
  if (!ctx.state) {
    return { recorded: false, reason: "No active workflow." };
  }
  if (
    call.tool_name !== "Edit" &&
    call.tool_name !== "Write" &&
    call.tool_name !== "NotebookEdit"
  ) {
    return { recorded: false, reason: "Tool is not a file edit." };
  }
  const filePath = (call.tool_input["file_path"] ?? call.tool_input["path"]) as string | undefined;
  if (typeof filePath !== "string") {
    return { recorded: false, reason: "Missing file_path." };
  }

  // In-scope files do not record incidental events; the change is part
  // of the planned work.
  if (ctx.state.scope.files_in_plan.includes(filePath)) {
    return { recorded: false, reason: "File is in plan scope; not incidental." };
  }

  // Reconstruct old content. For Edit, tool_input.old_string is the content
  // before the edit; we don't have the entire file pre-edit easily, so we
  // approximate by reading from git HEAD.
  const oldFromInput = call.tool_input["old_string"] as string | undefined;
  const oldContent =
    typeof oldFromInput === "string" && oldFromInput.length > 0 ? oldFromInput : ""; // empty fallback

  const result = classifyChange({
    file_path: filePath,
    old_content: oldContent,
    new_content: postContent,
    files_in_plan: ctx.state.scope.files_in_plan,
  });

  if (result.category !== "incidental") {
    return {
      recorded: false,
      reason: `Classifier verdict is ${result.category}; pre-tool-use should have blocked.`,
    };
  }

  return {
    recorded: true,
    reason: "Incidental change to file outside plan scope.",
    details: {
      file_path: filePath,
      lines_changed: result.diff_stats.lines_changed,
      classifier_reason: result.reason,
    },
  };
}

// ─── User prompt enrichment ──────────────────────────────────────────

/**
 * Build the workflow-state block injected into the user's prompt before
 * it reaches the agent. Returns empty string when there is no active
 * workflow — the hook stays silent in that case.
 */
export function buildPromptStateBlock(ctx: HookContext): string {
  if (!ctx.state) return "";
  const s = ctx.state;
  const filesInScope =
    s.scope.files_in_plan.length === 0 ? "(none yet)" : s.scope.files_in_plan.join(", ");

  const pendingScopeProposals = countPendingScopeProposals(ctx);
  const pendingTransition = describePendingTransition(ctx);

  const lines: string[] = [
    "<workflow-state>",
    `Active workflow: ${s.workflow_id} (${s.workflow_type})`,
    `Task: ${s.task}`,
    `Current phase: ${s.current_phase}`,
    `Status: ${s.status}`,
    `Files in plan: ${filesInScope}`,
    `Incidental changes recorded: ${s.scope.incidental_changes}`,
    `Scope expansions approved: ${s.scope.scope_expansions_approved}, rejected: ${s.scope.scope_expansions_rejected}`,
    `Subagents: ${s.subagent_stats.total_dispatched} dispatched, ${s.subagent_stats.total_tokens_consumed} tokens`,
    `Owner: ${s.current_owner}`,
  ];

  if (s.paused_for_child_id) {
    lines.push(`Paused for child workflow: ${s.paused_for_child_id}`);
  }
  if (pendingScopeProposals > 0) {
    lines.push(
      `Pending scope expansion proposals: ${pendingScopeProposals} — resolve before proceeding`,
    );
  }
  if (pendingTransition) {
    lines.push(`Pending transition: ${pendingTransition}`);
  }

  lines.push("");
  lines.push("Phase rules apply. Phase transitions require explicit human approval");
  lines.push("via `devloop transition --approve` (do not assume approval from context).");
  lines.push("Edits to files outside `Files in plan` will be blocked by the pre-tool-use");
  lines.push('hook. Use `devloop scope propose-expansion --file <path> --reason "<text>"`');
  lines.push("if you need to modify a file not yet in scope.");
  lines.push("</workflow-state>");

  return lines.join("\n");
}

function countPendingScopeProposals(ctx: HookContext): number {
  if (!ctx.state) return 0;
  const log = EventLog.fromCwd(ctx.cwd);
  const id = log.getActiveWorkflowId();
  if (!id) return 0;
  const events = log.loadEvents(id);

  const resolved = new Set<string>();
  let pending = 0;
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const e = events[i];
    if (!e) continue;
    if (
      e.event_type === "scope_expansion_approved" ||
      e.event_type === "scope_expansion_rejected"
    ) {
      const p = e.payload as { file_path: string };
      resolved.add(p.file_path);
      continue;
    }
    if (e.event_type === "scope_expansion_proposed") {
      const p = e.payload as { file_path: string };
      if (!resolved.has(p.file_path)) pending += 1;
    }
  }
  return pending;
}

function describePendingTransition(ctx: HookContext): string | null {
  if (!ctx.state) return null;
  const log = EventLog.fromCwd(ctx.cwd);
  const id = log.getActiveWorkflowId();
  if (!id) return null;
  const events = log.loadEvents(id);

  for (let i = events.length - 1; i >= 0; i -= 1) {
    const e = events[i];
    if (!e) continue;
    if (
      e.event_type === "phase_transition_approved" ||
      e.event_type === "phase_transition_rejected"
    ) {
      return null;
    }
    if (e.event_type === "phase_transition_proposed") {
      const p = e.payload as { from_phase: string; to_phase: string };
      return `${p.from_phase} → ${p.to_phase} (awaiting human approve/reject)`;
    }
  }
  return null;
}
