/**
 * LLM provider contract (Item 6).
 *
 * v3.0.0 ships two concrete adapters: Gemini and OpenAI. Both behave the
 * same way from the consolidation runner's perspective — given a system
 * prompt + a user prompt, return a deterministic-shape response with
 * usage metadata. Adding a third provider (Anthropic, Groq, ...) is a
 * matter of implementing this interface.
 */

export type ProviderId = "gemini" | "openai";

export interface GenerateOptions {
  readonly system: string;
  readonly user: string;
  readonly maxTokens?: number;
  readonly temperature?: number;
}

export interface GenerateResult {
  readonly text: string;
  readonly tokensIn: number;
  readonly tokensOut: number;
  readonly model: string;
}

export interface LlmProvider {
  readonly id: ProviderId;
  readonly defaultModel: string;
  generate(opts: GenerateOptions): Promise<GenerateResult>;
}

export class LlmConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmConfigError";
  }
}

export class LlmRateLimitError extends Error {
  constructor(
    message: string,
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "LlmRateLimitError";
  }
}

/**
 * Mask an API key for logging — keeps first 4 + last 4 chars, replaces the
 * middle with stars. Never log the raw key, even in dev.
 */
export function redactKey(key: string | undefined): string {
  if (!key) return "<unset>";
  if (key.length <= 8) return "<short-key>";
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}
