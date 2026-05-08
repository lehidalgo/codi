/**
 * Gemini provider (Item 6).
 *
 * Wraps `@google/generative-ai`. Reads `CODI_GEMINI_API_KEY` and uses
 * `gemini-1.5-flash` by default — cheap + fast for the volume of
 * consolidation calls v3 expects (≤ CODI_LLM_MAX_CALLS_PER_RUN per
 * pipeline run, default 20).
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  LlmConfigError,
  type GenerateOptions,
  type GenerateResult,
  type LlmProvider,
} from "./provider.js";

const DEFAULT_MODEL = "gemini-1.5-flash";

export interface GeminiOptions {
  readonly apiKey?: string;
  readonly model?: string;
  /** Override the SDK constructor — used by tests to inject a mock. */
  readonly clientFactory?: (apiKey: string) => GoogleGenerativeAI;
}

export class GeminiProvider implements LlmProvider {
  readonly id = "gemini" as const;
  readonly defaultModel: string;
  private readonly client: GoogleGenerativeAI;

  constructor(opts: GeminiOptions = {}) {
    const apiKey = opts.apiKey ?? process.env["CODI_GEMINI_API_KEY"];
    if (!apiKey) {
      throw new LlmConfigError("CODI_GEMINI_API_KEY is not set; cannot instantiate GeminiProvider");
    }
    this.defaultModel = opts.model ?? DEFAULT_MODEL;
    this.client = opts.clientFactory ? opts.clientFactory(apiKey) : new GoogleGenerativeAI(apiKey);
  }

  async generate(opts: GenerateOptions): Promise<GenerateResult> {
    const model = this.client.getGenerativeModel({
      model: this.defaultModel,
      systemInstruction: opts.system,
      generationConfig: {
        maxOutputTokens: opts.maxTokens ?? 512,
        temperature: opts.temperature ?? 0.3,
      },
    });
    const response = await model.generateContent(opts.user);
    const text = response.response.text();
    const usage = response.response.usageMetadata;
    return {
      text,
      tokensIn: usage?.promptTokenCount ?? 0,
      tokensOut: usage?.candidatesTokenCount ?? 0,
      model: this.defaultModel,
    };
  }
}
