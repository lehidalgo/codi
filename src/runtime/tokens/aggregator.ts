/**
 * Aggregate per-session token usage into the brain DB. Called from the
 * Stop hook after captures are persisted; idempotent (the latest
 * transcript snapshot replaces any previous estimate).
 *
 * Resolution order:
 *   1. Transcript JSONL exists → real Anthropic usage numbers.
 *   2. No transcript → tokenizer estimate over prompts / turns / tools.
 *
 * The `tokens_estimated` column on `sessions` records which path was
 * taken (1 = estimated, 0 = real) so the UI can mark estimated rows.
 */

import type Database from "better-sqlite3";
import { loadTranscriptUsage } from "./transcript.js";
import { loadCodexTranscriptUsage, isCodexTranscriptPath } from "./transcript-codex.js";
import { estimateSessionUsage } from "./estimator.js";
import { resolvePricing, computeCostUsd, type ModelPricing } from "./pricing.js";

interface SessionRow {
  readonly transcript_path: string | null;
  readonly agent_model: string | null;
}

interface PromptText {
  readonly text: string;
}

interface TurnText {
  readonly agent_text: string | null;
}

interface ToolText {
  readonly input_json: string;
  readonly output_summary: string | null;
}

export interface AggregatedUsage {
  readonly input: number;
  readonly output: number;
  readonly cacheCreate: number;
  readonly cacheRead: number;
  readonly preloaded: number;
  readonly maxPrefix: number;
  readonly messages: number;
  readonly costUsd: number;
  readonly contextWindow: number;
  readonly estimated: boolean;
  readonly modelId: string;
}

export function aggregateSessionUsage(
  raw: Database.Database,
  sessionId: string,
): AggregatedUsage | null {
  const session = raw
    .prepare(`SELECT transcript_path, agent_model FROM sessions WHERE session_id = ?`)
    .get(sessionId) as SessionRow | undefined;
  if (!session) return null;

  // 1. Transcript-driven path.
  if (session.transcript_path) {
    // Codex transcripts have a different shape; route by path.
    const usage = isCodexTranscriptPath(session.transcript_path)
      ? loadCodexTranscriptUsage(session.transcript_path)
      : loadTranscriptUsage(session.transcript_path);
    if (usage) {
      // Opus 4.7 / 4.6 / Sonnet 4.6 already include 1M context at
      // standard pricing — no tier promotion needed. resolvePricing
      // strips the legacy `-1m` suffix to a single canonical row.
      const baseId = usage.model ?? session.agent_model;
      const resolved = resolvePricing(baseId);
      const costUsd = computeCostUsd(
        {
          input: usage.input,
          output: usage.output,
          cacheCreate5m: usage.cacheCreate5m,
          cacheCreate1h: usage.cacheCreate1h || usage.cacheCreate,
          cacheRead: usage.cacheRead,
        },
        resolved.pricing,
      );
      writeSessionTotals(raw, sessionId, {
        input: usage.input,
        output: usage.output,
        cacheCreate: usage.cacheCreate,
        cacheRead: usage.cacheRead,
        preloaded: usage.preloadedCacheCreate,
        maxPrefix: usage.maxPrefix,
        messages: usage.messages,
        costUsd,
        contextWindow: resolved.pricing.contextWindow,
        estimated: false,
        modelId: resolved.id,
      });
      return {
        input: usage.input,
        output: usage.output,
        cacheCreate: usage.cacheCreate,
        cacheRead: usage.cacheRead,
        preloaded: usage.preloadedCacheCreate,
        maxPrefix: usage.maxPrefix,
        messages: usage.messages,
        costUsd,
        contextWindow: resolved.pricing.contextWindow,
        estimated: false,
        modelId: resolved.id,
      };
    }
  }

  // 2. Tokenizer estimate path.
  const prompts = raw
    .prepare(`SELECT text FROM prompts WHERE session_id = ?`)
    .all(sessionId) as PromptText[];
  const turns = raw
    .prepare(`SELECT agent_text FROM turns WHERE session_id = ?`)
    .all(sessionId) as TurnText[];
  const tools = raw
    .prepare(`SELECT input_json, output_summary FROM tool_calls WHERE session_id = ?`)
    .all(sessionId) as ToolText[];
  if (prompts.length === 0 && turns.length === 0 && tools.length === 0) return null;
  const est = estimateSessionUsage({ prompts, turns, tools });
  const { id, pricing } = resolvePricing(session.agent_model);
  const costUsd = computeCostUsd(est, pricing);
  writeSessionTotals(raw, sessionId, {
    input: est.input,
    output: est.output,
    cacheCreate: 0,
    cacheRead: 0,
    preloaded: 0,
    maxPrefix: est.input,
    messages: turns.length,
    costUsd,
    contextWindow: pricing.contextWindow,
    estimated: true,
    modelId: id,
  });
  return {
    input: est.input,
    output: est.output,
    cacheCreate: 0,
    cacheRead: 0,
    preloaded: 0,
    maxPrefix: est.input,
    messages: turns.length,
    costUsd,
    contextWindow: pricing.contextWindow,
    estimated: true,
    modelId: id,
  };
}

interface WritePayload {
  readonly input: number;
  readonly output: number;
  readonly cacheCreate: number;
  readonly cacheRead: number;
  readonly preloaded: number;
  readonly maxPrefix: number;
  readonly messages: number;
  readonly costUsd: number;
  readonly contextWindow: number;
  readonly estimated: boolean;
  readonly modelId: string;
}

function writeSessionTotals(
  raw: Database.Database,
  sessionId: string,
  payload: WritePayload,
): void {
  raw
    .prepare(
      `UPDATE sessions
         SET tokens_input          = ?,
             tokens_output         = ?,
             tokens_cache_create   = ?,
             tokens_cache_read     = ?,
             tokens_preloaded      = ?,
             tokens_max_prefix     = ?,
             tokens_messages_count = ?,
             cost_usd              = ?,
             context_window        = ?,
             tokens_estimated      = ?,
             agent_model           = ?
         WHERE session_id = ?`,
    )
    .run(
      payload.input,
      payload.output,
      payload.cacheCreate,
      payload.cacheRead,
      payload.preloaded,
      payload.maxPrefix,
      payload.messages,
      payload.costUsd,
      payload.contextWindow,
      payload.estimated ? 1 : 0,
      payload.modelId,
      sessionId,
    );
}

export type { ModelPricing };
