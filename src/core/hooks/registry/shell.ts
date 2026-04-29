import type { HookSpec } from "../hook-spec.js";

export const SHELL_HOOKS: HookSpec[] = [
  {
    name: "shellcheck",
    language: "shell",
    category: "lint",
    files: "**/*.sh",
    stages: ["pre-commit"],
    required: true,
    shell: {
      command: "shellcheck -S warning",
      passFiles: true,
      modifiesFiles: false,
      toolBinary: "shellcheck",
    },
    preCommit: {
      kind: "upstream",
      repo: "https://github.com/koalaman/shellcheck-precommit",
      rev: "v0.10.0",
      id: "shellcheck",
      args: ["-S", "warning"],
    },
    installHint: { command: "brew install shellcheck" },
  },
];
