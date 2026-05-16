/**
 * Per-model pricing + context window table. Prices are USD per 1,000,000
 * tokens for the four bill axes Anthropic exposes (and that we surface in
 * the brain UI). Rates come from claude.ai/pricing; the constants are
 * checked into the repo so cost numbers are reproducible without a network
 * call. Update the table when Anthropic changes the price sheet.
 */

export interface ModelPricing {
  /** Input tokens that miss every cache. */
  readonly inputUsdPerMTok: number;
  /** Output tokens (assistant reply). */
  readonly outputUsdPerMTok: number;
  /** Hit on existing cached prefix. Cheapest. */
  readonly cacheReadUsdPerMTok: number;
  /** 5-minute TTL cache write. Claude Code default: 1h, see below. */
  readonly cacheCreate5mUsdPerMTok: number;
  /** 1-hour TTL cache write. Claude Code uses this by default. */
  readonly cacheCreate1hUsdPerMTok: number;
  /** Maximum tokens the model can hold in a single turn. */
  readonly contextWindow: number;
}

// Pricing snapshot — Claude API (anthropic), May 2026.
// Source: https://platform.claude.com/docs/en/about-claude/pricing
//
// Cache writes have two TTL tiers:
//   - 5-minute cache write @ 1.25x input
//   - 1-hour   cache write @ 2x   input
// Claude Code emits `ephemeral_1h_input_tokens` by default, so the
// cumulative `cache_create` we receive from the transcript is split
// across both buckets. The aggregator routes each token to the correct
// rate.
//
// 1M context: Opus 4.7, Opus 4.6, and Sonnet 4.6 all include the 1M
// window at STANDARD pricing — no separate "-1m" tier. The same row
// applies whether the call used 200K or 1M.
const PRICING: Readonly<Record<string, ModelPricing>> = {
  "claude-opus-4-7": {
    inputUsdPerMTok: 5,
    outputUsdPerMTok: 25,
    cacheReadUsdPerMTok: 0.5,
    cacheCreate5mUsdPerMTok: 6.25,
    cacheCreate1hUsdPerMTok: 10,
    contextWindow: 1_000_000,
  },
  "claude-opus-4-6": {
    inputUsdPerMTok: 5,
    outputUsdPerMTok: 25,
    cacheReadUsdPerMTok: 0.5,
    cacheCreate5mUsdPerMTok: 6.25,
    cacheCreate1hUsdPerMTok: 10,
    contextWindow: 1_000_000,
  },
  "claude-opus-4-5": {
    inputUsdPerMTok: 5,
    outputUsdPerMTok: 25,
    cacheReadUsdPerMTok: 0.5,
    cacheCreate5mUsdPerMTok: 6.25,
    cacheCreate1hUsdPerMTok: 10,
    contextWindow: 200_000,
  },
  "claude-opus-4-1": {
    inputUsdPerMTok: 15,
    outputUsdPerMTok: 75,
    cacheReadUsdPerMTok: 1.5,
    cacheCreate5mUsdPerMTok: 18.75,
    cacheCreate1hUsdPerMTok: 30,
    contextWindow: 200_000,
  },
  "claude-sonnet-4-6": {
    inputUsdPerMTok: 3,
    outputUsdPerMTok: 15,
    cacheReadUsdPerMTok: 0.3,
    cacheCreate5mUsdPerMTok: 3.75,
    cacheCreate1hUsdPerMTok: 6,
    contextWindow: 1_000_000,
  },
  "claude-sonnet-4-5": {
    inputUsdPerMTok: 3,
    outputUsdPerMTok: 15,
    cacheReadUsdPerMTok: 0.3,
    cacheCreate5mUsdPerMTok: 3.75,
    cacheCreate1hUsdPerMTok: 6,
    contextWindow: 200_000,
  },
  "claude-haiku-4-5": {
    inputUsdPerMTok: 1,
    outputUsdPerMTok: 5,
    cacheReadUsdPerMTok: 0.1,
    cacheCreate5mUsdPerMTok: 1.25,
    cacheCreate1hUsdPerMTok: 2,
    contextWindow: 200_000,
  },
  // ─── OpenAI / Codex models ─────────────────────────────────────────────
  // Source: developers.openai.com/codex/pricing (Codex plan rate card,
  // converted from credits to USD at 100 credits = $1). cache write
  // tiers do not exist in the OpenAI billing model — set 5m/1h to the
  // input price as a no-op so cost math stays consistent with Anthropic.
  // Reasoning tokens are billed as output and we sum them into
  // `output_tokens` at parse time.
  "gpt-5-5": {
    inputUsdPerMTok: 1.25,
    outputUsdPerMTok: 7.5,
    cacheReadUsdPerMTok: 0.125,
    cacheCreate5mUsdPerMTok: 1.25,
    cacheCreate1hUsdPerMTok: 1.25,
    contextWindow: 400_000,
  },
  "gpt-5-4": {
    inputUsdPerMTok: 0.625,
    outputUsdPerMTok: 3.75,
    cacheReadUsdPerMTok: 0.0625,
    cacheCreate5mUsdPerMTok: 0.625,
    cacheCreate1hUsdPerMTok: 0.625,
    contextWindow: 258_400,
  },
  "gpt-5-4-mini": {
    inputUsdPerMTok: 0.1875,
    outputUsdPerMTok: 1.13,
    cacheReadUsdPerMTok: 0.01875,
    cacheCreate5mUsdPerMTok: 0.1875,
    cacheCreate1hUsdPerMTok: 0.1875,
    contextWindow: 258_400,
  },
  "gpt-5-3-codex": {
    inputUsdPerMTok: 0.4375,
    outputUsdPerMTok: 3.5,
    cacheReadUsdPerMTok: 0.04375,
    cacheCreate5mUsdPerMTok: 0.4375,
    cacheCreate1hUsdPerMTok: 0.4375,
    contextWindow: 258_400,
  },
  "gpt-5-codex": {
    inputUsdPerMTok: 1.25,
    outputUsdPerMTok: 10,
    cacheReadUsdPerMTok: 0.125,
    cacheCreate5mUsdPerMTok: 1.25,
    cacheCreate1hUsdPerMTok: 1.25,
    contextWindow: 400_000,
  },
};

/**
 * Resolve pricing for a free-form model id. Strips trailing `[1m]` /
 * `-1m` suffixes after a successful 1m-context match, then falls back to
 * the canonical id. When nothing matches, returns the Sonnet baseline so
 * cost calculations remain finite (callers can still detect "unknown
 * model" by comparing the returned id to the requested one).
 */
export function resolvePricing(model: string | null | undefined): {
  readonly id: string;
  readonly pricing: ModelPricing;
  readonly resolvedExactly: boolean;
} {
  const id = (model ?? "").toLowerCase().trim();
  if (!id) {
    return {
      id: "claude-sonnet-4-6",
      pricing: PRICING["claude-sonnet-4-6"]!,
      resolvedExactly: false,
    };
  }
  if (id in PRICING) {
    return { id, pricing: PRICING[id]!, resolvedExactly: true };
  }
  // Strip legacy `[1m]` / `-1m` suffixes; Opus 4.7 / 4.6 / Sonnet 4.6
  // all carry 1M at standard pricing now, so the suffixed id maps to
  // the same row.
  const stripped = id.replace(/\[1m\]$/, "").replace(/-1m$/, "");
  if (stripped !== id && stripped in PRICING) {
    return { id: stripped, pricing: PRICING[stripped]!, resolvedExactly: true };
  }
  const normalized = stripped.replace(/\.\d+/g, "");
  if (normalized in PRICING) {
    return { id: normalized, pricing: PRICING[normalized]!, resolvedExactly: true };
  }
  // Family fallback.
  if (id.includes("opus")) {
    return { id: "claude-opus-4-7", pricing: PRICING["claude-opus-4-7"]!, resolvedExactly: false };
  }
  if (id.includes("haiku")) {
    return {
      id: "claude-haiku-4-5",
      pricing: PRICING["claude-haiku-4-5"]!,
      resolvedExactly: false,
    };
  }
  // OpenAI / Codex family. Codex transcripts carry model ids like
  // "gpt-5.4", "gpt-5-codex", "gpt-5.4-mini" — normalise dots to dashes
  // and match the closest known row.
  if (id.startsWith("gpt-") || id.startsWith("openai/")) {
    const dashed = id.replace(/^openai\//, "").replace(/\./g, "-");
    if (dashed in PRICING) {
      return { id: dashed, pricing: PRICING[dashed]!, resolvedExactly: true };
    }
    if (dashed.includes("mini")) {
      return {
        id: "gpt-5-4-mini",
        pricing: PRICING["gpt-5-4-mini"]!,
        resolvedExactly: false,
      };
    }
    if (dashed.includes("codex")) {
      return {
        id: "gpt-5-codex",
        pricing: PRICING["gpt-5-codex"]!,
        resolvedExactly: false,
      };
    }
    if (dashed.startsWith("gpt-5-5")) {
      return { id: "gpt-5-5", pricing: PRICING["gpt-5-5"]!, resolvedExactly: false };
    }
    return { id: "gpt-5-4", pricing: PRICING["gpt-5-4"]!, resolvedExactly: false };
  }
  return {
    id: "claude-sonnet-4-6",
    pricing: PRICING["claude-sonnet-4-6"]!,
    resolvedExactly: false,
  };
}

export interface UsageBreakdown {
  readonly input: number;
  readonly output: number;
  /** 5-minute TTL slice of cache_create. */
  readonly cacheCreate5m?: number;
  /** 1-hour TTL slice of cache_create (Claude Code default). */
  readonly cacheCreate1h?: number;
  /** Legacy total cache_create when split is not available — billed at 1h rate. */
  readonly cacheCreate?: number;
  readonly cacheRead: number;
}

export function computeCostUsd(usage: UsageBreakdown, pricing: ModelPricing): number {
  const create5m = usage.cacheCreate5m ?? 0;
  const create1h = usage.cacheCreate1h ?? usage.cacheCreate ?? 0;
  const cost =
    (usage.input * pricing.inputUsdPerMTok +
      usage.output * pricing.outputUsdPerMTok +
      create5m * pricing.cacheCreate5mUsdPerMTok +
      create1h * pricing.cacheCreate1hUsdPerMTok +
      usage.cacheRead * pricing.cacheReadUsdPerMTok) /
    1_000_000;
  return Number(cost.toFixed(6));
}

export function knownModels(): ReadonlyArray<string> {
  return Object.keys(PRICING);
}
