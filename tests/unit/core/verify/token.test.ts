import { describe, it, expect } from 'vitest';
import { buildVerificationData } from '../../../../src/core/verify/token.js';
import { createMockConfig } from '../../adapters/mock-config.js';

describe('buildVerificationData', () => {
  it('returns token in codi-XXXXXX format', () => {
    const config = createMockConfig();
    const data = buildVerificationData(config);
    expect(data.token).toMatch(/^codi-[a-f0-9]{6}$/);
  });

  it('returns deterministic output for same config', () => {
    const config = createMockConfig();
    const a = buildVerificationData(config);
    const b = buildVerificationData(config);
    expect(a.token).toBe(b.token);
    expect(a.ruleNames).toEqual(b.ruleNames);
    expect(a.activeFlags).toEqual(b.activeFlags);
  });

  it('collects rule names from config', () => {
    const config = createMockConfig();
    const data = buildVerificationData(config);
    expect(data.ruleNames).toEqual(['Code Style', 'Testing']);
  });

  it('collects active flags from config', () => {
    const config = createMockConfig();
    const data = buildVerificationData(config);
    expect(data.activeFlags).toContain('Do NOT execute shell commands.');
    expect(data.activeFlags).toContain('Do NOT delete files.');
    expect(data.activeFlags).toContain('Keep files under 500 lines.');
    expect(data.activeFlags).toContain('Write tests for all new code.');
  });

  it('changes token when rules change', () => {
    const config1 = createMockConfig();
    const config2 = createMockConfig({
      rules: [
        {
          name: 'Different Rule',
          description: 'A different rule',
          content: 'Something different.',
          priority: 'high',
          alwaysApply: true,
          managedBy: 'codi',
        },
      ],
    });
    const t1 = buildVerificationData(config1).token;
    const t2 = buildVerificationData(config2).token;
    expect(t1).not.toBe(t2);
  });

  it('changes token when agents change', () => {
    const config1 = createMockConfig();
    const config2 = createMockConfig({
      manifest: { name: 'test-project', version: '1', agents: ['cursor'] },
    });
    const t1 = buildVerificationData(config1).token;
    const t2 = buildVerificationData(config2).token;
    expect(t1).not.toBe(t2);
  });

  it('returns empty flags when no flags are active', () => {
    const config = createMockConfig({ flags: {} });
    const data = buildVerificationData(config);
    expect(data.activeFlags).toEqual([]);
  });
});
