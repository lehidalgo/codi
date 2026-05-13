import type { GitHookArtifact } from "../hook-artifact.js";
import { MANAGED_BY_FRAMEWORK } from "#src/constants.js";

export const DART_HOOKS: GitHookArtifact[] = [
  {
    bucket: "git",
    name: "dart-format",
    description: "Dart formatter",
    version: "1",
    managed_by: MANAGED_BY_FRAMEWORK,
    required: false,
    default: true,
    category: "format",
    language: "dart",
    files: "**/*.dart",
    stages: ["pre-commit"],
    shell: {
      command: "dart format",
      passFiles: true,
      modifiesFiles: true,
      toolBinary: "dart",
    },
    preCommit: {
      kind: "local",
      entry: "dart format",
      language: "system",
    },
    installHint: { command: "Install Dart SDK from https://dart.dev" },
  },
  {
    bucket: "git",
    name: "dart-analyze",
    description: "Dart static analyser",
    version: "1",
    managed_by: MANAGED_BY_FRAMEWORK,
    required: true,
    default: true,
    category: "lint",
    language: "dart",
    files: "**/*.dart",
    stages: ["pre-commit"],
    shell: {
      command: "dart analyze",
      passFiles: true,
      modifiesFiles: false,
      toolBinary: "dart",
    },
    preCommit: {
      kind: "local",
      entry: "dart analyze",
      language: "system",
    },
    installHint: { command: "Install Dart SDK from https://dart.dev" },
  },
];
