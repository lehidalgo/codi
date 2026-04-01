import path from "node:path";
import { ok, err } from "../../types/result.js";
import type { Result } from "../../types/result.js";
import type { NormalizedConfig } from "../../types/config.js";
import { resolveProjectDir } from "../../utils/paths.js";
import { scanProjectDir } from "./parser.js";
import { flagsFromDefinitions } from "./composer.js";
import { validateConfig } from "./validator.js";
import { FLAGS_FILENAME } from "#src/constants.js";

/**
 * Resolves the full project configuration by reading .codi/ as the single source of truth.
 * All artifacts (rules, skills, agents, commands), flags, and MCP configs come from .codi/.
 * Presets are consumed at install time — they are not loaded during config resolution.
 */
export async function resolveConfig(
  projectRoot: string,
): Promise<Result<NormalizedConfig>> {
  const configDir = resolveProjectDir(projectRoot);
  const scanResult = await scanProjectDir(projectRoot);
  if (!scanResult.ok) return scanResult;

  const parsed = scanResult.data;
  const config: NormalizedConfig = {
    manifest: parsed.manifest,
    rules: parsed.rules,
    skills: parsed.skills,
    commands: parsed.commands,
    agents: parsed.agents,
    flags: flagsFromDefinitions(
      parsed.flags,
      path.join(configDir, FLAGS_FILENAME),
    ),
    mcp: parsed.mcp,
  };

  const validationErrors = validateConfig(config);
  if (validationErrors.length > 0) {
    return err(validationErrors);
  }

  return ok(config);
}
