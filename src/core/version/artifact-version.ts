export type ArtifactVersion = number;
export type InstalledArtifactVersion = ArtifactVersion | "unknown";

/**
 * Extracts the artifact version from a template's YAML frontmatter.
 * Returns 1 if no version field is found (backward-compatible default).
 */
export function parseVersionFromFrontmatter(content: string): ArtifactVersion {
  const match = content.match(/^version:\s*(\d+)\s*$/m);
  return match ? Number(match[1]) : 1;
}

/**
 * Injects or replaces the version field in a YAML frontmatter block.
 * Used for DEFAULT_CONTENT in scaffolders (user-created artifacts without a template).
 */
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
