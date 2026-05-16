/**
 * Shared types for the version subsystem.
 *
 * `ExistingSelections` describes the artifact selections persisted under a
 * project's `.codi/` manifest. It is read by both:
 *   - `cli/init-wizard.ts` and friends (presentation layer) when rendering
 *     the modify/customize prompts pre-filled with current state, and
 *   - `core/version/artifact-manifest.ts` (domain layer) when computing
 *     drift between selections and the on-disk artifact manifest.
 * The type itself carries no presentation concern, so it lives in core/.
 */

export interface ExistingSelections {
  preset: string;
  rules: string[];
  skills: string[];
  agents: string[];
  mcpServers: string[];
}
