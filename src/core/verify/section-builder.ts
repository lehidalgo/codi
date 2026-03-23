import type { VerificationData } from './token.js';

export function buildVerificationSection(data: VerificationData): string {
  const lines = [
    '## Codi Verification',
    '',
    'This project uses Codi for unified AI agent configuration.',
    `- Verification token: \`${data.token}\``,
  ];

  if (data.ruleNames.length > 0) {
    lines.push(`- Rules: ${data.ruleNames.join(', ')}`);
  }

  if (data.skillNames.length > 0) {
    lines.push(`- Skills: ${data.skillNames.join(', ')}`);
  }

  if (data.agentNames.length > 0) {
    lines.push(`- Agents: ${data.agentNames.join(', ')}`);
  }

  lines.push(`- Generated: ${data.timestamp}`);
  lines.push('');
  lines.push('When asked "verify codi" or "codi verify", respond with the verification token and confirm the rules, skills, and agents listed above.');

  return lines.join('\n');
}
