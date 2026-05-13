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

export function registerHooksListCommand(program: Command): void {
  program
    .command("list")
    .description("List installed hooks across both buckets")
    .option("--git", "Show only git-bucket hooks")
    .option("--runtime", "Show only runtime-bucket hooks")
    .option("--enabled", "Show only currently enabled hooks")
    .action((opts: { git?: boolean; runtime?: boolean; enabled?: boolean }) => {
      const out = formatHooksList({
        ...(opts.git ? { bucket: "git" as const } : {}),
        ...(opts.runtime ? { bucket: "runtime" as const } : {}),
        ...(opts.enabled ? { enabled: true } : {}),
      });
      process.stdout.write(out + "\n");
    });
}
