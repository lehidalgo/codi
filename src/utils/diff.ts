import { createTwoFilesPatch, diffLines, type Change } from "diff";
import pc from "picocolors";

/**
 * Builds a unified diff string between two arrays of lines using LCS-based diff.
 * Produces standard unified diff format with @@ hunk headers and 3 lines of context.
 */
export function buildUnifiedDiff(
  label1: string,
  label2: string,
  lines1: string[],
  lines2: string[],
): string {
  const text1 = lines1.join("\n");
  const text2 = lines2.join("\n");
  const patch = createTwoFilesPatch(label1, label2, text1, text2, "", "", {
    context: 3,
  });

  // Strip the "Index:" header line that createTwoFilesPatch adds
  const patchLines = patch.split("\n");
  const startIdx = patchLines.findIndex((l) => l.startsWith("---"));
  if (startIdx < 0) return "No differences found.";

  const result = patchLines.slice(startIdx).join("\n").trimEnd();
  if (!result.includes("@@")) return "No differences found.";
  return result;
}

/**
 * Renders a colored diff between two strings for terminal display.
 * Uses diffLines() from the diff package for accurate LCS-based comparison.
 * Green for additions, red for removals, dim for context lines.
 */
export function renderColoredDiff(
  current: string,
  incoming: string,
  _filename: string,
): string {
  const lines1 = current.split("\n");
  const lines2 = incoming.split("\n");
  const raw = buildUnifiedDiff("current", "incoming", lines1, lines2);

  return raw
    .split("\n")
    .map((line) => {
      if (line.startsWith("---") || line.startsWith("+++")) {
        return pc.bold(line);
      }
      if (line.startsWith("@@")) return pc.cyan(line);
      if (line.startsWith("+")) return pc.green(line);
      if (line.startsWith("-")) return pc.red(line);
      return pc.dim(line);
    })
    .join("\n");
}

/**
 * Produces git-style conflict markers from two content strings.
 * Non-overlapping changes are applied directly; true conflicts (adjacent
 * removed+added) are wrapped in <<<<<<< / ======= / >>>>>>> markers.
 * Returns { content, hasConflicts }.
 */
export function buildConflictMarkers(
  current: string,
  incoming: string,
): { content: string; hasConflicts: boolean } {
  const changes: Change[] = diffLines(current, incoming);
  const out: string[] = [];
  let hasConflicts = false;

  let i = 0;
  while (i < changes.length) {
    const c = changes[i]!;
    if (!c.added && !c.removed) {
      out.push(c.value);
      i++;
    } else if (c.removed && changes[i + 1]?.added) {
      // True conflict: same region changed on both sides
      hasConflicts = true;
      out.push(
        `<<<<<<< current\n${c.value}=======\n${changes[i + 1]!.value}>>>>>>> incoming\n`,
      );
      i += 2;
    } else if (c.removed) {
      // Removed in current, not replaced — keep current side (skip removal)
      // This shouldn't happen in a two-way diff but handle defensively
      out.push(`<<<<<<< current\n${c.value}=======\n>>>>>>> incoming\n`);
      hasConflicts = true;
      i++;
    } else {
      // c.added only — addition in incoming, not in current: take it
      out.push(c.value);
      i++;
    }
  }

  return { content: out.join(""), hasConflicts };
}

export interface ConflictHunk {
  type: "unchanged" | "added" | "conflict";
  /** Content for unchanged/added hunks. */
  value: string;
  /** Current (local) side for conflict hunks. */
  currentValue?: string;
  /** Incoming side for conflict hunks. */
  incomingValue?: string;
}

/**
 * Walks diffLines() output and returns structured hunks.
 * Unchanged/added-only hunks are auto-applied; adjacent removed+added pairs
 * become conflict hunks requiring manual resolution.
 */
export function extractConflictHunks(
  current: string,
  incoming: string,
): ConflictHunk[] {
  const changes: Change[] = diffLines(current, incoming);
  const hunks: ConflictHunk[] = [];
  let i = 0;
  while (i < changes.length) {
    const c = changes[i]!;
    if (!c.added && !c.removed) {
      hunks.push({ type: "unchanged", value: c.value });
      i++;
    } else if (c.removed && changes[i + 1]?.added) {
      hunks.push({
        type: "conflict",
        value: "",
        currentValue: c.value,
        incomingValue: changes[i + 1]!.value,
      });
      i += 2;
    } else if (c.removed) {
      hunks.push({
        type: "conflict",
        value: "",
        currentValue: c.value,
        incomingValue: "",
      });
      i++;
    } else {
      // added-only: non-overlapping incoming addition, auto-apply
      hunks.push({ type: "added", value: c.value });
      i++;
    }
  }
  return hunks;
}

/**
 * Counts additions and removals between two strings using diffLines().
 */
export function countChanges(
  current: string,
  incoming: string,
): { additions: number; removals: number } {
  const changes = diffLines(current, incoming);
  let additions = 0;
  let removals = 0;

  for (const change of changes) {
    const lineCount = change.count ?? 0;
    if (change.added) additions += lineCount;
    else if (change.removed) removals += lineCount;
  }

  return { additions, removals };
}
