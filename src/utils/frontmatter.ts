import matter from "gray-matter";

/**
 * Parse YAML front matter from a Markdown string using `gray-matter`.
 *
 * @template T - Expected shape of the front matter data object.
 * @param raw - Raw Markdown content that may contain a `---` front matter block.
 * @returns An object with `data` (parsed front matter cast to `T`) and
 *   `content` (the body text with the front matter block removed and trimmed).
 */
export function parseFrontmatter<T>(raw: string): { data: T; content: string } {
  const parsed = matter(raw);
  return {
    data: parsed.data as T,
    content: parsed.content.trim(),
  };
}
