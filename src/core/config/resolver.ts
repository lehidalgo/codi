import path from "node:path";
import { ok, err } from "#src/types/result.js";
import type { Result } from "#src/types/result.js";
import type { NormalizedConfig } from "#src/types/config.js";
import { resolveProjectDir } from "#src/utils/paths.js";
import { scanProjectDir } from "./parser.js";
import { flagsFromDefinitions } from "./composer.js";
import { validateConfig } from "./validator.js";
import { FLAGS_FILENAME } from "#src/constants.js";

/**
 * Resolves the full project configuration by reading `.codi/` as the single source of truth.
 *
 * Reads the manifest, flags, rules, skills, agents, and MCP config from the `.codi/`
 * directory, validates them, and returns a `NormalizedConfig` ready for generation.
 * Presets are consumed at install time and are not re-read during resolution.
 *
 * @param projectRoot - Absolute path to the project root directory
 * @returns A `Result` wrapping the resolved config on success, or validation errors on failure
 *
 * @example
 * ```ts
 * import { resolveConfig, isOk } from 'codi-cli';
 *
 * const result = await resolveConfig(process.cwd());
 * if (isOk(result)) {
 *   console.log(`${result.data.rules.length} rules loaded`);
 * } else {
 *   result.errors.forEach(e => console.error(e.message));
 * }
 * ```
 */
export async function resolveConfig(projectRoot: string): Promise<Result<NormalizedConfig>> {
  const configDir = resolveProjectDir(projectRoot);
  const scanResult = await scanProjectDir(projectRoot);
  if (!scanResult.ok) return scanResult;

  const parsed = scanResult.data;
  const config: NormalizedConfig = {
    manifest: parsed.manifest,
    rules: parsed.rules,
    skills: parsed.skills,
    agents: parsed.agents,
    flags: flagsFromDefinitions(parsed.flags, path.join(configDir, FLAGS_FILENAME)),
    mcp: parsed.mcp,
  };

  const validationErrors = validateConfig(config);
  if (validationErrors.length > 0) {
    return err(validationErrors);
  }

  return ok(config);
}
