import { registerAdapter } from "../core/generator/adapter-registry.js";
import { claudeCodeAdapter } from "./claude-code.js";
import { cursorAdapter } from "./cursor.js";
import { codexAdapter } from "./codex.js";
import { windsurfAdapter } from "./windsurf.js";
import { clineAdapter } from "./cline.js";
import { copilotAdapter } from "./copilot.js";
import type { AgentAdapter } from "../types/agent.js";
import { SUPPORTED_PLATFORMS } from "../constants.js";

/**
 * Canonical agent id derived from `SUPPORTED_PLATFORMS` (constants.ts).
 *
 * All adapters in `ALL_ADAPTERS` must have an `id` that matches one of these
 * literals — the compile-time assertion below enforces it. Any code that
 * stores or branches on an agent id should use this union type rather than
 * a bare `string`.
 */
export type AgentId = (typeof SUPPORTED_PLATFORMS)[number];

export { claudeCodeAdapter } from "./claude-code.js";
export { cursorAdapter } from "./cursor.js";
export { codexAdapter } from "./codex.js";
export { windsurfAdapter } from "./windsurf.js";
export { clineAdapter } from "./cline.js";
export { copilotAdapter } from "./copilot.js";

/**
 * The canonical registry of all supported agent adapters.
 *
 * This array is the single source of truth for which agents Codi supports.
 * Order determines auto-detection priority: earlier entries are checked first
 * when `codi generate` scans the project for active agents.
 *
 * @example
 * ```ts
 * import { ALL_ADAPTERS } from 'codi-cli';
 * const ids = ALL_ADAPTERS.map(a => a.id);
 * // ["claude-code", "cursor", "codex", "windsurf", "cline", "copilot"]
 * ```
 */
export const ALL_ADAPTERS: AgentAdapter[] = [
  claudeCodeAdapter,
  cursorAdapter,
  codexAdapter,
  windsurfAdapter,
  clineAdapter,
  copilotAdapter,
];

/**
 * Registers all built-in adapters into the global adapter registry.
 *
 * Must be called once before any generator operations. The CLI calls this
 * automatically during startup. Library consumers must call it explicitly
 * before using `resolveConfig()` or `generate()`.
 *
 * @example
 * ```ts
 * import { registerAllAdapters } from 'codi-cli';
 * registerAllAdapters();
 * ```
 */
export function registerAllAdapters(): void {
  for (const adapter of ALL_ADAPTERS) {
    registerAdapter(adapter);
  }
}

/**
 * Compile-time guard: every adapter registered in `ALL_ADAPTERS` must declare
 * an `id` that is a member of `SUPPORTED_PLATFORMS`. If a new adapter is
 * added whose id is not in `SUPPORTED_PLATFORMS` (or vice versa), this line
 * fails type-checking and CI blocks the regression. Together with the
 * `scripts/guard-agent-identity.mjs` check, it eliminates the drift class
 * that motivated ISSUE-016.
 */
const _adapterIdsAssertion: AgentId[] = ALL_ADAPTERS.map((a) => a.id as AgentId);
void _adapterIdsAssertion;

/**
 * The output configuration roots declared by each adapter, in registration
 * order. Use this for code that needs to enumerate "where on disk does each
 * agent write its config". Note that some adapters (copilot → `.github`,
 * windsurf → `.`) share a directory with the user; consumers must filter
 * accordingly rather than treating every entry as a Codi-owned dot-dir.
 */
export const AGENT_CONFIG_ROOTS: readonly string[] = Object.freeze(
  ALL_ADAPTERS.map((a) => a.paths.configRoot),
);
