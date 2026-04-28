import type { HookSpec } from "../hook-spec.js";

export const CSHARP_HOOKS: HookSpec[] = [
  {
    name: "dotnet-format",
    language: "csharp",
    category: "format",
    files: "**/*.cs",
    stages: ["pre-commit"],
    required: false,
    shell: {
      command: "dotnet format --include",
      passFiles: true,
      modifiesFiles: true,
      toolBinary: "dotnet",
    },
    preCommit: {
      kind: "local",
      entry: "dotnet format --include",
      language: "system",
    },
    installHint: { command: "Install .NET SDK from https://dot.net" },
  },
  {
    name: "dotnet-build",
    language: "csharp",
    category: "type-check",
    files: "**/*.cs",
    stages: ["pre-push"],
    required: true,
    shell: {
      command: "dotnet build --no-incremental -nologo",
      passFiles: false,
      modifiesFiles: false,
      toolBinary: "dotnet",
    },
    preCommit: {
      kind: "local",
      entry: "dotnet build --no-incremental -nologo",
      language: "system",
      passFilenames: false,
    },
    installHint: { command: "Install .NET SDK from https://dot.net" },
  },
];
