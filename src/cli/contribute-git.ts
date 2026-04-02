import { execFileAsync } from "../utils/exec.js";

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
    return stdout.trim() || "main";
  } catch {
    return "main";
  }
}
