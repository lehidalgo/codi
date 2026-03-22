import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { StateManager } from '../../../src/core/config/state.js';
import type { StateData, GeneratedFileState } from '../../../src/core/config/state.js';
import { hashContent } from '../../../src/utils/hash.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codi-state-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('StateManager', () => {
  it('returns empty state when state.json does not exist', async () => {
    const mgr = new StateManager(tmpDir);
    const result = await mgr.read();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.version).toBe('1');
    expect(result.data.agents).toEqual({});
  });

  it('writes and reads state', async () => {
    const mgr = new StateManager(tmpDir);
    const state: StateData = {
      version: '1',
      lastGenerated: '2026-01-01T00:00:00.000Z',
      agents: {
        'claude-code': [
          {
            path: '/project/.claude/rules',
            sourceHash: 'abc',
            generatedHash: 'def',
            sources: ['rule1.md'],
            timestamp: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
    };

    const writeResult = await mgr.write(state);
    expect(writeResult.ok).toBe(true);

    const readResult = await mgr.read();
    expect(readResult.ok).toBe(true);
    if (!readResult.ok) return;
    expect(readResult.data.agents['claude-code']).toHaveLength(1);
  });

  it('updateAgent adds files for an agent', async () => {
    const mgr = new StateManager(tmpDir);
    const files: GeneratedFileState[] = [
      {
        path: '/project/.cursor/rules',
        sourceHash: 'aaa',
        generatedHash: 'bbb',
        sources: ['rule1.md'],
        timestamp: new Date().toISOString(),
      },
    ];

    await mgr.updateAgent('cursor', files);
    const result = await mgr.getAgentFiles('cursor');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.path).toBe('/project/.cursor/rules');
  });

  it('getAgentFiles returns empty for unknown agent', async () => {
    const mgr = new StateManager(tmpDir);
    const result = await mgr.getAgentFiles('nonexistent');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([]);
  });

  it('detectDrift detects synced files', async () => {
    const content = 'file content here';
    const genHash = hashContent(content);

    const filePath = path.join(tmpDir, 'generated-file.md');
    await fs.writeFile(filePath, content, 'utf8');

    const mgr = new StateManager(tmpDir);
    await mgr.updateAgent('claude-code', [
      {
        path: filePath,
        sourceHash: 'src',
        generatedHash: genHash,
        sources: ['source.md'],
        timestamp: new Date().toISOString(),
      },
    ]);

    const driftResult = await mgr.detectDrift('claude-code');
    expect(driftResult.ok).toBe(true);
    if (!driftResult.ok) return;
    expect(driftResult.data.files[0]!.status).toBe('synced');
  });

  it('detectDrift detects drifted files', async () => {
    const filePath = path.join(tmpDir, 'drifted-file.md');
    await fs.writeFile(filePath, 'modified content', 'utf8');

    const mgr = new StateManager(tmpDir);
    await mgr.updateAgent('claude-code', [
      {
        path: filePath,
        sourceHash: 'src',
        generatedHash: 'original-hash',
        sources: ['source.md'],
        timestamp: new Date().toISOString(),
      },
    ]);

    const driftResult = await mgr.detectDrift('claude-code');
    expect(driftResult.ok).toBe(true);
    if (!driftResult.ok) return;
    expect(driftResult.data.files[0]!.status).toBe('drifted');
  });

  it('detectDrift detects missing files', async () => {
    const mgr = new StateManager(tmpDir);
    await mgr.updateAgent('claude-code', [
      {
        path: '/nonexistent/file.md',
        sourceHash: 'src',
        generatedHash: 'hash',
        sources: ['source.md'],
        timestamp: new Date().toISOString(),
      },
    ]);

    const driftResult = await mgr.detectDrift('claude-code');
    expect(driftResult.ok).toBe(true);
    if (!driftResult.ok) return;
    expect(driftResult.data.files[0]!.status).toBe('missing');
  });
});
