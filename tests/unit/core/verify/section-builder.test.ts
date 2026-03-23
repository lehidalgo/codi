import { describe, it, expect } from 'vitest';
import { buildVerificationSection } from '../../../../src/core/verify/section-builder.js';
import type { VerificationData } from '../../../../src/core/verify/token.js';

describe('buildVerificationSection', () => {
  const data: VerificationData = {
    token: 'codi-abc123def456',
    ruleNames: ['code-quality', 'security'],
    skillNames: ['rule-management'],
    agentNames: ['code-reviewer'],
    activeFlags: ['Keep source code files under 700 lines. Documentation files have no line limit.'],
    timestamp: '2026-03-23T20:12:30.000Z',
  };

  it('contains the verification token', () => {
    const section = buildVerificationSection(data);
    expect(section).toContain('`codi-abc123def456`');
  });

  it('contains the Codi Verification header', () => {
    const section = buildVerificationSection(data);
    expect(section).toContain('## Codi Verification');
  });

  it('lists rule names explicitly', () => {
    const section = buildVerificationSection(data);
    expect(section).toContain('- Rules: code-quality, security');
  });

  it('lists skill names explicitly', () => {
    const section = buildVerificationSection(data);
    expect(section).toContain('- Skills: rule-management');
  });

  it('lists agent names explicitly', () => {
    const section = buildVerificationSection(data);
    expect(section).toContain('- Agents: code-reviewer');
  });

  it('includes generated timestamp', () => {
    const section = buildVerificationSection(data);
    expect(section).toContain('- Generated: 2026-03-23T20:12:30.000Z');
  });

  it('includes instruction prompt for the agent', () => {
    const section = buildVerificationSection(data);
    expect(section).toContain('verify codi');
    expect(section).toContain('codi verify');
  });

  it('omits rules line when no rules', () => {
    const noRules: VerificationData = { ...data, ruleNames: [] };
    const section = buildVerificationSection(noRules);
    expect(section).not.toContain('- Rules:');
  });

  it('omits skills line when no skills', () => {
    const noSkills: VerificationData = { ...data, skillNames: [] };
    const section = buildVerificationSection(noSkills);
    expect(section).not.toContain('- Skills:');
  });

  it('omits agents line when no agents', () => {
    const noAgents: VerificationData = { ...data, agentNames: [] };
    const section = buildVerificationSection(noAgents);
    expect(section).not.toContain('- Agents:');
  });
});
