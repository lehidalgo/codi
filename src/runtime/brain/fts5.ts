/**
 * ISSUE-060 — safe FTS5 query construction.
 *
 * SQLite FTS5's MATCH expression has its own mini-grammar with reserved
 * tokens: AND / OR / NOT / NEAR, parentheses, `*` for prefix, `-` for
 * exclusion, `^` for column filters, and `"..."` for literal phrases.
 * Passing raw user input directly into MATCH causes two failure modes:
 *
 *   1. Syntax error — the user types `name (test)` and FTS5 rejects the
 *      whole query because `(` opens a group that never closes.
 *   2. Unexpected matches — the user types `NOT pizza` and FTS5 treats
 *      `NOT` as the boolean operator instead of a literal token.
 *
 * `quoteFtsPhrase` wraps the input in double quotes so the parser treats
 * the entire string as a literal phrase. Embedded double quotes are
 * escaped by doubling them per the FTS5 spec.
 *
 * https://www.sqlite.org/fts5.html#full_text_query_syntax
 */
export function quoteFtsPhrase(input: string): string {
  const escaped = input.replace(/"/g, '""');
  return `"${escaped}"`;
}
