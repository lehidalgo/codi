/**
 * `codi contribute lint` — pre-PR contribution-discipline check.
 *
 * Runs 9 checks against the local diff vs a base branch (default `main`).
 * Each check maps to a rejection criterion documented in CLAUDE.md.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createCommandResult } from "../core/output/formatter.js";
import { EXIT_CODES } from "../core/output/exit-codes.js";
import type { CommandResult } from "../core/output/types.js";

export interface LintFinding {
  readonly check: number;
  readonly criterion: string;
  readonly severity: "error" | "warn";
  readonly message: string;
  readonly file?: string;
}

export interface LintResult {
  readonly findings: readonly LintFinding[];
  readonly errors: number;
  readonly warnings: number;
  readonly diffSummary: { added: number; modified: number; deleted: number };
}

export interface LintOptions {
  readonly cwd: string;
  readonly baseBranch: string;
}

function gitFileStatus(
  cwd: string,
  baseBranch: string,
): { added: string[]; modified: string[]; deleted: string[] } {
  try {
    const out = execFileSync("git", ["diff", "--name-status", `${baseBranch}...HEAD`], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const added: string[] = [];
    const modified: string[] = [];
    const deleted: string[] = [];
    for (const line of out.split("\n")) {
      if (line.length === 0) continue;
      const [status, ...rest] = line.split(/\s+/);
      const file = rest.join(" ");
      if (status === "A") added.push(file);
      else if (status === "M") modified.push(file);
      else if (status === "D") deleted.push(file);
    }
    return { added, modified, deleted };
  } catch {
    return { added: [], modified: [], deleted: [] };
  }
}

const GENERATED_PREFIXES = [".claude/", ".codex/", ".cursor/", ".opencode/", ".github/copilot/"];
function checkGeneratedEdits(files: readonly string[]): LintFinding[] {
  const findings: LintFinding[] = [];
  for (const f of files) {
    if (GENERATED_PREFIXES.some((p) => f.startsWith(p))) {
      findings.push({
        check: 1,
        criterion: "no edits to generated artifacts",
        severity: "error",
        message: `'${f}' is generated. Edit the matching template under src/templates/ instead.`,
        file: f,
      });
    }
  }
  return findings;
}

function checkSkillEvals(cwd: string, addedFiles: readonly string[]): LintFinding[] {
  const findings: LintFinding[] = [];
  const newSkillTemplates = addedFiles.filter((f) =>
    /^src\/templates\/skills\/[^/]+\/template\.ts$/.test(f),
  );
  for (const tpl of newSkillTemplates) {
    const skillDir = tpl.replace(/\/template\.ts$/, "");
    const evalsPath = resolve(cwd, skillDir, "evals", "evals.json");
    if (!existsSync(evalsPath)) {
      findings.push({
        check: 2,
        criterion: "new skill needs evals/evals.json",
        severity: "error",
        message: `${skillDir}/evals/evals.json missing — every new skill ships eval cases.`,
        file: skillDir,
      });
    }
  }
  return findings;
}

const DESCRIPTION_BLOCK_RE = /description:\s*\|([\s\S]*?)(?:\n[a-z_-]+:\s)/;
function checkDescriptionSize(cwd: string, files: readonly string[]): LintFinding[] {
  const findings: LintFinding[] = [];
  const skillFiles = files.filter((f) => /^src\/templates\/skills\/[^/]+\/template\.ts$/.test(f));
  for (const f of skillFiles) {
    const path = resolve(cwd, f);
    if (!existsSync(path)) continue;
    const content = readFileSync(path, "utf8");
    const match = DESCRIPTION_BLOCK_RE.exec(content);
    if (!match) continue;
    const description = match[1] ?? "";
    if (description.length > 1500) {
      findings.push({
        check: 3,
        criterion: "skill description ≤1500 chars",
        severity: "error",
        message: `${f}: description is ${description.length} chars (max 1500).`,
        file: f,
      });
    }
  }
  return findings;
}

const PHASE_BLOCK_RE = /^\s*([a-z][a-z-]*):\s*\n((?:\s{4,}.*\n?)*)/gm;
function checkWorkflowChains(cwd: string, files: readonly string[]): LintFinding[] {
  const findings: LintFinding[] = [];
  const wfFiles = files.filter((f) => /^src\/templates\/workflows\/[^/]+\.yaml$/.test(f));
  for (const f of wfFiles) {
    const path = resolve(cwd, f);
    if (!existsSync(path)) continue;
    const content = readFileSync(path, "utf8");
    const phasesIdx = content.indexOf("phases:");
    if (phasesIdx === -1) continue;
    const flagsIdx = content.indexOf("\nflags:", phasesIdx);
    const phasesBlock = content.slice(phasesIdx, flagsIdx === -1 ? content.length : flagsIdx);
    PHASE_BLOCK_RE.lastIndex = 0;
    for (
      let m = PHASE_BLOCK_RE.exec(phasesBlock);
      m !== null;
      m = PHASE_BLOCK_RE.exec(phasesBlock)
    ) {
      const phaseName = m[1] ?? "";
      const phaseBody = m[2] ?? "";
      if (phaseName === "done" || phaseName === "abandoned") continue;
      if (!/\n\s*chains:\s/.test(phaseBody)) {
        findings.push({
          check: 4,
          criterion: "non-terminal phases declare chains:",
          severity: "warn",
          message: `${f}: phase '${phaseName}' has no chains:. Add chain entries or document explicitly.`,
          file: f,
        });
      }
    }
  }
  return findings;
}

function checkHookEdits(files: readonly string[]): LintFinding[] {
  const findings: LintFinding[] = [];
  for (const f of files) {
    if (f.startsWith(".husky/") || f.startsWith(".git/hooks/")) {
      findings.push({
        check: 5,
        criterion: "no direct edits to .husky/ or .git/hooks/",
        severity: "error",
        message: `'${f}' is managed. Edit src/templates/hooks/ or scripts/setup-husky-hooks.mjs instead.`,
        file: f,
      });
    }
  }
  return findings;
}

function extractVersion(content: string): number | null {
  const match = /(?:^|\n)\s*version:\s*(\d+)\s*(?:\n|$)/.exec(content);
  if (!match) return null;
  const raw = match[1];
  if (raw === undefined) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

function checkVersionBump(
  cwd: string,
  baseBranch: string,
  files: readonly string[],
): LintFinding[] {
  const findings: LintFinding[] = [];
  const skillFiles = files.filter((f) => /^src\/templates\/skills\/[^/]+\/template\.ts$/.test(f));
  for (const f of skillFiles) {
    let headContent = "";
    let currentContent = "";
    try {
      headContent = execFileSync("git", ["show", `${baseBranch}:${f}`], {
        cwd,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
    } catch {
      continue;
    }
    try {
      currentContent = readFileSync(resolve(cwd, f), "utf8");
    } catch {
      continue;
    }
    const headVersion = extractVersion(headContent);
    const currentVersion = extractVersion(currentContent);
    if (headVersion === null || currentVersion === null) continue;
    if (headVersion === currentVersion) {
      findings.push({
        check: 6,
        criterion: "skill template changed → bump version:",
        severity: "error",
        message: `${f}: version is still ${currentVersion}. Bump it.`,
        file: f,
      });
    }
  }
  return findings;
}

function checkNoVerify(cwd: string, baseBranch: string): LintFinding[] {
  const findings: LintFinding[] = [];
  try {
    const out = execFileSync("git", ["log", `${baseBranch}..HEAD`, "--format=%H %s"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    for (const line of out.split("\n")) {
      if (line.length === 0) continue;
      if (/SKIPVERIFY|--no-verify/i.test(line)) {
        findings.push({
          check: 7,
          criterion: "no --no-verify in commit history",
          severity: "error",
          message: `Commit '${line.slice(0, 80)}' looks like it used --no-verify. Diagnose the hook failure instead.`,
        });
      }
    }
  } catch {
    /* git unavailable */
  }
  return findings;
}

function checkDocNaming(files: readonly string[]): LintFinding[] {
  const findings: LintFinding[] = [];
  const docFiles = files.filter((f) => /^docs\/[^/]+\.md$/.test(f));
  for (const f of docFiles) {
    const base = f.slice("docs/".length);
    if (!/^\d{8}_\d{6}_\[[A-Z]+\]_.+\.md$/.test(base)) {
      findings.push({
        check: 8,
        criterion: "docs/ files follow YYYYMMDD_HHMMSS_[CATEGORY]_slug.md",
        severity: "warn",
        message: `${f}: missing timestamp + [CATEGORY] prefix.`,
        file: f,
      });
    }
  }
  return findings;
}

function checkSkillIndex(cwd: string, addedFiles: readonly string[]): LintFinding[] {
  const findings: LintFinding[] = [];
  const newSkillTemplates = addedFiles.filter((f) =>
    /^src\/templates\/skills\/[^/]+\/template\.ts$/.test(f),
  );
  for (const tpl of newSkillTemplates) {
    const indexPath = tpl.replace(/\/template\.ts$/, "/index.ts");
    if (!existsSync(resolve(cwd, indexPath))) {
      findings.push({
        check: 9,
        criterion: "new skill includes index.ts barrel",
        severity: "error",
        message: `${indexPath} missing — every skill ships a barrel for the loader.`,
        file: tpl,
      });
    }
  }
  return findings;
}

export async function runContributeLint(opts: LintOptions): Promise<CommandResult<LintResult>> {
  const status = gitFileStatus(opts.cwd, opts.baseBranch);
  const allFiles = [...status.added, ...status.modified];
  const findings: LintFinding[] = [];
  findings.push(...checkGeneratedEdits(allFiles));
  findings.push(...checkSkillEvals(opts.cwd, status.added));
  findings.push(...checkDescriptionSize(opts.cwd, allFiles));
  findings.push(...checkWorkflowChains(opts.cwd, allFiles));
  findings.push(...checkHookEdits(allFiles));
  findings.push(...checkVersionBump(opts.cwd, opts.baseBranch, status.modified));
  findings.push(...checkNoVerify(opts.cwd, opts.baseBranch));
  findings.push(...checkDocNaming(allFiles));
  findings.push(...checkSkillIndex(opts.cwd, status.added));

  const errors = findings.filter((f) => f.severity === "error").length;
  const warnings = findings.filter((f) => f.severity === "warn").length;
  const data: LintResult = {
    findings,
    errors,
    warnings,
    diffSummary: {
      added: status.added.length,
      modified: status.modified.length,
      deleted: status.deleted.length,
    },
  };

  return createCommandResult({
    success: errors === 0,
    command: "contribute lint",
    data,
    ...(errors > 0
      ? {
          errors: findings
            .filter((f) => f.severity === "error")
            .map((f) => ({
              code: `LINT_CHECK_${f.check}`,
              message: f.message,
              hint: `Criterion: ${f.criterion}. See CLAUDE.md → Contribution rejection criteria.`,
              severity: "error" as const,
              context: f.file !== undefined ? { file: f.file } : {},
            })),
        }
      : {}),
    exitCode: errors === 0 ? EXIT_CODES.SUCCESS : EXIT_CODES.GENERAL_ERROR,
  });
}
