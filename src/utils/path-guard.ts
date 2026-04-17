import path from "node:path";

export function isPathSafe(projectRoot: string, targetPath: string): boolean {
  const resolved = path.resolve(projectRoot, targetPath);
  const relative = path.relative(projectRoot, resolved);
  return !relative.startsWith("..") && !path.isAbsolute(relative);
}

/**
 * Sanitize an artifact name for use as a filesystem path segment.
 *
 * Replaces every character outside `[A-Za-z0-9_-]` with a hyphen, collapses
 * consecutive hyphens, trims leading/trailing hyphens, and lowercases the
 * result. This is the single source of truth for adapter-level path
 * sanitization — every adapter that derives a file or directory name from a
 * user-controlled artifact name must route through this function, otherwise
 * inputs like `"../../etc/passwd"` or `"a/b"` can escape the intended output
 * directory.
 *
 * @example
 * sanitizeNameForPath("My Skill");          // => "my-skill"
 * sanitizeNameForPath("My Complex   Rule"); // => "my-complex-rule"
 * sanitizeNameForPath("../../etc/passwd");  // => "etc-passwd"
 * sanitizeNameForPath("codi-pdf");          // => "codi-pdf"
 */
export function sanitizeNameForPath(name: string): string {
  return name
    .replace(/[^\w-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}
