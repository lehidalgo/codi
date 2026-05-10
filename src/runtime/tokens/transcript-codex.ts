/**
 * Parse a Codex CLI session JSONL and extract aggregate token usage.
 *
 * Codex transcripts live under
 * `~/.codex/sessions/<yyyy>/<mm>/<dd>/rollout-<ts>-<uuid>.jsonl` and use
 * a different shape from Anthropic's transcripts:
 *
 *   - `session_meta` carries `payload.model_provider`, `cli_version`,
 *     `cwd`, and the system prompt under `payload.base_instructions`.
 *   - `event_msg/token_count` events carry cumulative + last-turn token
 *     usage with `input_tokens`, `cached_input_tokens`, `output_tokens`,
 *     `reasoning_output_tokens`, `total_tokens` and the model context
 *     window size.
 *   - Each user / assistant message is a `response_item` with
 *     `payload.role` and `payload.content`.
 *
 * We take the LAST `token_count` event as the final running total
 * (Codex emits one after every turn, with `total_token_usage` already
 * cumulative). Reasoning output tokens fold into the regular output
 * bucket so the cost calc treats them as billable output (which they
 * are, per OpenAI billing).
 *
 * Cache reads map to `cached_input_tokens`. Codex has no separate
 * cache_create concept; the cache write cost is folded into the input
 * price by the OpenAI billing model, so we leave `cacheCreate` at 0.
 */

import { readFileSync, existsSync } from "node:fs";
import type { TranscriptUsage } from "./transcript.js";

interface CodexTokenUsage {
  readonly input_tokens?: number;
  readonly cached_input_tokens?: number;
  readonly output_tokens?: number;
  readonly reasoning_output_tokens?: number;
  readonly total_tokens?: number;
}

interface CodexTokenCountInfo {
  readonly total_token_usage?: CodexTokenUsage;
  readonly last_token_usage?: CodexTokenUsage;
  readonly model_context_window?: number;
}

function asInt(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.floor(v));
  return 0;
}

/**
 * Read a Codex session JSONL and return aggregate usage in the same
 * shape as `loadTranscriptUsage` from `transcript.ts`. Cache writes are
 * always 0 (OpenAI rolls write costs into input pricing).
 */
export function loadCodexTranscriptUsage(path: string): TranscriptUsage | null {
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, "utf8");
  if (!raw) return null;
  const lines = raw.split("\n");

  let model: string | null = null;
  let modelContextWindow = 0;
  let lastTotal: CodexTokenUsage | null = null;
  let firstTokenCount: CodexTokenUsage | null = null;
  let messages = 0;
  let maxPrefix = 0;

  for (const line of lines) {
    if (!line.trim()) continue;
    let obj: unknown;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    if (typeof obj !== "object" || obj === null) continue;
    const env = obj as Record<string, unknown>;
    const payload = env["payload"] as Record<string, unknown> | undefined;
    if (!payload) continue;

    if (env["type"] === "session_meta") {
      const baseModel = (payload["model_provider"] as string) ?? null;
      // session_meta carries the provider but Codex stores the actual
      // model id under turn_context payload.model_id (per docs). Fall
      // back to provider when nothing else surfaces.
      if (!model && baseModel) model = baseModel;
    }
    if (env["type"] === "turn_context") {
      const m = (payload["model"] as string) ?? null;
      if (m) model = m;
    }
    if (env["type"] === "event_msg" && payload["type"] === "token_count") {
      const info = payload["info"] as CodexTokenCountInfo | undefined;
      if (!info) continue;
      messages += 1;
      if (typeof info.model_context_window === "number") {
        modelContextWindow = info.model_context_window;
      }
      if (info.total_token_usage) lastTotal = info.total_token_usage;
      if (!firstTokenCount && info.last_token_usage) {
        firstTokenCount = info.last_token_usage;
      }
      // Track max prefix: the largest `last_token_usage.input_tokens +
      // cached_input_tokens` seen in a single turn (matches the
      // semantics of Anthropic's max-prefix calc — biggest single API
      // call observed).
      if (info.last_token_usage) {
        const lt = info.last_token_usage;
        const prefix = asInt(lt.input_tokens) + asInt(lt.cached_input_tokens);
        if (prefix > maxPrefix) maxPrefix = prefix;
      }
    }
  }

  if (!lastTotal) return null;

  const input = asInt(lastTotal.input_tokens);
  const output = asInt(lastTotal.output_tokens) + asInt(lastTotal.reasoning_output_tokens);
  const cacheRead = asInt(lastTotal.cached_input_tokens);
  // First token_count's cache reads are the implicit pre-load (system
  // prompt + injected instructions cached at session start). Codex does
  // not expose a separate cache_create event, so we surface this as
  // "preloadedCacheCreate" for UI parity with Anthropic.
  const preloadedCacheCreate = firstTokenCount ? asInt(firstTokenCount.cached_input_tokens) : 0;

  return {
    model,
    messages,
    input,
    output,
    cacheCreate: 0,
    cacheCreate5m: 0,
    cacheCreate1h: 0,
    cacheRead,
    preloadedCacheCreate,
    maxPrefix: maxPrefix > 0 ? maxPrefix : input + cacheRead,
  };
}

/**
 * Cheap detector: a Codex transcript path lives under `.codex/sessions/`
 * (project) or `~/.codex/sessions/` (user). Anthropic transcripts live
 * under `~/.claude/projects/`. We dispatch at aggregator level by
 * pattern-matching the path so the caller doesn't need to remember.
 */
export function isCodexTranscriptPath(path: string | null | undefined): boolean {
  if (!path) return false;
  return path.includes("/.codex/sessions/") || path.includes("\\.codex\\sessions\\");
}
