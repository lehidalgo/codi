/**
 * Iron Laws 4-8 runtime enforcement (Item 3).
 *
 * Iron Laws 1-3 are behavioral and not enforceable in code:
 *   1. Recommend AND execute  — agent's responsibility, no programmatic check
 *   2. One question per turn  — semantic, not measurable
 *   3. Canvas is sacred       — would need NL analysis of agent text
 *
 * The remaining five compile to deterministic checks that run inside the
 * existing Anthropic-protocol hooks (UserPromptSubmit, PreToolUse).
 *
 * This module is PURE — no I/O beyond the brain DB read where needed.
 * The shell-script hooks call into these functions via the tsx
 * scripts/runtime/hook-* entrypoints.
 */

import type Database from "better-sqlite3";

// ─── Iron Law 4 — HARD GATES need 'ok' ──────────────────────────────────────

export interface GateState {
  readonly workflowId: string;
  readonly currentPhase: string;
  readonly status: string;
  readonly pendingProposalCount: number;
}

/**
 * Read the active workflow's gate state from the brain. Returns null when
 * no workflow is active (no gate is firing).
 */
export function readGateState(raw: Database.Database): GateState | null {
  const row = raw
    .prepare(
      `SELECT workflow_id, current_phase, status, metadata
       FROM workflow_runs
       WHERE status IN ('active', 'pending_approval', 'in_progress')
       ORDER BY started_at DESC
       LIMIT 1`,
    )
    .get() as { workflow_id: string; current_phase: string; status: string } | undefined;
  if (!row) return null;
  return {
    workflowId: row.workflow_id,
    currentPhase: row.current_phase,
    status: row.status,
    pendingProposalCount: 0,
  };
}

const APPROVAL_TOKEN_RE = /\b(ok|OK|Ok)\b/;

/**
 * Iron Law 4 enforcement: returns true when the user's last prompt should
 * count as a phase-transition approval. Soft signals like "looks good",
 * "yeah", "sure" are NOT approval — only the literal two-character token.
 */
export function isPhaseApproval(prompt: string): boolean {
  // Strip code fences before checking — agent's transcript can echo "ok" in
  // examples without that being a real approval.
  const stripped = prompt.replace(/```[\s\S]*?```/g, "");
  const matched = APPROVAL_TOKEN_RE.test(stripped);
  if (!matched) return false;
  // Reject longer words that contain "ok" or "OK".
  const words = stripped.match(/\b\w+\b/g) ?? [];
  return words.some((w) => w === "ok" || w === "OK" || w === "Ok");
}

export function buildHardGateBlock(state: GateState | null): string {
  if (!state || state.status !== "pending_approval") return "";
  const lines = [
    "<hard-gate>",
    "Iron Law 4: phase transition pending approval.",
    `Workflow: ${state.workflowId} (phase ${state.currentPhase})`,
    "Type the literal 'ok' (case-insensitive, 2 chars) to approve, or",
    "redirect with a reason. 'looks good' / 'yeah' / 'sure' do NOT pass.",
    "</hard-gate>",
  ];
  return lines.join("\n");
}

// ─── Iron Law 5 — Pull before patch ─────────────────────────────────────────

export interface PullCheckInput {
  /** Last brain-read ts for this session, ms since epoch. 0 = never read. */
  readonly lastBrainReadTs: number;
  /** Now, ms since epoch. */
  readonly nowTs: number;
  /** Tool the agent is about to call. */
  readonly toolName: string;
}

const PULL_FRESHNESS_MS = 60_000;
const MUTATING_TOOLS = new Set(["Edit", "Write", "NotebookEdit"]);

export function shouldRecommendPull(input: PullCheckInput): boolean {
  if (!MUTATING_TOOLS.has(input.toolName)) return false;
  const ageMs = input.nowTs - input.lastBrainReadTs;
  return ageMs > PULL_FRESHNESS_MS;
}

export function buildPullReminder(): string {
  return [
    "<pull-reminder>",
    "Iron Law 5: brain state is older than 60s. Run a quick recall before",
    "applying this edit, or accept the risk that you may overwrite",
    "stakeholder edits captured since.",
    "</pull-reminder>",
  ].join("\n");
}

// ─── Iron Law 7 — Never commit without approval ─────────────────────────────

const GIT_MUTATING_RE =
  /\bgit\s+(commit|push|tag|merge|reset\s+--hard|branch\s+-D|push\s+--force)\b/;
const COMMIT_APPROVAL_TOKENS = ["commit", "push", "merge", "tag", "release"];

export interface CommitCheckInput {
  readonly bashCommand: string;
  /** The user's most recent N prompts (newest first). */
  readonly recentPrompts: readonly string[];
}

export interface CommitDecision {
  readonly allowed: boolean;
  readonly reason: string;
}

export function decideGitCommand(input: CommitCheckInput): CommitDecision {
  if (!GIT_MUTATING_RE.test(input.bashCommand)) {
    return { allowed: true, reason: "non-mutating git command" };
  }
  const haystack = input.recentPrompts.join("\n").toLowerCase();
  const approved = COMMIT_APPROVAL_TOKENS.some((tok) => haystack.includes(tok));
  if (approved) {
    return { allowed: true, reason: "found approval token in recent prompts" };
  }
  return {
    allowed: false,
    reason:
      "Iron Law 7: git mutation requires explicit approval (none of " +
      COMMIT_APPROVAL_TOKENS.join(", ") +
      " found in recent prompts)",
  };
}

// ─── Iron Law 8 — Output mode honors project preference ─────────────────────

export type OutputMode = "caveman" | "normal";

export function buildOutputModeBlock(mode: OutputMode): string {
  if (mode === "normal") return "";
  return [
    "<output-mode>caveman</output-mode>",
    "<output-mode-note>",
    "Iron Law 8: project default = caveman. Bullets, ≤3-col tables,",
    "ONE summary line per phase. User types '?' to request normal for",
    "THIS turn only.",
    "</output-mode-note>",
  ].join("\n");
}

// ─── Aggregation for hooks ──────────────────────────────────────────────────

export interface IronLawsContext {
  readonly outputMode: OutputMode;
  readonly gateState: GateState | null;
}

/**
 * Build the combined block injected into UserPromptSubmit. Empty string
 * when no Iron Law has anything to say (rare — output-mode caveman is
 * the project default).
 */
export function buildIronLawsBlock(ctx: IronLawsContext): string {
  const parts = [buildOutputModeBlock(ctx.outputMode), buildHardGateBlock(ctx.gateState)];
  return parts.filter((p) => p.length > 0).join("\n\n");
}
