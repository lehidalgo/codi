import { describe, it, expect } from 'vitest';
import { buildVerificationSection } from '../../../../src/core/verify/section-builder.js';
import type { VerificationData } from '../../../../src/core/verify/token.js';

describe('buildVerificationSection', () => {
  const data: VerificationData = {
    token: 'codi-abc123',
    ruleNames: ['code-quality', 'security'],
    activeFlags: ['Keep files under 700 lines.'],
  };

  it('contains the verification token', () => {
    const section = buildVerificationSection(data);
    expect(section).toContain('`codi-abc123`');
  });

  it('contains the Codi Verification header', () => {
    const section = buildVerificationSection(data);
    expect(section).toContain('## Codi Verification');
  });

  it('asks agent to list rules and flags', () => {
    const section = buildVerificationSection(data);
    expect(section).toContain('Rules loaded');
    expect(section).toContain('Flags active');
  });

  it('includes instruction prompt for the agent', () => {
    const section = buildVerificationSection(data);
    expect(section).toContain('verify codi');
    expect(section).toContain('codi verify');
  });
});
