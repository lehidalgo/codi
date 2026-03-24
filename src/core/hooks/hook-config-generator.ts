import type { ResolvedFlags } from '../../types/flags.js';
import { DEFAULT_MAX_FILE_LINES } from '../../constants.js';
import type { CodiManifest } from '../../types/config.js';
import type { HookEntry } from './hook-registry.js';
import { getHooksForLanguage, getDoctorHook } from './hook-registry.js';

export interface HooksConfig {
  hooks: HookEntry[];
  secretScan: boolean;
  fileSizeCheck: boolean;
  maxFileLines: number;
  versionCheck: boolean;
}

interface FlagHookMapping {
  flagName: string;
  hookNames: string[];
  check: (flag: { value: unknown; mode: string }) => boolean;
}

const FLAG_HOOK_MAPPINGS: FlagHookMapping[] = [
  {
    flagName: 'type_checking',
    hookNames: ['tsc', 'pyright'],
    check: (flag) => flag.value !== 'off' && flag.mode !== 'disabled',
  },
];

function isHookEnabled(
  hookName: string,
  flags: ResolvedFlags,
): boolean {
  for (const mapping of FLAG_HOOK_MAPPINGS) {
    if (mapping.hookNames.includes(hookName)) {
      const flag = flags[mapping.flagName];
      if (flag) {
        return mapping.check(flag);
      }
    }
  }
  return true;
}

function isSecurityScanEnabled(flags: ResolvedFlags): boolean {
  const flag = flags['security_scan'];
  if (!flag) return true;
  if (flag.mode === 'disabled') return false;
  return flag.value !== false;
}

function isFileSizeCheckEnabled(flags: ResolvedFlags): boolean {
  const flag = flags['max_file_lines'];
  if (!flag) return false;
  if (flag.mode === 'disabled') return false;
  return typeof flag.value === 'number' && flag.value > 0;
}

function getMaxFileLines(flags: ResolvedFlags): number {
  const flag = flags['max_file_lines'];
  if (flag && typeof flag.value === 'number') {
    return flag.value;
  }
  return DEFAULT_MAX_FILE_LINES;
}

export function generateHooksConfig(
  flags: ResolvedFlags,
  languages: string[],
  manifest?: CodiManifest,
): HooksConfig {
  const allHooks: HookEntry[] = [];

  const hasVersionRequirement = Boolean(manifest?.codi?.requiredVersion);
  if (hasVersionRequirement) {
    allHooks.push(getDoctorHook());
  }

  for (const lang of languages) {
    const langHooks = getHooksForLanguage(lang);
    for (const hook of langHooks) {
      if (isHookEnabled(hook.name, flags)) {
        const alreadyAdded = allHooks.some((h) => h.name === hook.name);
        if (!alreadyAdded) {
          allHooks.push(hook);
        }
      }
    }
  }

  return {
    hooks: allHooks,
    secretScan: isSecurityScanEnabled(flags),
    fileSizeCheck: isFileSizeCheckEnabled(flags),
    maxFileLines: getMaxFileLines(flags),
    versionCheck: hasVersionRequirement,
  };
}
