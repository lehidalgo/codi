import matter from 'gray-matter';

export function parseFrontmatter<T>(raw: string): { data: T; content: string } {
  const parsed = matter(raw);
  return {
    data: parsed.data as T,
    content: parsed.content.trim(),
  };
}
