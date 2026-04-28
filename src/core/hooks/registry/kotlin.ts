import type { HookSpec } from "../hook-spec.js";

export const KOTLIN_HOOKS: HookSpec[] = [
  {
    name: "ktfmt",
    language: "kotlin",
    category: "format",
    files: "**/*.kt",
    stages: ["pre-commit"],
    required: false,
    shell: {
      command: "ktfmt --kotlinlang-style",
      passFiles: true,
      modifiesFiles: true,
      toolBinary: "ktfmt",
    },
    preCommit: {
      kind: "local",
      entry: "ktfmt --kotlinlang-style",
      language: "system",
    },
    installHint: { command: "brew install ktfmt" },
  },
  {
    name: "detekt",
    language: "kotlin",
    category: "lint",
    files: "**/*.kt",
    stages: ["pre-commit"],
    required: true,
    shell: {
      command: "detekt --input",
      passFiles: true,
      modifiesFiles: false,
      toolBinary: "detekt",
    },
    preCommit: {
      kind: "local",
      entry: "detekt --input",
      language: "system",
    },
    installHint: { command: "brew install detekt", url: "https://detekt.dev" },
  },
];
