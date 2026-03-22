export interface HookEntry {
  name: string;
  command: string;
  stagedFilter: string;
}

const LANGUAGE_HOOKS: Record<string, HookEntry[]> = {
  typescript: [
    { name: 'eslint', command: 'eslint --fix', stagedFilter: '**/*.{ts,tsx,js,jsx}' },
    { name: 'prettier', command: 'prettier --write', stagedFilter: '**/*.{ts,tsx,js,jsx}' },
    { name: 'tsc', command: 'tsc --noEmit', stagedFilter: '**/*.{ts,tsx}' },
  ],
  javascript: [
    { name: 'eslint', command: 'eslint --fix', stagedFilter: '**/*.{ts,tsx,js,jsx}' },
    { name: 'prettier', command: 'prettier --write', stagedFilter: '**/*.{ts,tsx,js,jsx}' },
  ],
  python: [
    { name: 'ruff-check', command: 'ruff check --fix', stagedFilter: '**/*.py' },
    { name: 'ruff-format', command: 'ruff format', stagedFilter: '**/*.py' },
    { name: 'pyright', command: 'pyright', stagedFilter: '**/*.py' },
  ],
  go: [
    { name: 'golangci-lint', command: 'golangci-lint run', stagedFilter: '**/*.go' },
    { name: 'gofmt', command: 'gofmt -w', stagedFilter: '**/*.go' },
  ],
  rust: [
    { name: 'cargo-clippy', command: 'cargo clippy', stagedFilter: '**/*.rs' },
    { name: 'cargo-fmt', command: 'cargo fmt', stagedFilter: '**/*.rs' },
  ],
};

const GLOBAL_HOOKS: HookEntry[] = [
  { name: 'codi-doctor', command: 'npx codi doctor --ci', stagedFilter: '' },
];

export function getDoctorHook(): HookEntry {
  return GLOBAL_HOOKS[0]!;
}

export function getHooksForLanguage(language: string): HookEntry[] {
  const normalized = language.toLowerCase();
  return LANGUAGE_HOOKS[normalized] ?? [];
}

export function getSupportedLanguages(): string[] {
  return Object.keys(LANGUAGE_HOOKS);
}
