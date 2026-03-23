import { createHash } from 'node:crypto';
import type { NormalizedConfig } from '../../types/config.js';
import { buildFlagInstructions } from '../../adapters/flag-instructions.js';

export interface VerificationData {
  token: string;
  ruleNames: string[];
  skillNames: string[];
  agentNames: string[];
  activeFlags: string[];
  timestamp: string;
}

export function buildVerificationData(config: NormalizedConfig): VerificationData {
  const ruleNames = config.rules.map((r) => r.name);
  const skillNames = config.skills.map((s) => s.name);
  const agentNames = config.agents.map((a) => a.name);

  const flagText = buildFlagInstructions(config.flags);
  const activeFlags = flagText
    ? flagText.split('\n').filter((line) => line.trim().length > 0)
    : [];

  const sortedManifestAgents = [...(config.manifest.agents ?? [])].sort();
  const ruleEntries = config.rules.map((r) => `${r.name}:${r.content}`).join(',');
  const raw = [
    config.manifest.name,
    sortedManifestAgents.join(','),
    ruleEntries,
    skillNames.join(','),
    agentNames.join(','),
    activeFlags.join(','),
  ].join('|');

  const hash = createHash('sha256').update(raw, 'utf8').digest('hex');
  const token = `codi-${hash.slice(0, 12)}`;
  const timestamp = new Date().toISOString();

  return { token, ruleNames, skillNames, agentNames, activeFlags, timestamp };
}
