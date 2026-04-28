import type { HookSpec } from "../hook-spec.js";

export const JAVA_HOOKS: HookSpec[] = [
  {
    name: "google-java-format",
    language: "java",
    category: "format",
    files: "**/*.java",
    stages: ["pre-commit"],
    required: false,
    shell: {
      command: "google-java-format --replace",
      passFiles: true,
      modifiesFiles: true,
      toolBinary: "google-java-format",
    },
    preCommit: {
      kind: "local",
      entry: "google-java-format --replace",
      language: "system",
    },
    installHint: {
      command: "brew install google-java-format",
      url: "https://github.com/google/google-java-format",
    },
  },
  {
    name: "checkstyle",
    language: "java",
    category: "lint",
    files: "**/*.java",
    stages: ["pre-commit"],
    required: true,
    shell: {
      command: "checkstyle -c /google_checks.xml",
      passFiles: true,
      modifiesFiles: false,
      toolBinary: "checkstyle",
    },
    preCommit: {
      kind: "local",
      entry: "checkstyle -c /google_checks.xml",
      language: "system",
    },
    installHint: { command: "brew install checkstyle" },
  },
];
