import type { RedactionPattern } from "./redactor-patterns.js";

export interface RedactionResult {
  redacted: string;
  counts: Record<string, number>;
}

/**
 * Redacts known-sensitive substrings from a transcript. Returns the redacted
 * text + per-pattern hit counts.
 *
 * PRIVACY INVARIANT: the `counts` object never contains matched content —
 * only pattern names (safe for audit logs). Verify via the test
 * "PRIVACY: counts object never contains matched secret content".
 */
export function redactTranscript(
  raw: string,
  patterns: RedactionPattern[],
  homeDir: string,
): RedactionResult {
  let text = raw;
  const counts: Record<string, number> = {};

  if (homeDir) {
    const escaped = homeDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const homeRegex = new RegExp(escaped + "[^\\s\"']*", "g");
    const matches = text.match(homeRegex);
    if (matches) {
      counts.home_path = matches.length;
      text = text.replace(homeRegex, "[REDACTED:home_path]");
    }
  }

  for (const p of patterns) {
    const flags = p.regex.flags.includes("g") ? p.regex.flags : p.regex.flags + "g";
    const re = new RegExp(p.regex.source, flags);
    const matches = text.match(re);
    if (matches) {
      counts[p.name] = (counts[p.name] ?? 0) + matches.length;
      text = text.replace(re, p.replacement);
    }
  }

  return { redacted: text, counts };
}
