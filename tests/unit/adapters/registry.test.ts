import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerAdapter,
  getAdapter,
  getAllAdapters,
  detectAdapters,
  clearAdapters,
} from '../../../src/core/generator/adapter-registry.js';
import { claudeCodeAdapter } from '../../../src/adapters/claude-code.js';
import { cursorAdapter } from '../../../src/adapters/cursor.js';

describe('adapter-registry', () => {
  beforeEach(() => {
    clearAdapters();
  });

  it('registers and retrieves an adapter', () => {
    registerAdapter(claudeCodeAdapter);
    const adapter = getAdapter('claude-code');
    expect(adapter).toBeDefined();
    expect(adapter?.id).toBe('claude-code');
  });

  it('returns undefined for unknown adapter', () => {
    expect(getAdapter('nonexistent')).toBeUndefined();
  });

  it('returns all registered adapters', () => {
    registerAdapter(claudeCodeAdapter);
    registerAdapter(cursorAdapter);
    const all = getAllAdapters();
    expect(all).toHaveLength(2);
    expect(all.map(a => a.id)).toEqual(['claude-code', 'cursor']);
  });

  it('detects adapters based on project root', async () => {
    registerAdapter(claudeCodeAdapter);
    registerAdapter(cursorAdapter);
    // Neither CLAUDE.md nor .cursor exist in a temp dir
    const detected = await detectAdapters('/tmp/nonexistent-project-root');
    expect(detected).toHaveLength(0);
  });
});
