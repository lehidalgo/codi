import { access, readFile } from "node:fs/promises";

/**
 * Returns `true` when `path` exists and is readable by the current process,
 * `false` otherwise. Never throws. Used by every adapter's `detect()` step
 * and by callers that need to gate a write on the presence of a sibling
 * file or directory.
 *
 * Consolidates the six byte-identical local copies that lived in each
 * adapter prior to CORE-006. Closes CORE-025 as a side-effect.
 */
export async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Like {@link exists} but accepts a list of candidate paths and returns
 * `true` if any of them exists. Order matters only for the short-circuit
 * — semantics are pure OR. Returns `false` for an empty list.
 */
export async function existsAny(paths: ReadonlyArray<string>): Promise<boolean> {
  for (const p of paths) {
    if (await exists(p)) return true;
  }
  return false;
}

/**
 * Read a JSON file and parse it. Returns `null` on missing file or
 * unparseable JSON — never throws. Callers that need to distinguish
 * "missing" from "malformed" should use `fs.readFile` directly.
 */
export async function readJsonIfExists<T>(path: string): Promise<T | null> {
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
