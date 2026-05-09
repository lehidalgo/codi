/**
 * PostToolUse hook orchestrator (F6).
 *
 * Claude Code fires this hook after every tool invocation. Payload (Stop
 * hook + this share most fields):
 *
 *     { session_id, cwd, tool_name, tool_input, tool_response, hook_event_name }
 *
 * On every fire we:
 *   1. UPSERT the sessions row.
 *   2. Resolve the in-flight turn (synthesize one if missing).
 *   3. Append a tool_calls row tagged with status (`ok` | `error` | `blocked`).
 *
 * Independent of the legacy `recordIncidentalChange` flow — both write to
 * different tables. This hook is purely observability; blocking decisions
 * remain in PreToolUse + the existing scope/classifier pipeline.
 */

import type { BrainHandle } from "../brain/index.js";
import { ensureSession, latestTurnId, openTurn, recordPrompt, recordToolCall } from "./session.js";

export interface ToolCallInput {
  readonly sessionId: string;
  readonly cwd: string;
  readonly toolName: string;
  readonly toolInput: unknown;
  readonly toolResponse?: unknown;
  readonly transcriptPath?: string;
  readonly agentType?: string;
  readonly agentModel?: string;
  readonly durationMs?: number;
}

export interface ToolCallResult {
  readonly callId: number;
  readonly turnId: number;
  readonly status: "ok" | "error" | "blocked";
}

export function processPostToolUse(handle: BrainHandle, input: ToolCallInput): ToolCallResult {
  const { raw } = handle;

  ensureSession(raw, {
    sessionId: input.sessionId,
    projectId: deriveProjectId(input.cwd),
    agentType: input.agentType ?? "claude-code",
    agentModel: input.agentModel,
    workingDir: input.cwd,
    transcriptPath: input.transcriptPath,
  });

  let turnId = latestTurnId(raw, input.sessionId);
  if (turnId === null) {
    const p = recordPrompt(raw, {
      sessionId: input.sessionId,
      text: "(synthetic — tool call before any prompt)",
    });
    turnId = openTurn(raw, {
      sessionId: input.sessionId,
      promptId: p.promptId,
      turnNo: p.turnNo,
    });
  }

  const status = inferStatus(input.toolResponse);
  const summary = summarizeResponse(input.toolResponse);
  const callArgs = {
    sessionId: input.sessionId,
    turnId,
    toolName: input.toolName,
    input: input.toolInput,
    status,
    ...(summary !== undefined ? { outputSummary: summary } : {}),
    ...(input.durationMs !== undefined ? { durationMs: input.durationMs } : {}),
    ...(status === "error" || status === "blocked"
      ? { error: extractError(input.toolResponse) }
      : {}),
  } as const;
  const callId = recordToolCall(raw, callArgs);
  return { callId, turnId, status };
}

function inferStatus(response: unknown): "ok" | "error" | "blocked" {
  if (response === null || response === undefined) return "ok";
  if (typeof response !== "object") return "ok";
  const r = response as Record<string, unknown>;
  if (r["blocked"] === true) return "blocked";
  if (typeof r["status"] === "string") {
    const s = r["status"] as string;
    if (s === "blocked" || s === "error" || s === "ok") return s;
  }
  if (r["error"] !== undefined && r["error"] !== null) return "error";
  if (r["success"] === false) return "error";
  return "ok";
}

function summarizeResponse(response: unknown): string | undefined {
  if (response === null || response === undefined) return undefined;
  if (typeof response === "string") return truncate(response, 200);
  if (typeof response !== "object") return undefined;
  try {
    return truncate(JSON.stringify(response), 200);
  } catch {
    return undefined;
  }
}

function extractError(response: unknown): string {
  if (response === null || typeof response !== "object") return "unknown";
  const r = response as Record<string, unknown>;
  const e = r["error"];
  if (typeof e === "string") return truncate(e, 500);
  if (typeof r["reason"] === "string") return truncate(r["reason"] as string, 500);
  return "unknown";
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function deriveProjectId(cwd: string): string {
  const parts = cwd.replace(/\/+$/, "").split("/");
  const basename = parts[parts.length - 1] ?? "project";
  let h = 0;
  for (let i = 0; i < cwd.length; i += 1) {
    h = (h * 31 + cwd.charCodeAt(i)) | 0;
  }
  return `${basename}-${(h >>> 0).toString(16).slice(0, 8)}`;
}
