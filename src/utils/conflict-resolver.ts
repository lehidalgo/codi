import * as p from "@clack/prompts";
import pc from "picocolors";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  renderColoredDiff,
  countChanges,
  buildConflictMarkers,
  extractConflictHunks,
} from "./diff.js";
import type { Logger } from "#src/types/logger.js";
import { NULL_LOGGER } from "#src/types/logger.js";

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
 * Returns true when `cmd` is found in PATH. Explicit status check avoids
 * false positives when the `which` binary itself fails to spawn (status=null).
 */
function isCommandAvailable(cmd: string): boolean {
  const result = spawnSync("which", [cmd], { stdio: "ignore" });
  return result.status === 0;
}

/**
 * Resolves the editor command and arguments.
 * Priority:
 *   1. $VISUAL / $EDITOR (explicit user override)
 *   2. Cursor, if running in a Cursor terminal and the binary is available
 *   3. VS Code, if running in a VS Code terminal and the binary is available
 *      (detected via TERM_PROGRAM, VSCODE_IPC_HOOK_CLI, or VSCODE_INJECTION —
 *      any single signal can be absent during shell-init race conditions)
 *   4. Any GUI editor that IS in PATH (code → cursor) even without env hints
 *   5. vi as last-resort fallback
 * Splits env vars on whitespace so "code --wait" works correctly with spawnSync.
 */
function resolveEditor(): { command: string; args: string[] } {
  const raw = process.env["VISUAL"] ?? process.env["EDITOR"];
  if (raw) {
    const parts = raw.trim().split(/\s+/);
    return { command: parts[0]!, args: parts.slice(1) };
  }

  const inVscode =
    process.env["TERM_PROGRAM"] === "vscode" ||
    process.env["VSCODE_IPC_HOOK_CLI"] !== undefined ||
    process.env["VSCODE_INJECTION"] !== undefined;
  const inCursor = process.env["TERM_PROGRAM"] === "cursor";
  const inJetBrains = process.env["TERMINAL_EMULATOR"] === "JetBrains-JediTerm";

  // Prefer the editor matching the current terminal
  if (inCursor && isCommandAvailable("cursor")) {
    return { command: "cursor", args: ["--wait"] };
  }
  if (inVscode && isCommandAvailable("code")) {
    return { command: "code", args: ["--wait"] };
  }
  if (inJetBrains) {
    // Try each JetBrains CLI launcher in order; take the first one in PATH.
    // We cannot tell which JetBrains IDE opened the terminal from env alone,
    // so if several are installed the user should set $EDITOR explicitly.
    const jetBrainsLaunchers = [
      "idea",
      "webstorm",
      "pycharm",
      "goland",
      "rubymine",
      "clion",
      "rider",
      "phpstorm",
      "datagrip",
      "dataspell",
      "appcode",
      "studio",
    ];
    for (const cmd of jetBrainsLaunchers) {
      if (isCommandAvailable(cmd)) {
        return { command: cmd, args: ["--wait"] };
      }
    }
  }
  // Otherwise use any known GUI editor found in PATH
  if (isCommandAvailable("code")) {
    return { command: "code", args: ["--wait"] };
  }
  if (isCommandAvailable("cursor")) {
    return { command: "cursor", args: ["--wait"] };
  }
  return { command: "vi", args: [] };
}

const GUI_EDITORS = new Set([
  // VS Code family
  "code",
  "cursor",
  "codium",
  "windsurf",
  // JetBrains family (each IDE ships its own CLI launcher)
  "idea",
  "webstorm",
  "pycharm",
  "goland",
  "rubymine",
  "clion",
  "rider",
  "phpstorm",
  "datagrip",
  "dataspell",
  "appcode",
  "studio",
  "fleet",
  // Others
  "subl",
  "sublime",
  "zed",
  "atom",
  "nova",
]);

/** Opens content in the user's editor and returns the saved result. */
async function openInEditor(
  content: string,
  label: string,
  log: Logger,
): Promise<string | null> {
  const { command, args } = resolveEditor();
  const safeName = label.replace(/[^a-z0-9._-]/gi, "-");
  const tmpFile = path.join(os.tmpdir(), `${safeName}-conflict-${Date.now()}.md`);
  const isGui = GUI_EDITORS.has(path.basename(command));

  try {
    fs.writeFileSync(tmpFile, content, "utf-8");

    if (isGui) {
      // GUI editors: spawn async + spinner so the terminal stays responsive
      const s = p.spinner();
      s.start(`Waiting for ${command} — close the editor tab to continue`);
      const exitCode = await new Promise<number | null>((resolve, reject) => {
        const child = spawn(command, [...args, tmpFile], { stdio: "ignore" });
        child.on("error", reject);
        child.on("close", resolve);
      }).catch((err: Error) => {
        s.stop(`Editor failed`);
        log.warn(
          `Could not open editor "${command}": ${err.message}. Set $EDITOR to your preferred editor.`,
        );
        return "error" as const;
      });
      if (exitCode === "error") return null;
      s.stop(`Editor closed`);
    } else {
      // Terminal editors: spawnSync takes over the terminal
      const result = spawnSync(command, [...args, tmpFile], {
        stdio: "inherit",
      });
      if (result.error) {
        log.warn(
          `Could not open editor "${command}": ${result.error.message}. Set $EDITOR to your preferred editor.`,
        );
        return null;
      }
    }

    const edited = fs.readFileSync(tmpFile, "utf-8");
    return edited;
  } finally {
    try {
      fs.unlinkSync(tmpFile);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Interactively resolves each conflict hunk in the terminal via p.select().
 * Non-overlapping changes are applied automatically.
 * Returns the merged content, or null if the user cancelled.
 */
async function resolveInteractive(conflict: ConflictEntry): Promise<string | null> {
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
 * Builds a ConflictEntry from two strings, computing additions/removals via jsdiff.
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

/**
 * Resolves a list of conflicting files via one of three modes:
 * - force:       accept all without prompting (keep-incoming)
 * - keepCurrent: skip all without prompting (keep current content)
 * - default:     interactive per-file diff with accept/skip/accept-all/skip-all
 */
export async function resolveConflicts(
  conflicts: ConflictEntry[],
  options: ConflictOptions = {},
): Promise<ConflictResolution> {
  const log = options.log ?? NULL_LOGGER;
  if (conflicts.length === 0) {
    return { accepted: [], skipped: [], merged: [], unresolvable: [] };
  }

  if (options.force) {
    return { accepted: conflicts, skipped: [], merged: [], unresolvable: [] };
  }

  if (options.keepCurrent) {
    return { accepted: [], skipped: conflicts, merged: [], unresolvable: [] };
  }

  // Union merge: non-overlapping hunks applied, overlapping hunks keep both sides
  // wrapped in git-style markers the user resolves in-editor. Never prompts, never fails.
  if (options.unionMerge) {
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
  }

  // Non-TTY: CI, git hooks, watch mode — auto-merge non-overlapping, surface
  // hard conflicts via `unresolvable[]` + `nonInteractivePayload` for the CLI
  // to translate into an exit code. Never sets `process.exitCode` directly.
  if (!process.stdout.isTTY) {
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
  }

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
          {
            label: "Accept incoming (overwrite local)",
            value: "accept" as const,
          },
          { label: "Keep current (skip this file)", value: "skip" as const },
          {
            label: "Merge (interactive)",
            value: "interactive" as const,
            hint: "resolve each conflict hunk in terminal",
          },
          {
            label: "Merge in editor",
            value: "edit" as const,
            hint: `opens ${editorName}`,
          },
          {
            label: "Merge (auto)",
            value: "auto_merge" as const,
            hint: "apply non-overlapping changes automatically",
          },
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
        const result = await resolveInteractive(conflict);
        if (result === null) {
          // User cancelled mid-hunk — re-prompt file-level choice
          continue;
        }
        // CORE-007: copy-on-write — do not mutate the input entry.
        merged.push({ ...conflict, incomingContent: result });
        resolved = true;
      } else if (choice === "edit") {
        const { content: markerContent } = buildConflictMarkers(
          conflict.currentContent,
          conflict.incomingContent,
        );
        const edited = await openInEditor(markerContent, conflict.label, log);
        if (edited === null) {
          // Editor failed — re-prompt
          continue;
        }
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
          if (edited === null) {
            continue;
          }
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
}
