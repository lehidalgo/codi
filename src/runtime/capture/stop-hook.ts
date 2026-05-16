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

import { closeSync, existsSync, fstatSync, openSync, readSync, statSync } from "node:fs";
import { reduce } from "../reducer.js";
import { BrainEventLog } from "../brain-event-log.js";
import type { BrainHandle } from "../brain/db.js";
import { parseMarkersWithReport, type ParsedMarker } from "./markers.js";
import { persistMarkers } from "./persist.js";
import { aggregateSessionUsage } from "../tokens/aggregator.js";
import {
  closeTurn,
  ensureProject,
  ensureSession,
  latestTurnId,
  openTurn,
  recordPrompt,
  refreshCaptureCount,
} from "./session.js";

import { deriveProjectId } from "./project-id.js";
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

  // Resolve the active workflow + phase ONCE per fire, reusing the caller's
  // BrainHandle via `BrainEventLog.wrap` (non-owning). The previous Stop
  // implementation opened FOUR separate brain handles per fire (each of
  // them ran applyMigrations + readMetadata) — measurable cost on the
  // hot path. The values are consistent within a fire because the only
  // writer of `__codi_active__` is the workflow CLI, which runs in a
  // different process.
  const wrappedLog = BrainEventLog.wrap(handle);
  let activeWorkflowId: string | null = null;
  let activePhase: string | null = null;
  try {
    activeWorkflowId = wrappedLog.getActiveWorkflowId();
    if (activeWorkflowId) {
      const events = wrappedLog.loadEvents(activeWorkflowId);
      if (events.length > 0) activePhase = reduce(events).current_phase;
    }
  } catch {
    // Brain unreachable — degrade silently; captures persist without
    // workflow tagging just as before.
  }

  // ── Pure / I/O-bound preparation (runs OUTSIDE the SQL transaction)
  // Reading the transcript JSONL and parsing markers must not hold the
  // SQLite write lock — both can take measurable wall time on large
  // transcripts.

  // 3. Read agent text. Override path for tests; otherwise read from
  //    transcript JSONL. If neither yields text, we still close the turn
  //    cleanly so the next prompt can open a fresh one.
  const agentText =
    input.agentTextOverride ??
    (input.transcriptPath ? readLastAssistantMessage(input.transcriptPath) : "");

  // 4a. Parse markers. Promotion of non-canonical TYPE entries to
  //    OBSERVATION is data-shaping, not a write — keep it outside.
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

  // ── Single SQL transaction wrapping every Stop-hook write.
  //
  // Previously each write (ensureProject, ensureSession, persistMarkers,
  // closeTurn, refreshCaptureCount, optional synthetic prompt/turn)
  // ran in its own implicit transaction. Two real consequences:
  //   - 7 fsyncs per fire instead of 1.
  //   - Concurrent Stops on the same session (Claude double-fires on
  //     interrupt/resume — documented in the file header) interleaved
  //     the dedupe SELECT/INSERT in persistMarkers AND the read-recompute
  //     of refreshCaptureCount, undercounting captures.
  // The transaction wraps writes only; if any one throws, better-sqlite3
  // auto-rolls back the whole stop, preserving the outer try/catch's
  // "never block the agent" contract while preventing partial state.
  // `aggregateSessionUsage` stays OUTSIDE because it reads the
  // transcript file (file I/O while holding a write lock would serialize
  // unrelated writers).
  const projectId = deriveProjectId(input.cwd);
  let turnId = 0;
  let persisted: { inserted: number; skippedDuplicates: number } = {
    inserted: 0,
    skippedDuplicates: 0,
  };
  raw.transaction(() => {
    // 1. Ensure project + session rows.
    ensureProject(raw, { projectId, cwd: input.cwd });
    ensureSession(raw, {
      sessionId: input.sessionId,
      projectId,
      agentType: input.agentType ?? "claude-code",
      agentModel: input.agentModel,
      workingDir: input.cwd,
      transcriptPath: input.transcriptPath,
      workflowId: activeWorkflowId ?? undefined,
    });

    // 2. Resolve the in-flight turn. Synthesize one when the upstream
    //    UserPromptSubmit hook hasn't run (e.g. plugin half-installed).
    const existingTurnId = latestTurnId(raw, input.sessionId);
    if (existingTurnId === null) {
      const p = recordPrompt(raw, {
        sessionId: input.sessionId,
        text: "(synthetic — no UserPromptSubmit hook fired)",
      });
      turnId = openTurn(raw, {
        sessionId: input.sessionId,
        promptId: p.promptId,
        turnNo: p.turnNo,
      });
    } else {
      turnId = existingTurnId;
    }

    // 4b. Persist markers (writes — must stay inside the transaction so
    //    persistMarkers' dedupe SELECT + INSERT is race-free).
    persisted = persistMarkers(
      raw,
      {
        sessionId: input.sessionId,
        promptId: lookupPromptId(raw, turnId),
        turnId,
        ...(activeWorkflowId !== null ? { workflowId: activeWorkflowId } : {}),
        ...(activePhase !== null ? { phase: activePhase } : {}),
      },
      markers,
    );

    // 5. Close the turn — record agent_text + duration_ms (since open).
    const turnRow = raw.prepare(`SELECT ts FROM turns WHERE turn_id = ?`).get(turnId) as
      | { ts: number }
      | undefined;
    const durationMs = turnRow ? Math.max(0, Date.now() - turnRow.ts) : undefined;
    const closeArgs: { turnId: number; agentText?: string; durationMs?: number } = {
      turnId,
    };
    if (agentText.length > 0) closeArgs.agentText = agentText;
    if (durationMs !== undefined) closeArgs.durationMs = durationMs;
    closeTurn(raw, closeArgs);

    // 6. Refresh cached capture count. Must be inside the same txn as
    //    persistMarkers so the recount sees the rows just inserted.
    refreshCaptureCount(raw, input.sessionId);
  })();

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

/** Buffer size for the backwards transcript walk (64 KB). */
const TRANSCRIPT_READ_CHUNK = 64 * 1024;

/**
 * Read the most recent assistant message from a Claude Code transcript
 * JSONL file. The file format is one JSON object per line. Each line
 * has at least a `type` field; we look for assistant text events. The
 * exact key path varies by Claude Code version — we walk the JSON for
 * any string field named `text` or `content` under role 'assistant' /
 * type 'assistant'.
 *
 * Reads from EOF backwards in 64 KB chunks so a 20 MB transcript does
 * not pay full-file I/O on every Stop hook fire. Stops at the first
 * valid assistant record. Returns "" when the transcript is missing,
 * empty, or unreadable — Stop hook never fails because of a malformed
 * transcript.
 */
export function readLastAssistantMessage(path: string): string {
  if (!existsSync(path)) return "";
  let fd: number;
  try {
    if (!statSync(path).isFile()) return "";
    fd = openSync(path, "r");
  } catch {
    return "";
  }
  try {
    const size = fstatSync(fd).size;
    if (size === 0) return "";
    const buf = Buffer.alloc(TRANSCRIPT_READ_CHUNK);
    let tail = "";
    let pos = size;
    while (pos > 0) {
      const start = Math.max(0, pos - TRANSCRIPT_READ_CHUNK);
      const len = pos - start;
      const got = readSync(fd, buf, 0, len, start);
      tail = buf.toString("utf-8", 0, got) + tail;
      pos = start;
      // Drop the partial leading line — it may be incomplete until the
      // next read fills it. We keep it across iterations until we hit BOF.
      const newlineIdx = pos > 0 ? tail.indexOf("\n") : -1;
      const parseable = newlineIdx >= 0 ? tail.slice(newlineIdx + 1) : tail;
      const lines = parseable.split("\n");
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
      tail = newlineIdx >= 0 ? tail.slice(0, newlineIdx) : tail;
    }
    return "";
  } catch {
    return "";
  } finally {
    try {
      closeSync(fd);
    } catch {
      /* fd already invalid — best-effort cleanup */
    }
  }
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
