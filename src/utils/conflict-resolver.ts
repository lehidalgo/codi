/**
 * Conflict resolution — 5 strategy dispatch (CORE-021).
 *
 * `resolveConflicts` is a thin dispatcher that selects one of five
 * strategies based on `options` + TTY context. Each strategy is a
 * self-contained async function with a clear contract:
 *
 *   `force`        → accept all (no prompts, no merges)
 *   `keep-current` → skip all (no prompts, no merges)
 *   `union-merge`  → emit git-style markers; never prompts, never fails
 *   `non-tty`      → auto-merge non-overlapping; hard conflicts surface
 *                    via `unresolvable[]` + `nonInteractivePayload`
 *   `interactive`  → per-file prompts (accept / skip / merge / edit)
 *
 * Editor utilities (`resolveEditor`, `openInEditor`, `isCommandAvailable`,
 * the `GUI_EDITORS` set) live in `editor-utils.ts` — same module folder,
 * imported here for the `interactive` strategy.
 */

import * as p from "@clack/prompts";
import pc from "picocolors";
import {
  renderColoredDiff,
  countChanges,
  buildConflictMarkers,
  extractConflictHunks,
} from "./diff.js";
import type { Logger } from "#src/types/logger.js";
import { NULL_LOGGER } from "#src/types/logger.js";
import { openInEditor, resolveEditor } from "./editor-utils.js";

export interface ConflictEntry {
  /** Display label shown in diffs and prompts (e.g. "rules/my-rule"). */
  label: string;
  /** Absolute path to write to if accepted. */
  fullPath: string;
  currentContent: string;
  incomingContent: string;
  additions: number;
  removals: number;
  /** Set when union-merge produced git-style markers the user must resolve. */
  hasMarkers?: boolean;
}

export interface ConflictOptions {
  /** Overwrite all conflicting files without prompting. */
  force?: boolean;
  /** Skip all conflicting files without prompting (keep existing content). */
  keepCurrent?: boolean;
  /**
   * Auto-merge every conflict with git-style markers (union strategy):
   * non-overlapping hunks applied, overlapping hunks keep both sides
   * wrapped in <<<<<<< / ======= / >>>>>>> so the user can resolve in-editor.
   */
  unionMerge?: boolean;
  /**
   * Injected logger (CORE-003). Defaults to `NULL_LOGGER` — the composition
   * root (CLI handlers, generator pipeline) passes `Logger.getInstance()`
   * here. Tests can pass a capturing logger to assert on warn/info calls.
   */
  log?: Logger;
}

export interface ConflictResolution {
  /** Entries whose incoming content should be written to disk. */
  accepted: ConflictEntry[];
  /** Entries the user (or `--keep-current`) chose to leave untouched. */
  skipped: ConflictEntry[];
  /** Entries where incomingContent was replaced with user-merged content. */
  merged: ConflictEntry[];
  /**
   * CORE-007 — entries that could not be merged automatically in a
   * non-interactive environment (CI, git hooks, piped stdin). The CLI
   * caller emits {@link nonInteractivePayload} to stderr and exits with
   * {@link EXIT_CODES.UNRESOLVABLE_CONFLICTS}. Before CORE-007 this
   * condition was signalled by an in-function `process.exitCode = 2`
   * assignment that was invisible to callers and tests.
   */
  unresolvable: ConflictEntry[];
  /**
   * Structured stderr payload the CLI emits when {@link unresolvable} is
   * non-empty. Present only when the resolver detected a hard conflict
   * in a non-TTY environment. CI consumers parse this JSON line to
   * surface a usable diff to their UI.
   */
  nonInteractivePayload?: NonInteractivePayload;
}

/**
 * Machine-readable payload describing the unresolvable conflicts to a
 * non-interactive caller. Emitted by the CLI to stderr (one JSON line)
 * so CI / wrapper scripts can parse and surface a diff without
 * scraping human-readable output.
 */
export interface NonInteractivePayload {
  type: "conflicts";
  items: Array<{
    label: string;
    fullPath: string;
    currentContent: string;
    incomingContent: string;
  }>;
}

/**
 * Thrown in non-interactive environments when two sides change the same
 * lines and auto-merge cannot resolve the conflict automatically.
 * Use --on-conflict keep-incoming to accept all incoming or
 * --on-conflict keep-current to keep all current.
 */
export class UnresolvableConflictError extends Error {
  public readonly files: string[];

  constructor(files: string[]) {
    super(
      `${files.length} file(s) have unresolvable conflicts and require manual resolution.\n` +
        `Files: ${files.join(", ")}\n` +
        `Run the command interactively to resolve, or use ` +
        `--on-conflict keep-incoming to accept all incoming, or ` +
        `--on-conflict keep-current to keep all current.`,
    );
    this.name = "UnresolvableConflictError";
    this.files = files;
  }
}

/**
 * Builds a ConflictEntry from two strings, computing additions/removals
 * via jsdiff.
 */
export function makeConflictEntry(
  label: string,
  fullPath: string,
  currentContent: string,
  incomingContent: string,
): ConflictEntry {
  const { additions, removals } = countChanges(currentContent, incomingContent);
  return {
    label,
    fullPath,
    currentContent,
    incomingContent,
    additions,
    removals,
  };
}

// ─── CORE-021 — strategy union + dispatcher ──────────────────────────────────

/**
 * Discriminated union of the five resolution strategies. The kind is
 * derived from `ConflictOptions` + TTY context by {@link selectStrategy};
 * the dispatcher then invokes the matching `STRATEGIES[kind]`.
 */
type StrategyKind = "force" | "keep-current" | "union-merge" | "non-tty" | "interactive";

interface StrategyContext {
  readonly conflicts: ConflictEntry[];
  readonly log: Logger;
}

type StrategyFn = (ctx: StrategyContext) => Promise<ConflictResolution>;

function selectStrategy(opts: ConflictOptions, isTTY: boolean): StrategyKind {
  if (opts.force) return "force";
  if (opts.keepCurrent) return "keep-current";
  if (opts.unionMerge) return "union-merge";
  return isTTY ? "interactive" : "non-tty";
}

// ─── Strategy: force ─────────────────────────────────────────────────────────
const resolveForceAll: StrategyFn = async ({ conflicts }) => ({
  accepted: conflicts,
  skipped: [],
  merged: [],
  unresolvable: [],
});

// ─── Strategy: keep-current ──────────────────────────────────────────────────
const resolveKeepCurrentAll: StrategyFn = async ({ conflicts }) => ({
  accepted: [],
  skipped: conflicts,
  merged: [],
  unresolvable: [],
});

// ─── Strategy: union-merge ───────────────────────────────────────────────────
// Always succeeds. Non-overlapping hunks apply cleanly; overlapping hunks
// keep both sides wrapped in git-style markers the user resolves in-editor.
const resolveUnionMerge: StrategyFn = async ({ conflicts }) => {
  const merged: ConflictEntry[] = [];
  for (const conflict of conflicts) {
    const { content, hasConflicts } = buildConflictMarkers(
      conflict.currentContent,
      conflict.incomingContent,
    );
    // CORE-007: copy-on-write — do not mutate the input entry.
    merged.push({ ...conflict, incomingContent: content, hasMarkers: hasConflicts });
  }
  return { accepted: [], skipped: [], merged, unresolvable: [] };
};

// ─── Strategy: non-tty (CI, git hooks, piped stdin) ──────────────────────────
// Auto-merges non-overlapping changes; surfaces hard conflicts via
// `unresolvable[]` + `nonInteractivePayload` (CORE-007 contract). Never
// sets `process.exitCode` directly — the CLI caller translates to an
// exit code from the returned shape.
const resolveNonInteractive: StrategyFn = async ({ conflicts, log }) => {
  const mergedEntries: ConflictEntry[] = [];
  const unresolvable: ConflictEntry[] = [];

  for (const conflict of conflicts) {
    const { content, hasConflicts } = buildConflictMarkers(
      conflict.currentContent,
      conflict.incomingContent,
    );
    if (!hasConflicts) {
      // CORE-007: copy-on-write — do not mutate the input entry.
      mergedEntries.push({ ...conflict, incomingContent: content });
    } else {
      unresolvable.push(conflict);
    }
  }

  if (mergedEntries.length > 0) {
    log.info(`${mergedEntries.length} file(s) auto-merged in non-interactive mode`);
  }

  const resolution: ConflictResolution = {
    accepted: [],
    skipped: [],
    merged: mergedEntries,
    unresolvable,
  };
  if (unresolvable.length > 0) {
    resolution.nonInteractivePayload = {
      type: "conflicts",
      items: unresolvable.map((f) => ({
        label: f.label,
        fullPath: f.fullPath,
        currentContent: f.currentContent,
        incomingContent: f.incomingContent,
      })),
    };
  }
  return resolution;
};

// ─── Strategy: interactive (TTY) ─────────────────────────────────────────────
const resolveInteractiveLoop: StrategyFn = async ({ conflicts, log }) => {
  log.warn(`${conflicts.length} file(s) conflict with your local versions`);

  const accepted: ConflictEntry[] = [];
  const skipped: ConflictEntry[] = [];
  const merged: ConflictEntry[] = [];
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

    // Prompt loop: repeat if the user edits but leaves unresolved markers
    let resolved = false;
    while (!resolved) {
      const editorName = resolveEditor().command;
      const choice = await p.select({
        message: `What do you want to do with ${conflict.label}?`,
        options: [
          { label: "Accept incoming (overwrite local)", value: "accept" as const },
          { label: "Keep current (skip this file)", value: "skip" as const },
          {
            label: "Merge (interactive)",
            value: "interactive" as const,
            hint: "resolve each conflict hunk in terminal",
          },
          { label: "Merge in editor", value: "edit" as const, hint: `opens ${editorName}` },
          {
            label: "Merge (auto)",
            value: "auto_merge" as const,
            hint: "apply non-overlapping changes automatically",
          },
          { label: "Accept ALL incoming (overwrite all remaining)", value: "accept_all" as const },
          { label: "Keep ALL current (skip all remaining)", value: "skip_all" as const },
        ],
      });

      if (p.isCancel(choice)) {
        skipped.push(conflict);
        resolved = true;
        continue;
      }

      if (choice === "accept" || choice === "accept_all") {
        accepted.push(conflict);
        if (choice === "accept_all") acceptAll = true;
        resolved = true;
      } else if (choice === "skip" || choice === "skip_all") {
        skipped.push(conflict);
        if (choice === "skip_all") skipAll = true;
        resolved = true;
      } else if (choice === "interactive") {
        const result = await resolveInteractiveHunks(conflict);
        if (result === null) continue; // user cancelled mid-hunk; re-prompt
        // CORE-007: copy-on-write — do not mutate the input entry.
        merged.push({ ...conflict, incomingContent: result });
        resolved = true;
      } else if (choice === "edit") {
        const { content: markerContent } = buildConflictMarkers(
          conflict.currentContent,
          conflict.incomingContent,
        );
        const edited = await openInEditor(markerContent, conflict.label, log);
        if (edited === null) continue;
        if (!edited.trim()) {
          log.warn("Editor returned empty content — re-prompting.");
          continue;
        }
        if (edited.includes("<<<<<<<")) {
          log.warn(
            "Unresolved conflict markers remain — save the file after resolving all markers.",
          );
          continue;
        }
        // CORE-007: copy-on-write — do not mutate the input entry.
        merged.push({ ...conflict, incomingContent: edited });
        resolved = true;
      } else {
        // auto_merge
        const { content, hasConflicts } = buildConflictMarkers(
          conflict.currentContent,
          conflict.incomingContent,
        );
        if (!hasConflicts) {
          // CORE-007: copy-on-write — do not mutate the input entry.
          merged.push({ ...conflict, incomingContent: content });
          resolved = true;
        } else {
          p.log.info(
            "Auto-merge found overlapping changes — opening editor to resolve remaining conflicts.",
          );
          const markerDiff = renderColoredDiff(conflict.currentContent, content, conflict.label);
          p.note(markerDiff, `${conflict.label} — conflicts to resolve manually`);
          const edited = await openInEditor(content, conflict.label, log);
          if (edited === null) continue;
          if (!edited.trim()) {
            log.warn("Editor returned empty content — re-prompting.");
            continue;
          }
          if (edited.includes("<<<<<<<")) {
            log.warn(
              "Unresolved conflict markers remain — save the file after resolving all markers.",
            );
            continue;
          }
          // CORE-007: copy-on-write — do not mutate the input entry.
          merged.push({ ...conflict, incomingContent: edited });
          resolved = true;
        }
      }
    }
  }

  return { accepted, skipped, merged, unresolvable: [] };
};

/**
 * Interactively resolves each conflict hunk in the terminal via
 * p.select(). Non-overlapping changes are applied automatically. Returns
 * the merged content, or null if the user cancelled.
 */
async function resolveInteractiveHunks(conflict: ConflictEntry): Promise<string | null> {
  const hunks = extractConflictHunks(conflict.currentContent, conflict.incomingContent);
  const conflictHunks = hunks.filter((h) => h.type === "conflict");
  const total = conflictHunks.length;

  if (total === 0) {
    // All changes are non-overlapping — auto-apply
    return hunks.map((h) => h.value).join("");
  }

  const out: string[] = [];
  let conflictIndex = 0;

  for (const hunk of hunks) {
    if (hunk.type !== "conflict") {
      out.push(hunk.value);
      continue;
    }

    conflictIndex++;
    const toLines = (s: string) =>
      s.split("\n").filter((l, i, arr) => !(i === arr.length - 1 && l === ""));
    const currentSide = toLines(hunk.currentValue ?? "")
      .map((l) => pc.red(`- ${l}`))
      .join("\n");
    const incomingSide = toLines(hunk.incomingValue ?? "")
      .map((l) => pc.green(`+ ${l}`))
      .join("\n");
    const display = [currentSide, incomingSide].filter(Boolean).join("\n");

    p.note(display, `Conflict ${conflictIndex}/${total} in ${conflict.label}`);

    const choice = await p.select({
      message: "How do you want to resolve this hunk?",
      options: [
        { label: "Accept incoming", value: "incoming" as const },
        { label: "Keep current", value: "current" as const },
        { label: "Keep both (current then incoming)", value: "both" as const },
      ],
    });

    if (p.isCancel(choice)) return null;

    if (choice === "current") {
      out.push(hunk.currentValue ?? "");
    } else if (choice === "incoming") {
      out.push(hunk.incomingValue ?? "");
    } else {
      out.push((hunk.currentValue ?? "") + (hunk.incomingValue ?? ""));
    }
  }

  return out.join("");
}

/**
 * Exhaustive `Record<StrategyKind, StrategyFn>` dispatch map. Adding a
 * new strategy member without an entry here fails the build (the
 * `satisfies` clause). The map literal is the single source of truth
 * for which strategy handles which kind.
 */
const STRATEGIES: Record<StrategyKind, StrategyFn> = {
  force: resolveForceAll,
  "keep-current": resolveKeepCurrentAll,
  "union-merge": resolveUnionMerge,
  "non-tty": resolveNonInteractive,
  interactive: resolveInteractiveLoop,
} as const satisfies Record<StrategyKind, StrategyFn>;

/**
 * Resolve a list of conflicting files. Selects the strategy from
 * `options` + TTY context and delegates to the matching strategy
 * function. Empty input short-circuits to the zero resolution.
 */
export async function resolveConflicts(
  conflicts: ConflictEntry[],
  options: ConflictOptions = {},
): Promise<ConflictResolution> {
  const log = options.log ?? NULL_LOGGER;
  if (conflicts.length === 0) {
    return { accepted: [], skipped: [], merged: [], unresolvable: [] };
  }
  const kind = selectStrategy(options, process.stdout.isTTY === true);
  return STRATEGIES[kind]({ conflicts, log });
}
