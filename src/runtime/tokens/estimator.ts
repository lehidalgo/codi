/**
 * Tokenizer-based fallback used when no Claude transcript is available
 * (Codex sessions, manual back-fills, sessions whose transcript was
 * deleted). gpt-tokenizer's cl100k_base encoder is within ~3% of
 * Anthropic's true count for English / code text — accurate enough for a
 * "session has consumed N% of the context window" indicator.
 *
 * Estimated rows are flagged with `estimated: true` so the UI can show a
 * tilde (~) next to the number.
 */

import { encode } from "gpt-tokenizer";

export interface EstimatedUsage {
  readonly input: number;
  readonly output: number;
  readonly cacheCreate: number;
  readonly cacheRead: number;
  readonly estimated: true;
}

export function estimateTokens(text: string | null | undefined): number {
  if (!text) return 0;
  try {
    return encode(text).length;
  } catch {
    // gpt-tokenizer can throw on malformed unicode; fall back to a
    // 4-chars-per-token approximation rather than failing the aggregate.
    return Math.ceil(text.length / 4);
  }
}

export interface EstimateInput {
  readonly prompts: ReadonlyArray<{ text: string }>;
  readonly turns: ReadonlyArray<{ agent_text: string | null }>;
  readonly tools: ReadonlyArray<{ input_json: string; output_summary: string | null }>;
}

/**
 * Roll all session text through the tokenizer. Prompts + tool inputs
 * count as input; turns + tool outputs count as output. Cache fields are
 * left at 0 because we cannot infer cache hits without the transcript.
 */
export function estimateSessionUsage(input: EstimateInput): EstimatedUsage {
  let inputTokens = 0;
  let outputTokens = 0;
  for (const p of input.prompts) inputTokens += estimateTokens(p.text);
  for (const t of input.turns) outputTokens += estimateTokens(t.agent_text);
  for (const tc of input.tools) {
    inputTokens += estimateTokens(tc.input_json);
    outputTokens += estimateTokens(tc.output_summary);
  }
  return {
    input: inputTokens,
    output: outputTokens,
    cacheCreate: 0,
    cacheRead: 0,
    estimated: true,
  };
}
