import type { HookSpec } from "../hook-spec.js";

export const SWIFT_HOOKS: HookSpec[] = [
  {
    name: "swiftformat",
    language: "swift",
    category: "format",
    files: "**/*.swift",
    stages: ["pre-commit"],
    required: false,
    shell: {
      command: "swiftformat",
      passFiles: true,
      modifiesFiles: true,
      toolBinary: "swiftformat",
    },
    preCommit: {
      kind: "local",
      entry: "swiftformat",
      language: "system",
    },
    installHint: { command: "brew install swiftformat" },
  },
  {
    name: "swiftlint",
    language: "swift",
    category: "lint",
    files: "**/*.swift",
    stages: ["pre-commit"],
    required: true,
    shell: {
      command: "swiftlint lint --strict",
      passFiles: true,
      modifiesFiles: false,
      toolBinary: "swiftlint",
    },
    preCommit: {
      kind: "local",
      entry: "swiftlint lint --strict",
      language: "system",
    },
    installHint: {
      command: "brew install swiftlint",
      url: "https://github.com/realm/SwiftLint",
    },
  },
];
