import { describe, it, expect } from 'vitest';
import { checkAgentResponse } from '../../../../src/core/verify/checker.js';
import type { VerificationData } from '../../../../src/core/verify/token.js';

const expected: VerificationData = {
  token: 'codi-a3f8b2',
  ruleNames: ['code-quality', 'security', 'testing-standards'],
  activeFlags: ['Keep source code files under 700 lines. Documentation files have no line limit.'],
};

describe('checkAgentResponse', () => {
  it('matches a valid complete response', () => {
    const response = `
Verification token: codi-a3f8b2
Rules loaded: code-quality, security, testing-standards
Flags active: Keep source code files under 700 lines. Documentation files have no line limit.
`;
    const result = checkAgentResponse(response, expected);
    expect(result.tokenMatch).toBe(true);
    expect(result.receivedToken).toBe('codi-a3f8b2');
    expect(result.rulesFound).toEqual(['code-quality', 'security', 'testing-standards']);
    expect(result.rulesMissing).toEqual([]);
    expect(result.flagsFound).toEqual(['Keep source code files under 700 lines. Documentation files have no line limit.']);
    expect(result.flagsMissing).toEqual([]);
  });

  it('detects missing token', () => {
    const response = 'Rules loaded: code-quality, security';
    const result = checkAgentResponse(response, expected);
    expect(result.tokenMatch).toBe(false);
    expect(result.receivedToken).toBeNull();
  });

  it('detects wrong token', () => {
    const response = 'Verification token: codi-000000';
    const result = checkAgentResponse(response, expected);
    expect(result.tokenMatch).toBe(false);
    expect(result.receivedToken).toBe('codi-000000');
  });

  it('detects missing rules', () => {
    const response = `
Verification token: codi-a3f8b2
Rules loaded: code-quality
Flags active: Keep source code files under 700 lines. Documentation files have no line limit.
`;
    const result = checkAgentResponse(response, expected);
    expect(result.rulesFound).toEqual(['code-quality']);
    expect(result.rulesMissing).toEqual(['security', 'testing-standards']);
  });

  it('detects extra rules', () => {
    const response = `
Rules loaded: code-quality, security, testing-standards, unknown-rule
`;
    const result = checkAgentResponse(response, expected);
    expect(result.rulesExtra).toEqual(['unknown-rule']);
  });

  it('handles bullet-list format', () => {
    const response = `
Verification token: codi-a3f8b2
Rules loaded:
- code-quality
- security
- testing-standards
Flags active:
- Keep source code files under 700 lines. Documentation files have no line limit.
`;
    const result = checkAgentResponse(response, expected);
    expect(result.rulesFound).toEqual(['code-quality', 'security', 'testing-standards']);
    expect(result.flagsFound).toEqual(['Keep source code files under 700 lines. Documentation files have no line limit.']);
  });

  it('handles fuzzy matching with backticks and formatting', () => {
    const response = `
Verification token: \`codi-a3f8b2\`
Rules loaded: \`code-quality\`, \`security\`, \`testing-standards\`
Flags active: "Keep source code files under 700 lines. Documentation files have no line limit."
`;
    const result = checkAgentResponse(response, expected);
    expect(result.tokenMatch).toBe(true);
    expect(result.rulesFound).toEqual(['code-quality', 'security', 'testing-standards']);
    expect(result.flagsFound).toEqual(['Keep source code files under 700 lines. Documentation files have no line limit.']);
  });

  it('detects missing flags', () => {
    const response = `
Verification token: codi-a3f8b2
Rules loaded: code-quality, security, testing-standards
Flags active: none
`;
    const result = checkAgentResponse(response, expected);
    expect(result.flagsMissing).toEqual(['Keep source code files under 700 lines. Documentation files have no line limit.']);
  });
});
