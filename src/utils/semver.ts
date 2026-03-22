interface SemverParts {
  major: number;
  minor: number;
  patch: number;
}

function parseSemver(version: string): SemverParts | null {
  const cleaned = version.replace(/^v/, '');
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

export function satisfiesVersion(current: string, required: string): boolean {
  const trimmed = required.trim();

  if (trimmed.startsWith('>=')) {
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
