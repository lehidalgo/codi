/**
 * Per-project preferences for codi.
 *
 * Stored at `.codi/preferences.json`. Caveman is the default output mode
 * because workflow phases are short, high-frequency, and benefit from
 * compact output. The user can flip to `normal` per-project, or use the `?`
 * escape hatch to request verbose for a single turn.
 *
 * Schema is intentionally minimal. New keys are optional; missing keys take
 * the documented default. The file is gitignored alongside other .codi/
 * runtime state.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export type OutputMode = "caveman" | "normal";

export interface CodiPreferences {
  /** Output verbosity. Defaults to caveman. */
  output_mode?: OutputMode;
}

export const PREFERENCES_RELATIVE_PATH = ".codi/preferences.json";

export const DEFAULT_PREFERENCES: Required<CodiPreferences> = {
  output_mode: "caveman",
};

export function preferencesPath(cwd: string): string {
  return join(cwd, PREFERENCES_RELATIVE_PATH);
}

/**
 * Read preferences with defaults applied for any missing keys. Never throws —
 * a missing or malformed file returns the defaults.
 */
export function readPreferences(cwd: string): Required<CodiPreferences> {
  const path = preferencesPath(cwd);
  if (!existsSync(path)) return { ...DEFAULT_PREFERENCES };
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<CodiPreferences>;
    return {
      output_mode: isOutputMode(raw.output_mode)
        ? raw.output_mode
        : DEFAULT_PREFERENCES.output_mode,
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function writePreferences(cwd: string, prefs: CodiPreferences): void {
  const path = preferencesPath(cwd);
  mkdirSync(dirname(path), { recursive: true });
  // Merge with existing on disk so partial writes don't blank other keys.
  const existing = readPreferences(cwd);
  const merged: CodiPreferences = { ...existing, ...prefs };
  writeFileSync(path, JSON.stringify(merged, null, 2) + "\n", "utf8");
}

function isOutputMode(v: unknown): v is OutputMode {
  return v === "caveman" || v === "normal";
}
