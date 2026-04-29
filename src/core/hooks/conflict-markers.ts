/**
 * Pure scanner for git merge-conflict markers in text content.
 *
 * Detects all four marker variants:
 *   <<<<<<< (ours)        7 chars + space-or-EOL
 *   ||||||| (base/ancestor — only emitted with merge.conflictStyle = diff3)
 *   ======= (separator)
 *   >>>>>>> (theirs)
 *
 * Used by:
 *   - src/core/config/validator.ts (validateNoConflictMarkers)
 *   - hook-templates.ts CONFLICT_MARKER_CHECK_TEMPLATE (logic inlined into the template)
 */

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
  const hits: MarkerHit[] = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? "";
    const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    const match = MARKER_RE.exec(line);
    if (!match) continue;
    const sigil = match[1]!;
    let kind: MarkerKind = "sep";
    if (sigil.startsWith("<")) kind = "ours";
    else if (sigil.startsWith(">")) kind = "theirs";
    else if (sigil.startsWith("|")) kind = "base";
    hits.push({ line: i + 1, kind, text: line });
  }
  return hits;
}

/**
 * Fast yes/no check for callers that don't need line numbers.
 */
export function hasConflictMarkers(text: string): boolean {
  return findConflictMarkers(text).length > 0;
}
