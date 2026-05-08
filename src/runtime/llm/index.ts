/**
 * Public surface of `src/runtime/llm/` (Item 6).
 */

export {
  type ProviderId,
  type GenerateOptions,
  type GenerateResult,
  type LlmProvider,
  LlmConfigError,
  LlmRateLimitError,
  redactKey,
} from "./provider.js";

export { GeminiProvider, type GeminiOptions } from "./gemini.js";
export { OpenAIProvider, type OpenAIOptions } from "./openai.js";
export { getProvider, maxCallsPerRun, type SelectorOptions } from "./registry.js";
