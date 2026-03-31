import * as p from "@clack/prompts";
import { renderColoredDiff, countChanges } from "./diff.js";
import { Logger } from "../core/output/logger.js";

export interface ConflictEntry {
  /** Display label shown in diffs and prompts (e.g. "rules/my-rule"). */
  label: string;
  /** Absolute path to write to if accepted. */
  fullPath: string;
  currentContent: string;
  incomingContent: string;
  additions: number;
  removals: number;
}

export interface ConflictOptions {
  /** Overwrite all conflicting files without prompting. */
  force?: boolean;
  /** Skip all conflicting files without prompting (keep existing). */
  json?: boolean;
}

export interface ConflictResolution {
  /** Entries whose incoming content should be written to disk. */
  accepted: ConflictEntry[];
  /** Entries whose existing content should be left untouched. */
  skipped: ConflictEntry[];
}

/**
 * Builds a ConflictEntry from two strings, computing additions/removals via jsdiff.
 */
export function makeConflictEntry(
  label: string,
  fullPath: string,
  currentContent: string,
  incomingContent: string,
): ConflictEntry {
  const { additions, removals } = countChanges(currentContent, incomingContent);
  return { label, fullPath, currentContent, incomingContent, additions, removals };
}

/**
 * Resolves a list of conflicting files via one of three modes:
 * - force: accept all without prompting
 * - json:  skip all without prompting
 * - default: interactive per-file diff with accept/skip/accept-all/skip-all
 */
export async function resolveConflicts(
  conflicts: ConflictEntry[],
  options: ConflictOptions = {},
): Promise<ConflictResolution> {
  if (conflicts.length === 0) {
    return { accepted: [], skipped: [] };
  }

  if (options.force) {
    return { accepted: conflicts, skipped: [] };
  }

  if (options.json) {
    return { accepted: [], skipped: conflicts };
  }

  // Non-TTY: CI, git hooks, watch mode — auto-accept without prompting
  if (!process.stdout.isTTY) {
    Logger.getInstance().warn(
      `Non-interactive environment detected: auto-accepting ${conflicts.length} conflict(s). Use --json to keep existing files instead.`,
    );
    return { accepted: conflicts, skipped: [] };
  }

  const log = Logger.getInstance();
  log.warn(`${conflicts.length} file(s) conflict with your local versions`);

  const accepted: ConflictEntry[] = [];
  const skipped: ConflictEntry[] = [];
  let acceptAll = false;
  let skipAll = false;

  for (const conflict of conflicts) {
    if (acceptAll) {
      accepted.push(conflict);
      continue;
    }
    if (skipAll) {
      skipped.push(conflict);
      continue;
    }

    const diff = renderColoredDiff(
      conflict.currentContent,
      conflict.incomingContent,
      conflict.label,
    );

    p.note(diff, `${conflict.label}  (+${conflict.additions} -${conflict.removals})`);

    const choice = await p.select({
      message: `What do you want to do with ${conflict.label}?`,
      options: [
        { label: "Accept incoming (overwrite local)", value: "accept" as const },
        { label: "Keep current (skip this file)", value: "skip" as const },
        {
          label: "Accept ALL incoming (overwrite all remaining)",
          value: "accept_all" as const,
        },
        {
          label: "Keep ALL current (skip all remaining)",
          value: "skip_all" as const,
        },
      ],
    });

    if (p.isCancel(choice)) {
      skipped.push(conflict);
      continue;
    }

    if (choice === "accept" || choice === "accept_all") {
      accepted.push(conflict);
      if (choice === "accept_all") acceptAll = true;
    } else {
      skipped.push(conflict);
      if (choice === "skip_all") skipAll = true;
    }
  }

  return { accepted, skipped };
}
