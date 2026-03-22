import { describe, it, expect } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { resolveCodiDir, resolveUserDir, normalizePath } from '../../src/utils/paths.js';
import { hashContent } from '../../src/utils/hash.js';
import { parseFrontmatter } from '../../src/utils/frontmatter.js';

describe('resolveCodiDir', () => {
  it('returns .codi inside project root', () => {
    const result = resolveCodiDir('/my/project');
    expect(result).toBe(path.join('/my/project', '.codi'));
  });
});

describe('resolveUserDir', () => {
  it('returns .codi inside home directory', () => {
    const result = resolveUserDir();
    expect(result).toBe(path.join(os.homedir(), '.codi'));
  });
});

describe('normalizePath', () => {
  it('converts backslashes to forward slashes', () => {
    expect(normalizePath('a/b/c')).toBe('a/b/c');
  });
});

describe('hashContent', () => {
  it('returns consistent SHA-256 hex', () => {
    const hash1 = hashContent('hello');
    const hash2 = hashContent('hello');
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it('produces different hashes for different content', () => {
    expect(hashContent('a')).not.toBe(hashContent('b'));
  });

  it('returns hex string', () => {
    expect(hashContent('test')).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('parseFrontmatter', () => {
  it('parses YAML frontmatter', () => {
    const input = `---
name: my-rule
description: A rule
---
Rule content here`;
    const result = parseFrontmatter<{ name: string; description: string }>(input);
    expect(result.data.name).toBe('my-rule');
    expect(result.data.description).toBe('A rule');
    expect(result.content).toBe('Rule content here');
  });

  it('returns empty data for no frontmatter', () => {
    const input = 'Just some content';
    const result = parseFrontmatter<Record<string, unknown>>(input);
    expect(result.data).toEqual({});
    expect(result.content).toBe('Just some content');
  });
});
