import path from "node:path";
import os from "node:os";
import { PROJECT_DIR } from "../constants.js";

/**
 * Resolve the project-level Codi configuration directory (`.codi/`).
 *
 * @param projectRoot - Absolute path to the project root.
 * @returns Absolute path to `<projectRoot>/.codi/`.
 */
export function resolveProjectDir(projectRoot: string): string {
  return path.join(projectRoot, PROJECT_DIR);
}

/**
 * Resolve the user-level Codi configuration directory (`~/.codi/`).
 *
 * @returns Absolute path to `<home>/.codi/`.
 */
export function resolveUserDir(): string {
  return path.join(os.homedir(), PROJECT_DIR);
}

/**
 * Normalize a file-system path to use forward slashes regardless of platform.
 *
 * Useful when embedding paths in generated text files that must be
 * platform-independent (e.g. CLAUDE.md, rule files).
 *
 * @param p - Platform-native path string.
 * @returns Path with all separators replaced by `/`.
 */
export function normalizePath(p: string): string {
  return p.split(path.sep).join("/");
}
