import type { GitHookArtifact } from "../hook-artifact.js";

export const SHELL_HOOKS: GitHookArtifact[] = [
  {
    bucket: "git",
    name: "shellcheck",
    description: "Shell script linter",
    version: "1",
    managed_by: "codi",
    required: true,
    default: true,
    category: "lint",
    language: "shell",
    files: "**/*.sh",
    stages: ["pre-commit"],
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
