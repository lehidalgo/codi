import type { BuiltinPresetDefinition } from './types.js';

export const preset: BuiltinPresetDefinition = {
  name: 'typescript-fullstack',
  description: 'TypeScript fullstack development with React/Next.js, strict typing, and CI best practices',
  version: '1.0.0',
  extends: 'balanced',
  author: 'codi',
  tags: ['typescript', 'react', 'nextjs', 'fullstack', 'frontend', 'backend'],
  compatibility: {
    codi: '>=0.3.0',
    agents: ['claude-code', 'cursor', 'windsurf', 'codex', 'cline'],
  },
  flags: {
    type_checking: { mode: 'enforced', value: 'strict' },
    lint_on_save: { mode: 'enabled', value: true },
    require_tests: { mode: 'enabled', value: true },
    max_file_lines: { mode: 'enabled', value: 600 },
  },
  rules: ['typescript', 'react', 'nextjs', 'code-style', 'testing', 'architecture'],
  skills: ['code-review', 'e2e-testing', 'refactoring'],
  agents: ['code-reviewer', 'test-generator'],
  commands: [],
};
