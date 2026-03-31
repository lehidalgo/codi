import { createTwoFilesPatch, diffLines } from "diff";
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
