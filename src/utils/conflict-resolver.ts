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
  /** Entries where incomingContent was replaced with user-merged content. */
  merged: ConflictEntry[];
}

/**
 * Thrown in non-interactive environments when two sides change the same
 * lines and auto-merge cannot resolve the conflict automatically.
 * Use --force to accept all incoming or --json to keep all current.
 */
export class UnresolvableConflictError extends Error {
  public readonly files: string[];

  constructor(files: string[]) {
    super(
      `${files.length} file(s) have unresolvable conflicts and require manual resolution.\n` +
        `Files: ${files.join(", ")}\n` +
        `Run the command interactively to resolve, or use --force to accept all incoming, --json to keep all current.`,
    );
    this.name = "UnresolvableConflictError";
    this.files = files;
  }
}

/**
 * Resolves the editor command and arguments.
 * Priority: $VISUAL → $EDITOR → VS Code (if `code` is in PATH) → vi
 * Splits the env var on whitespace so "code --wait" works correctly with spawnSync.
 */
function resolveEditor(): { command: string; args: string[] } {
  const raw = process.env["VISUAL"] ?? process.env["EDITOR"];
  if (raw) {
    const parts = raw.trim().split(/\s+/);
    return { command: parts[0]!, args: parts.slice(1) };
  }
  // Auto-detect VS Code: check TERM_PROGRAM or if `code` CLI is in PATH
  if (
    process.env["TERM_PROGRAM"] === "vscode" ||
    !spawnSync("which", ["code"], { stdio: "ignore" }).status
  ) {
    return { command: "code", args: ["--wait"] };
  }
  return { command: "vi", args: [] };
}

const GUI_EDITORS = new Set([
  "code",
  "subl",
  "sublime",
  "atom",
  "zed",
  "webstorm",
  "idea",
  "fleet",
]);

/** Opens content in the user's editor and returns the saved result. */
async function openInEditor(content: string, label: string): Promise<string | null> {
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
        Logger.getInstance().warn(
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
        Logger.getInstance().warn(
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
 * - force: accept all without prompting
 * - json:  skip all without prompting
 * - default: interactive per-file diff with accept/skip/accept-all/skip-all
 */
export async function resolveConflicts(
  conflicts: ConflictEntry[],
  options: ConflictOptions = {},
): Promise<ConflictResolution> {
  if (conflicts.length === 0) {
    return { accepted: [], skipped: [], merged: [] };
  }

  if (options.force) {
    return { accepted: conflicts, skipped: [], merged: [] };
  }

  if (options.json) {
    return { accepted: [], skipped: conflicts, merged: [] };
  }

  // Non-TTY: CI, git hooks, watch mode — auto-accept without prompting
  if (!process.stdout.isTTY) {
    Logger.getInstance().warn(
      `Non-interactive environment detected: auto-accepting ${conflicts.length} conflict(s). Use --json to keep existing files instead.`,
    );
    return { accepted: conflicts, skipped: [], merged: [] };
  }

  const log = Logger.getInstance();
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
        conflict.incomingContent = result;
        merged.push(conflict);
        resolved = true;
      } else if (choice === "edit") {
        const { content: markerContent } = buildConflictMarkers(
          conflict.currentContent,
          conflict.incomingContent,
        );
        const edited = await openInEditor(markerContent, conflict.label);
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
        conflict.incomingContent = edited;
        merged.push(conflict);
        resolved = true;
      } else {
        // auto_merge
        const { content, hasConflicts } = buildConflictMarkers(
          conflict.currentContent,
          conflict.incomingContent,
        );
        if (!hasConflicts) {
          conflict.incomingContent = content;
          merged.push(conflict);
          resolved = true;
        } else {
          p.log.info(
            "Auto-merge found overlapping changes — opening editor to resolve remaining conflicts.",
          );
          const markerDiff = renderColoredDiff(conflict.currentContent, content, conflict.label);
          p.note(markerDiff, `${conflict.label} — conflicts to resolve manually`);
          const edited = await openInEditor(content, conflict.label);
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
          conflict.incomingContent = edited;
          merged.push(conflict);
          resolved = true;
        }
      }
    }
  }

  return { accepted, skipped, merged };
}
