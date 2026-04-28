import type { HookSpec } from "../hook-spec.js";

export const RUST_HOOKS: HookSpec[] = [
  {
    name: "cargo-fmt",
    language: "rust",
    category: "format",
    files: "**/*.rs",
    stages: ["pre-commit"],
    required: true,
    shell: {
      command: "cargo fmt",
      passFiles: false,
      modifiesFiles: true,
      toolBinary: "cargo",
    },
    preCommit: {
      kind: "local",
      entry: "cargo fmt",
      language: "system",
      passFilenames: false,
    },
    installHint: { command: "rustup component add rustfmt" },
  },
  {
    name: "cargo-clippy",
    language: "rust",
    category: "lint",
    files: "**/*.rs",
    stages: ["pre-commit"],
    required: true,
    shell: {
      command: "cargo clippy",
      passFiles: false,
      modifiesFiles: false,
      toolBinary: "cargo",
    },
    preCommit: {
      kind: "local",
      entry: "cargo clippy",
      language: "system",
      passFilenames: false,
    },
    installHint: { command: "rustup component add clippy" },
  },
];
