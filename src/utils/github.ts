const GITHUB_URL_RE =
  /^https?:\/\/github\.com\/([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+?)(?:\.git|\/.*)?$/;
const OWNER_REPO_RE = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;

/**
 * Normalizes a GitHub repository reference to `owner/repo` format.
 *
 * Accepts:
 *   - "owner/repo"
 *   - "https://github.com/owner/repo"
 *   - "https://github.com/owner/repo.git"
 *   - "https://github.com/owner/repo/tree/branch/..."
 *
 * Returns the normalized slug, or `null` if the input is not a valid reference.
 */
export function normalizeGithubRepo(input: string): string | null {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(GITHUB_URL_RE);
  if (urlMatch?.[1]) return urlMatch[1];
  if (OWNER_REPO_RE.test(trimmed)) return trimmed;
  return null;
}
