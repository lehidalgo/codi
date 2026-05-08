/**
 * Capture markers parser (Iron Law 9 / Sprint 3).
 *
 * Agents emit one or more markers at the end of each turn. Format:
 *
 *     |TYPE: "verbatim content"|
 *
 * - TYPE   one of the 10 canonical capture types (see CAPTURE_TYPES below)
 * - content   short, single-line, double-quoted; embedded quotes are escaped \"
 *
 * Multiple markers per turn are allowed and processed in order. Anything that
 * looks like a marker but does not match the strict regex is ignored — the
 * parser is intentionally conservative so that prose containing pipe
 * characters does not produce false positives.
 *
 * The parser is pure (no I/O). Persistence lives in `persist.ts`.
 */

export const CAPTURE_TYPES = [
  "RULE",
  "PROHIBITION",
  "PREFERENCE",
  "FEEDBACK",
  "INSIGHT",
  "OBSERVATION",
  "DECISION",
  "QUESTION",
  "PROMPT",
  "CORRECTION",
] as const;

export type CaptureType = (typeof CAPTURE_TYPES)[number];

export interface ParsedMarker {
  readonly type: CaptureType;
  readonly content: string;
  readonly rawMarker: string;
  /** Byte offset within the source text where the marker started. */
  readonly offset: number;
}

const TYPE_ALTERNATION = CAPTURE_TYPES.join("|");

// Strict pattern:
//   - opening pipe
//   - one of the canonical types (capture group 1)
//   - colon + at least one space
//   - opening double quote
//   - content (capture group 2): any chars except an UNESCAPED double quote
//   - closing double quote
//   - closing pipe
const MARKER_RE = new RegExp(String.raw`\|(${TYPE_ALTERNATION}):\s+"((?:\\"|[^"])*)"\|`, "g");

/**
 * Parse all valid markers from `text`. Order is preserved. Invalid candidates
 * are silently dropped.
 */
export function parseMarkers(text: string): ParsedMarker[] {
  const found: ParsedMarker[] = [];
  for (const match of text.matchAll(MARKER_RE)) {
    const type = match[1] as CaptureType;
    const rawContent = match[2] ?? "";
    const content = unescape(rawContent);
    found.push({
      type,
      content,
      rawMarker: match[0],
      offset: match.index ?? 0,
    });
  }
  return found;
}

function unescape(raw: string): string {
  return raw.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

export function isValidCaptureType(t: string): t is CaptureType {
  return (CAPTURE_TYPES as readonly string[]).includes(t);
}
