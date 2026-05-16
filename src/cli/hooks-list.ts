/**
 * `codi hooks list` — print all known hooks across both buckets.
 *
 * Listing reads only from the static registry. The `--enabled` flag filters
 * to the project's currently-selected set (read from `.codi/state/state.json`).
 */

import type { Command } from "commander";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getAllHooks, getGitHooks, getRuntimeHooks } from "../core/hooks/registry/index.js";
import type { HookArtifact } from "../core/hooks/hook-artifact.js";
import { PROJECT_DIR } from "#src/constants.js";
import { createCommandResult } from "../core/output/formatter.js";
import { EXIT_CODES } from "../core/output/exit-codes.js";
import { initFromOptions, handleOutput, type GlobalOptions } from "./shared.js";
import type { CommandResult } from "../core/output/types.js";

export interface ListOptions {
  bucket?: "git" | "runtime";
  enabled?: boolean;
  cwd?: string;
}

function readSelectedHookNames(cwd: string): { git: string[]; runtime: string[] } | null {
  const stateFile = join(cwd, PROJECT_DIR, "state", "state.json");
  if (!existsSync(stateFile)) return null;
  try {
    const parsed = JSON.parse(readFileSync(stateFile, "utf8")) as {
      selectedHooks?: { git?: string[]; runtime?: string[] };
    };
    return {
      git: parsed.selectedHooks?.git ?? [],
      runtime: parsed.selectedHooks?.runtime ?? [],
    };
  } catch {
    return null;
  }
}

function formatRow(h: HookArtifact, enabled: Set<string>): string {
  const tag =
    h.bucket === "git" ? `[git/${(h as { language?: string }).language ?? "global"}]` : "[runtime]";
  const flags = `${h.required ? "*" : " "}${h.default ? "+" : "-"}${enabled.has(h.name) ? "✓" : " "}`;
  return `${flags} ${tag.padEnd(18)} ${h.name.padEnd(28)} ${h.description}`;
}

export function formatHooksList(opts: ListOptions): string {
  const cwd = opts.cwd ?? process.cwd();
  const selected = readSelectedHookNames(cwd);
  const enabled = new Set<string>([...(selected?.git ?? []), ...(selected?.runtime ?? [])]);
  const hooks =
    opts.bucket === "git"
      ? getGitHooks()
      : opts.bucket === "runtime"
        ? getRuntimeHooks()
        : getAllHooks();
  const filtered = opts.enabled ? hooks.filter((h) => enabled.has(h.name) || h.required) : hooks;
  const rows = filtered.map((h) => formatRow(h, enabled));
  return [
    "Flags: * required   + default-on   - default-off   ✓ currently enabled",
    "",
    ...rows,
  ].join("\n");
}

interface HooksListData {
  readonly bucket: "git" | "runtime" | "all";
  readonly enabledOnly: boolean;
  readonly text: string;
}

export function hooksListHandler(opts: ListOptions): CommandResult<HooksListData> {
  const text = formatHooksList(opts);
  const bucket = opts.bucket ?? "all";
  return createCommandResult({
    success: true,
    command: "hooks list",
    data: { bucket, enabledOnly: opts.enabled === true, text },
    exitCode: EXIT_CODES.SUCCESS,
  });
}

export function registerHooksListCommand(program: Command): void {
  program
    .command("list")
    .description("List installed hooks across both buckets")
    .option("--git", "Show only git-bucket hooks")
    .option("--runtime", "Show only runtime-bucket hooks")
    .option("--enabled", "Show only currently enabled hooks")
    .action((opts: { git?: boolean; runtime?: boolean; enabled?: boolean }) => {
      // ISSUE-074: route through handleOutput so the global -j/--json flag
      // gets a JSON envelope just like every other subcommand. Human mode
      // still prints the same table via the `text` field.
      const globalOpts = (program.parent ?? program).opts() as GlobalOptions;
      initFromOptions(globalOpts);
      const result = hooksListHandler({
        ...(opts.git ? { bucket: "git" as const } : {}),
        ...(opts.runtime ? { bucket: "runtime" as const } : {}),
        ...(opts.enabled ? { enabled: true } : {}),
      });
      handleOutput(result, globalOpts);
      if (globalOpts.json !== true) {
        process.stdout.write(result.data.text + "\n");
      }
    });
}
