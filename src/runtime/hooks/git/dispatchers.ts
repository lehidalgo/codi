/**
 * Git hook dispatchers — invoked by `codi hook git-pre-commit` and
 * `codi hook git-pre-push`. ADR-013 Paso 8.
 *
 * Pre-commit: junk-paths-check, file-lines-check, agent-configs-scan,
 *             auto-format (in that order — auto-format last so the
 *             re-staged content is what gets committed).
 * Pre-push:   branch-name-check, branch-base-check, direct-push-guard.
 *
 * Each check returns a verdict. The dispatcher prints all stderr
 * messages then exits with the worst severity:
 *   any block → exit 1
 *   else      → exit 0
 *
 * Each check fails OPEN — exceptions inside a check become "warn"
 * verdicts so a buggy check never aborts a commit/push.
 */

import { readFileSync } from "node:fs";
import { checkJunkPaths } from "./junk-paths-check.js";
import { checkFileLines } from "./file-lines-check.js";
import { scanAgentConfigs } from "./agent-configs-scan.js";
import { runAutoFormat } from "./auto-format.js";
import { checkBranchName } from "./branch-name-check.js";
import { checkBranchBase } from "./branch-base-check.js";
import { checkDirectPush } from "./direct-push-guard.js";
import { aggregateExitCode, formatVerdictForStderr } from "./types.js";
import type { GitHookContext, GitHookVerdict } from "./types.js";

function readStdinLines(): string[] {
  try {
    const raw = readFileSync(0, "utf8");
    return raw.split("\n").filter((line) => line.length > 0);
  } catch {
    return [];
  }
}

function emit(verdicts: readonly GitHookVerdict[]): void {
  for (const v of verdicts) {
    if (v.severity === "pass" || v.messages.length === 0) continue;
    process.stderr.write(formatVerdictForStderr(v) + "\n");
  }
}

export function runGitPreCommit(): void {
  const ctx: GitHookContext = { cwd: process.cwd() };
  // Order matters: auto-format last so re-staged files are committed.
  const verdicts: GitHookVerdict[] = [
    checkJunkPaths(ctx),
    checkFileLines(ctx),
    scanAgentConfigs(ctx),
    runAutoFormat(ctx),
  ];
  emit(verdicts);
  process.exit(aggregateExitCode(verdicts));
}

export function runGitPrePush(): void {
  const ctx: GitHookContext = { cwd: process.cwd() };
  const stdinLines = readStdinLines();
  const verdicts: GitHookVerdict[] = [
    checkBranchName(ctx),
    checkBranchBase(ctx),
    checkDirectPush(ctx, stdinLines),
  ];
  emit(verdicts);
  process.exit(aggregateExitCode(verdicts));
}
