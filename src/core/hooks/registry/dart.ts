import type { HookSpec } from "../hook-spec.js";

export const DART_HOOKS: HookSpec[] = [
  {
    name: "dart-format",
    language: "dart",
    category: "format",
    files: "**/*.dart",
    stages: ["pre-commit"],
    required: false,
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
    name: "dart-analyze",
    language: "dart",
    category: "lint",
    files: "**/*.dart",
    stages: ["pre-commit"],
    required: true,
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
