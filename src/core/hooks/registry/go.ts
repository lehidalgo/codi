import type { HookSpec } from "../hook-spec.js";

export const GO_HOOKS: HookSpec[] = [
  {
    name: "golangci-lint",
    language: "go",
    category: "lint",
    files: "**/*.go",
    stages: ["pre-commit"],
    required: true,
    shell: {
      command: "golangci-lint run",
      passFiles: false,
      modifiesFiles: false,
      toolBinary: "golangci-lint",
    },
    preCommit: {
      kind: "local",
      entry: "golangci-lint run",
      language: "system",
      passFilenames: false,
    },
    installHint: {
      command: "go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest",
      url: "https://golangci-lint.run/usage/install/",
    },
  },
  {
    name: "gofmt",
    language: "go",
    category: "format",
    files: "**/*.go",
    stages: ["pre-commit"],
    required: true,
    shell: {
      command: "gofmt -w",
      passFiles: true,
      modifiesFiles: true,
      toolBinary: "gofmt",
    },
    preCommit: {
      kind: "local",
      entry: "gofmt -w",
      language: "system",
    },
    installHint: { command: "Install Go from https://go.dev (gofmt is included)" },
  },
  {
    name: "gosec",
    language: "go",
    category: "security",
    files: "**/*.go",
    stages: ["pre-commit"],
    required: true,
    shell: {
      command: "gosec",
      passFiles: false,
      modifiesFiles: false,
      toolBinary: "gosec",
    },
    preCommit: {
      kind: "local",
      entry: "gosec",
      language: "system",
      passFilenames: false,
    },
    installHint: { command: "go install github.com/securego/gosec/v2/cmd/gosec@latest" },
  },
];
