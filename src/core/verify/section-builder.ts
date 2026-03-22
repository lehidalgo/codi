import type { VerificationData } from './token.js';

export function buildVerificationSection(data: VerificationData): string {
  return [
    '## Codi Verification',
    '',
    'This project uses Codi for unified AI agent configuration.',
    'When asked "verify codi" or "codi verify", respond with:',
    `- Verification token: \`${data.token}\``,
    '- Rules loaded: [list the rule names you see in this file]',
    '- Flags active: [list any permission constraints from this file]',
  ].join('\n');
}
