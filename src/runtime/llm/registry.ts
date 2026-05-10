/**
 * Provider selector (Item 6).
 *
 * Reads `CODI_LLM_PROVIDER` (gemini | openai). Default: gemini (cheaper for
 * the consolidation call volume v3 expects). Validates the corresponding
 * API key exists at instantiation time so callers fail fast with a clear
 * config error rather than at the first generate() call.
 *
 * Provider modules are loaded lazily via dynamic `import()` so the heavy
 * `openai` (~32 MB) and `@google/generative-ai` (~1.2 MB) SDKs stay out of
 * the CLI's eager module graph. Cold `codi --help` keeps its sub-300 ms
 * latency; only the brain-ui consolidation endpoint pays the SDK cost.
 */

import { LlmConfigError, type LlmProvider, type ProviderId } from "./provider.js";

export interface SelectorOptions {
  /** Override the env var. Tests + CLI commands pass this in directly. */
  readonly provider?: ProviderId;
  /** Inject a fully built provider — tests use this to skip env validation. */
  readonly forceProvider?: LlmProvider;
}

const VALID_IDS: readonly ProviderId[] = ["gemini", "openai"];

export async function getProvider(opts: SelectorOptions = {}): Promise<LlmProvider> {
  if (opts.forceProvider) return opts.forceProvider;
  const id =
    opts.provider ?? (process.env["CODI_LLM_PROVIDER"] as ProviderId | undefined) ?? "gemini";
  if (!VALID_IDS.includes(id)) {
    throw new LlmConfigError(
      `CODI_LLM_PROVIDER must be one of ${VALID_IDS.join(", ")}, got: ${id}`,
    );
  }
  if (id === "gemini") {
    const { GeminiProvider } = await import("./gemini.js");
    return new GeminiProvider();
  }
  const { OpenAIProvider } = await import("./openai.js");
  return new OpenAIProvider();
}

/**
 * Cap on LLM calls per consolidation run. Prevents a runaway pipeline from
 * blowing through an API budget when something pathological appears in
 * the brain DB (e.g. thousands of P5 candidates).
 */
export function maxCallsPerRun(): number {
  const raw = process.env["CODI_LLM_MAX_CALLS_PER_RUN"];
  if (raw === undefined) return 20;
  const n = Number(raw);
  // 0 is a valid value (disables LLM calls). Negative or non-finite is garbage.
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 20;
}
