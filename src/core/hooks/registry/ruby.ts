import type { HookSpec } from "../hook-spec.js";

export const RUBY_HOOKS: HookSpec[] = [
  {
    name: "rubocop",
    language: "ruby",
    category: "lint",
    files: "**/*.rb",
    stages: ["pre-commit"],
    required: true,
    shell: {
      command: "rubocop -a",
      passFiles: true,
      modifiesFiles: true,
      toolBinary: "rubocop",
    },
    preCommit: {
      kind: "local",
      entry: "rubocop -a",
      language: "system",
    },
    installHint: { command: "gem install rubocop" },
  },
  {
    name: "brakeman",
    language: "ruby",
    category: "security",
    files: "**/*.rb",
    stages: ["pre-commit"],
    required: true,
    shell: {
      command: "brakeman --no-pager -q",
      passFiles: false,
      modifiesFiles: false,
      toolBinary: "brakeman",
    },
    preCommit: {
      kind: "local",
      entry: "brakeman --no-pager -q",
      language: "system",
      passFilenames: false,
    },
    installHint: { command: "gem install brakeman" },
  },
];
