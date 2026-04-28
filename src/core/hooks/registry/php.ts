import type { HookSpec } from "../hook-spec.js";

export const PHP_HOOKS: HookSpec[] = [
  {
    name: "php-cs-fixer",
    language: "php",
    category: "format",
    files: "**/*.php",
    stages: ["pre-commit"],
    required: false,
    shell: {
      command: "php-cs-fixer fix",
      passFiles: true,
      modifiesFiles: true,
      toolBinary: "php-cs-fixer",
    },
    preCommit: {
      kind: "local",
      entry: "php-cs-fixer fix",
      language: "system",
    },
    installHint: { command: "composer global require friendsofphp/php-cs-fixer" },
  },
  {
    name: "phpstan",
    language: "php",
    category: "type-check",
    files: "**/*.php",
    stages: ["pre-push"],
    required: true,
    shell: {
      command: "phpstan analyse",
      passFiles: false,
      modifiesFiles: false,
      toolBinary: "phpstan",
    },
    preCommit: {
      kind: "local",
      entry: "phpstan analyse",
      language: "system",
      passFilenames: false,
    },
    installHint: { command: "composer global require phpstan/phpstan" },
  },
  {
    name: "phpcs-security",
    language: "php",
    category: "security",
    files: "**/*.php",
    stages: ["pre-commit"],
    required: true,
    shell: {
      command: "phpcs --standard=Security",
      passFiles: true,
      modifiesFiles: false,
      toolBinary: "phpcs",
    },
    preCommit: {
      kind: "local",
      entry: "phpcs --standard=Security",
      language: "system",
    },
    installHint: { command: "composer global require pheromone/phpcs-security-audit" },
  },
];
