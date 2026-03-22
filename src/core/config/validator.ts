import type { NormalizedConfig } from '../../types/config.js';
import type { CodiError } from '../output/types.js';
import { createError } from '../output/errors.js';
import { getAllAdapters } from '../generator/adapter-registry.js';

const FALLBACK_ADAPTERS = ['claude-code', 'cursor', 'windsurf', 'codex', 'cline'];

function getKnownAdapterIds(): string[] {
  const registered = getAllAdapters().map((a) => a.id);
  return registered.length > 0 ? registered : FALLBACK_ADAPTERS;
}

export function validateConfig(config: NormalizedConfig): CodiError[] {
  const errors: CodiError[] = [];

  errors.push(...validateAgents(config));
  errors.push(...validateRules(config));
  errors.push(...validateFlags(config));

  return errors;
}

function validateAgents(config: NormalizedConfig): CodiError[] {
  const errors: CodiError[] = [];
  const agentIds = config.manifest.agents ?? [];

  for (const agentId of agentIds) {
    const known = getKnownAdapterIds();
    if (!known.includes(agentId)) {
      errors.push(createError('E_AGENT_NOT_FOUND', {
        agent: agentId,
        available: known.join(', '),
      }));
    }
  }

  return errors;
}

function validateRules(config: NormalizedConfig): CodiError[] {
  const errors: CodiError[] = [];
  const names = new Set<string>();

  for (const rule of config.rules) {
    if (names.has(rule.name)) {
      errors.push(createError('E_CONFIG_INVALID', {
        message: `Duplicate rule name: "${rule.name}"`,
      }));
    }
    names.add(rule.name);

    if (!rule.content.trim()) {
      errors.push(createError('E_CONFIG_INVALID', {
        message: `Rule "${rule.name}" has empty content`,
      }));
    }
  }

  return errors;
}

function validateFlags(config: NormalizedConfig): CodiError[] {
  const errors: CodiError[] = [];

  for (const [key, flag] of Object.entries(config.flags)) {
    if (flag.mode === 'enforced' && flag.value === undefined) {
      errors.push(createError('E_CONFIG_INVALID', {
        message: `Flag "${key}" is enforced but has no value`,
      }));
    }
  }

  return errors;
}
