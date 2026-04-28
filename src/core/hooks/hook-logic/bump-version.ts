import type { BumpDecision } from "./types.js";
import type { PreviousVersionResult } from "./get-previous-version.js";

function parseStagedVersion(content: string): number | null {
  const match = content.match(/^version:\s*(\d+)\s*$/m);
  return match ? Number(match[1]) : null;
}

function hasFrontmatter(content: string): boolean {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith("---")) return false;
  // Need a closing --- somewhere after the opening one
  const afterOpen = trimmed.slice(3);
  return /^---\s*$/m.test(afterOpen);
}

function injectVersion(content: string, version: number): string {
  if (/^version:\s*\d+\s*$/m.test(content)) {
    return content.replace(/^version:\s*\d+\s*$/m, `version: ${version}`);
  }
  return content.replace(/^---$/m, `---\nversion: ${version}`);
}

function contentEqualsIgnoringVersion(a: string, b: string): boolean {
  const strip = (s: string) => s.replace(/^version:\s*\d+\s*$/m, "version: 0");
  return strip(a) === strip(b);
}

export function bumpVersion(
  stagedContent: string,
  previous: PreviousVersionResult,
  headContent?: string,
): BumpDecision {
  if (!hasFrontmatter(stagedContent)) {
    return {
      action: "rejected",
      fromVersion: null,
      toVersion: null,
      rejectReason: "missing or malformed frontmatter",
    };
  }

  const stagedVersion = parseStagedVersion(stagedContent);

  if (previous.kind === "new-file" || previous.kind === "no-head") {
    if (stagedVersion === null) {
      return {
        action: "bumped",
        fromVersion: null,
        toVersion: 1,
        rewrittenContent: injectVersion(stagedContent, 1),
      };
    }
    return {
      action: "no-op",
      fromVersion: null,
      toVersion: stagedVersion,
    };
  }

  const headVersion = previous.version;

  if (stagedVersion !== null && stagedVersion < headVersion) {
    return {
      action: "rejected",
      fromVersion: headVersion,
      toVersion: stagedVersion,
      rejectReason: `version regression: ${headVersion} -> ${stagedVersion}`,
    };
  }

  if (stagedVersion !== null && stagedVersion > headVersion) {
    return {
      action: "no-op",
      fromVersion: headVersion,
      toVersion: stagedVersion,
    };
  }

  if (headContent !== undefined && contentEqualsIgnoringVersion(stagedContent, headContent)) {
    return { action: "no-op", fromVersion: headVersion, toVersion: stagedVersion };
  }

  const newVersion = headVersion + 1;
  return {
    action: "bumped",
    fromVersion: headVersion,
    toVersion: newVersion,
    rewrittenContent: injectVersion(stagedContent, newVersion),
  };
}
