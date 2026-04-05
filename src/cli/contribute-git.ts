import fs from "node:fs/promises";
import { execFileAsync } from "../utils/exec.js";
import type { Logger } from "../core/output/logger.js";

export async function getGitRepoUrl(repo: string): Promise<string> {
  try {
    const { stdout, stderr } = await execFileAsync("gh", ["auth", "status"]);
    const output = stdout + stderr;
    if (output.includes("Git operations protocol: ssh")) {
      return `git@github.com:${repo}.git`;
    }
  } catch {
    // Fall through to HTTPS
  }
  return `https://github.com/${repo}.git`;
}

export async function detectDefaultBranch(repo: string): Promise<string> {
  // 1. Try GitHub CLI (works for repos the user has gh access to)
  try {
    const { stdout } = await execFileAsync("gh", [
      "repo",
      "view",
      repo,
      "--json",
      "defaultBranchRef",
      "--jq",
      ".defaultBranchRef.name",
    ]);
    const branch = stdout.trim();
    if (branch) return branch;
  } catch {
    // Fall through to git ls-remote
  }

  // 2. Try git ls-remote via the user's configured protocol
  const repoUrl = await getGitRepoUrl(repo);
  try {
    const { stdout } = await execFileAsync("git", ["ls-remote", "--symref", repoUrl, "HEAD"]);
    // Output format: ref: refs/heads/<branch>\tHEAD
    const match = stdout.match(/^ref: refs\/heads\/([^\t\n]+)\s+HEAD/m);
    if (match?.[1]) return match[1];
  } catch {
    // Fall through to default
  }

  return "main";
}

/**
 * Detects the actual default branch from an already-cloned repo.
 * Reads the symbolic ref that HEAD points to.
 */
export async function detectClonedBranch(cloneDir: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", ["symbolic-ref", "--short", "HEAD"], {
      cwd: cloneDir,
    });
    return stdout.trim() || "main";
  } catch {
    return "main";
  }
}

export type RepoAccessResult =
  | { ok: true; empty: boolean }
  | { ok: false; message: string; hints: string[] };

/**
 * Checks whether the current git/gh credentials can access a GitHub repo.
 * Also detects empty repos (no commits/branches) so callers can handle them.
 */
export async function checkRepoAccess(repo: string): Promise<RepoAccessResult> {
  // Try gh CLI first — it gives the clearest error messages
  let ghAccessible = false;
  try {
    await execFileAsync("gh", ["repo", "view", repo, "--json", "name"]);
    ghAccessible = true;
  } catch {
    // gh failed — could be auth, could be private repo
  }

  // Check if the repo has any refs (detects empty repos)
  const repoUrl = await getGitRepoUrl(repo);
  try {
    const { stdout } = await execFileAsync("git", ["ls-remote", repoUrl], {
      timeout: 15_000,
    });
    // ls-remote succeeds but returns empty output = repo exists but has no refs
    const isEmpty = stdout.trim() === "";
    return { ok: true, empty: isEmpty };
  } catch {
    // ls-remote failed — if gh succeeded, the repo exists but we can't ls-remote
    if (ghAccessible) return { ok: true, empty: false };
  }

  return {
    ok: false,
    message: `Cannot access repository '${repo}'.`,
    hints: [
      `1. Verify you have access: gh repo view ${repo}`,
      `2. For private repos, ensure your GitHub token has the 'repo' scope:`,
      `     gh auth refresh -s repo`,
      `3. If using SSH, verify your key: ssh -T git@github.com`,
      `4. Ask the repo owner to add you as a collaborator`,
      `5. Check the repository name is correct (case-sensitive)`,
    ],
  };
}

export function logCloneAccessError(log: Logger, msg: string, repo: string): void {
  log.error(`Clone failed: ${msg}`);
  const isAccessError =
    msg.includes("Permission") ||
    msg.includes("403") ||
    msg.includes("Authentication") ||
    msg.includes("repository not found") ||
    msg.includes("Could not read from remote") ||
    msg.includes("not found");
  if (isAccessError) {
    log.error(`This may be a private repository access issue.`);
    log.info(`  Troubleshooting:`);
    log.info(`  1. Ensure your GitHub token has 'repo' scope: gh auth refresh -s repo`);
    log.info(`  2. Verify access: gh repo view ${repo}`);
    log.info(`  3. If using SSH, verify your key: ssh -T git@github.com`);
    log.info(`  4. Ask the repo owner to add you as a collaborator`);
  }
}

export function logPushAccessError(
  log: Logger,
  msg: string,
  ghUser: string,
  repoName: string,
): void {
  const isAccessError =
    msg.includes("Permission") ||
    msg.includes("403") ||
    msg.includes("denied") ||
    msg.includes("not found") ||
    msg.includes("Could not read from remote");
  if (isAccessError) {
    log.error(`Git push failed — could not push to your fork ${ghUser}/${repoName}.`);
    log.info(`  Troubleshooting:`);
    log.info(`  1. Check your git credentials: gh auth status`);
    log.info(`  2. If using SSH, verify your key: ssh -T git@github.com`);
    log.info(`  3. Ensure the fork exists: gh repo view ${ghUser}/${repoName}`);
    log.info(`  4. For private repos, your token must include 'repo' scope:`);
    log.info(`       gh auth refresh -s repo`);
  }
}

export type EmptyRepoPushOptions = {
  artifacts: { type: string; name: string }[];
  targetRepo: string;
  targetBranch: string;
  presetName: string;
  repoUrl: string;
  cloneDir: string;
  buildPackage: (cloneDir: string) => Promise<void>;
  log: Logger;
};

/**
 * Handles the empty-repo edge case: initializes the repo with the preset
 * and pushes directly to the target branch (no fork/PR needed).
 */
export async function pushToEmptyRepo({
  artifacts,
  targetRepo,
  targetBranch,
  repoUrl,
  cloneDir,
  buildPackage,
  log,
}: EmptyRepoPushOptions): Promise<string> {
  log.info(`Repository ${targetRepo} is empty — pushing initial commit directly.`);

  await fs.mkdir(cloneDir, { recursive: true });
  await execFileAsync("git", ["init"], { cwd: cloneDir });
  await execFileAsync("git", ["remote", "add", "origin", repoUrl], { cwd: cloneDir });

  await buildPackage(cloneDir);
  await execFileAsync("git", ["add", "."], { cwd: cloneDir });

  const grouped: Record<string, string[]> = {};
  for (const a of artifacts) (grouped[a.type] ??= []).push(a.name);
  const summary = Object.entries(grouped)
    .map(([type, names]) => `${names.length} ${type}(s)`)
    .join(", ");
  const details = Object.entries(grouped)
    .map(
      ([type, names]) =>
        `### ${type.charAt(0).toUpperCase() + type.slice(1)}s\n${names.map((n) => `- ${n}`).join("\n")}`,
    )
    .join("\n\n");

  await execFileAsync(
    "git",
    ["commit", "-m", `feat: initial preset contribution — ${summary}\n\n${details}`],
    { cwd: cloneDir },
  );

  const pushBranch = targetBranch || "main";
  await execFileAsync("git", ["branch", "-M", pushBranch], { cwd: cloneDir });

  try {
    await execFileAsync("git", ["push", "-u", "origin", pushBranch], { cwd: cloneDir });
  } catch (pushError) {
    const msg = pushError instanceof Error ? pushError.message : String(pushError);
    log.error(`Push to empty repo failed: ${msg}`);
    log.info(`  Troubleshooting:`);
    log.info(`  1. Verify you have write access: gh repo view ${targetRepo}`);
    log.info(`  2. For private repos, ensure your token has 'repo' scope:`);
    log.info(`       gh auth refresh -s repo`);
    log.info(`  3. If using SSH, verify your key: ssh -T git@github.com`);
    log.info(`  4. Ask the repo owner to grant you write (push) permission`);
    throw pushError;
  }

  log.info(`Pushed initial commit to ${targetRepo}/${pushBranch}`);
  return `https://github.com/${targetRepo}`;
}
