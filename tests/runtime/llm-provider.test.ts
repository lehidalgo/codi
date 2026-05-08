/**
 * LLM provider contract tests (Item 6).
 *
 * Real Gemini / OpenAI calls are mocked at the SDK boundary so the suite
 * never touches the network. The tests target:
 *   - LlmConfigError when the API key env var is missing
 *   - generate() returns the GenerateResult shape
 *   - registry returns the right concrete class
 *   - redactKey masks every char except first/last 4
 *   - maxCallsPerRun() reads CODI_LLM_MAX_CALLS_PER_RUN with a sane default
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  GeminiProvider,
  OpenAIProvider,
  LlmConfigError,
  redactKey,
  getProvider,
  maxCallsPerRun,
  type LlmProvider,
} from "#src/runtime/llm/index.js";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  delete process.env["CODI_GEMINI_API_KEY"];
  delete process.env["CODI_OPENAI_API_KEY"];
  delete process.env["CODI_LLM_PROVIDER"];
  delete process.env["CODI_LLM_MAX_CALLS_PER_RUN"];
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("redactKey", () => {
  it("masks middle chars", () => {
    expect(redactKey("abcdefghijklmn")).toBe("abcd…klmn");
  });
  it("returns sentinel when undefined", () => {
    expect(redactKey(undefined)).toBe("<unset>");
  });
  it("returns sentinel for short keys", () => {
    expect(redactKey("abc123")).toBe("<short-key>");
  });
});

describe("GeminiProvider", () => {
  it("throws LlmConfigError when CODI_GEMINI_API_KEY is missing", () => {
    expect(() => new GeminiProvider()).toThrow(LlmConfigError);
  });

  it("generate() returns the GenerateResult shape", async () => {
    process.env["CODI_GEMINI_API_KEY"] = "test-key-1234";
    const provider = new GeminiProvider({
      clientFactory: () => makeMockGeminiClient("hello world"),
    });
    const result = await provider.generate({ system: "s", user: "u" });
    expect(result.text).toBe("hello world");
    expect(result.tokensIn).toBeGreaterThanOrEqual(0);
    expect(result.tokensOut).toBeGreaterThanOrEqual(0);
    expect(result.model).toBe("gemini-1.5-flash");
  });
});

describe("OpenAIProvider", () => {
  it("throws LlmConfigError when CODI_OPENAI_API_KEY is missing", () => {
    expect(() => new OpenAIProvider()).toThrow(LlmConfigError);
  });

  it("generate() returns the GenerateResult shape", async () => {
    process.env["CODI_OPENAI_API_KEY"] = "test-key-5678";
    const provider = new OpenAIProvider({
      clientFactory: () => makeMockOpenAIClient("hi from openai") as never,
    });
    const result = await provider.generate({ system: "s", user: "u" });
    expect(result.text).toBe("hi from openai");
    expect(result.model).toBe("gpt-4o-mini");
  });
});

describe("getProvider (registry)", () => {
  it("forceProvider injection bypasses env validation", () => {
    const fake: LlmProvider = {
      id: "gemini",
      defaultModel: "fake",
      generate: async () => ({ text: "x", tokensIn: 0, tokensOut: 0, model: "fake" }),
    };
    expect(getProvider({ forceProvider: fake })).toBe(fake);
  });

  it("rejects unknown CODI_LLM_PROVIDER values", () => {
    process.env["CODI_LLM_PROVIDER"] = "bogus";
    expect(() => getProvider()).toThrow(LlmConfigError);
  });

  it("defaults to gemini when CODI_LLM_PROVIDER is unset (and key is set)", () => {
    process.env["CODI_GEMINI_API_KEY"] = "k";
    const provider = getProvider();
    expect(provider.id).toBe("gemini");
  });
});

describe("maxCallsPerRun", () => {
  it("defaults to 20", () => {
    expect(maxCallsPerRun()).toBe(20);
  });

  it("reads from env when set to a positive number", () => {
    process.env["CODI_LLM_MAX_CALLS_PER_RUN"] = "5";
    expect(maxCallsPerRun()).toBe(5);
  });

  it("falls back to default on garbage", () => {
    process.env["CODI_LLM_MAX_CALLS_PER_RUN"] = "not-a-number";
    expect(maxCallsPerRun()).toBe(20);
    process.env["CODI_LLM_MAX_CALLS_PER_RUN"] = "-1";
    expect(maxCallsPerRun()).toBe(20);
  });
});

// ─── helpers ──────────────────────────────────────────────────────────────

function makeMockGeminiClient(text: string): never {
  return {
    getGenerativeModel() {
      return {
        async generateContent() {
          return {
            response: {
              text: () => text,
              usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 7 },
            },
          };
        },
      };
    },
  } as never;
}

function makeMockOpenAIClient(text: string) {
  return {
    chat: {
      completions: {
        async create() {
          return {
            choices: [{ message: { content: text } }],
            usage: { prompt_tokens: 5, completion_tokens: 7 },
          };
        },
      },
    },
  };
}
