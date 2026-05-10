/**
 * Parse a Claude Code transcript JSONL file and extract per-assistant-
 * message token usage. The transcript path lives at
 * `~/.claude/projects/<slug>/<session_id>.jsonl`; each line is a JSON
 * object that wraps either a user message, an assistant message, or a
 * tool result. Assistant messages carry a `usage` block we sum into a
 * session aggregate.
 */

import { readFileSync, existsSync } from "node:fs";

export interface MessageUsage {
  readonly model: string | null;
  readonly input: number;
  readonly output: number;
  readonly cacheCreate: number;
  /** 5-minute TTL portion of cache_create (extracted from `cache_creation.ephemeral_5m_input_tokens`). */
  readonly cacheCreate5m: number;
  /** 1-hour TTL portion of cache_create (extracted from `cache_creation.ephemeral_1h_input_tokens`). */
  readonly cacheCreate1h: number;
  readonly cacheRead: number;
}

export interface TranscriptUsage {
  readonly model: string | null;
  readonly messages: number;
  readonly input: number;
  readonly output: number;
  readonly cacheCreate: number;
  readonly cacheCreate5m: number;
  readonly cacheCreate1h: number;
  readonly cacheRead: number;
  /**
   * The cache_creation_input_tokens of the FIRST assistant message. This
   * is a useful proxy for the system prompt + injected skills + tool
   * definitions that were pre-loaded at session start.
   */
  readonly preloadedCacheCreate: number;
  /**
   * The largest per-message prefix observed across the transcript:
   * `input + cache_create + cache_read` for a single assistant message.
   * This is the right number to drive the "context window fill" bar —
   * the cumulative sum across turns has no semantic meaning (each call
   * sees a fresh prefix; reads are reused across calls).
   */
  readonly maxPrefix: number;
}

function asInt(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.floor(v));
  return 0;
}

function parseMessageUsage(line: string): MessageUsage | null {
  if (!line.trim()) return null;
  let obj: unknown;
  try {
    obj = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof obj !== "object" || obj === null) return null;
  const env = obj as Record<string, unknown>;
  const role =
    (env["type"] as string) || ((env["message"] as Record<string, unknown>)?.["role"] as string);
  if (role !== "assistant") return null;
  const msg = (env["message"] as Record<string, unknown>) ?? env;
  const usage = msg["usage"] as Record<string, unknown> | undefined;
  if (!usage) return null;
  const creation = usage["cache_creation"] as Record<string, unknown> | undefined;
  return {
    model: (msg["model"] as string) ?? null,
    input: asInt(usage["input_tokens"]),
    output: asInt(usage["output_tokens"]),
    cacheCreate: asInt(usage["cache_creation_input_tokens"]),
    cacheCreate5m: asInt(creation?.["ephemeral_5m_input_tokens"]),
    cacheCreate1h: asInt(creation?.["ephemeral_1h_input_tokens"]),
    cacheRead: asInt(usage["cache_read_input_tokens"]),
  };
}

/**
 * Read the entire transcript and return aggregate usage. Returns null if
 * the file is missing or empty (caller decides whether to fall back to a
 * tokenizer-based estimate).
 */
export function loadTranscriptUsage(path: string): TranscriptUsage | null {
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, "utf8");
  if (!raw) return null;
  const lines = raw.split("\n");
  let model: string | null = null;
  let messages = 0;
  let input = 0;
  let output = 0;
  let cacheCreate = 0;
  let cacheCreate5m = 0;
  let cacheCreate1h = 0;
  let cacheRead = 0;
  let preloadedCacheCreate = 0;
  let maxPrefix = 0;
  for (const line of lines) {
    const u = parseMessageUsage(line);
    if (!u) continue;
    if (u.model && !model) model = u.model;
    messages += 1;
    input += u.input;
    output += u.output;
    cacheCreate += u.cacheCreate;
    cacheCreate5m += u.cacheCreate5m;
    cacheCreate1h += u.cacheCreate1h;
    cacheRead += u.cacheRead;
    const prefix = u.input + u.cacheCreate + u.cacheRead;
    if (prefix > maxPrefix) maxPrefix = prefix;
    if (messages === 1) preloadedCacheCreate = u.cacheCreate;
  }
  if (messages === 0) return null;
  return {
    model,
    messages,
    input,
    output,
    cacheCreate,
    cacheCreate5m,
    cacheCreate1h,
    cacheRead,
    preloadedCacheCreate,
    maxPrefix,
  };
}
