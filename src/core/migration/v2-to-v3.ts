/**
 * `codi migrate v2-to-v3` — pure-function planner (Sprint 7).
 *
 * The CLI command (Sprint 7 next pass) shells out to this module:
 *   1. detectV2Layout() inspects `.codi/` to confirm a v2 install
 *   2. planMigration() returns a typed plan (no I/O on the user's repo)
 *   3. executeMigration() (deferred — Sprint 7.b) applies the plan
 *
 * The planner runs in dry-run mode by default; the executor is gated on the
 * user explicitly typing `ok` after reviewing the plan output. Backups are
 * written before any rewrite so a failed apply is recoverable.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { PROJECT_DIR } from "#src/constants.js";

export interface V2DetectionResult {
  readonly isV2: boolean;
  readonly codiDir: string;
  readonly hasManifest: boolean;
  readonly hasYaml: boolean;
  readonly artifactCounts: {
    readonly rules: number;
    readonly skills: number;
    readonly agents: number;
  };
  readonly warnings: readonly string[];
}

export function detectV2Layout(repoRoot: string): V2DetectionResult {
  const codiDir = resolve(repoRoot, PROJECT_DIR);
  const warnings: string[] = [];

  if (!existsSync(codiDir) || !statSync(codiDir).isDirectory()) {
    return {
      isV2: false,
      codiDir,
      hasManifest: false,
      hasYaml: false,
      artifactCounts: { rules: 0, skills: 0, agents: 0 },
      warnings: ["no .codi/ directory found"],
    };
  }

  const manifestPath = resolve(codiDir, "artifact-manifest.json");
  const yamlPath = resolve(codiDir, "codi.yaml");
  const hasManifest = existsSync(manifestPath);
  const hasYaml = existsSync(yamlPath);

  if (!hasManifest) warnings.push("missing .codi/artifact-manifest.json");
  if (!hasYaml) warnings.push("missing .codi/codi.yaml");

  const counts = { rules: 0, skills: 0, agents: 0 };
  if (hasManifest) {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
        artifacts?: Record<string, { type?: string }>;
      };
      const artifacts = manifest.artifacts ?? {};
      for (const meta of Object.values(artifacts)) {
        const t = meta.type;
        if (t === "rule") counts.rules++;
        else if (t === "skill") counts.skills++;
        else if (t === "agent") counts.agents++;
      }
    } catch {
      warnings.push("artifact-manifest.json is not valid JSON");
    }
  }

  return {
    isV2: hasManifest && hasYaml,
    codiDir,
    hasManifest,
    hasYaml,
    artifactCounts: counts,
    warnings,
  };
}

export type MigrationStepKind =
  | "backup_codi_dir"
  | "bootstrap_brain_db"
  | "rewrite_codi_yaml"
  | "regenerate_per_agent_output"
  | "report_summary";

export interface MigrationStep {
  readonly kind: MigrationStepKind;
  readonly description: string;
  /** Reversible without the backup? Only `report_summary` is. */
  readonly reversibleWithoutBackup: boolean;
}

export interface MigrationPlan {
  readonly source: V2DetectionResult;
  readonly steps: readonly MigrationStep[];
  readonly backupPath: string;
  readonly destinationMode: "zero" | "lite" | "standard" | "full";
  readonly canProceed: boolean;
  readonly blockers: readonly string[];
}

export interface PlanOptions {
  /** Target install mode for the migrated repo. Default: zero. */
  readonly mode?: "zero" | "lite" | "standard" | "full";
  /** Backup directory name (relative to repoRoot). Default `.codi.v2.backup-<ts>`. */
  readonly backupName?: string;
}

export function planMigration(repoRoot: string, opts: PlanOptions = {}): MigrationPlan {
  const detection = detectV2Layout(repoRoot);
  const blockers: string[] = [];
  if (!detection.isV2) {
    blockers.push("source is not a recognised Codi v2 install");
  }

  const ts = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
  const backupName = opts.backupName ?? `.codi.v2.backup-${ts}`;
  const backupPath = resolve(repoRoot, backupName);
  if (existsSync(backupPath)) {
    blockers.push(`backup path already exists: ${backupPath}`);
  }

  const destinationMode = opts.mode ?? "zero";

  const steps: MigrationStep[] = [
    {
      kind: "backup_codi_dir",
      description: `Copy .codi/ → ${backupName}`,
      reversibleWithoutBackup: false,
    },
    {
      kind: "bootstrap_brain_db",
      description: `Initialise brain DB (~/.codi/brain.db) — idempotent`,
      reversibleWithoutBackup: true,
    },
    {
      kind: "rewrite_codi_yaml",
      description: `Update .codi/codi.yaml → mode: ${destinationMode}`,
      reversibleWithoutBackup: false,
    },
    {
      kind: "regenerate_per_agent_output",
      description: "Run codi generate to refresh .claude/, .cursor/, etc.",
      reversibleWithoutBackup: false,
    },
    {
      kind: "report_summary",
      description: "Print artifact diff (added / removed / changed)",
      reversibleWithoutBackup: true,
    },
  ];

  return {
    source: detection,
    steps,
    backupPath,
    destinationMode,
    canProceed: blockers.length === 0,
    blockers,
  };
}

/**
 * Render a plan as human-readable text — used by the dry-run preview that
 * gates the actual apply on explicit user approval.
 */
export function formatPlan(plan: MigrationPlan): string {
  const lines: string[] = [];
  lines.push("Codi v2 → v3 migration plan");
  lines.push("");
  lines.push(`Source:           ${plan.source.codiDir}`);
  lines.push(
    `Source artifacts: ${plan.source.artifactCounts.rules} rules, ${plan.source.artifactCounts.skills} skills, ${plan.source.artifactCounts.agents} agents`,
  );
  lines.push(`Backup target:    ${plan.backupPath}`);
  lines.push(`Destination mode: ${plan.destinationMode}`);
  lines.push("");
  if (plan.source.warnings.length > 0) {
    lines.push("Warnings:");
    for (const w of plan.source.warnings) lines.push(`  - ${w}`);
    lines.push("");
  }
  if (!plan.canProceed) {
    lines.push("BLOCKED:");
    for (const b of plan.blockers) lines.push(`  - ${b}`);
    return lines.join("\n");
  }
  lines.push("Steps:");
  plan.steps.forEach((s, i) => {
    lines.push(`  ${i + 1}. [${s.kind}] ${s.description}`);
  });
  lines.push("");
  lines.push("Re-run with --apply after reviewing the plan.");
  return lines.join("\n");
}
