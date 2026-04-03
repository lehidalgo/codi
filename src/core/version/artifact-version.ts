export type ArtifactVersion = number;
export type InstalledArtifactVersion = ArtifactVersion | "unknown";

export function injectFrontmatterVersion(content: string, version: ArtifactVersion): string {
  if (!content.trimStart().startsWith("---")) {
    return content;
  }

  if (/^version:\s*\d+\s*$/m.test(content)) {
    return content.replace(/^version:\s*\d+\s*$/m, `version: ${version}`);
  }

  return content.replace(/^---\n([\s\S]*?)\n---/, (_match, frontmatter: string) => {
    return `---\n${frontmatter}\nversion: ${version}\n---`;
  });
}

export function createVersionMap(
  names: string[],
  overrides: Partial<Record<string, ArtifactVersion>> = {},
): Record<string, ArtifactVersion> {
  return Object.fromEntries(names.map((name) => [name, overrides[name] ?? 1]));
}
