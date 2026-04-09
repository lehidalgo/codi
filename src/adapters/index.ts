import { registerAdapter } from "../core/generator/adapter-registry.js";
import { claudeCodeAdapter } from "./claude-code.js";
import { cursorAdapter } from "./cursor.js";
import { codexAdapter } from "./codex.js";
import { windsurfAdapter } from "./windsurf.js";
import { clineAdapter } from "./cline.js";
import type { AgentAdapter } from "../types/agent.js";

export { claudeCodeAdapter } from "./claude-code.js";
export { cursorAdapter } from "./cursor.js";
export { codexAdapter } from "./codex.js";
export { windsurfAdapter } from "./windsurf.js";
export { clineAdapter } from "./cline.js";

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
 * // ["claude-code", "cursor", "codex", "windsurf", "cline"]
 * ```
 */
export const ALL_ADAPTERS: AgentAdapter[] = [
  claudeCodeAdapter,
  cursorAdapter,
  codexAdapter,
  windsurfAdapter,
  clineAdapter,
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
