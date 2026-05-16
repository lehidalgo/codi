import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PROJECT_DIR } from "../constants.js";

/**
 * Read the user's selection of runtime hooks from `.codi/state/state.json`.
 *
 * Returns the list when the file exists and the `selectedHooks.runtime`
 * key is present, `null` otherwise (greenfield project, no init run,
 * malformed JSON, or no `selectedHooks` key). Callers treat `null` as
 * "emit every heartbeat hook" — the default before init writes the
 * selection.
 *
 * Consolidates the duplicated reader that lived in `claude-code.ts` and
 * `codex.ts` prior to CORE-006.
 */
export function readEnabledRuntimeHookNames(
  projectRoot: string | undefined,
): string[] | null {
  if (!projectRoot) return null;
  try {
    const stateFile = join(projectRoot, PROJECT_DIR, "state", "state.json");
    if (!existsSync(stateFile)) return null;
    const parsed = JSON.parse(readFileSync(stateFile, "utf8")) as {
      selectedHooks?: { runtime?: string[] };
    };
    return parsed.selectedHooks?.runtime ?? null;
  } catch {
    return null;
  }
}

/**
 * Decide whether a heartbeat hook named `name` should be emitted given
 * the user's runtime-hook selection. `selected === null` means greenfield
 * — emit by default to preserve the pre-CORE-006 behaviour.
 */
export function isHeartbeatEnabled(
  selected: string[] | null,
  name: string,
): boolean {
  if (selected === null) return true;
  return selected.includes(name);
}
