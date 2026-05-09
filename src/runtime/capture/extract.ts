/**
 * Lightweight extractors that mine structure out of free-form marker
 * content. Used at persist-time so the agent can keep emitting plain prose
 * while the brain row still gets useful metadata (file_paths today, more
 * later).
 *
 * The extractors are deliberately conservative — false positives are worse
 * than false negatives because every extra entry inflates the JSON column.
 */

const KNOWN_EXTS = new Set([
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "json",
  "md",
  "mdx",
  "yaml",
  "yml",
  "toml",
  "sh",
  "py",
  "rb",
  "go",
  "rs",
  "java",
  "kt",
  "swift",
  "cs",
  "html",
  "css",
  "scss",
  "sql",
  "txt",
  "csv",
  "tsv",
  "xml",
  "lock",
  "ini",
  "env",
]);

// Path-like token: alphanumerics + a few path symbols, then `.ext`,
// optionally followed by `:line` or `:line:col`.
const PATH_RE = /\b([A-Za-z0-9_./@~-]+\.[A-Za-z][A-Za-z0-9]*)(?::(\d+))?(?::\d+)?\b/g;

// Tokens that match PATH_RE but are not files (semver, IPs, hostnames).
const VERSION_RE = /^\d+(?:\.\d+){1,3}$/;
const IP_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;

/**
 * Extract file paths mentioned in a free-form text. Returns deduplicated
 * absolute or relative paths, optionally suffixed with `:line` to keep the
 * caller's locator intact.
 *
 * Heuristics that count as a "file":
 *  - has at least one `/` (relative or absolute path), OR
 *  - the extension is in {@link KNOWN_EXTS} (single-segment names like
 *    `package.json`, `tsconfig.json`).
 *
 * Heuristics that exclude:
 *  - semver / version strings (`3.0.0`, `1.2.3.4`)
 *  - IPv4 addresses (`127.0.0.1`)
 */
export function extractFilePaths(text: string): string[] {
  if (!text) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const match of text.matchAll(PATH_RE)) {
    const candidate = match[1];
    const lineSuffix = match[2];
    if (!candidate) continue;
    if (VERSION_RE.test(candidate)) continue;
    if (IP_RE.test(candidate)) continue;
    const dotIdx = candidate.lastIndexOf(".");
    if (dotIdx < 0) continue;
    const ext = candidate.slice(dotIdx + 1).toLowerCase();
    const hasSlash = candidate.includes("/");
    if (!hasSlash && !KNOWN_EXTS.has(ext)) continue;
    const located = lineSuffix ? `${candidate}:${lineSuffix}` : candidate;
    if (seen.has(located)) continue;
    seen.add(located);
    out.push(located);
  }
  return out;
}
