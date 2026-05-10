/**
 * Workflow ID generation.
 *
 * Format: <type-prefix>-<slug>-<YYYYMMDD>
 *   - type-prefix: short stable prefix per workflow type (feat, fix, refactor, mig)
 *   - slug: kebab-case from task, truncated to ~30 chars, no trailing dash
 *   - date: UTC date at workflow start
 *
 * Collisions on the same day are resolved by appending -<n> (incrementing).
 * The caller checks against existing archive directories.
 */

import type { WorkflowType } from "./types.js";

const TYPE_PREFIX: Record<WorkflowType, string> = {
  feature: "feat",
  "bug-fix": "fix",
  refactor: "refactor",
  migration: "mig",
  project: "proj",
  quick: "quick",
};

const MAX_SLUG_LENGTH = 30;

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, "");
}

export function dateStamp(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

export function buildWorkflowId(
  workflowType: WorkflowType,
  task: string,
  date: Date = new Date(),
): string {
  const prefix = TYPE_PREFIX[workflowType];
  const slug = slugify(task) || "untitled";
  return `${prefix}-${slug}-${dateStamp(date)}`;
}

export function disambiguate(baseId: string, exists: (id: string) => boolean): string {
  if (!exists(baseId)) return baseId;
  for (let i = 2; i < 100; i += 1) {
    const candidate = `${baseId}-${i}`;
    if (!exists(candidate)) return candidate;
  }
  throw new Error(`Cannot disambiguate workflow ID after 100 attempts: ${baseId}`);
}
