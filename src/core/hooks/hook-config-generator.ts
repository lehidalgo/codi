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
  commitMsgValidation: boolean;
  testBeforeCommit: boolean;
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

  const testBeforeCommit = isTestBeforeCommitEnabled(flags);
  if (testBeforeCommit) {
    const testHooks = getTestHooksForLanguages(languages);
    for (const hook of testHooks) {
      const alreadyAdded = allHooks.some((h) => h.name === hook.name);
      if (!alreadyAdded) {
        allHooks.push(hook);
      }
    }
  }

  const secretScan = isSecurityScanEnabled(flags);
  if (secretScan) {
    allHooks.push({ name: 'secret-scan', command: 'node .git/hooks/codi-secret-scan.mjs', stagedFilter: '' });
  }

  const fileSizeCheck = isFileSizeCheckEnabled(flags);
  if (fileSizeCheck) {
    allHooks.push({ name: 'file-size-check', command: 'node .git/hooks/codi-file-size-check.mjs', stagedFilter: '' });
  }

  if (hasVersionRequirement) {
    allHooks.push({ name: 'version-check', command: 'node .git/hooks/codi-version-check.mjs', stagedFilter: '' });
  }

  return {
    hooks: allHooks,
    secretScan,
    fileSizeCheck,
    maxFileLines: getMaxFileLines(flags),
    versionCheck: hasVersionRequirement,
    commitMsgValidation: true,
    testBeforeCommit,
  };
}

function isTestBeforeCommitEnabled(flags: ResolvedFlags): boolean {
  const flag = flags['test_before_commit'];
  if (!flag) return true;
  if (flag.mode === 'disabled') return false;
  return flag.value !== false;
}

function getTestHooksForLanguages(languages: string[]): HookEntry[] {
  const TEST_COMMANDS: Record<string, HookEntry> = {
    typescript: { name: 'test-ts', command: 'npm test', stagedFilter: '' },
    javascript: { name: 'test-js', command: 'npm test', stagedFilter: '' },
    python: { name: 'test-py', command: 'pytest', stagedFilter: '' },
    go: { name: 'test-go', command: 'go test ./...', stagedFilter: '' },
    rust: { name: 'test-rs', command: 'cargo test', stagedFilter: '' },
    java: { name: 'test-java', command: 'mvn test -q', stagedFilter: '' },
    kotlin: { name: 'test-kt', command: 'gradle test', stagedFilter: '' },
    swift: { name: 'test-swift', command: 'swift test', stagedFilter: '' },
    csharp: { name: 'test-cs', command: 'dotnet test', stagedFilter: '' },
    dart: { name: 'test-dart', command: 'dart test', stagedFilter: '' },
    php: { name: 'test-php', command: 'phpunit', stagedFilter: '' },
    ruby: { name: 'test-rb', command: 'bundle exec rspec', stagedFilter: '' },
  };
  const hooks: HookEntry[] = [];
  for (const lang of languages) {
    const hook = TEST_COMMANDS[lang.toLowerCase()];
    if (hook) hooks.push(hook);
  }
  return hooks;
}
