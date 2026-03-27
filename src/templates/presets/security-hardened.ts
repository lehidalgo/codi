import type { BuiltinPresetDefinition } from './types.js';

export const preset: BuiltinPresetDefinition = {
  name: 'security-hardened',
  description: 'Maximum security enforcement with locked flags, mandatory scans, and restricted operations',
  version: '1.0.0',
  extends: 'strict',
  author: 'codi',
  tags: ['security', 'hardened', 'compliance', 'enterprise'],
  compatibility: {
    codi: '>=0.3.0',
    agents: ['claude-code', 'cursor', 'windsurf', 'codex', 'cline'],
  },
  flags: {
    security_scan: { mode: 'enforced', value: true, locked: true },
    type_checking: { mode: 'enforced', value: 'strict', locked: true },
    allow_shell_commands: { mode: 'enforced', value: true, locked: true },
    allow_file_deletion: { mode: 'enforced', value: false, locked: true },
    allow_force_push: { mode: 'enforced', value: false, locked: true },
    require_pr_review: { mode: 'enforced', value: true, locked: true },
    require_tests: { mode: 'enforced', value: true, locked: true },
    test_before_commit: { mode: 'enforced', value: true, locked: true },
  },
  rules: ['security', 'code-style', 'testing', 'error-handling', 'api-design'],
  skills: ['security-scan', 'code-review'],
  agents: ['security-analyzer', 'code-reviewer'],
  commands: [],
};
