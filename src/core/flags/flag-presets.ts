import type { FlagDefinition } from '../../types/flags.js';

function flag(mode: FlagDefinition['mode'], value: unknown, locked = false): FlagDefinition {
  return locked ? { mode, value, locked } : { mode, value };
}

const MINIMAL: Record<string, FlagDefinition> = {
  auto_commit: flag('enabled', false),
  test_before_commit: flag('enabled', false),
  security_scan: flag('enabled', false),
  type_checking: flag('enabled', 'off'),
  max_file_lines: flag('enabled', 1000),
  require_tests: flag('enabled', false),
  allow_shell_commands: flag('enabled', true),
  allow_file_deletion: flag('enabled', true),
  lint_on_save: flag('enabled', false),
  allow_force_push: flag('enabled', true),
  require_pr_review: flag('enabled', false),
  mcp_allowed_servers: flag('enabled', []),
  require_documentation: flag('enabled', false),
  allowed_languages: flag('enabled', ['*']),
  max_context_tokens: flag('enabled', 100000),
  progressive_loading: flag('enabled', 'off'),
  drift_detection: flag('enabled', 'off'),
  auto_generate_on_change: flag('enabled', false),
};

const BALANCED: Record<string, FlagDefinition> = {
  auto_commit: flag('enabled', false),
  test_before_commit: flag('enabled', true),
  security_scan: flag('enabled', true),
  type_checking: flag('enabled', 'strict'),
  max_file_lines: flag('enabled', 700),
  require_tests: flag('enabled', false),
  allow_shell_commands: flag('enabled', true),
  allow_file_deletion: flag('enabled', true),
  lint_on_save: flag('enabled', true),
  allow_force_push: flag('enabled', false),
  require_pr_review: flag('enabled', true),
  mcp_allowed_servers: flag('enabled', []),
  require_documentation: flag('enabled', false),
  allowed_languages: flag('enabled', ['*']),
  max_context_tokens: flag('enabled', 50000),
  progressive_loading: flag('enabled', 'metadata'),
  drift_detection: flag('enabled', 'warn'),
  auto_generate_on_change: flag('enabled', false),
};

const STRICT: Record<string, FlagDefinition> = {
  auto_commit: flag('enabled', false),
  test_before_commit: flag('enforced', true, true),
  security_scan: flag('enforced', true, true),
  type_checking: flag('enforced', 'strict', true),
  max_file_lines: flag('enabled', 500),
  require_tests: flag('enforced', true, true),
  allow_shell_commands: flag('enabled', false),
  allow_file_deletion: flag('enabled', false),
  lint_on_save: flag('enabled', true),
  allow_force_push: flag('enforced', false, true),
  require_pr_review: flag('enforced', true, true),
  mcp_allowed_servers: flag('enabled', []),
  require_documentation: flag('enabled', true),
  allowed_languages: flag('enabled', ['*']),
  max_context_tokens: flag('enabled', 50000),
  progressive_loading: flag('enabled', 'metadata'),
  drift_detection: flag('enabled', 'error'),
  auto_generate_on_change: flag('enabled', true),
};

const PRESETS = {
  minimal: MINIMAL,
  balanced: BALANCED,
  strict: STRICT,
} as const satisfies Record<string, Record<string, FlagDefinition>>;

export type PresetName = keyof typeof PRESETS;

export function getPreset(name: PresetName): Record<string, FlagDefinition> {
  return structuredClone(PRESETS[name]);
}

export function getPresetNames(): PresetName[] {
  return Object.keys(PRESETS) as PresetName[];
}

export const PRESET_DESCRIPTIONS: Record<PresetName, string> = {
  minimal: 'Permissive — security off, no test requirements, all actions allowed',
  balanced: 'Recommended — security on, type-checking strict, no force-push',
  strict: 'Enforced — security locked, tests required, shell/delete restricted',
};
