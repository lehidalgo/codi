export const EXIT_CODES = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  CONFIG_INVALID: 2,
  CONFIG_NOT_FOUND: 3,
  FLAG_CONFLICT: 4,
  GENERATION_FAILED: 5,
  MIGRATION_FAILED: 6,
  DRIFT_DETECTED: 7,
  HOOK_FAILED: 8,
  DOCTOR_FAILED: 9,
  PERMISSION_DENIED: 10,
  AGENT_NOT_FOUND: 11,
  VERIFY_MISMATCH: 12,
  PRESET_ERROR: 13,
  // CORE-007 — signals that one or more files had hunk-level overlaps the
  // resolver could not auto-merge in a non-interactive environment.
  // Numerically equal to CONFIG_INVALID (=2) to preserve the legacy CI
  // contract that callers relied on (`process.exitCode = 2` set inside
  // the resolver). Future code should use this named constant.
  UNRESOLVABLE_CONFLICTS: 2,
} as const;

export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];
