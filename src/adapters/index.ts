import { registerAdapter } from '../core/generator/adapter-registry.js';
import { claudeCodeAdapter } from './claude-code.js';
import { cursorAdapter } from './cursor.js';
import { codexAdapter } from './codex.js';
import { windsurfAdapter } from './windsurf.js';
import { clineAdapter } from './cline.js';

export { claudeCodeAdapter } from './claude-code.js';
export { cursorAdapter } from './cursor.js';
export { codexAdapter } from './codex.js';
export { windsurfAdapter } from './windsurf.js';
export { clineAdapter } from './cline.js';

export function registerAllAdapters(): void {
  registerAdapter(claudeCodeAdapter);
  registerAdapter(cursorAdapter);
  registerAdapter(codexAdapter);
  registerAdapter(windsurfAdapter);
  registerAdapter(clineAdapter);
}
