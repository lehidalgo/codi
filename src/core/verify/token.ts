import { createHash } from 'node:crypto';
import type { NormalizedConfig } from '../../types/config.js';
import { buildFlagInstructions } from '../../adapters/flag-instructions.js';

export interface VerificationData {
  token: string;
  ruleNames: string[];
  activeFlags: string[];
}

export function buildVerificationData(config: NormalizedConfig): VerificationData {
  const ruleNames = config.rules.map((r) => r.name);

  const flagText = buildFlagInstructions(config.flags);
  const activeFlags = flagText
    ? flagText.split('\n').filter((line) => line.trim().length > 0)
    : [];

  const agents = [...(config.manifest.agents ?? [])].sort();
  const raw = [
    config.manifest.name,
    agents.join(','),
    ruleNames.join(','),
    activeFlags.join(','),
  ].join('|');

  const hash = createHash('sha256').update(raw, 'utf8').digest('hex');
  const token = `codi-${hash.slice(0, 6)}`;

  return { token, ruleNames, activeFlags };
}
