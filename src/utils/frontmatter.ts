import { parse as parseYaml } from "yaml";

/**
 * Parse a YAML front-matter block (the `---`-fenced YAML object at the
 * top of a Markdown file) and return the parsed data plus the remaining
 * Markdown body.
 *
 * Codi's entire frontmatter corpus is YAML between standard `---` fences,
 * so this parser is the deliberate single-dep replacement for `gray-matter`
 * (~280 kB install + transitive `js-yaml@3.x`). It delegates YAML decoding
 * to the modern `yaml` package which is already a Codi dependency.
 *
 * @template T - Expected shape of the frontmatter data object.
 * @param raw - Raw Markdown content that may contain a `---` frontmatter block.
 * @returns An object with `data` (parsed frontmatter cast to `T`) and
 *   `content` (the body text with the frontmatter block removed and trimmed).
 */
export function parseFrontmatter<T>(raw: string): { data: T; content: string } {
  // BOM tolerance — gray-matter strips it, we mirror that.
  const stripped = raw.replace(/^﻿/, "");

  // The frontmatter block must open at character 0 with `---` followed by a
  // newline. Anything else is treated as "no frontmatter", matching
  // gray-matter's contract.
  const FENCE = /^---\r?\n([\s\S]*?)(?:\r?\n)?---(\r?\n|$)/;
  const m = FENCE.exec(stripped);
  if (!m) {
    return {
      data: {} as T,
      content: stripped.trim(),
    };
  }

  const yamlBlock = m[1] ?? "";
  const body = stripped.slice(m[0].length);

  let parsed: unknown;
  try {
    parsed = parseYaml(yamlBlock);
  } catch (cause) {
    throw new SyntaxError(`Invalid YAML frontmatter: ${(cause as Error).message}`, {
      cause: cause as Error,
    });
  }

  // YAML `~` and empty body parse to `null` / `undefined`; gray-matter
  // normalises both to `{}` for downstream `.data` access. Match that.
  const data: T =
    parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as T) : ({} as T);

  return {
    data,
    content: body.trim(),
  };
}
