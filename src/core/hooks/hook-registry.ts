import { PROJECT_CLI, PROJECT_NAME } from "#src/constants.js";

export interface HookEntry {
  name: string;
  command: string;
  stagedFilter: string;
  /** When false, the tool uses project config (e.g. tsconfig.json) and should not receive file args. Defaults to true. */
  passFiles?: boolean;
  /** When true, the hook modifies files (formatters/fixers). Modified files are re-staged automatically after the hook runs. */
  modifiesFiles?: boolean;
  /** Language this hook belongs to (e.g. "python", "typescript"). Used for grouping in generated hook scripts. */
  language?: string;
}

const LANGUAGE_HOOKS: Record<string, HookEntry[]> = {
  typescript: [
    {
      name: "eslint",
      command: "npx eslint --fix",
      stagedFilter: "**/*.{ts,tsx,js,jsx}",
      modifiesFiles: true,
    },
    {
      name: "prettier",
      command: "npx prettier --write",
      stagedFilter: "**/*.{ts,tsx,js,jsx}",
      modifiesFiles: true,
    },
    {
      name: "tsc",
      command: "npx tsc --noEmit",
      stagedFilter: "**/*.{ts,tsx}",
      passFiles: false,
    },
  ],
  javascript: [
    {
      name: "eslint",
      command: "npx eslint --fix",
      stagedFilter: "**/*.{ts,tsx,js,jsx}",
      modifiesFiles: true,
    },
    {
      name: "prettier",
      command: "npx prettier --write",
      stagedFilter: "**/*.{ts,tsx,js,jsx}",
      modifiesFiles: true,
    },
  ],
  python: [
    {
      name: "ruff-check",
      command: "ruff check --fix",
      stagedFilter: "**/*.py",
      modifiesFiles: true,
    },
    {
      name: "ruff-format",
      command: "ruff format",
      stagedFilter: "**/*.py",
      modifiesFiles: true,
    },
    {
      name: "pyright",
      command: "npx pyright",
      stagedFilter: "**/*.py",
      passFiles: false,
    },
    {
      name: "bandit",
      command: "bandit -c pyproject.toml -r",
      stagedFilter: "**/*.py",
    },
  ],
  go: [
    {
      name: "golangci-lint",
      command: "golangci-lint run",
      stagedFilter: "**/*.go",
      passFiles: false,
    },
    {
      name: "gofmt",
      command: "gofmt -w",
      stagedFilter: "**/*.go",
      modifiesFiles: true,
    },
    {
      name: "gosec",
      command: "gosec",
      stagedFilter: "**/*.go",
      passFiles: false,
    },
  ],
  rust: [
    {
      name: "cargo-clippy",
      command: "cargo clippy",
      stagedFilter: "**/*.rs",
      passFiles: false,
    },
    {
      name: "cargo-fmt",
      command: "cargo fmt",
      stagedFilter: "**/*.rs",
      passFiles: false,
      modifiesFiles: true,
    },
  ],
  java: [
    {
      name: "google-java-format",
      command: "google-java-format --replace",
      stagedFilter: "**/*.java",
      modifiesFiles: true,
    },
    {
      name: "checkstyle",
      command: "checkstyle -c /google_checks.xml",
      stagedFilter: "**/*.java",
    },
  ],
  kotlin: [
    {
      name: "ktfmt",
      command: "ktfmt --kotlinlang-style",
      stagedFilter: "**/*.kt",
      modifiesFiles: true,
    },
    { name: "detekt", command: "detekt --input", stagedFilter: "**/*.kt" },
  ],
  swift: [
    {
      name: "swiftformat",
      command: "swiftformat",
      stagedFilter: "**/*.swift",
      modifiesFiles: true,
    },
    {
      name: "swiftlint",
      command: "swiftlint lint --strict",
      stagedFilter: "**/*.swift",
    },
  ],
  csharp: [
    {
      name: "dotnet-format",
      command: "dotnet format --include",
      stagedFilter: "**/*.cs",
      modifiesFiles: true,
    },
  ],
  cpp: [
    {
      name: "clang-format",
      command: "clang-format -i",
      stagedFilter: "**/*.{cpp,hpp,cc,h}",
      modifiesFiles: true,
    },
    {
      name: "clang-tidy",
      command: "clang-tidy",
      stagedFilter: "**/*.{cpp,cc}",
    },
  ],
  php: [
    {
      name: "php-cs-fixer",
      command: "php-cs-fixer fix",
      stagedFilter: "**/*.php",
      modifiesFiles: true,
    },
    {
      name: "phpstan",
      command: "phpstan analyse",
      stagedFilter: "**/*.php",
      passFiles: false,
    },
    {
      name: "phpcs-security",
      command: "phpcs --standard=Security",
      stagedFilter: "**/*.php",
    },
  ],
  ruby: [
    {
      name: "rubocop",
      command: "rubocop -a",
      stagedFilter: "**/*.rb",
      modifiesFiles: true,
    },
    {
      name: "brakeman",
      command: "brakeman --no-pager -q",
      stagedFilter: "**/*.rb",
      passFiles: false,
    },
  ],
  dart: [
    {
      name: "dart-format",
      command: "dart format",
      stagedFilter: "**/*.dart",
      modifiesFiles: true,
    },
    {
      name: "dart-analyze",
      command: "dart analyze",
      stagedFilter: "**/*.dart",
    },
  ],
};

const GLOBAL_HOOKS: HookEntry[] = [
  {
    name: `${PROJECT_NAME}-doctor`,
    command: `npx ${PROJECT_CLI} doctor --ci`,
    stagedFilter: "",
  },
];

export function getDoctorHook(): HookEntry {
  return GLOBAL_HOOKS[0]!;
}

export function getHooksForLanguage(language: string): HookEntry[] {
  const normalized = language.toLowerCase();
  const hooks = LANGUAGE_HOOKS[normalized] ?? [];
  return hooks.map((h) => ({ ...h, language: normalized }));
}

export function getSupportedLanguages(): string[] {
  return Object.keys(LANGUAGE_HOOKS);
}
