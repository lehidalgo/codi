import { execFileSync } from "node:child_process";
import type { VerifyOffender } from "./types.js";
import { detectMode } from "./detect-mode.js";

function gitShow(ref: string, path: string): string | null {
  try {
    return execFileSync("git", ["show", `${ref}:${path}`], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    return null;
  }
}

function parseVersion(content: string): number {
  const match = content.match(/^version:\s*(\d+)\s*$/m);
  return match ? Number(match[1]) : 1;
}

function contentChanged(a: string, b: string): boolean {
  const strip = (s: string) => s.replace(/^version:\s*\d+\s*$/m, "version: 0");
  return strip(a) !== strip(b);
}

export function verifyRange(baseOid: string, headOid: string): VerifyOffender[] {
  const diffOut = execFileSync(
    "git",
    ["diff", "--name-only", "--diff-filter=ACMR", `${baseOid}..${headOid}`],
    { encoding: "utf-8" },
  );
  const files = diffOut.trim().split("\n").filter(Boolean);

  const offenders: VerifyOffender[] = [];
  for (const path of files) {
    const baseContent = gitShow(baseOid, path);
    const headContent = gitShow(headOid, path);
    if (!baseContent || !headContent) continue;

    const inspection = detectMode(path, headContent);
    if (inspection.mode === "skip") continue;

    const baseVersion = parseVersion(baseContent);
    const headVersion = parseVersion(headContent);

    if (!contentChanged(baseContent, headContent)) continue;

    if (headVersion < baseVersion) {
      offenders.push({
        path,
        headVersion: baseVersion,
        pushVersion: headVersion,
        reason: "version-regression",
      });
      continue;
    }

    if (headVersion === baseVersion) {
      offenders.push({
        path,
        headVersion: baseVersion,
        pushVersion: headVersion,
        reason: "content-changed-without-bump",
      });
    }
  }
  return offenders;
}
