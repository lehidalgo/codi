import fs from "node:fs/promises";
import path from "node:path";
import { DOC_PROJECT_DIR, DOC_STAMP_FILENAME } from "#src/constants.js";
import { execFileAsync } from "#src/utils/exec.js";

export interface DocStamp {
  commit: string;
  verified_at: string;
  verified_by: "human" | "agent";
}

export type StalenessReason = "no_stamp" | "invalid_hash" | "unverified_commits";

export interface StalenessCheck {
  stale: boolean;
  reason?: StalenessReason;
  commitCount?: number;
  stampCommit?: string;
}

function stampPath(projectRoot: string): string {
  return path.join(projectRoot, DOC_PROJECT_DIR, DOC_STAMP_FILENAME);
}

export async function readStamp(projectRoot: string): Promise<DocStamp | null> {
  try {
    const content = await fs.readFile(stampPath(projectRoot), "utf-8");
    return JSON.parse(content) as DocStamp;
  } catch {
    return null;
  }
}

export async function writeStamp(
  projectRoot: string,
  verifiedBy: "human" | "agent" = "human",
): Promise<DocStamp> {
  const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], {
    cwd: projectRoot,
  });
  const commit = stdout.trim();

  const stamp: DocStamp = {
    commit,
    verified_at: new Date().toISOString(),
    verified_by: verifiedBy,
  };

  const dir = path.join(projectRoot, DOC_PROJECT_DIR);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(stampPath(projectRoot), JSON.stringify(stamp, null, 2) + "\n", "utf-8");

  return stamp;
}

export async function checkStaleness(projectRoot: string): Promise<StalenessCheck> {
  const stamp = await readStamp(projectRoot);

  if (!stamp) {
    return { stale: true, reason: "no_stamp" };
  }

  // Verify the stamp hash exists in git history
  try {
    await execFileAsync("git", ["rev-parse", "--verify", `${stamp.commit}^{commit}`], {
      cwd: projectRoot,
    });
  } catch {
    return { stale: true, reason: "invalid_hash", stampCommit: stamp.commit };
  }

  // Count commits after the stamp (allow at most 1 — the stamp commit itself)
  const { stdout: countOut } = await execFileAsync(
    "git",
    ["rev-list", `${stamp.commit}..HEAD`, "--count"],
    { cwd: projectRoot },
  );
  const count = parseInt(countOut.trim(), 10);

  if (count > 1) {
    return {
      stale: true,
      reason: "unverified_commits",
      commitCount: count,
      stampCommit: stamp.commit,
    };
  }

  return { stale: false, commitCount: count, stampCommit: stamp.commit };
}

/** Create docs/project/ with a starter README if neither exists. */
export async function ensureDocProjectDir(projectRoot: string): Promise<void> {
  const dir = path.join(projectRoot, DOC_PROJECT_DIR);
  await fs.mkdir(dir, { recursive: true });

  const readmePath = path.join(dir, "README.md");
  try {
    await fs.access(readmePath);
  } catch {
    const projectName = path.basename(projectRoot);
    await fs.writeFile(
      readmePath,
      [
        `# ${projectName} — Project Documentation`,
        "",
        "This directory contains the official project documentation.",
        "",
        "Files here are tracked by the Codi documentation checkpoint.",
        "Run `codi docs-stamp` after verifying docs are aligned with the code.",
        "",
      ].join("\n"),
      "utf-8",
    );
  }
}
