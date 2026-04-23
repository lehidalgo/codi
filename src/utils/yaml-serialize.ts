/**
 * Serialize a string value safely for YAML frontmatter scalar output.
 *
 * Prefers plain scalar when safe, otherwise single-quoted. Avoids YAML
 * double-quoted form on purpose: Codex CLI (Rust) mishandles backslash-
 * escape sequences inside double-quoted scalars and drops the skill
 * (upstream openai/codex#11495). Single-quoted scalars have zero escape
 * sequences — only `'` is special, doubled as `''` — so every YAML
 * parser across the six supported agents accepts them identically.
 */
export function fmStr(value: string): string {
  const s = value.replace(/\n+/g, " ").trim();
  if (isPlainSafe(s)) return s;
  return `'${s.replace(/'/g, "''")}'`;
}

function isPlainSafe(s: string): boolean {
  if (!s) return false;
  if (/[\n\r:#\[\]{},&*?|>'"\\]/.test(s)) return false;
  if (/^[-?!@`%&*|>'"#\s]/.test(s)) return false;
  if (/\s$/.test(s)) return false;
  if (/^(true|false|null|yes|no|on|off|~)$/i.test(s)) return false;
  if (/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s)) return false;
  return true;
}
