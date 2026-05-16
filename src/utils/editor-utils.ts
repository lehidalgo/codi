/**
 * Editor discovery + invocation utilities for conflict resolution
 * (CORE-021 — extracted from conflict-resolver.ts).
 *
 * Resolves the user's preferred editor command from $VISUAL / $EDITOR,
 * terminal-context env hints (Cursor / VS Code / JetBrains), and finally
 * falls back to vi. `openInEditor` spawns the chosen editor against a
 * tmp file containing the content to merge and returns the user's
 * saved buffer.
 */

import * as p from "@clack/prompts";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Logger } from "#src/types/logger.js";

/**
 * Returns true when `cmd` is found in PATH. Explicit status check avoids
 * false positives when the `which` binary itself fails to spawn
 * (status=null).
 */
export function isCommandAvailable(cmd: string): boolean {
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
 * Splits env vars on whitespace so "code --wait" works correctly with
 * spawnSync.
 */
export function resolveEditor(): { command: string; args: string[] } {
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
export async function openInEditor(
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
      /* ignore — tmp file cleanup is best-effort */
    }
  }
}
