/**
 * Change classifier — decides whether a file modification is incidental or
 * a scope expansion, and whether it should be elevated to a child workflow.
 *
 * Pure TypeScript, no LLM. The closed rule table comes from the grilling
 * decisions (Q3 + Q9 + Q12 of the bootstrap design). Extending the table
 * requires an ADR.
 *
 * Authority chain (per the constitutional principle):
 *   pre-tool-use hook   → guardrail (calls this classifier)
 *   classifier          → mechanical authority (this file)
 *   agent               → orchestrator (acts on classifier output)
 *   human               → decision-maker (only when agent escalates)
 *
 * The classifier never asks the human anything. Low-confidence incidentals
 * automatically escalate to scope-expansion (per the constitutional rule:
 * "no human confirmations of low value").
 */

import type { WorkflowType } from "./types.js";
import {
  computeDiffStats,
  diffIntroducesNewIdentifiers,
  diffOnlyAddsImports,
  diffOnlyModifiesTypeAssertions,
  diffTouchesExports,
  isAdrFile,
  isContextFile,
  isMigrationFile,
  isPackageManifest,
  isSchemaFile,
  isTestFile,
  type DiffStats,
} from "./classifier-rules.js";

export type Category = "incidental" | "scope-expansion";

export type ElevationTrigger = "schema_or_migration_change" | "context_or_adr_change";

export interface SuggestedElevation {
  workflow_type: WorkflowType;
  trigger: ElevationTrigger;
  reason: string;
}

export interface ClassifyResult {
  category: Category;
  reason: string;
  confidence: "high" | "low";
  suggested_elevation: SuggestedElevation | null;
  diff_stats: {
    lines_added: number;
    lines_removed: number;
    lines_changed: number;
  };
}

export interface ClassifyInput {
  file_path: string;
  old_content: string;
  new_content: string;
  files_in_plan: readonly string[];
}

const SMALL_DIFF_THRESHOLD_LINES = 5;

/**
 * Apply the closed rule table to classify a single file change.
 *
 * Order of evaluation matters: more specific rules first. The default
 * (last) is conservative — scope-expansion when in doubt.
 */
export function classifyChange(input: ClassifyInput): ClassifyResult {
  const { file_path, old_content, new_content, files_in_plan } = input;
  const diff = computeDiffStats(old_content, new_content);
  const stats = {
    lines_added: diff.linesAdded,
    lines_removed: diff.linesRemoved,
    lines_changed: diff.linesChanged,
  };

  // Edge case: identical content shouldn't reach the classifier, but be safe.
  if (diff.linesChanged === 0) {
    return {
      category: "incidental",
      reason: "No content change detected.",
      confidence: "high",
      suggested_elevation: null,
      diff_stats: stats,
    };
  }

  // 1. File-kind rules (highest specificity). These always force scope-expansion.

  if (isTestFile(file_path)) {
    return {
      category: "scope-expansion",
      reason: "Test file changes are contract-affecting and require explicit scope.",
      confidence: "high",
      suggested_elevation: null,
      diff_stats: stats,
    };
  }

  if (isPackageManifest(file_path)) {
    return {
      category: "scope-expansion",
      reason:
        "Package manifest changes (deps, scripts) affect runtime behavior and require explicit scope.",
      confidence: "high",
      suggested_elevation: null,
      diff_stats: stats,
    };
  }

  if (isMigrationFile(file_path)) {
    return {
      category: "scope-expansion",
      reason: "Migration files affect persisted state and require explicit scope.",
      confidence: "high",
      suggested_elevation: {
        workflow_type: "migration",
        trigger: "schema_or_migration_change",
        reason: "Schema or migration file modified.",
      },
      diff_stats: stats,
    };
  }

  if (isSchemaFile(file_path)) {
    return {
      category: "scope-expansion",
      reason: "Schema changes affect contracts and require explicit scope.",
      confidence: "high",
      suggested_elevation: {
        workflow_type: "migration",
        trigger: "schema_or_migration_change",
        reason: "Schema file modified.",
      },
      diff_stats: stats,
    };
  }

  if (isAdrFile(file_path)) {
    return {
      category: "scope-expansion",
      reason:
        "ADR files are immutable architectural records. Edit only via supersedes flow with explicit approval.",
      confidence: "high",
      suggested_elevation: {
        workflow_type: "refactor",
        trigger: "context_or_adr_change",
        reason: "ADR modification implies architectural change.",
      },
      diff_stats: stats,
    };
  }

  if (isContextFile(file_path)) {
    return {
      category: "scope-expansion",
      reason: "CONTEXT.md changes are domain-vocabulary updates and must be approved explicitly.",
      confidence: "high",
      suggested_elevation: null,
      diff_stats: stats,
    };
  }

  // 2. File is in plan? Permit (incidental for tracking but not a violation).
  // The hook permits these without invoking the classifier in normal flow,
  // but if called we mark as incidental.
  if (files_in_plan.includes(file_path)) {
    return {
      category: "incidental",
      reason: "File is in the plan scope.",
      confidence: "high",
      suggested_elevation: null,
      diff_stats: stats,
    };
  }

  // 3. Diff-shape rules.

  if (diffTouchesExports(diff)) {
    return {
      category: "scope-expansion",
      reason: "Diff modifies public exports — interface change.",
      confidence: "high",
      suggested_elevation: null,
      diff_stats: stats,
    };
  }

  if (diffOnlyAddsImports(diff)) {
    return {
      category: "incidental",
      reason: "Diff only adds import statements.",
      confidence: "high",
      suggested_elevation: null,
      diff_stats: stats,
    };
  }

  if (diffOnlyModifiesTypeAssertions(diff)) {
    // Low-confidence incidental → auto-escalate per constitutional principle
    return {
      category: "scope-expansion",
      reason:
        "Diff appears to modify only type assertions (low-confidence incidental, auto-escalated).",
      confidence: "low",
      suggested_elevation: null,
      diff_stats: stats,
    };
  }

  if (diff.linesChanged < SMALL_DIFF_THRESHOLD_LINES && !diffIntroducesNewIdentifiers(diff)) {
    // Small diff, no new identifiers → low-confidence incidental → auto-escalate
    return {
      category: "scope-expansion",
      reason: `Small diff (${diff.linesChanged} lines) without new identifiers — low-confidence incidental, auto-escalated.`,
      confidence: "low",
      suggested_elevation: null,
      diff_stats: stats,
    };
  }

  // 4. Default — conservative. When in doubt, require explicit scope expansion.
  return {
    category: "scope-expansion",
    reason: "Change does not match any incidental pattern; conservative default.",
    confidence: "high",
    suggested_elevation: null,
    diff_stats: stats,
  };
}

/**
 * Convenience helper: classify and check if the result requires the user
 * to invoke `devloop scope propose-expansion`.
 */
export function requiresScopeExpansion(result: ClassifyResult): boolean {
  return result.category === "scope-expansion";
}

// Re-export for consumers (hooks, CLI)
export { type DiffStats };
