import { PROJECT_CLI, PROJECT_NAME } from "#src/constants.js";

export interface InstallHint {
  /** Single-line install command to show in the terminal (e.g. "brew install gitleaks") */
  command: string;
  /** Optional URL for extended instructions */
  url?: string;
}

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
  /** When true, the command is run via execSync with shell: true instead of execFileSync. Required for commands that use shell operators (&&, ||, 2>/dev/null). */
  shell?: boolean;
  /** Hook contract category: format | lint | type-check | security | test */
  category?: "format" | "lint" | "type-check" | "security" | "test";
  /** When true, a missing tool blocks the commit with install instructions. When false (format tools), a missing tool prints a warning and skips. */
  required?: boolean;
  /** Install instructions printed when the tool is missing */
  installHint?: InstallHint;
}

const LANGUAGE_HOOKS: Record<string, HookEntry[]> = {
  typescript: [
    {
      name: "eslint",
      command: "npx eslint --fix",
      stagedFilter: "**/*.{ts,tsx,js,jsx}",
      modifiesFiles: true,
      category: "lint",
      required: false,
      installHint: { command: "npm install -D eslint" },
    },
    {
      name: "prettier",
      command: "npx prettier --write",
      stagedFilter: "**/*.{ts,tsx,js,jsx}",
      modifiesFiles: true,
      category: "format",
      required: false,
      installHint: { command: "npm install -D prettier" },
    },
    {
      name: "tsc",
      command: "npx tsc --noEmit",
      stagedFilter: "**/*.{ts,tsx}",
      passFiles: false,
      category: "type-check",
      required: true,
      installHint: { command: "npm install -D typescript" },
    },
  ],
  javascript: [
    {
      name: "eslint",
      command: "npx eslint --fix",
      stagedFilter: "**/*.{ts,tsx,js,jsx}",
      modifiesFiles: true,
      category: "lint",
      required: false,
      installHint: { command: "npm install -D eslint" },
    },
    {
      name: "prettier",
      command: "npx prettier --write",
      stagedFilter: "**/*.{ts,tsx,js,jsx}",
      modifiesFiles: true,
      category: "format",
      required: false,
      installHint: { command: "npm install -D prettier" },
    },
  ],
  python: [
    {
      name: "ruff-check",
      command: "ruff check --fix",
      stagedFilter: "**/*.py",
      modifiesFiles: true,
      category: "lint",
      required: true,
      installHint: { command: "pip install ruff", url: "https://docs.astral.sh/ruff" },
    },
    {
      name: "ruff-format",
      command: "ruff format",
      stagedFilter: "**/*.py",
      modifiesFiles: true,
      category: "format",
      required: false,
      installHint: { command: "pip install ruff" },
    },
    {
      name: "pyright",
      command: "npx pyright",
      stagedFilter: "**/*.py",
      passFiles: false,
      category: "type-check",
      required: true,
      installHint: { command: "npm install -D pyright" },
    },
    {
      name: "bandit",
      command: "bandit -c pyproject.toml -r",
      stagedFilter: "**/*.py",
      category: "security",
      required: true,
      installHint: { command: "pip install bandit" },
    },
  ],
  go: [
    {
      name: "golangci-lint",
      command: "golangci-lint run",
      stagedFilter: "**/*.go",
      passFiles: false,
      category: "lint",
      required: true,
      installHint: {
        command: "go install github.com/golangci-lint/golangci-lint/cmd/golangci-lint@latest",
        url: "https://golangci-lint.run/usage/install/",
      },
    },
    {
      name: "gofmt",
      command: "gofmt -w",
      stagedFilter: "**/*.go",
      modifiesFiles: true,
      category: "format",
      required: true,
      installHint: { command: "Install Go from https://go.dev (gofmt is included)" },
    },
    {
      name: "gosec",
      command: "gosec",
      stagedFilter: "**/*.go",
      passFiles: false,
      category: "security",
      required: true,
      installHint: { command: "go install github.com/securego/gosec/v2/cmd/gosec@latest" },
    },
  ],
  rust: [
    {
      name: "cargo-fmt",
      command: "cargo fmt",
      stagedFilter: "**/*.rs",
      passFiles: false,
      modifiesFiles: true,
      category: "format",
      required: true,
      installHint: { command: "rustup component add rustfmt" },
    },
    {
      name: "cargo-clippy",
      command: "cargo clippy",
      stagedFilter: "**/*.rs",
      passFiles: false,
      category: "lint",
      required: true,
      installHint: { command: "rustup component add clippy" },
    },
  ],
  java: [
    {
      name: "google-java-format",
      command: "google-java-format --replace",
      stagedFilter: "**/*.java",
      modifiesFiles: true,
      category: "format",
      required: false,
      installHint: {
        command: "brew install google-java-format",
        url: "https://github.com/google/google-java-format",
      },
    },
    {
      name: "checkstyle",
      command: "checkstyle -c /google_checks.xml",
      stagedFilter: "**/*.java",
      category: "lint",
      required: true,
      installHint: { command: "brew install checkstyle" },
    },
  ],
  kotlin: [
    {
      name: "ktfmt",
      command: "ktfmt --kotlinlang-style",
      stagedFilter: "**/*.kt",
      modifiesFiles: true,
      category: "format",
      required: false,
      installHint: { command: "brew install ktfmt" },
    },
    {
      name: "detekt",
      command: "detekt --input",
      stagedFilter: "**/*.kt",
      category: "lint",
      required: true,
      installHint: { command: "brew install detekt", url: "https://detekt.dev" },
    },
  ],
  swift: [
    {
      name: "swiftformat",
      command: "swiftformat",
      stagedFilter: "**/*.swift",
      modifiesFiles: true,
      category: "format",
      required: false,
      installHint: { command: "brew install swiftformat" },
    },
    {
      name: "swiftlint",
      command: "swiftlint lint --strict",
      stagedFilter: "**/*.swift",
      category: "lint",
      required: true,
      installHint: {
        command: "brew install swiftlint",
        url: "https://github.com/realm/SwiftLint",
      },
    },
  ],
  csharp: [
    {
      name: "dotnet-format",
      command: "dotnet format --include",
      stagedFilter: "**/*.cs",
      modifiesFiles: true,
      category: "format",
      required: false,
      installHint: { command: "Install .NET SDK from https://dot.net" },
    },
    {
      name: "dotnet-build",
      command: "dotnet build --no-incremental -nologo",
      stagedFilter: "**/*.cs",
      passFiles: false,
      category: "type-check",
      required: true,
      installHint: { command: "Install .NET SDK from https://dot.net" },
    },
  ],
  cpp: [
    {
      name: "clang-format",
      command: "clang-format -i",
      stagedFilter: "**/*.{cpp,hpp,cc,h}",
      modifiesFiles: true,
      category: "format",
      required: false,
      installHint: { command: "brew install clang-format" },
    },
    {
      name: "clang-tidy",
      command: "clang-tidy",
      stagedFilter: "**/*.{cpp,cc}",
      category: "lint",
      required: true,
      installHint: { command: "brew install llvm  # provides clang-tidy" },
    },
  ],
  php: [
    {
      name: "php-cs-fixer",
      command: "php-cs-fixer fix",
      stagedFilter: "**/*.php",
      modifiesFiles: true,
      category: "format",
      required: false,
      installHint: { command: "composer global require friendsofphp/php-cs-fixer" },
    },
    {
      name: "phpstan",
      command: "phpstan analyse",
      stagedFilter: "**/*.php",
      passFiles: false,
      category: "type-check",
      required: true,
      installHint: { command: "composer global require phpstan/phpstan" },
    },
    {
      name: "phpcs-security",
      command: "phpcs --standard=Security",
      stagedFilter: "**/*.php",
      category: "security",
      required: true,
      installHint: { command: "composer global require pheromone/phpcs-security-audit" },
    },
  ],
  ruby: [
    {
      name: "rubocop",
      command: "rubocop -a",
      stagedFilter: "**/*.rb",
      modifiesFiles: true,
      category: "lint",
      required: true,
      installHint: { command: "gem install rubocop" },
    },
    {
      name: "brakeman",
      command: "brakeman --no-pager -q",
      stagedFilter: "**/*.rb",
      passFiles: false,
      category: "security",
      required: true,
      installHint: { command: "gem install brakeman" },
    },
  ],
  dart: [
    {
      name: "dart-format",
      command: "dart format",
      stagedFilter: "**/*.dart",
      modifiesFiles: true,
      category: "format",
      required: false,
      installHint: { command: "Install Dart SDK from https://dart.dev" },
    },
    {
      name: "dart-analyze",
      command: "dart analyze",
      stagedFilter: "**/*.dart",
      category: "lint",
      required: true,
      installHint: { command: "Install Dart SDK from https://dart.dev" },
    },
  ],
  shell: [
    {
      name: "shellcheck",
      command: "shellcheck -S warning",
      stagedFilter: "**/*.sh",
      category: "lint",
      required: true,
      installHint: { command: "brew install shellcheck" },
    },
  ],
};

const GLOBAL_HOOKS: HookEntry[] = [
  {
    name: "gitleaks",
    command: "gitleaks protect --staged --no-banner",
    stagedFilter: "**/*",
    passFiles: false,
    category: "security",
    required: true,
    installHint: {
      command: "brew install gitleaks",
      url: "https://github.com/gitleaks/gitleaks#installing",
    },
  },
  {
    name: `${PROJECT_NAME}-doctor`,
    command: `npx ${PROJECT_CLI} doctor --ci`,
    stagedFilter: "",
    category: "lint",
    required: false,
  },
];

export function getDoctorHook(): HookEntry {
  return GLOBAL_HOOKS.find((h) => h.name === `${PROJECT_NAME}-doctor`)!;
}

export function getGlobalHooks(): HookEntry[] {
  return [...GLOBAL_HOOKS];
}

export function getHooksForLanguage(language: string): HookEntry[] {
  const normalized = language.toLowerCase();
  const hooks = LANGUAGE_HOOKS[normalized] ?? [];
  return hooks.map((h) => ({ ...h, language: normalized }));
}

export function getSupportedLanguages(): string[] {
  return Object.keys(LANGUAGE_HOOKS);
}
