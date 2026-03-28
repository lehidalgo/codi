import { ok, err } from '../../types/result.js';
import type { Result } from '../../types/result.js';
import type { NormalizedConfig } from '../../types/config.js';
import type { ResolvedFlags, FlagDefinition } from '../../types/flags.js';
import type { CodiError } from '../output/types.js';
import { createError } from '../output/errors.js';

export type ConfigLayerLevel = 'org' | 'team' | 'preset' | 'repo' | 'lang' | 'framework' | 'agent' | 'user';

export interface ConfigLayer {
  level: ConfigLayerLevel;
  source: string;
  config: Partial<NormalizedConfig>;
}

interface LockedFlag {
  source: string;
  flag: string;
}

const DEFAULT_CONFIG: NormalizedConfig = {
  manifest: { name: '', version: '1' },
  rules: [],
  skills: [],
  commands: [],
  agents: [],
  flags: {},
  mcp: { servers: {} },
};

export function composeConfig(layers: ConfigLayer[]): Result<NormalizedConfig> {
  const errors: CodiError[] = [];
  const lockedFlags: LockedFlag[] = [];
  const merged: NormalizedConfig = structuredClone(DEFAULT_CONFIG);

  for (const layer of layers) {
    const cfg = layer.config;

    if (cfg.manifest) {
      merged.manifest = { ...merged.manifest, ...cfg.manifest };
    }

    if (cfg.rules) {
      merged.rules = [...merged.rules, ...cfg.rules];
    }
    if (cfg.skills) {
      merged.skills = [...merged.skills, ...cfg.skills];
    }
    if (cfg.commands) {
      merged.commands = [...merged.commands, ...cfg.commands];
    }
    if (cfg.agents) {
      merged.agents = [...merged.agents, ...cfg.agents];
    }
    if (cfg.flags) {
      const flagErrors = mergeFlags(merged.flags, cfg.flags, layer.source, lockedFlags);
      errors.push(...flagErrors);
    }

    if (cfg.mcp?.servers) {
      merged.mcp = {
        servers: { ...merged.mcp.servers, ...cfg.mcp.servers },
      };
    }
  }

  if (errors.length > 0) return err(errors);
  return ok(merged);
}

function mergeFlags(
  target: ResolvedFlags,
  incoming: ResolvedFlags,
  source: string,
  lockedFlags: LockedFlag[],
): CodiError[] {
  const errors: CodiError[] = [];

  for (const [key, flag] of Object.entries(incoming)) {
    const locked = lockedFlags.find((l) => l.flag === key);
    if (locked) {
      errors.push(createError('E_FLAG_LOCKED', { flag: key, source: locked.source }));
      continue;
    }

    target[key] = {
      value: flag.value,
      mode: flag.mode,
      source,
      locked: flag.locked,
    };

    if (flag.locked) {
      lockedFlags.push({ flag: key, source });
    }
  }

  return errors;
}

export function flagsFromDefinitions(
  defs: Record<string, FlagDefinition>,
  source: string,
): ResolvedFlags {
  const resolved: ResolvedFlags = {};
  for (const [key, def] of Object.entries(defs)) {
    resolved[key] = {
      value: def.value,
      mode: def.mode,
      source,
      locked: def.locked ?? false,
    };
  }
  return resolved;
}
