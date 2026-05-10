/**
 * `codi hooks remove <bucket> <name>` — disable a hook in this project.
 *
 * `required: true` hooks (e.g. iron-laws-enforcer) cannot be removed.
 */

import type { Command } from "commander";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getHook } from "../core/hooks/registry/index.js";

export interface RemoveHookResult {
  removed: boolean;
  reason?: string;
}

export function removeHookFromState(
  bucket: "git" | "runtime",
  name: string,
  statePath: string,
): RemoveHookResult {
  const hook = getHook(name);
  if (hook?.required) return { removed: false, reason: "required hook cannot be disabled" };
  if (!existsSync(statePath)) return { removed: false, reason: "state.json not found" };
  let state: Record<string, unknown>;
  try {
    state = JSON.parse(readFileSync(statePath, "utf8")) as Record<string, unknown>;
  } catch {
    return { removed: false, reason: "state.json malformed" };
  }
  const selected = (state["selectedHooks"] ?? { git: [], runtime: [] }) as {
    git?: string[];
    runtime?: string[];
  };
  const list = (selected[bucket] ?? []) as string[];
  const filtered = list.filter((n) => n !== name);
  if (filtered.length === list.length) return { removed: false, reason: "not enabled" };
  selected[bucket] = filtered;
  state["selectedHooks"] = selected;
  const tmp = `${statePath}.tmp.${process.pid}.${Date.now()}`;
  writeFileSync(tmp, JSON.stringify(state, null, 2), "utf8");
  renameSync(tmp, statePath);
  return { removed: true };
}

export function registerHooksRemoveCommand(program: Command): void {
  program
    .command("remove <bucket> <name>")
    .description("Disable a hook in this project (bucket = git | runtime)")
    .action((bucket: string, name: string) => {
      if (bucket !== "git" && bucket !== "runtime") {
        process.stderr.write("Bucket must be 'git' or 'runtime'.\n");
        process.exit(2);
      }
      const statePath = join(process.cwd(), ".codi", ".state", "state.json");
      const r = removeHookFromState(bucket, name, statePath);
      if (!r.removed) {
        process.stderr.write(`No change: ${r.reason}\n`);
      } else {
        process.stdout.write(`Disabled '${name}' in ${bucket} bucket. Run 'codi generate'.\n`);
      }
    });
}
