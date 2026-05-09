import type { GitHookArtifact } from "../hook-artifact.js";

export const CPP_HOOKS: GitHookArtifact[] = [
  {
    bucket: "git",
    name: "clang-format",
    description: "C/C++ formatter (clang-format)",
    version: "1",
    managed_by: "codi",
    required: false,
    default: true,
    category: "format",
    language: "cpp",
    files: "**/*.{cpp,hpp,cc,h}",
    stages: ["pre-commit"],
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
    bucket: "git",
    name: "clang-tidy",
    description: "C/C++ linter (clang-tidy)",
    version: "1",
    managed_by: "codi",
    required: true,
    default: true,
    category: "lint",
    language: "cpp",
    files: "**/*.{cpp,cc}",
    stages: ["pre-commit"],
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
