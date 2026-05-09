import type { GitHookArtifact } from "../hook-artifact.js";

export const JAVA_HOOKS: GitHookArtifact[] = [
  {
    bucket: "git",
    name: "google-java-format",
    description: "Java formatter (Google style)",
    version: "1",
    managed_by: "codi",
    required: false,
    default: true,
    category: "format",
    language: "java",
    files: "**/*.java",
    stages: ["pre-commit"],
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
    bucket: "git",
    name: "checkstyle",
    description: "Java style and lint checker",
    version: "1",
    managed_by: "codi",
    required: true,
    default: true,
    category: "lint",
    language: "java",
    files: "**/*.java",
    stages: ["pre-commit"],
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
