import type { BuiltinPresetDefinition } from './types.js';

export const preset: BuiltinPresetDefinition = {
  name: 'python-web',
  description: 'Python web development with Django/FastAPI conventions, security, and testing',
  version: '1.0.0',
  extends: 'balanced',
  author: 'codi',
  tags: ['python', 'web', 'django', 'fastapi', 'api'],
  compatibility: {
    codi: '>=0.3.0',
    agents: ['claude-code', 'cursor', 'windsurf', 'codex', 'cline'],
  },
  flags: {
    type_checking: { mode: 'enforced', value: 'strict' },
    security_scan: { mode: 'enforced', value: true },
    require_tests: { mode: 'enabled', value: true },
    max_file_lines: { mode: 'enabled', value: 500 },
  },
  rules: ['python', 'security', 'api-design', 'testing', 'error-handling'],
  skills: ['code-review', 'security-scan', 'e2e-testing'],
  agents: ['code-reviewer', 'security-analyzer', 'test-generator'],
  commands: [],
};
