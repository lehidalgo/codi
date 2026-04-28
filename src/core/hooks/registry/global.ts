import { PROJECT_CLI, PROJECT_NAME } from "#src/constants.js";
import type { HookSpec } from "../hook-spec.js";

export const GLOBAL_HOOKS: HookSpec[] = [
  {
    name: "gitleaks",
    language: "global",
    category: "security",
    files: "**/*",
    stages: ["pre-commit"],
    required: true,
    shell: {
      command: "gitleaks protect --staged --no-banner",
      passFiles: false,
      modifiesFiles: false,
      toolBinary: "gitleaks",
    },
    preCommit: {
      kind: "upstream",
      repo: "https://github.com/gitleaks/gitleaks",
      rev: "v8.21.0",
      id: "gitleaks",
    },
    installHint: {
      command: "brew install gitleaks",
      url: "https://github.com/gitleaks/gitleaks#installing",
    },
  },
  {
    name: "commitlint",
    language: "global",
    category: "meta",
    files: "",
    stages: ["commit-msg"],
    required: false,
    shell: {
      command: "npx --no -- commitlint --edit",
      passFiles: false,
      modifiesFiles: false,
      toolBinary: "commitlint",
    },
    preCommit: {
      kind: "upstream",
      repo: "https://github.com/alessandrojcm/commitlint-pre-commit-hook",
      rev: "v9.23.0",
      id: "commitlint",
      additionalDependencies: ["@commitlint/config-conventional"],
    },
    installHint: {
      command: "npm install -D @commitlint/config-conventional @commitlint/cli",
    },
  },
  {
    name: `${PROJECT_NAME}-doctor`,
    language: "global",
    category: "meta",
    files: "",
    stages: ["pre-commit"],
    required: false,
    shell: {
      command: `npx ${PROJECT_CLI} doctor --ci`,
      passFiles: false,
      modifiesFiles: false,
      toolBinary: PROJECT_CLI,
    },
    preCommit: {
      kind: "local",
      entry: `npx ${PROJECT_CLI} doctor --ci`,
      language: "system",
      passFilenames: false,
    },
    installHint: { command: "" },
  },
];
