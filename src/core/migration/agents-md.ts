/**
 * Thin wrapper for AGENTS.md migration — see `migration-md-shared.ts` for
 * the shared parser implementation.
 */

import type { Result } from "#src/types/result.js";
import { importInstructionMarkdown, type MigrationResult } from "./migration-md-shared.js";

export type { MigrationResult } from "./migration-md-shared.js";

export async function importAgentsMd(projectRoot: string): Promise<Result<MigrationResult>> {
  return importInstructionMarkdown(projectRoot, "AGENTS.md");
}
