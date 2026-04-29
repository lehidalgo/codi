/**
 * Single source of truth for directories codi excludes from per-language hooks
 * and from the file-size check template.
 *
 * Adding a directory here automatically extends:
 *   - the YAML `exclude:` regex emitted by yaml-renderer
 *   - the `EXCLUDED` array inside the FILE_SIZE_CHECK_TEMPLATE script
 *
 * Used by:
 *   - src/core/hooks/renderers/yaml-renderer.ts (TOP_LEVEL_DEFAULTS)
 *   - src/core/hooks/hook-installer.ts (FILE_SIZE_CHECK_TEMPLATE substitution)
 */
export const VENDORED_DIRS = [
  "node_modules",
  ".venv",
  "venv",
  "dist",
  "build",
  "coverage",
  ".next",
  ".codi",
  ".agents",
  ".claude",
  ".codex",
  ".cursor",
  ".windsurf",
  ".cline",
] as const;

export type VendoredDir = (typeof VENDORED_DIRS)[number];

/**
 * Build the anchored regex string used as the YAML `exclude:` value.
 * Matches any path beginning with one of the vendored directory names.
 *
 * Example output:
 *   "^(node_modules|\\.venv|...|\\.cline)/"
 */
export function buildVendoredDirsRegex(): string {
  const escaped = VENDORED_DIRS.map((d) => d.replace(/\./g, "\\."));
  return `^(${escaped.join("|")})/`;
}

/**
 * Build the comma-separated literal for substitution into hook templates.
 * After the substitution, the rendered script contains a list of regex
 * literals that match the directory prefixes:
 *   /^node_modules\//, /^\.venv\//, ..., /^\.cline\//
 *
 * Each VENDORED_DIRS entry produces one regex literal. Dots in directory
 * names are escaped (\.codi instead of .codi) so the regex matches the
 * literal directory and not arbitrary single characters.
 */
export function buildVendoredDirsTemplatePatterns(): string {
  return VENDORED_DIRS.map((d) => `/^${d.replace(/\./g, "\\.")}\\//`).join(", ");
}
