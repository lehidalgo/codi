import type { HookSpec } from "../hook-spec.js";

export const CPP_HOOKS: HookSpec[] = [
  {
    name: "clang-format",
    language: "cpp",
    category: "format",
    files: "**/*.{cpp,hpp,cc,h}",
    stages: ["pre-commit"],
    required: false,
    shell: {
      command: "clang-format -i",
      passFiles: true,
      modifiesFiles: true,
      toolBinary: "clang-format",
    },
    preCommit: {
      kind: "local",
      entry: "clang-format -i",
      language: "system",
    },
    installHint: { command: "brew install clang-format" },
  },
  {
    name: "clang-tidy",
    language: "cpp",
    category: "lint",
    files: "**/*.{cpp,cc}",
    stages: ["pre-commit"],
    required: true,
    shell: {
      command: "clang-tidy",
      passFiles: true,
      modifiesFiles: false,
      toolBinary: "clang-tidy",
    },
    preCommit: {
      kind: "local",
      entry: "clang-tidy",
      language: "system",
    },
    installHint: { command: "brew install llvm  # provides clang-tidy" },
  },
];
