/**
 * OpenAI provider (Item 6).
 *
 * Wraps `openai` SDK. Reads `CODI_OPENAI_API_KEY` and uses `gpt-4o-mini`
 * by default — same cost-tier reasoning as the Gemini default model.
 */

import OpenAI from "openai";
import {
  LlmConfigError,
  type GenerateOptions,
  type GenerateResult,
  type LlmProvider,
} from "./provider.js";

const DEFAULT_MODEL = "gpt-4o-mini";

export interface OpenAIOptions {
  readonly apiKey?: string;
  readonly model?: string;
  /** Inject a mock client (tests). */
  readonly clientFactory?: (apiKey: string) => OpenAI;
}

export class OpenAIProvider implements LlmProvider {
  readonly id = "openai" as const;
  readonly defaultModel: string;
  private readonly client: OpenAI;

  constructor(opts: OpenAIOptions = {}) {
    const apiKey = opts.apiKey ?? process.env["CODI_OPENAI_API_KEY"];
    if (!apiKey) {
      throw new LlmConfigError("CODI_OPENAI_API_KEY is not set; cannot instantiate OpenAIProvider");
    }
    this.defaultModel = opts.model ?? DEFAULT_MODEL;
    this.client = opts.clientFactory ? opts.clientFactory(apiKey) : new OpenAI({ apiKey });
  }

  async generate(opts: GenerateOptions): Promise<GenerateResult> {
    const completion = await this.client.chat.completions.create({
      model: this.defaultModel,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      max_tokens: opts.maxTokens ?? 512,
      temperature: opts.temperature ?? 0.3,
    });
    const choice = completion.choices[0];
    const text = choice?.message?.content ?? "";
    return {
      text,
      tokensIn: completion.usage?.prompt_tokens ?? 0,
      tokensOut: completion.usage?.completion_tokens ?? 0,
      model: this.defaultModel,
    };
  }
}
