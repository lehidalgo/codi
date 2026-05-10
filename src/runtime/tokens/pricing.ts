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
  /** Bytes added to the prompt cache for the first time. */
  readonly cacheCreateUsdPerMTok: number;
  /** Maximum tokens the model can hold in a single turn. */
  readonly contextWindow: number;
}

const PRICING: Readonly<Record<string, ModelPricing>> = {
  // Claude Opus 4.7 (current flagship)
  "claude-opus-4-7": {
    inputUsdPerMTok: 15,
    outputUsdPerMTok: 75,
    cacheReadUsdPerMTok: 1.5,
    cacheCreateUsdPerMTok: 18.75,
    contextWindow: 200_000,
  },
  "claude-opus-4-7-1m": {
    inputUsdPerMTok: 15,
    outputUsdPerMTok: 75,
    cacheReadUsdPerMTok: 1.5,
    cacheCreateUsdPerMTok: 18.75,
    contextWindow: 1_000_000,
  },
  // Claude Sonnet 4.6
  "claude-sonnet-4-6": {
    inputUsdPerMTok: 3,
    outputUsdPerMTok: 15,
    cacheReadUsdPerMTok: 0.3,
    cacheCreateUsdPerMTok: 3.75,
    contextWindow: 200_000,
  },
  "claude-sonnet-4-6-1m": {
    inputUsdPerMTok: 3,
    outputUsdPerMTok: 15,
    cacheReadUsdPerMTok: 0.3,
    cacheCreateUsdPerMTok: 3.75,
    contextWindow: 1_000_000,
  },
  // Claude Haiku 4.5
  "claude-haiku-4-5": {
    inputUsdPerMTok: 1,
    outputUsdPerMTok: 5,
    cacheReadUsdPerMTok: 0.1,
    cacheCreateUsdPerMTok: 1.25,
    contextWindow: 200_000,
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
  // Exact + 1m-tier match.
  if (id in PRICING) {
    return { id, pricing: PRICING[id]!, resolvedExactly: true };
  }
  const normalized = id.replace(/\[1m\]$/, "-1m").replace(/\.\d+/g, ""); // tolerate "claude-opus-4.7" → "claude-opus-4-7"
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
  return {
    id: "claude-sonnet-4-6",
    pricing: PRICING["claude-sonnet-4-6"]!,
    resolvedExactly: false,
  };
}

export interface UsageBreakdown {
  readonly input: number;
  readonly output: number;
  readonly cacheCreate: number;
  readonly cacheRead: number;
}

export function computeCostUsd(usage: UsageBreakdown, pricing: ModelPricing): number {
  const cost =
    (usage.input * pricing.inputUsdPerMTok +
      usage.output * pricing.outputUsdPerMTok +
      usage.cacheCreate * pricing.cacheCreateUsdPerMTok +
      usage.cacheRead * pricing.cacheReadUsdPerMTok) /
    1_000_000;
  return Number(cost.toFixed(6));
}

export function knownModels(): ReadonlyArray<string> {
  return Object.keys(PRICING);
}
