import type { GitHookArtifact } from "../hook-artifact.js";
import { MANAGED_BY_FRAMEWORK } from "#src/constants.js";

export const RUST_HOOKS: GitHookArtifact[] = [
  {
    bucket: "git",
    name: "cargo-fmt",
    description: "Standard Rust formatter",
    version: "1",
    managed_by: MANAGED_BY_FRAMEWORK,
    required: true,
    default: true,
    category: "format",
    language: "rust",
    files: "**/*.rs",
    stages: ["pre-commit"],
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
    bucket: "git",
    name: "cargo-clippy",
    description: "Rust linter (clippy)",
    version: "1",
    managed_by: MANAGED_BY_FRAMEWORK,
    required: true,
    default: true,
    category: "lint",
    language: "rust",
    files: "**/*.rs",
    stages: ["pre-commit"],
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
