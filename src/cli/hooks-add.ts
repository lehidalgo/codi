/**
 * `codi hooks add <bucket> <name>` — enable a hook in this project's state.
 *
 * Validates the hook exists in the registry and lives in the requested
 * bucket. Idempotent: re-adding an already-enabled hook is a no-op.
 */

import type { Command } from "commander";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getHook } from "../core/hooks/registry/index.js";
import { PROJECT_DIR } from "#src/constants.js";

export interface AddHookResult {
  added: boolean;
  reason?: string;
}

export function addHookToState(
  bucket: "git" | "runtime",
  name: string,
  statePath: string,
): AddHookResult {
  const hook = getHook(name);
  if (!hook) return { added: false, reason: `Unknown hook '${name}'` };
  if (hook.bucket !== bucket) {
    return {
      added: false,
      reason: `Hook '${name}' is in '${hook.bucket}' bucket, not '${bucket}'`,
    };
  }

  let state: Record<string, unknown> = {};
  if (existsSync(statePath)) {
    try {
      state = JSON.parse(readFileSync(statePath, "utf8")) as Record<string, unknown>;
    } catch {
      state = {};
    }
  }
  const selected = (state["selectedHooks"] ?? { git: [], runtime: [] }) as {
    git?: string[];
    runtime?: string[];
  };
  const list = (selected[bucket] ?? []) as string[];
  if (list.includes(name)) return { added: false, reason: "already enabled" };
  list.push(name);
  selected[bucket] = list;
  state["selectedHooks"] = selected;

  mkdirSync(dirname(statePath), { recursive: true });
  const tmp = `${statePath}.tmp.${process.pid}.${Date.now()}`;
  writeFileSync(tmp, JSON.stringify(state, null, 2), "utf8");
  renameSync(tmp, statePath);
  return { added: true };
}

export function registerHooksAddCommand(program: Command): void {
  program
    .command("add <bucket> <name>")
    .description("Enable a hook in this project (bucket = git | runtime)")
    .action((bucket: string, name: string) => {
      if (bucket !== "git" && bucket !== "runtime") {
        process.stderr.write("Bucket must be 'git' or 'runtime'.\n");
        process.exit(2);
      }
      const statePath = join(process.cwd(), PROJECT_DIR, "state", "state.json");
      const r = addHookToState(bucket, name, statePath);
      if (!r.added) {
        process.stderr.write(`No change: ${r.reason}\n`);
      } else {
        process.stdout.write(`Enabled '${name}' in ${bucket} bucket. Run 'codi generate'.\n`);
      }
    });
}
