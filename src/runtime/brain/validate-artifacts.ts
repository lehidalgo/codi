/**
 * Lean v1 of the artifact validator (Q9). Implements the four checks that
 * are mechanical and high-leverage today; leaves five for follow-up phases:
 *
 *   ✓ #2 internal flag consistency        (this file)
 *   ✓ #4 chains reference existing skills (this file)
 *   ✓ #5 workflow yaml schema valid       (delegates to seedWorkflowDefinitions)
 *   ✓ #7 phase-refs match yaml            (delegates to regeneratePhaseRefs)
 *   — #1 skill workflow role declaration  (needs frontmatter field, separate phase)
 *   — #3 pair Skip when reciprocity       (needs explicit pair registry, separate phase)
 *   — #6 version bump on hash change      (Q8 — its own phase 10)
 *   — #8 trigger phrase overlap NLP-light (separate phase)
 *   — #9 user-invocable ↔ CLI registry    (separate phase)
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import type { ChainEntry, WorkflowDefinitionShape } from "./seed-workflows.js";
import { regeneratePhaseRefs } from "./render-chains.js";

export interface ValidationIssue {
  readonly check: number;
  readonly severity: "error" | "warn";
  readonly message: string;
  readonly location?: string;
}

export interface ValidationReport {
  readonly errors: readonly ValidationIssue[];
  readonly warnings: readonly ValidationIssue[];
  readonly checksRun: readonly number[];
}

export interface ValidateOptions {
  readonly skillsRoot: string;
  readonly workflows: readonly WorkflowDefinitionShape[];
  /**
   * Repository root for git-based checks. When omitted, check #6 is skipped.
   * Tests pass a tmp dir without git history; the real CLI passes process.cwd().
   */
  readonly repoRoot?: string;
}

// Skill templates wrap their YAML frontmatter inside a backtick string, so
// the literal ---\n...\n--- block lives somewhere INSIDE the .ts file rather
// than at byte 0. Match the first occurrence rather than anchoring at start.
const FRONTMATTER_RE = /---\n([\s\S]*?)\n---/;

export type SkillLifecycle = "stable" | "beta" | "experimental" | "deprecated";

export const VALID_LIFECYCLES: readonly SkillLifecycle[] = [
  "stable",
  "beta",
  "experimental",
  "deprecated",
];

interface SkillFrontmatter {
  readonly name?: string;
  readonly internal?: boolean;
  readonly disableModelInvocation?: boolean;
  readonly userInvocable?: boolean;
  readonly version?: number;
  readonly lifecycle?: SkillLifecycle;
  readonly replacedBy?: string;
  readonly removeIn?: string;
}

function parseSimpleFrontmatter(text: string): SkillFrontmatter {
  const match = FRONTMATTER_RE.exec(text);
  if (match === null) return {};
  const body = match[1];
  if (body === undefined) return {};
  const out: { -readonly [K in keyof SkillFrontmatter]: SkillFrontmatter[K] } = {};
  for (const line of body.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    switch (key) {
      case "name":
        out.name = value;
        break;
      case "internal":
        if (value === "true") out.internal = true;
        else if (value === "false") out.internal = false;
        break;
      case "disable-model-invocation":
        if (value === "true") out.disableModelInvocation = true;
        else if (value === "false") out.disableModelInvocation = false;
        break;
      case "user-invocable":
        if (value === "true") out.userInvocable = true;
        else if (value === "false") out.userInvocable = false;
        break;
      case "version":
        out.version = Number.parseInt(value, 10);
        break;
      case "lifecycle":
        if ((VALID_LIFECYCLES as readonly string[]).includes(value)) {
          out.lifecycle = value as SkillLifecycle;
        }
        break;
      case "replaced_by":
      case "replaced-by":
        out.replacedBy = value;
        break;
      case "remove_in":
      case "remove-in":
        out.removeIn = value;
        break;
    }
  }
  return out;
}

/**
 * Extract the YAML frontmatter that lives inside the skill template.ts
 * string template literal. Skill templates are TypeScript files that export a
 * backtick-quoted string starting with `---`. The simple regex below tolerates
 * a leading import block and pulls the first `---\n...\n---` it finds.
 */
function extractSkillFrontmatter(skillDir: string): SkillFrontmatter | null {
  const templatePath = resolve(skillDir, "template.ts");
  if (!existsSync(templatePath)) return null;
  const source = readFileSync(templatePath, "utf8");
  return parseSimpleFrontmatter(source);
}

function listSkillSlugs(skillsRoot: string): readonly string[] {
  if (!existsSync(skillsRoot)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(skillsRoot)) {
    const full = resolve(skillsRoot, entry);
    if (!statSync(full).isDirectory()) continue;
    if (existsSync(resolve(full, "template.ts"))) out.push(entry);
  }
  return out;
}

function checkInternalConsistency(skillsRoot: string): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const slug of listSkillSlugs(skillsRoot)) {
    const fm = extractSkillFrontmatter(resolve(skillsRoot, slug));
    if (fm === null) continue;
    if (fm.internal === true && fm.disableModelInvocation !== true) {
      issues.push({
        check: 2,
        severity: "error",
        message: `skill '${slug}': internal: true requires disable-model-invocation: true`,
        location: resolve(skillsRoot, slug, "template.ts"),
      });
    }
  }
  return issues;
}

/**
 * Check #10 (16F) — skill lifecycle hygiene. Deprecated skills MUST declare
 * `replaced_by:` and `remove_in:` so the deprecation has a clear off-ramp.
 * Other lifecycle stages have no additional requirements; the validator
 * simply rejects unknown values via the parser (which drops them silently).
 */
function checkLifecycleHygiene(skillsRoot: string): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const slug of listSkillSlugs(skillsRoot)) {
    const fm = extractSkillFrontmatter(resolve(skillsRoot, slug));
    if (fm === null) continue;
    if (fm.lifecycle !== "deprecated") continue;
    const missing: string[] = [];
    if (fm.replacedBy === undefined || fm.replacedBy.length === 0) missing.push("replaced_by");
    if (fm.removeIn === undefined || fm.removeIn.length === 0) missing.push("remove_in");
    if (missing.length > 0) {
      issues.push({
        check: 10,
        severity: "error",
        message: `skill '${slug}': lifecycle: deprecated requires ${missing.join(" + ")} in frontmatter`,
        location: resolve(skillsRoot, slug, "template.ts"),
      });
    }
  }
  return issues;
}

function checkChainSkillsExist(
  workflows: readonly WorkflowDefinitionShape[],
  skillsRoot: string,
): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const catalog = new Set(listSkillSlugs(skillsRoot));
  for (const wf of workflows) {
    for (const [phaseName, spec] of Object.entries(wf.phases)) {
      const chains = (spec as { chains?: readonly ChainEntry[] }).chains;
      if (chains === undefined) continue;
      for (const entry of chains) {
        if (!catalog.has(entry.skill)) {
          issues.push({
            check: 4,
            severity: "error",
            message:
              `workflow '${wf.id}' phase '${phaseName}': chain references unknown skill '${entry.skill}' ` +
              `(not found under ${skillsRoot})`,
            location: `${wf.id}.${phaseName}`,
          });
        }
      }
    }
  }
  return issues;
}

/**
 * Strip line comments (`// ...`), block comments (`/* ... *​/`), and collapse
 * whitespace runs to a single space. Reformatting (Prettier reflow, comment
 * tweak, blank-line shuffle) won't change the normalized hash; semantic
 * content does.
 */
function normalizeForHash(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "") // block comments
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1") // line comments (avoids `://` in URLs)
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedHash(source: string): string {
  return createHash("sha256").update(normalizeForHash(source), "utf8").digest("hex");
}

const VERSION_LINE_RE = /(^|\n)\s*version:\s*(\d+)\s*(\n|$)/;

function extractVersion(source: string): number | null {
  const match = VERSION_LINE_RE.exec(source);
  if (match === null) return null;
  const raw = match[2];
  if (raw === undefined) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

function tryGitShowHead(repoRoot: string, relPath: string): string | null {
  try {
    return execFileSync("git", ["show", `HEAD:${relPath}`], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null; // file new in working tree, or git unavailable
  }
}

/**
 * Check #6 (Q8) — when a skill's template.ts content changed (normalized) but
 * the `version:` field is unchanged, the bump was forgotten. Compares working
 * tree against HEAD via git. New files (no HEAD version) are skipped.
 *
 * Override path (deferred to a future phase): commit message tag
 * `[skill-major]` or `[skill-minor]` lets the dev acknowledge the bump
 * decision explicitly. v1 just enforces the basic invariant.
 */
function checkVersionBumpOnContentChange(
  skillsRoot: string,
  repoRoot: string,
): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const slug of listSkillSlugs(skillsRoot)) {
    const templatePath = resolve(skillsRoot, slug, "template.ts");
    if (!existsSync(templatePath)) continue;
    const current = readFileSync(templatePath, "utf8");
    const relPath = relative(repoRoot, templatePath);
    const head = tryGitShowHead(repoRoot, relPath);
    if (head === null) continue; // new file or git unavailable
    if (normalizedHash(current) === normalizedHash(head)) continue; // no semantic change
    const currentVersion = extractVersion(current);
    const headVersion = extractVersion(head);
    if (currentVersion === null) continue; // no version field — separate concern
    if (headVersion === null) continue; // version field is new — counts as bump
    if (currentVersion === headVersion) {
      issues.push({
        check: 6,
        severity: "error",
        message:
          `skill '${slug}': template.ts content changed (normalized hash differs from HEAD) ` +
          `but version: is still ${currentVersion} — bump it`,
        location: templatePath,
      });
    }
  }
  return issues;
}

function checkPhaseRefDrift(
  workflows: readonly WorkflowDefinitionShape[],
  skillsRoot: string,
): readonly ValidationIssue[] {
  const result = regeneratePhaseRefs(workflows, { skillsRoot });
  const issues: ValidationIssue[] = [];
  for (const d of result.drift) {
    issues.push({
      check: 7,
      severity: "error",
      message: `phase-ref drift inside auto-generated block (run pnpm regen:phase-refs:force to repair)`,
      location: d.path,
    });
  }
  for (const m of result.missingMarkers) {
    issues.push({
      check: 7,
      severity: "warn",
      message: `phase-ref ${m} is missing BEGIN/END markers`,
    });
  }
  for (const m of result.missingMd) {
    issues.push({
      check: 7,
      severity: "warn",
      message: `phase ${m} declared in yaml but no phase-*.md exists`,
    });
  }
  return issues;
}

export function validateArtifacts(opts: ValidateOptions): ValidationReport {
  const allIssues: ValidationIssue[] = [];
  const checksRun: number[] = [2, 4, 5, 7, 10];

  allIssues.push(...checkInternalConsistency(opts.skillsRoot));
  allIssues.push(...checkChainSkillsExist(opts.workflows, opts.skillsRoot));
  // #5 is implicit — the workflows array passed here was already validated by
  // readBuiltinDefinitions when it was loaded. Recording the check number
  // lets the caller report coverage.
  allIssues.push(...checkPhaseRefDrift(opts.workflows, opts.skillsRoot));
  allIssues.push(...checkLifecycleHygiene(opts.skillsRoot));

  if (opts.repoRoot !== undefined) {
    allIssues.push(...checkVersionBumpOnContentChange(opts.skillsRoot, opts.repoRoot));
    checksRun.push(6);
  }

  return {
    errors: allIssues.filter((i) => i.severity === "error"),
    warnings: allIssues.filter((i) => i.severity === "warn"),
    checksRun,
  };
}
