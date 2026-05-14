/**
 * Agent-harness runner — invokes a real model with a controlled prompt and
 * captures the full transcript so vitest assertions can grep for skill
 * invocations, response phrases, or anti-patterns.
 *
 * Runs are OPT-IN: tests skip unless `CODI_AGENT_TESTS=1` is set. Default
 * model is Anthropic Haiku 4.5 (cheap + fast).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface HarnessOptions {
  readonly promptPath: string;
  readonly systemPrompt?: string;
  readonly model?: string;
  readonly maxTokens?: number;
  readonly apiKey?: string;
}

export interface HarnessResult {
  readonly text: string;
  readonly stopReason: string | null;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export function harnessEnabled(): boolean {
  return process.env["CODI_AGENT_TESTS"] === "1";
}

export function readPrompt(promptPath: string): string {
  return readFileSync(resolve(process.cwd(), promptPath), "utf8");
}

export async function runHarness(opts: HarnessOptions): Promise<HarnessResult> {
  const apiKey = opts.apiKey ?? process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not set — agent-harness tests need a Claude API key.");
  }
  let Anthropic: typeof import("@anthropic-ai/sdk").default;
  try {
    const mod = await import("@anthropic-ai/sdk");
    Anthropic = mod.default;
  } catch {
    throw new Error(
      "Optional dep '@anthropic-ai/sdk' missing — run `npm install --save-dev @anthropic-ai/sdk` to enable.",
    );
  }
  const client = new Anthropic({ apiKey });
  const userText = readPrompt(opts.promptPath);
  const response = await client.messages.create({
    model: opts.model ?? "claude-haiku-4-5-20251001",
    max_tokens: opts.maxTokens ?? 1024,
    system: opts.systemPrompt ?? "",
    messages: [{ role: "user", content: userText }],
  });
  const text = response.content
    .filter((block): block is { type: "text"; text: string } => block.type === "text")
    .map((block) => block.text)
    .join("");
  return {
    text,
    stopReason: response.stop_reason,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

export function loadUsingCodiAnchor(): string {
  try {
    const path = resolve(process.cwd(), "src", "templates", "skills", "using-codi", "template.ts");
    const content = readFileSync(path, "utf8");
    const firstFm = content.indexOf("---\n");
    if (firstFm === -1) return "";
    const secondFm = content.indexOf("\n---", firstFm + 4);
    if (secondFm === -1) return "";
    return content
      .slice(secondFm + 4)
      .replace(/`;\s*$/m, "")
      .trim();
  } catch {
    return "";
  }
}
