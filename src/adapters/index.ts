import { registerAdapter } from '../core/generator/adapter-registry.js';
import { claudeCodeAdapter } from './claude-code.js';
import { cursorAdapter } from './cursor.js';
import { codexAdapter } from './codex.js';
import { windsurfAdapter } from './windsurf.js';
import { clineAdapter } from './cline.js';
import type { AgentAdapter } from '../types/agent.js';

export { claudeCodeAdapter } from './claude-code.js';
export { cursorAdapter } from './cursor.js';
export { codexAdapter } from './codex.js';
export { windsurfAdapter } from './windsurf.js';
export { clineAdapter } from './cline.js';

/** All adapter instances — single source of truth for supported agents. */
export const ALL_ADAPTERS: AgentAdapter[] = [
  claudeCodeAdapter,
  cursorAdapter,
  codexAdapter,
  windsurfAdapter,
  clineAdapter,
];

export function registerAllAdapters(): void {
  for (const adapter of ALL_ADAPTERS) {
    registerAdapter(adapter);
  }
}
