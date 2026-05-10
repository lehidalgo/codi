/**
 * Filters that pre-screen files before pattern evaluation:
 *
 *  - extension allowlist / skiplist (kills false positives on docs / data)
 *  - line-level comment heuristic (kills false positives in JSDoc / examples)
 */

export const SKIPPED_EXTENSIONS = new Set<string>([
  ".md",
  ".mdx",
  ".json",
  ".yaml",
  ".yml",
  ".lock",
  ".svg",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".pdf",
  ".csv",
  ".txt",
  ".toml",
  ".gitignore",
  ".editorconfig",
]);

export function fileExtension(filePath: string): string {
  const idx = filePath.lastIndexOf(".");
  if (idx < 0) return "";
  return filePath.slice(idx).toLowerCase();
}

export function isSkippedExtension(filePath: string): boolean {
  // Special case: filenames that are pure dotfiles (".gitignore" etc.) —
  // lastIndexOf returns 0, slice gives the whole name (".gitignore"), which
  // is what we want to compare against the skiplist.
  return SKIPPED_EXTENSIONS.has(fileExtension(filePath));
}

export function isAllowedForPattern(
  filePath: string,
  allowedExtensions: string[] | undefined,
): boolean {
  if (!allowedExtensions || allowedExtensions.length === 0) return true;
  const ext = fileExtension(filePath);
  return allowedExtensions.includes(ext);
}

const COMMENT_PREFIXES = ["//", "#", "/*", "*", "<!--"];

export function stripCommentLines(content: string): string {
  return content
    .split("\n")
    .filter((line) => {
      const stripped = line.trimStart();
      for (const prefix of COMMENT_PREFIXES) {
        if (stripped.startsWith(prefix)) return false;
      }
      return true;
    })
    .join("\n");
}
