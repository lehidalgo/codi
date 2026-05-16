/**
 * v2-to-v3 migration executor (Sprint 7.b).
 *
 * The planner produces a typed plan; this module applies it. Every step
 * emits a structured StepRecord so callers can render progress and so a
 * mid-run failure produces a usable rollback report.
 *
 * Safety:
 *   - Step 1 (backup_codi_dir) MUST run before any rewrite.
 *   - Step 3 (rewrite_codi_yaml) is the only step that mutates source files;
 *     a failure there leaves the backup intact and aborts the rest.
 *   - Step 2 (bootstrap_brain_db) is idempotent — safe to retry.
 *   - Step 4 (regenerate_per_agent_output) is delegated: the executor only
 *     records intent. The CLI shells out to `codi generate --force` so the
 *     existing scaffolder owns that step.
 */

import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import type { MigrationPlan, MigrationStepKind } from "./v2-to-v3.js";

export interface StepRecord {
  readonly kind: MigrationStepKind;
  readonly status: "ok" | "skipped" | "failed";
  readonly detail: string;
  readonly durationMs: number;
}

export interface ExecuteOptions {
  readonly plan: MigrationPlan;
  readonly repoRoot: string;
  /** When true, no filesystem writes happen; steps record what they would do. */
  readonly dryRun?: boolean;
}

export interface ExecuteResult {
  readonly success: boolean;
  readonly steps: readonly StepRecord[];
  readonly aborted: boolean;
  readonly abortReason: string | null;
}

function timed<T>(fn: () => T): { value: T; durationMs: number } {
  const start = Date.now();
  const value = fn();
  return { value, durationMs: Date.now() - start };
}

function copyDirRecursive(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    const st = statSync(srcPath);
    if (st.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      mkdirSync(dirname(destPath), { recursive: true });
      copyFileSync(srcPath, destPath);
    }
  }
}

export function executeMigration(opts: ExecuteOptions): ExecuteResult {
  const { plan, repoRoot, dryRun = false } = opts;
  const steps: StepRecord[] = [];

  if (!plan.canProceed) {
    return {
      success: false,
      steps,
      aborted: true,
      abortReason: `plan blocked: ${plan.blockers.join("; ")}`,
    };
  }

  for (const step of plan.steps) {
    try {
      const record = applyStep(step.kind, plan, repoRoot, dryRun);
      steps.push(record);
      if (record.status === "failed") {
        return {
          success: false,
          steps,
          aborted: true,
          abortReason: `step ${step.kind} failed: ${record.detail}`,
        };
      }
    } catch (e) {
      steps.push({
        kind: step.kind,
        status: "failed",
        detail: (e as Error).message,
        durationMs: 0,
      });
      return {
        success: false,
        steps,
        aborted: true,
        abortReason: `step ${step.kind} threw: ${(e as Error).message}`,
      };
    }
  }

  return { success: true, steps, aborted: false, abortReason: null };
}

function applyStep(
  kind: MigrationStepKind,
  plan: MigrationPlan,
  repoRoot: string,
  dryRun: boolean,
): StepRecord {
  if (kind === "backup_codi_dir") {
    if (dryRun) {
      return {
        kind,
        status: "skipped",
        detail: `dry-run — would copy ${plan.source.codiDir} → ${plan.backupPath}`,
        durationMs: 0,
      };
    }
    const { durationMs } = timed(() => {
      copyDirRecursive(plan.source.codiDir, plan.backupPath);
    });
    return {
      kind,
      status: "ok",
      detail: `backed up to ${relative(repoRoot, plan.backupPath)}`,
      durationMs,
    };
  }

  if (kind === "bootstrap_brain_db") {
    return {
      kind,
      status: "skipped",
      detail: dryRun
        ? "dry-run — would call applyMigrations on ~/.codi/brain.db"
        : "deferred to first agent session (lazy bootstrap is idempotent)",
      durationMs: 0,
    };
  }

  if (kind === "rewrite_codi_yaml") {
    const yamlPath = resolve(plan.source.codiDir, "codi.yaml");
    if (dryRun) {
      return {
        kind,
        status: "skipped",
        detail: `dry-run — would set mode: ${plan.destinationMode} in ${relative(
          repoRoot,
          yamlPath,
        )}`,
        durationMs: 0,
      };
    }
    const { durationMs } = timed(() => {
      const original = readFileSync(yamlPath, "utf8");
      let updated = original;
      if (/^mode:\s*\S+/m.test(original)) {
        updated = original.replace(/^mode:\s*\S+/m, `mode: ${plan.destinationMode}`);
      } else {
        updated = `mode: ${plan.destinationMode}\n${original}`;
      }
      writeFileSync(yamlPath, updated);
    });
    return {
      kind,
      status: "ok",
      detail: `mode: ${plan.destinationMode}`,
      durationMs,
    };
  }

  if (kind === "regenerate_per_agent_output") {
    return {
      kind,
      status: "skipped",
      detail: "delegated to the CLI: run `codi generate --force` after migrate completes",
      durationMs: 0,
    };
  }

  // report_summary is rendered by the caller from the StepRecord array.
  return {
    kind,
    status: "ok",
    detail: "summary rendered by caller",
    durationMs: 0,
  };
}
