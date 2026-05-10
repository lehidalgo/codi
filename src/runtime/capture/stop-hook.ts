/**
 * Stop hook orchestrator (F6).
 *
 * Claude Code fires the `Stop` hook each time the assistant finishes a
 * response. The payload is a JSON object on stdin with at minimum:
 *
 *     { session_id, transcript_path, cwd, hook_event_name }
 *
 * On every fire we:
 *   1. UPSERT the sessions row.
 *   2. Open or reuse the in-flight turn (UserPromptSubmit hook normally
 *      opens it; if it didn't, we synthesize a fallback turn so captures
 *      are not orphaned).
 *   3. Read the assistant's last message from the transcript JSONL and
 *      parse `|TYPE: "..."|` markers.
 *   4. Persist captures (idempotent by raw_marker, scoped to turn_id).
 *   5. Close the turn — set agent_text + duration_ms.
 *   6. Refresh sessions.total_capture_count.
 *
 * Designed to be safe to call multiple times (Claude Code can emit Stop
 * twice when the user interrupts and resumes); persistence layers handle
 * the duplicates by raw_marker.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { reduce } from "../reducer.js";
import { BrainEventLog } from "../brain-event-log.js";
import type { BrainHandle } from "../brain/index.js";
import { parseMarkersWithReport, type ParsedMarker } from "./markers.js";
import { persistMarkers } from "./persist.js";
import { aggregateSessionUsage } from "../tokens/index.js";
import {
  closeTurn,
  ensureProject,
  ensureSession,
  latestTurnId,
  openTurn,
  recordPrompt,
  refreshCaptureCount,
} from "./session.js";

export interface StopHookInput {
  readonly sessionId: string;
  readonly cwd: string;
  readonly transcriptPath?: string;
  readonly agentType?: string;
  readonly agentModel?: string;
  /** Override for tests — bypass transcript reading and use this text directly. */
  readonly agentTextOverride?: string;
}

export interface StopHookResult {
  readonly turnId: number;
  readonly capturesInserted: number;
  readonly capturesSkipped: number;
  readonly markerCount: number;
  readonly agentTextChars: number;
}

/**
 * Process a Stop hook event end-to-end. Pure with respect to the brain DB
 * — the caller owns the BrainHandle lifecycle.
 */
export function processStopHook(handle: BrainHandle, input: StopHookInput): StopHookResult {
  const { raw } = handle;

  // 1. Ensure project + session rows.
  const projectId = deriveProjectId(input.cwd);
  ensureProject(raw, { projectId, cwd: input.cwd });
  ensureSession(raw, {
    sessionId: input.sessionId,
    projectId,
    agentType: input.agentType ?? "claude-code",
    agentModel: input.agentModel,
    workingDir: input.cwd,
    transcriptPath: input.transcriptPath,
    workflowId: readActiveWorkflowId() ?? undefined,
  });

  // 2. Resolve the in-flight turn. Synthesize one when the upstream
  //    UserPromptSubmit hook hasn't run (e.g. plugin half-installed).
  let turnId = latestTurnId(raw, input.sessionId);
  if (turnId === null) {
    const p = recordPrompt(raw, {
      sessionId: input.sessionId,
      text: "(synthetic — no UserPromptSubmit hook fired)",
    });
    turnId = openTurn(raw, {
      sessionId: input.sessionId,
      promptId: p.promptId,
      turnNo: p.turnNo,
    });
  }

  // 3. Read agent text. Override path for tests; otherwise read from
  //    transcript JSONL. If neither yields text, we still close the turn
  //    cleanly so the next prompt can open a fresh one.
  const agentText =
    input.agentTextOverride ??
    (input.transcriptPath ? readLastAssistantMessage(input.transcriptPath) : "");

  // 4. Parse + persist markers. Markers with a non-canonical TYPE keep
  //    their full information by being demoted to OBSERVATION at
  //    persist-time; the raw_marker column preserves the agent's original
  //    intent so the brain UI / consolidator can recover the offending
  //    type. We also emit a stderr warning so the typo is visible during
  //    the session.
  const parsed = parseMarkersWithReport(agentText);
  const promoted: ParsedMarker[] = parsed.invalid.map((bad) => {
    const annotated = `[unknown_type=${bad.type}] ${bad.content}`;
    return {
      type: "OBSERVATION",
      content: annotated,
      rawMarker: bad.rawMarker,
      offset: bad.offset,
    };
  });
  if (parsed.invalid.length > 0) {
    for (const bad of parsed.invalid) {
      console.error(
        `[capture] non-canonical TYPE=${bad.type} promoted to OBSERVATION: ${bad.rawMarker}`,
      );
    }
  }
  const markers: ParsedMarker[] = [...parsed.valid, ...promoted].sort(
    (a, b) => a.offset - b.offset,
  );
  const phase = readActivePhase();
  const persisted = persistMarkers(
    raw,
    {
      sessionId: input.sessionId,
      promptId: lookupPromptId(raw, turnId),
      turnId,
      ...(readActiveWorkflowId() !== null
        ? { workflowId: readActiveWorkflowId() ?? undefined }
        : {}),
      ...(phase !== null ? { phase } : {}),
    },
    markers,
  );

  // 5. Close the turn — record agent_text + duration_ms (since open).
  const turnRow = raw.prepare(`SELECT ts FROM turns WHERE turn_id = ?`).get(turnId) as
    | { ts: number }
    | undefined;
  const durationMs = turnRow ? Math.max(0, Date.now() - turnRow.ts) : undefined;
  const closeArgs: { turnId: number; agentText?: string; durationMs?: number } = { turnId };
  if (agentText.length > 0) closeArgs.agentText = agentText;
  if (durationMs !== undefined) closeArgs.durationMs = durationMs;
  closeTurn(raw, closeArgs);

  // 6. Refresh cached capture count.
  refreshCaptureCount(raw, input.sessionId);

  // 7. Aggregate token usage + cost from the transcript (or tokenizer
  //    fallback) into `sessions`. Best-effort: a malformed transcript or
  //    missing column never blocks the capture path.
  try {
    aggregateSessionUsage(raw, input.sessionId);
  } catch (cause) {
    console.error(`[capture] token aggregation failed for session ${input.sessionId}:`, cause);
  }

  return {
    turnId,
    capturesInserted: persisted.inserted,
    capturesSkipped: persisted.skippedDuplicates,
    markerCount: markers.length,
    agentTextChars: agentText.length,
  };
}

/**
 * Find a `prompt_id` for the given turn — required for capture rows. Falls
 * back to 0 when the row is missing (should never happen; defensive).
 */
function lookupPromptId(raw: import("better-sqlite3").Database, turnId: number): number {
  const row = raw.prepare(`SELECT prompt_id FROM turns WHERE turn_id = ?`).get(turnId) as
    | { prompt_id?: number }
    | undefined;
  return row?.prompt_id ?? 0;
}

/**
 * Read the most recent assistant message from a Claude Code transcript
 * JSONL file. The file format is one JSON object per line. Each line
 * has at least a `type` field; we look for assistant text events. The
 * exact key path varies by Claude Code version — we walk the JSON for
 * any string field named `text` or `content` under role 'assistant' /
 * type 'assistant'.
 *
 * Returns "" when the transcript is missing, empty, or unreadable —
 * Stop hook never fails because of a malformed transcript.
 */
export function readLastAssistantMessage(path: string): string {
  if (!existsSync(path)) return "";
  try {
    if (!statSync(path).isFile()) return "";
  } catch {
    return "";
  }
  let raw: string;
  try {
    raw = readFileSync(path, "utf-8");
  } catch {
    return "";
  }
  if (raw.length === 0) return "";
  const lines = raw.split("\n");
  // Walk backwards — Claude Code transcripts stream chronologically, the
  // last assistant block is the most recent response.
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i];
    if (!line || line.trim().length === 0) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }
    const text = extractAssistantText(parsed);
    if (text !== null && text.length > 0) return text;
  }
  return "";
}

/**
 * Extract assistant-authored text from a single transcript record. Shapes:
 *   - Anthropic: { role: "assistant", content: "..." }
 *   - Anthropic: { role: "assistant", content: [{ type: "text", text: "..." }, ...] }
 *   - Anthropic: { type: "assistant", message: { content: [{ text: "..." }] } }
 *   - Codex:     { type: "response_item", payload: { role: "assistant",
 *                  content: [{ type: "output_text", text: "..." }] } }
 *   - Codex:     { type: "event_msg", payload: { type: "agent_message",
 *                  message: "..." } }
 */
function extractAssistantText(record: unknown): string | null {
  if (record === null || typeof record !== "object") return null;
  const r = record as Record<string, unknown>;

  // Case 1: top-level role === "assistant"
  if (r["role"] === "assistant") {
    return flattenTextField(r["content"]);
  }

  // Case 2: top-level type === "assistant" with nested message
  if (r["type"] === "assistant" && typeof r["message"] === "object" && r["message"] !== null) {
    const msg = r["message"] as Record<string, unknown>;
    return flattenTextField(msg["content"]);
  }

  // Case 3: Codex response_item — payload.role === "assistant"
  if (r["type"] === "response_item" && typeof r["payload"] === "object" && r["payload"] !== null) {
    const p = r["payload"] as Record<string, unknown>;
    if (p["role"] === "assistant") {
      return flattenTextField(p["content"]);
    }
  }

  // Case 4: Codex event_msg agent_message — payload.message is the text
  if (r["type"] === "event_msg" && typeof r["payload"] === "object" && r["payload"] !== null) {
    const p = r["payload"] as Record<string, unknown>;
    if (p["type"] === "agent_message" && typeof p["message"] === "string") {
      return p["message"];
    }
  }

  return null;
}

function flattenTextField(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const item of content) {
      if (item && typeof item === "object") {
        const it = item as Record<string, unknown>;
        const text = it["text"] ?? it["content"];
        if (typeof text === "string") parts.push(text);
      }
    }
    return parts.join("\n");
  }
  return "";
}

/**
 * Project ID derivation: a stable hash of the working dir keeps multiple
 * checkouts of the same repo distinguishable while letting `~/.codi/brain.db`
 * aggregate sessions for a single repo. We use the basename + a short hash
 * of the absolute path for readability in dashboards.
 */
function deriveProjectId(cwd: string): string {
  const parts = cwd.replace(/\/+$/, "").split("/");
  const basename = parts[parts.length - 1] ?? "project";
  // Tiny non-cryptographic hash — collisions are tolerable for this surface.
  let h = 0;
  for (let i = 0; i < cwd.length; i += 1) {
    h = (h * 31 + cwd.charCodeAt(i)) | 0;
  }
  return `${basename}-${(h >>> 0).toString(16).slice(0, 8)}`;
}

/**
 * Convenience shim: read the active workflow id (if any) from brain so the
 * captures inherit it. Errors swallowed — the Stop hook never blocks.
 */
function readActiveWorkflowId(): string | null {
  try {
    const log = BrainEventLog.open();
    try {
      return log.getActiveWorkflowId();
    } finally {
      log.dispose();
    }
  } catch {
    return null;
  }
}

function readActivePhase(): string | null {
  try {
    const log = BrainEventLog.open();
    try {
      const id = log.getActiveWorkflowId();
      if (!id) return null;
      const events = log.loadEvents(id);
      if (events.length === 0) return null;
      return reduce(events).current_phase;
    } finally {
      log.dispose();
    }
  } catch {
    return null;
  }
}
