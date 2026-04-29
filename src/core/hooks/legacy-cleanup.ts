import { PROJECT_NAME_DISPLAY } from "#src/constants.js";

/**
 * Strip the legacy text-marker block written by versions of Codi that
 * predate the YAML AST round-trip renderer. Two forms exist in the wild:
 *
 *   1. Indented BEGIN/END marker block emitted by recent Codi versions:
 *
 *        # ${PROJECT_NAME_DISPLAY} hooks: BEGIN (auto-generated — do not edit between markers)
 *        - repo: local
 *          hooks:
 *            - id: codi-...
 *        # ${PROJECT_NAME_DISPLAY} hooks: END
 *
 *   2. Older column-zero broken form (the original C1 bug output) which
 *      placed `- repo: local` at column 0, producing invalid YAML:
 *
 *        # ${PROJECT_NAME_DISPLAY} hooks
 *        - repo: local
 *          hooks:
 *            - id: codi-...
 *
 * Returns the cleaned content. Idempotent: passing input that has neither
 * marker form returns it unchanged (modulo trailing newline normalisation).
 */
const LEGACY_BEGIN_TRIM = `# ${PROJECT_NAME_DISPLAY} hooks: BEGIN (auto-generated — do not edit between markers)`;
const LEGACY_END_TRIM = `# ${PROJECT_NAME_DISPLAY} hooks: END`;
const LEGACY_COLUMN_ZERO_HEADER = `# ${PROJECT_NAME_DISPLAY} hooks`;

export function stripLegacyTextMarkers(content: string): string {
  const lines = content.split("\n");
  const out: string[] = [];
  let skipping = false;
  let legacySkipping = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();

    if (!skipping && trimmed === LEGACY_BEGIN_TRIM) {
      skipping = true;
      continue;
    }
    if (skipping) {
      if (trimmed === LEGACY_END_TRIM) skipping = false;
      continue;
    }

    // Legacy column-zero header followed by a `- repo: local` at col 0.
    if (
      !legacySkipping &&
      trimmed === LEGACY_COLUMN_ZERO_HEADER &&
      lines[i + 1]?.startsWith("- repo: local")
    ) {
      legacySkipping = true;
      continue;
    }
    if (legacySkipping) {
      if (line.startsWith("- ") || line.startsWith("  ") || line === "") continue;
      legacySkipping = false;
      out.push(line);
      continue;
    }

    out.push(line);
  }

  return out
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\n+$/, "\n");
}
