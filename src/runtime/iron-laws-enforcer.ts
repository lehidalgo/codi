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
 *
 * The `type != 'session'` predicate excludes the `__codi_session__`
 * singleton row (which BrainEventLog uses to track the active-workflow
 * pointer). Without it, when the singleton's `started_at` ties with a
 * real workflow's (sub-millisecond clock collision under concurrent
 * load), `ORDER BY started_at DESC` can return the singleton — surfacing
 * `status='active'` regardless of any pending phase transition.
 */
export function readGateState(raw: Database.Database): GateState | null {
  const row = raw
    .prepare(
      `SELECT workflow_id, current_phase, status, metadata
       FROM workflow_runs
       WHERE status IN ('active', 'pending_approval', 'in_progress')
         AND type != 'session'
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

// Single canonical approval token across every gate (Iron Law 4 + 7 +
// any future). Case-insensitive, exactly two chars. Long tokens were
// brittle in the wild — typos like "ecommit" or words like "commitment"
// either failed to match or false-positively matched. "ok" is the only
// shape that survives unicode tokenisation, multi-language prompts, and
// quick-fire CLI typing.
const COMMIT_APPROVAL_TOKENS = ["ok"] as const;

/**
 * Tokens that, when they precede an approval token within the same clause,
 * negate the apparent approval. Example: "don't commit yet" contains
 * "commit" but is NOT an approval — the leading "don't" inverts intent.
 */
const NEGATION_TOKENS_RE =
  /\b(?:don'?t|do not|doesn'?t|does not|did not|didn'?t|never|no|not|stop|cancel|undo|abort|skip|hold off|wait|defer)\b/i;

const CLAUSE_SPLIT_RE = /[.,;!?\n]+|\s+(?:but|and then|then|and)\s+/i;

export interface CommitCheckInput {
  readonly bashCommand: string;
  /** The user's most recent N prompts (newest first). */
  readonly recentPrompts: readonly string[];
}

export interface CommitDecision {
  readonly allowed: boolean;
  readonly reason: string;
}

/**
 * Walk each clause of each recent prompt looking for an approval token
 * that is NOT preceded by a negation token in the same clause. Word-
 * boundary matching prevents false positives on words like "commitment"
 * or "deployment" that contain an approval substring.
 *
 * Examples:
 *   "please commit"                → approved (no negation)
 *   "don't commit yet"             → not approved (don't precedes commit)
 *   "fix bug, dont commit yet"     → not approved (clause "dont commit yet" is negated)
 *   "fix bug, then commit"         → approved (clause "then commit" stands alone)
 *   "no push to main"              → not approved
 *   "commitment to quality"        → not approved (word boundary rejects partial)
 */
function hasUnnegatedApprovalToken(prompt: string): boolean {
  const clauses = prompt.split(CLAUSE_SPLIT_RE);
  for (const rawClause of clauses) {
    // Strict 3-casings list (ok / OK / Ok) — matches Iron Law 4's
    // `isPhaseApproval` so every gate behaves identically. "oK" or
    // "OkAY" do NOT count: codi accepts only the canonical 2-char
    // token in one of three deliberate casings.
    const words = rawClause.match(/\b\w+\b/g) ?? [];
    for (let i = 0; i < words.length; i += 1) {
      const w = words[i]!;
      if (w !== "ok" && w !== "OK" && w !== "Ok") continue;
      // Reject when a negation precedes the token in the same clause.
      const before = rawClause.slice(0, rawClause.indexOf(w));
      if (NEGATION_TOKENS_RE.test(before)) continue;
      return true;
    }
  }
  return false;
}

export function decideGitCommand(input: CommitCheckInput): CommitDecision {
  if (!GIT_MUTATING_RE.test(input.bashCommand)) {
    return { allowed: true, reason: "non-mutating git command" };
  }
  const approved = input.recentPrompts.some((p) => hasUnnegatedApprovalToken(p));
  if (approved) {
    return { allowed: true, reason: "found unnegated approval token in recent prompts" };
  }
  return {
    allowed: false,
    reason:
      "Iron Law 7: git mutation requires explicit approval — type 'ok' (case-insensitive) in your next prompt to authorize",
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

// ─── Helpers consumed by the live hooks (F7 wiring) ─────────────────────────

/**
 * Pull the most recent N user prompts (newest first) for a given session.
 * Used by Iron Law 7 to look for approval tokens before a git mutation.
 *
 * Falls back to the global most-recent prompts when sessionId is null —
 * the PreToolUse payload may not always carry session_id (older Claude
 * Code releases) and an empty list would silently disable the law.
 */
export function readRecentPrompts(
  raw: Database.Database,
  opts: { sessionId?: string; limit?: number } = {},
): string[] {
  const limit = Math.max(1, opts.limit ?? 5);
  if (opts.sessionId !== undefined && opts.sessionId.length > 0) {
    const rows = raw
      .prepare(`SELECT text FROM prompts WHERE session_id = ? ORDER BY prompt_id DESC LIMIT ?`)
      .all(opts.sessionId, limit) as { text: string }[];
    if (rows.length > 0) return rows.map((r) => r.text);
  }
  const rows = raw
    .prepare(`SELECT text FROM prompts ORDER BY prompt_id DESC LIMIT ?`)
    .all(limit) as { text: string }[];
  return rows.map((r) => r.text);
}

/**
 * Resolve the most recent UserPromptSubmit timestamp for a session — used
 * by Iron Law 5 as the proxy for "last brain read". Returns 0 when no
 * prompt has been recorded (effectively forces a pull recommendation on
 * the very first edit, which is the safe default).
 */
export function readLastPromptTs(raw: Database.Database, sessionId: string): number {
  if (sessionId.length === 0) return 0;
  const row = raw
    .prepare(`SELECT MAX(ts) as latest FROM prompts WHERE session_id = ?`)
    .get(sessionId) as { latest: number | null } | undefined;
  return row?.latest ?? 0;
}
