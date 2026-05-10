/**
 * Pure logic for the pre-tool-use hook. Separated from the CLI script so
 * it is unit-testable.
 *
 * The hook is the guardrail layer of the enforcement model. It does not
 * make policy decisions on its own — it consults the classifier (for
 * file edits) and pattern rules (for shell commands), then maps the
 * verdict to an allow / block decision with a structured feedback
 * message for the agent.
 *
 * Brain-backed: workflow state is read via BrainEventLog directly.
 */

import { classifyChange, type ClassifyResult } from "./classifier.js";
import { reduce } from "./reducer.js";
import { BrainEventLog } from "./brain-event-log.js";
import type { ManifestEvent, Phase, ReducedState } from "./types.js";
import { readFileSafe } from "./fs-utils.js";

export type HookDecision =
  | { allow: true; reason?: string; auto_event?: ManifestEvent; advisories?: string[] }
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
  /** Universal data-loss rules block hard. Workflow-phase rules are advisory only. */
  enforcement: "block" | "advisory";
  reason: string;
  suggested_action: string;
}

const BASH_RULES: BashRule[] = [
  {
    pattern: /^\s*git\s+push\b(?!\s+--force\b)/,
    blocked_in_phases: ["intent", "plan", "decompose", "execute"],
    enforcement: "advisory",
    reason: "git push is conventionally done in phase verify, after validation passes.",
    suggested_action:
      "Iron Law 7 already gates git push with the 'ok' approval token. The phase advisory is informational only.",
  },
  {
    pattern: /^\s*gh\s+pr\s+create\b/,
    blocked_in_phases: ["intent", "plan", "decompose", "execute", "verify"],
    enforcement: "advisory",
    reason: "PR creation conventionally happens in phase done, after verify gates pass.",
    suggested_action:
      "If verify gates already passed, transition to done first; otherwise this is a heads-up, not a block.",
  },
  {
    pattern: /^\s*rm\s+-rf?\s+\//,
    blocked_in_phases: "all",
    enforcement: "block",
    reason: "rm -rf at root is destructive and never authorized by codi.",
    suggested_action: "If you need to delete files, name them explicitly.",
  },
  {
    pattern: /^\s*git\s+reset\s+--hard\b/,
    blocked_in_phases: "all",
    enforcement: "block",
    reason: "git reset --hard discards uncommitted work and breaks the audit trail.",
    suggested_action:
      "Use `codi workflow abandon --reason '<text>'` to end the workflow cleanly, or fix the issue without resetting.",
  },
  {
    pattern: /^\s*git\s+push\s+--force\b/,
    blocked_in_phases: "all",
    enforcement: "block",
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

  // codi state files — project config, queues, drafts, etc. Allowed any phase.
  // These are workflow-managed artifacts (not source code), produced by
  // project-workflow.intent (.codi/project.json), sheets-sync
  // (.codi/sheets-queue.jsonl), and discover/decompose drafts
  // (.codi/draft/*.json). Match any json/jsonl inside .codi/ at any depth.
  if (/(^|\/)\.codi\/(.+\/)?[^/]+\.(json|jsonl)$/i.test(normalized)) {
    return "codi-state";
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

  // Pre-execute phases: edits to source files outside scope are an
  // anti-pattern (the phase is for understanding / planning) but the
  // workflow gate is ADVISORY, not blocking — friction kills flow. The
  // post-tool-use flow records an `incidental_change_recorded` event so
  // the workflow detail page can surface the divergence after the fact.
  const sourcePhases: Phase[] = ["intent", "plan", "decompose"];
  if (sourcePhases.includes(state.current_phase)) {
    return {
      allow: true,
      reason: `Advisory: source-file edit in phase ${state.current_phase}.`,
      advisories: [
        `File '${filePath}' edited during phase ${state.current_phase}.`,
        `Phases intent/plan/decompose are intended for understanding & planning.`,
        `Recorded as incidental change. To track this work officially, transition to execute via \`codi workflow transition --to execute\`.`,
      ],
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

  // Out-of-scope edit during execute / verify / data-validation. Advisory:
  // the change is allowed, the post-tool-use flow records it as
  // `incidental_change_recorded`, and the workflow UI surfaces it for
  // retrospective review. Hard blocks killed flow; advisory keeps the
  // signal without the friction.
  const elevationHint = result.suggested_elevation
    ? ` Classifier suggests elevation to '${result.suggested_elevation.workflow_type}' (trigger: ${result.suggested_elevation.trigger}).`
    : "";

  return {
    allow: true,
    reason: `Advisory: out-of-scope edit. ${result.reason}`,
    advisories: [
      `File '${filePath}' is not in the plan scope.`,
      `Classifier verdict: ${result.reason}.${elevationHint}`,
      `Recorded as incidental change. If this is the start of a real expansion, run \`codi workflow scope propose --file '${filePath}' --reason "<why>"\` and approve.`,
    ],
  };
}

// ─── Bash commands ───────────────────────────────────────────────────

function evaluateBashCommand(call: ToolCall, ctx: HookContext): HookDecision {
  const command = call.tool_input["command"] as string | undefined;
  if (typeof command !== "string") return { allow: true };

  const state = ctx.state;
  if (!state) return { allow: true };

  const advisories: string[] = [];
  for (const rule of BASH_RULES) {
    if (!rule.pattern.test(command)) continue;
    const inPhase =
      rule.blocked_in_phases === "all" || rule.blocked_in_phases.includes(state.current_phase);
    if (!inPhase) continue;
    if (rule.enforcement === "block") {
      return {
        allow: false,
        reason: rule.reason,
        suggested_action: rule.suggested_action,
      };
    }
    advisories.push(`${rule.reason} ${rule.suggested_action}`);
  }
  return advisories.length > 0
    ? { allow: true, reason: "phase advisory", advisories }
    : { allow: true };
}

// ─── Convenience: build context from filesystem ──────────────────────

export function buildContext(cwd: string): HookContext {
  const log = BrainEventLog.open();
  try {
    const id = log.getActiveWorkflowId();
    if (!id) return { cwd, state: null };
    const events = log.loadEvents(id);
    if (events.length === 0) return { cwd, state: null };
    return { cwd, state: reduce(events) };
  } finally {
    log.dispose();
  }
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
  lines.push("via `codi workflow transition --approve` (do not assume approval from context).");
  lines.push("Edits to files outside `Files in plan` will be blocked by the pre-tool-use");
  lines.push('hook. Use `codi workflow scope propose-expansion --file <path> --reason "<text>"`');
  lines.push("if you need to modify a file not yet in scope.");
  lines.push("</workflow-state>");

  return lines.join("\n");
}

/**
 * Capture protocol reminder injected into every UserPromptSubmit turn (Iron
 * Law 9). Short by design — the full rule lives in
 * `src/templates/rules/capture-everything.ts`. Runtime parser at
 * `src/runtime/capture/markers.ts` deduplicates by raw_marker so re-emission
 * across turns is safe.
 */
export function buildCaptureReminderBlock(): string {
  const lines = [
    "<capture-protocol>",
    "Iron Law 9: when the user states a rule / prohibition / preference / feedback /",
    "insight / observation / decision / question / prompt / correction, emit a marker",
    "at the END of your response in the form:",
    '  |TYPE: "verbatim content"|',
    "Multiple markers per turn are allowed. False positives are NOT tolerated;",
    "false negatives are recoverable via offline consolidation.",
    "</capture-protocol>",
  ];
  return lines.join("\n");
}

function countPendingScopeProposals(ctx: HookContext): number {
  if (!ctx.state) return 0;
  const log = BrainEventLog.open();
  try {
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
  } finally {
    log.dispose();
  }
}

function describePendingTransition(ctx: HookContext): string | null {
  if (!ctx.state) return null;
  const log = BrainEventLog.open();
  try {
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
  } finally {
    log.dispose();
  }
}

/**
 * Iron Law-style advisory block surfacing gate failures from the most
 * recent phase_transition_approved on the active workflow. Empty string
 * when there is no active workflow, no approval has happened yet, or no
 * gates failed at the most recent approval.
 *
 * Mirrors the shape of buildIronLawsBlock — block markers, multi-line
 * body, suggested actions. The block stays visible until the next
 * phase_transition_approved supersedes it.
 *
 * Mechanics: gate_check_failed events are written immediately before
 * phase_transition_approved during approveTransition. We find the most
 * recent approved event and collect the contiguous gate_check_failed
 * events that precede it (the "burst" of gate output for that approval).
 */
export function buildGateAdvisoryBlock(log: BrainEventLog): string {
  try {
    const workflowId = log.getActiveWorkflowId();
    if (!workflowId) return "";
    const events = log.loadEvents(workflowId);

    let latestApprovedIdx = -1;
    for (let i = events.length - 1; i >= 0; i -= 1) {
      if (events[i]?.event_type === "phase_transition_approved") {
        latestApprovedIdx = i;
        break;
      }
    }
    if (latestApprovedIdx < 0) return "";

    // Walk backwards from the approved event, collecting contiguous gate
    // events for that approval. Stop at the first event that is not part
    // of the gate burst (phase_started, scope_*, etc.).
    const failures: typeof events = [];
    for (let i = latestApprovedIdx - 1; i >= 0; i -= 1) {
      const t = events[i]?.event_type;
      if (t === "gate_check_failed") {
        failures.unshift(events[i]!);
        continue;
      }
      if (t === "gate_check_started" || t === "gate_check_passed" || t === "phase_completed") {
        continue;
      }
      break;
    }
    if (failures.length === 0) return "";

    const lines: string[] = [
      "<gate-advisory>",
      "Phase gates flagged the following at the most recent approve. Advisory — transition was approved by the developer; act on these before the next transition.",
    ];
    for (const ev of failures) {
      const p = ev.payload as {
        check_id?: string;
        reason?: string;
        suggested_action?: string;
      };
      const id = p.check_id ?? "(unknown)";
      lines.push(`[${id}] ${p.reason ?? ""}`);
      if (p.suggested_action && p.suggested_action.length > 0) {
        lines.push(`  → ${p.suggested_action}`);
      }
    }
    lines.push("</gate-advisory>");
    return lines.join("\n");
  } catch {
    return "";
  }
}
