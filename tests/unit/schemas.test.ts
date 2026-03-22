import { describe, it, expect } from 'vitest';
import {
  CodiManifestSchema,
  RuleFrontmatterSchema,
  SkillFrontmatterSchema,
  FlagModeSchema,
  FlagConditionsSchema,
  FlagDefinitionSchema,
  McpConfigSchema,
  HookDefinitionSchema,
  HooksConfigSchema,
} from '../../src/schemas/index.js';

describe('CodiManifestSchema', () => {
  it('accepts valid manifest', () => {
    const result = CodiManifestSchema.safeParse({
      name: 'my-project',
      version: '1',
    });
    expect(result.success).toBe(true);
  });

  it('accepts manifest with all fields', () => {
    const result = CodiManifestSchema.safeParse({
      name: 'my-project',
      version: '1',
      description: 'A test project',
      agents: ['claude', 'cursor'],
      layers: { rules: true, skills: false },
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid name with uppercase', () => {
    const result = CodiManifestSchema.safeParse({
      name: 'MyProject',
      version: '1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid version', () => {
    const result = CodiManifestSchema.safeParse({
      name: 'ok',
      version: '2',
    });
    expect(result.success).toBe(false);
  });

  it('rejects name over 64 chars', () => {
    const result = CodiManifestSchema.safeParse({
      name: 'a'.repeat(65),
      version: '1',
    });
    expect(result.success).toBe(false);
  });
});

describe('RuleFrontmatterSchema', () => {
  it('accepts valid rule with defaults', () => {
    const result = RuleFrontmatterSchema.safeParse({
      name: 'no-console',
      description: 'Avoid console.log',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('rule');
      expect(result.data.priority).toBe('medium');
      expect(result.data.alwaysApply).toBe(true);
      expect(result.data.managed_by).toBe('user');
    }
  });

  it('rejects missing description', () => {
    const result = RuleFrontmatterSchema.safeParse({
      name: 'test-rule',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid priority', () => {
    const result = RuleFrontmatterSchema.safeParse({
      name: 'test',
      description: 'test',
      priority: 'urgent',
    });
    expect(result.success).toBe(false);
  });
});

describe('SkillFrontmatterSchema', () => {
  it('accepts valid skill', () => {
    const result = SkillFrontmatterSchema.safeParse({
      name: 'code-review',
      description: 'Review code for issues',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('skill');
    }
  });

  it('accepts skill with optional fields', () => {
    const result = SkillFrontmatterSchema.safeParse({
      name: 'test-skill',
      description: 'A skill',
      compatibility: ['claude', 'cursor'],
      tools: ['read', 'write'],
      model: 'gpt-4',
    });
    expect(result.success).toBe(true);
  });
});

describe('FlagModeSchema', () => {
  it('accepts all valid modes', () => {
    const modes = ['enforced', 'enabled', 'disabled', 'inherited', 'delegated_to_agent_default', 'conditional'];
    for (const mode of modes) {
      expect(FlagModeSchema.safeParse(mode).success).toBe(true);
    }
  });

  it('rejects invalid mode', () => {
    expect(FlagModeSchema.safeParse('auto').success).toBe(false);
  });
});

describe('FlagConditionsSchema', () => {
  it('accepts conditions with at least one field', () => {
    const result = FlagConditionsSchema.safeParse({ lang: ['typescript'] });
    expect(result.success).toBe(true);
  });

  it('rejects empty conditions', () => {
    const result = FlagConditionsSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('FlagDefinitionSchema', () => {
  it('accepts basic enforced flag', () => {
    const result = FlagDefinitionSchema.safeParse({
      mode: 'enforced',
      value: true,
    });
    expect(result.success).toBe(true);
  });

  it('rejects conditional without conditions', () => {
    const result = FlagDefinitionSchema.safeParse({
      mode: 'conditional',
      value: true,
    });
    expect(result.success).toBe(false);
  });

  it('rejects enforced with conditions', () => {
    const result = FlagDefinitionSchema.safeParse({
      mode: 'enforced',
      value: true,
      conditions: { lang: ['ts'] },
    });
    expect(result.success).toBe(false);
  });

  it('accepts conditional with conditions', () => {
    const result = FlagDefinitionSchema.safeParse({
      mode: 'conditional',
      value: true,
      conditions: { agent: ['claude'] },
    });
    expect(result.success).toBe(true);
  });
});

describe('McpConfigSchema', () => {
  it('accepts empty servers with default', () => {
    const result = McpConfigSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.servers).toEqual({});
    }
  });

  it('accepts valid server config', () => {
    const result = McpConfigSchema.safeParse({
      servers: {
        'my-server': {
          command: 'node',
          args: ['server.js'],
          env: { PORT: '3000' },
        },
      },
    });
    expect(result.success).toBe(true);
  });
});

describe('HookDefinitionSchema', () => {
  it('accepts valid hook', () => {
    const result = HookDefinitionSchema.safeParse({
      name: 'lint-check',
      command: 'pnpm lint',
      condition: 'always',
    });
    expect(result.success).toBe(true);
  });

  it('rejects hook with invalid name', () => {
    const result = HookDefinitionSchema.safeParse({
      name: 'Lint Check',
      command: 'pnpm lint',
      condition: 'always',
    });
    expect(result.success).toBe(false);
  });
});

describe('HooksConfigSchema', () => {
  it('accepts valid hooks config', () => {
    const result = HooksConfigSchema.safeParse({
      version: '1',
      runner: 'codi',
      install_method: 'git-hooks',
      hooks: {
        'pre-commit': {
          lint: [{
            name: 'eslint',
            command: 'pnpm lint',
            condition: 'always',
          }],
        },
      },
    });
    expect(result.success).toBe(true);
  });
});
