/**
 * Serialize a string value safely for YAML frontmatter scalar output.
 * Values containing special characters are JSON-stringified; newlines are
 * flattened first so the scalar stays on a single line.
 */
export function fmStr(value: string): string {
  if (/[\n\r:#\[\]{},&*?|>'"]/.test(value) || value.startsWith(" ")) {
    return JSON.stringify(value.replace(/\n+/g, " ").trim());
  }
  return value;
}
