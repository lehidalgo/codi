import type { GitHookArtifact } from "../hook-artifact.js";

export const KOTLIN_HOOKS: GitHookArtifact[] = [
  {
    bucket: "git",
    name: "ktfmt",
    description: "Kotlin formatter",
    version: "1",
    managed_by: "codi",
    required: false,
    default: true,
    category: "format",
    language: "kotlin",
    files: "**/*.kt",
    stages: ["pre-commit"],
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
    bucket: "git",
    name: "detekt",
    description: "Kotlin static analyser",
    version: "1",
    managed_by: "codi",
    required: true,
    default: true,
    category: "lint",
    language: "kotlin",
    files: "**/*.kt",
    stages: ["pre-commit"],
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
