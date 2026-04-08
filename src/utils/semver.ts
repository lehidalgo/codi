interface SemverParts {
  major: number;
  minor: number;
  patch: number;
}

function parseSemver(version: string): SemverParts | null {
  const cleaned = version.replace(/^v/, "");
  const match = cleaned.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function compareVersions(a: SemverParts, b: SemverParts): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

/**
 * Check whether `current` satisfies the `required` version constraint.
 *
 * Supports two constraint forms:
 * - `">=X.Y.Z"` — `current` must be greater than or equal to `X.Y.Z`.
 * - `"X.Y.Z"` — `current` must be exactly `X.Y.Z`.
 *
 * Version strings may optionally be prefixed with `v` (e.g. `"v1.2.3"`).
 *
 * @param current - The installed version string (e.g. `"2.3.0"`).
 * @param required - The required version constraint (e.g. `">=2.0.0"`).
 * @returns `true` if `current` satisfies `required`, `false` if not or if
 *   either string cannot be parsed as a semver triple.
 */
export function satisfiesVersion(current: string, required: string): boolean {
  const trimmed = required.trim();

  if (trimmed.startsWith(">=")) {
    const reqParts = parseSemver(trimmed.slice(2).trim());
    const curParts = parseSemver(current);
    if (!reqParts || !curParts) return false;
    return compareVersions(curParts, reqParts) >= 0;
  }

  const reqParts = parseSemver(trimmed);
  const curParts = parseSemver(current);
  if (!reqParts || !curParts) return false;
  return compareVersions(curParts, reqParts) === 0;
}
