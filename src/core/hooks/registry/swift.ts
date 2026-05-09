import type { GitHookArtifact } from "../hook-artifact.js";

export const SWIFT_HOOKS: GitHookArtifact[] = [
  {
    bucket: "git",
    name: "swiftformat",
    description: "Swift formatter",
    version: "1",
    managed_by: "codi",
    required: false,
    default: true,
    category: "format",
    language: "swift",
    files: "**/*.swift",
    stages: ["pre-commit"],
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
    bucket: "git",
    name: "swiftlint",
    description: "Swift linter",
    version: "1",
    managed_by: "codi",
    required: true,
    default: true,
    category: "lint",
    language: "swift",
    files: "**/*.swift",
    stages: ["pre-commit"],
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
