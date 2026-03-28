export interface HookEntry {
  name: string;
  command: string;
  stagedFilter: string;
  /** When false, the tool uses project config (e.g. tsconfig.json) and should not receive file args. Defaults to true. */
  passFiles?: boolean;
}

const LANGUAGE_HOOKS: Record<string, HookEntry[]> = {
  typescript: [
    {
      name: "eslint",
      command: "npx eslint --fix",
      stagedFilter: "**/*.{ts,tsx,js,jsx}",
    },
    {
      name: "prettier",
      command: "npx prettier --write",
      stagedFilter: "**/*.{ts,tsx,js,jsx}",
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
    },
    {
      name: "prettier",
      command: "npx prettier --write",
      stagedFilter: "**/*.{ts,tsx,js,jsx}",
    },
  ],
  python: [
    {
      name: "ruff-check",
      command: "ruff check --fix",
      stagedFilter: "**/*.py",
    },
    { name: "ruff-format", command: "ruff format", stagedFilter: "**/*.py" },
    {
      name: "pyright",
      command: "npx pyright",
      stagedFilter: "**/*.py",
      passFiles: false,
    },
  ],
  go: [
    {
      name: "golangci-lint",
      command: "golangci-lint run",
      stagedFilter: "**/*.go",
      passFiles: false,
    },
    { name: "gofmt", command: "gofmt -w", stagedFilter: "**/*.go" },
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
    },
  ],
  java: [
    {
      name: "google-java-format",
      command: "google-java-format --replace",
      stagedFilter: "**/*.java",
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
    },
    { name: "detekt", command: "detekt --input", stagedFilter: "**/*.kt" },
  ],
  swift: [
    { name: "swiftformat", command: "swiftformat", stagedFilter: "**/*.swift" },
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
    },
  ],
  cpp: [
    {
      name: "clang-format",
      command: "clang-format -i",
      stagedFilter: "**/*.{cpp,hpp,cc,h}",
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
    },
    {
      name: "phpstan",
      command: "phpstan analyse",
      stagedFilter: "**/*.php",
      passFiles: false,
    },
  ],
  ruby: [{ name: "rubocop", command: "rubocop -a", stagedFilter: "**/*.rb" }],
  dart: [
    { name: "dart-format", command: "dart format", stagedFilter: "**/*.dart" },
    {
      name: "dart-analyze",
      command: "dart analyze",
      stagedFilter: "**/*.dart",
    },
  ],
};

const GLOBAL_HOOKS: HookEntry[] = [
  { name: "codi-doctor", command: "npx codi doctor --ci", stagedFilter: "" },
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
