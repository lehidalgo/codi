/**
 * Pure scanner for git merge-conflict markers in text content.
 *
 * Detects all four marker variants:
 *   <<<<<<< (ours)        7 chars + space-or-EOL
 *   ||||||| (base/ancestor — only emitted with merge.conflictStyle = diff3)
 *   ======= (separator)
 *   >>>>>>> (theirs)
 *
 * Markers inside literal blocks (fenced code blocks or `<example>` tag
 * regions) are ignored — they are documentation showing what unresolved
 * conflicts look like, not actual unresolved conflicts. The literal-block
 * detection is delegated to `src/core/scanner/literal-blocks.ts` so every
 * safety scanner shares the same convention.
 *
 * Used by:
 *   - src/core/config/validator.ts (validateNoConflictMarkers)
 *   - hook-templates.ts CONFLICT_MARKER_CHECK_TEMPLATE (logic inlined into
 *     the generated pre-commit hook script — kept in sync via the parity
 *     test in tests/integration)
 */

import { findLiteralBlocks, lineIsLiteral } from "../scanner/literal-blocks.js";

const MARKER_RE = /^(<{7}|={7}|>{7}|\|{7})( |$)/;

export type MarkerKind = "ours" | "base" | "theirs" | "sep";

export interface MarkerHit {
  /** 1-based line number where the marker appears. */
  line: number;
  kind: MarkerKind;
  /** Raw line text (CRLF stripped). */
  text: string;
}

/**
 * Scan text for git merge-conflict markers. Returns one hit per marker line.
 * An empty array means the text is clean.
 */
export function findConflictMarkers(text: string): MarkerHit[] {
  const lines = text.split("\n");
  const literalBlocks = findLiteralBlocks(text);
  const hits: MarkerHit[] = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? "";
    const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    const lineNo = i + 1;
    if (lineIsLiteral(lineNo, literalBlocks)) continue;
    const match = MARKER_RE.exec(line);
    if (!match) continue;
    const sigil = match[1]!;
    let kind: MarkerKind = "sep";
    if (sigil.startsWith("<")) kind = "ours";
    else if (sigil.startsWith(">")) kind = "theirs";
    else if (sigil.startsWith("|")) kind = "base";
    hits.push({ line: lineNo, kind, text: line });
  }
  return hits;
}

/**
 * Fast yes/no check for callers that don't need line numbers.
 * Early-returns on the first marker hit — does not allocate the hits array.
 *
 * Public API: companion to `findConflictMarkers` for callers that need
 * O(1) memory (e.g., a future fast-path inside the conflict-marker hook
 * template, or a config-validator short-circuit).
 */
export function hasConflictMarkers(text: string): boolean {
  const lines = text.split("\n");
  const literalBlocks = findLiteralBlocks(text);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? "";
    const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    const lineNo = i + 1;
    if (lineIsLiteral(lineNo, literalBlocks)) continue;
    if (MARKER_RE.test(line)) return true;
  }
  return false;
}
