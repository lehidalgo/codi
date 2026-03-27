import { describe, it, expect } from 'vitest';
import { buildFlagInstructions } from '../../../src/adapters/flag-instructions.js';
import type { ResolvedFlags } from '../../../src/types/flags.js';

function makeFlag(value: unknown, mode = 'enabled' as const): ResolvedFlags[string] {
  return { value, mode, source: 'test', locked: false };
}

describe('buildFlagInstructions', () => {
  it('returns empty string for default flags with no restrictions', () => {
    const flags: ResolvedFlags = {};
    expect(buildFlagInstructions(flags)).toBe('');
  });

  it('generates instruction for allow_force_push: false', () => {
    const flags: ResolvedFlags = {
      allow_force_push: makeFlag(false),
    };
    const result = buildFlagInstructions(flags);
    expect(result).toContain('Do NOT use force push');
  });

  it('generates instruction for require_pr_review: true', () => {
    const flags: ResolvedFlags = {
      require_pr_review: makeFlag(true),
    };
    const result = buildFlagInstructions(flags);
    expect(result).toContain('pull request review');
  });

  it('generates instruction for mcp_allowed_servers with values', () => {
    const flags: ResolvedFlags = {
      mcp_allowed_servers: makeFlag(['github', 'jira']),
    };
    const result = buildFlagInstructions(flags);
    expect(result).toContain('github, jira');
    expect(result).toContain('MCP servers');
  });

  it('skips mcp_allowed_servers when empty', () => {
    const flags: ResolvedFlags = {
      mcp_allowed_servers: makeFlag([]),
    };
    const result = buildFlagInstructions(flags);
    expect(result).not.toContain('MCP');
  });

  it('generates instruction for require_documentation: true', () => {
    const flags: ResolvedFlags = {
      require_documentation: makeFlag(true),
    };
    const result = buildFlagInstructions(flags);
    expect(result).toContain('documentation');
  });

  it('generates instruction for allowed_languages (non-wildcard)', () => {
    const flags: ResolvedFlags = {
      allowed_languages: makeFlag(['typescript', 'python']),
    };
    const result = buildFlagInstructions(flags);
    expect(result).toContain('typescript, python');
  });

  it('skips allowed_languages when wildcard', () => {
    const flags: ResolvedFlags = {
      allowed_languages: makeFlag(['*']),
    };
    const result = buildFlagInstructions(flags);
    expect(result).not.toContain('languages');
  });

  it('generates instruction for max_context_tokens', () => {
    const flags: ResolvedFlags = {
      max_context_tokens: makeFlag(32000),
    };
    const result = buildFlagInstructions(flags);
    expect(result).toContain('32000 tokens');
  });

  it('generates positive instruction for allow_shell_commands: true', () => {
    const flags: ResolvedFlags = {
      allow_shell_commands: makeFlag(true),
    };
    const result = buildFlagInstructions(flags);
    expect(result).toContain('Shell commands are allowed');
  });

  it('combines multiple flag instructions', () => {
    const flags: ResolvedFlags = {
      allow_shell_commands: makeFlag(false),
      allow_force_push: makeFlag(false),
      require_tests: makeFlag(true),
      require_documentation: makeFlag(true),
    };
    const result = buildFlagInstructions(flags);
    const lines = result.split('\n');
    expect(lines.length).toBe(4);
  });
});
